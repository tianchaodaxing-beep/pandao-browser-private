import AdmZip from 'adm-zip';
import fs from 'node:fs/promises';
import path from 'node:path';

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
    throw new ExtensionInstallError('Invalid CRX file', 'INVALID_CRX');
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
      throw new ExtensionInstallError('Invalid CRX header', 'INVALID_CRX_HEADER');
    }
    return offset;
  }

  if (version === 3) {
    const headerLength = buffer.readUInt32LE(8);
    const offset = 12 + headerLength;
    if (offset >= buffer.length) {
      throw new ExtensionInstallError('Invalid CRX3 header', 'INVALID_CRX_HEADER');
    }
    return offset;
  }

  throw new ExtensionInstallError(`Unsupported CRX version: ${version}`, 'UNSUPPORTED_CRX_VERSION');
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
    await fs.access(path.join(dir, 'manifest.json'));
    return dir;
  } catch {
    // Continue below.
  }

  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const found = await findManifestDir(path.join(dir, entry.name), depth + 1);
    if (found) return found;
  }

  return null;
}

async function readManifest(installedPath: string): Promise<ExtensionManifest> {
  const content = await fs.readFile(path.join(installedPath, 'manifest.json'), 'utf8');
  return JSON.parse(content) as ExtensionManifest;
}

async function finishInstall(targetDir: string): Promise<InstalledExtensionFiles> {
  const installedPath = await findManifestDir(targetDir);
  if (!installedPath) {
    throw new ExtensionInstallError('manifest.json not found', 'MANIFEST_NOT_FOUND');
  }

  return {
    installedPath,
    manifest: await readManifest(installedPath)
  };
}

export async function installZip(zipPath: string, targetDir: string): Promise<InstalledExtensionFiles> {
  await emptyDir(targetDir);
  const zip = new AdmZip(zipPath);
  zip.extractAllTo(targetDir, true);
  return finishInstall(targetDir);
}

export async function installCrx(crxPath: string, targetDir: string): Promise<InstalledExtensionFiles> {
  const buffer = await fs.readFile(crxPath);
  const offset = getCrxZipOffset(buffer);
  await emptyDir(targetDir);
  const zip = new AdmZip(buffer.subarray(offset));
  zip.extractAllTo(targetDir, true);
  return finishInstall(targetDir);
}

function parseGithubRepo(repoUrl: string) {
  const normalized = repoUrl.trim().replace(/\.git$/i, '');
  const match = normalized.match(/^https:\/\/github\.com\/([^/]+)\/([^/#?]+)(?:[/?#].*)?$/i);
  if (!match) {
    throw new ExtensionInstallError('Invalid GitHub repo URL', 'INVALID_GITHUB_URL');
  }
  return { owner: match[1], repo: match[2] };
}

async function fetchBuffer(url: string): Promise<Buffer> {
  const response = await fetch(url, {
    headers: {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'PANDAO-Browser'
    }
  });

  if (!response.ok) {
    throw new ExtensionInstallError(`Download failed: ${response.status}`, 'DOWNLOAD_FAILED');
  }

  return Buffer.from(await response.arrayBuffer());
}

export async function installFromGithub(repoUrl: string, targetDir: string): Promise<InstalledExtensionFiles> {
  const { owner, repo } = parseGithubRepo(repoUrl);
  const latestRelease = await fetch(`https://api.github.com/repos/${owner}/${repo}/releases/latest`, {
    headers: {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'PANDAO-Browser'
    }
  });

  if (latestRelease.ok) {
    const release = (await latestRelease.json()) as { zipball_url?: string };
    if (release.zipball_url) {
      await emptyDir(targetDir);
      new AdmZip(await fetchBuffer(release.zipball_url)).extractAllTo(targetDir, true);
      return finishInstall(targetDir);
    }
  }

  for (const branch of ['main', 'master']) {
    try {
      await emptyDir(targetDir);
      new AdmZip(await fetchBuffer(`https://github.com/${owner}/${repo}/archive/refs/heads/${branch}.zip`)).extractAllTo(
        targetDir,
        true
      );
      return finishInstall(targetDir);
    } catch (error) {
      if (branch === 'master') throw error;
    }
  }

  throw new ExtensionInstallError('GitHub repo cannot be downloaded', 'DOWNLOAD_FAILED');
}
