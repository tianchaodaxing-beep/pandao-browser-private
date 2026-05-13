import AdmZip from 'adm-zip';
import fs from 'node:fs/promises';
import path from 'node:path';

export type ExtensionInstallSourceType = 'crx' | 'zip' | 'github' | 'manual';

export type ExtensionManifest = {
  name?: string;
  version?: string;
};

export type InstalledExtensionFiles = {
  installedPath: string;
  manifest: ExtensionManifest;
};

export class ExtensionInstallError extends Error {
  constructor(
    message: string,
    readonly code: string
  ) {
    super(message);
    this.name = 'ExtensionInstallError';
  }
}

function ensureCrxBuffer(buffer: Buffer) {
  if (buffer.length < 16 || buffer.subarray(0, 4).toString('ascii') !== 'Cr24') {
    throw new ExtensionInstallError('不是有效的 CRX 文件', 'INVALID_CRX');
  }
}

export function getCrxZipOffset(buffer: Buffer): number {
  ensureCrxBuffer(buffer);
  const version = buffer.readUInt32LE(4);

  if (version === 2) {
    const publicKeyLength = buffer.readUInt32LE(8);
    const signatureLength = buffer.readUInt32LE(12);
    const offset = 16 + publicKeyLength + signatureLength;
    if (offset >= buffer.length) {
      throw new ExtensionInstallError('CRX header 长度不合法', 'INVALID_CRX_HEADER');
    }
    return offset;
  }

  if (version === 3) {
    const headerLength = buffer.readUInt32LE(8);
    const offset = 12 + headerLength;
    if (offset >= buffer.length) {
      throw new ExtensionInstallError('CRX3 header 长度不合法', 'INVALID_CRX_HEADER');
    }
    return offset;
  }

  throw new ExtensionInstallError(`不支持的 CRX 版本: ${version}`, 'UNSUPPORTED_CRX_VERSION');
}

async function emptyDir(targetDir: string) {
  await fs.rm(targetDir, { recursive: true, force: true });
  await fs.mkdir(targetDir, { recursive: true });
}

async function findManifestDir(dir: string, depth = 0): Promise<string | null> {
  if (depth > 4) {
    return null;
  }

  try {
    const manifestPath = path.join(dir, 'manifest.json');
    await fs.access(manifestPath);
    return dir;
  } catch {
    // Continue searching below.
  }

  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }
    const found = await findManifestDir(path.join(dir, entry.name), depth + 1);
    if (found) {
      return found;
    }
  }

  return null;
}

async function readManifest(installedPath: string): Promise<ExtensionManifest> {
  try {
    const content = await fs.readFile(path.join(installedPath, 'manifest.json'), 'utf8');
    return JSON.parse(content) as ExtensionManifest;
  } catch {
    throw new ExtensionInstallError('解包后没有找到 manifest.json', 'MANIFEST_NOT_FOUND');
  }
}

async function finishInstall(targetDir: string): Promise<InstalledExtensionFiles> {
  const installedPath = await findManifestDir(targetDir);
  if (!installedPath) {
    throw new ExtensionInstallError('解包后没有找到 manifest.json', 'MANIFEST_NOT_FOUND');
  }

  return {
    installedPath,
    manifest: await readManifest(installedPath)
  };
}

function extractZipBuffer(buffer: Buffer, targetDir: string) {
  const zip = new AdmZip(buffer);
  zip.extractAllTo(targetDir, true);
}

export async function installZipBuffer(buffer: Buffer, targetDir: string): Promise<InstalledExtensionFiles> {
  await emptyDir(targetDir);
  extractZipBuffer(buffer, targetDir);
  return finishInstall(targetDir);
}

export async function installCrxBuffer(buffer: Buffer, targetDir: string): Promise<InstalledExtensionFiles> {
  const offset = getCrxZipOffset(buffer);
  await emptyDir(targetDir);
  extractZipBuffer(buffer.subarray(offset), targetDir);
  return finishInstall(targetDir);
}

function parseGithubRepo(repoUrl: string) {
  const normalized = repoUrl.trim().replace(/\.git$/i, '');
  const match = normalized.match(/^https:\/\/github\.com\/([^/]+)\/([^/#?]+)(?:[/?#].*)?$/i);
  if (!match) {
    throw new ExtensionInstallError('GitHub repo URL 不合法', 'INVALID_GITHUB_URL');
  }
  return { owner: match[1], repo: match[2] };
}

async function fetchArrayBuffer(url: string): Promise<Buffer> {
  const response = await fetch(url, {
    headers: {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'PANDAO-Browser'
    }
  });

  if (!response.ok) {
    throw new ExtensionInstallError(`下载失败: ${response.status}`, 'DOWNLOAD_FAILED');
  }

  return Buffer.from(await response.arrayBuffer());
}

export async function installFromGithub(repoUrl: string, targetDir: string): Promise<InstalledExtensionFiles> {
  const { owner, repo } = parseGithubRepo(repoUrl);
  const releaseResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/releases/latest`, {
    headers: {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'PANDAO-Browser'
    }
  });

  if (releaseResponse.ok) {
    const release = (await releaseResponse.json()) as { zipball_url?: string };
    if (release.zipball_url) {
      return installZipBuffer(await fetchArrayBuffer(release.zipball_url), targetDir);
    }
  }

  for (const branch of ['main', 'master']) {
    try {
      const archiveUrl = `https://github.com/${owner}/${repo}/archive/refs/heads/${branch}.zip`;
      return await installZipBuffer(await fetchArrayBuffer(archiveUrl), targetDir);
    } catch (error) {
      if (branch === 'master') {
        throw error;
      }
    }
  }

  throw new ExtensionInstallError('GitHub repo 无法下载', 'DOWNLOAD_FAILED');
}
