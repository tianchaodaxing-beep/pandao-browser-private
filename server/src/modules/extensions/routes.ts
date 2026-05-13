import type { FastifyInstance } from 'fastify';
import type { MultipartFile } from '@fastify/multipart';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { ExtensionSourceType, ExtensionToggleRequest } from 'shared';
import { authenticateRequest } from '../auth/guards.js';
import { parsePositiveInt } from '../workspaces/service.js';
import {
  installCrxBuffer,
  installFromGithub,
  installZipBuffer,
  type InstalledExtensionFiles
} from './installer.js';
import {
  bindExtensionToWorkspace,
  createExtension,
  deleteExtension,
  findExtension,
  listExtensions,
  listExtensionsForWorkspace,
  setExtensionEnabled,
  unbindExtensionFromWorkspace
} from './repository.js';

type ExtensionParams = {
  id: string;
};

type WorkspaceParams = {
  id: string;
};

type WorkspaceExtensionParams = WorkspaceParams & {
  extId: string;
};

type JsonInstallBody = {
  source_type?: unknown;
  sourceType?: unknown;
  source_url?: unknown;
  sourceUrl?: unknown;
  name?: unknown;
  version?: unknown;
  installed_path?: unknown;
  installedPath?: unknown;
};

function dataRoot() {
  return process.env.PANDAO_DATA_ROOT ?? path.join(process.cwd(), 'data');
}

function extensionTargetDir(extensionId: string) {
  return path.join(dataRoot(), 'extensions', extensionId);
}

function sanitizeText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function sanitizeOptionalText(value: unknown) {
  const text = sanitizeText(value);
  return text ? text : null;
}

function isExtensionSourceType(value: unknown): value is ExtensionSourceType {
  return value === 'crx' || value === 'zip' || value === 'github' || value === 'manual';
}

function getField(file: MultipartFile, name: string) {
  const fields = file.fields as Record<string, { value?: unknown } | undefined>;
  return fields[name]?.value;
}

function inferUploadSourceType(filename: string, value: unknown): ExtensionSourceType | null {
  if (isExtensionSourceType(value)) {
    return value;
  }

  const lower = filename.toLowerCase();
  if (lower.endsWith('.crx')) return 'crx';
  if (lower.endsWith('.zip')) return 'zip';
  return null;
}

function displayNameFromManifest(manifest: InstalledExtensionFiles['manifest'], fallback: string | null) {
  return sanitizeOptionalText(fallback) ?? sanitizeOptionalText(manifest.name) ?? 'Chrome Extension';
}

async function installUploadedExtension(file: MultipartFile, extensionId: string) {
  const sourceType = inferUploadSourceType(String(file.filename ?? ''), getField(file, 'sourceType') ?? getField(file, 'source_type'));
  if (sourceType !== 'crx' && sourceType !== 'zip') {
    throw new Error('只支持上传 .crx 或 .zip');
  }

  const buffer = await file.toBuffer();
  const targetDir = extensionTargetDir(extensionId);
  const installed = sourceType === 'crx'
    ? await installCrxBuffer(buffer, targetDir)
    : await installZipBuffer(buffer, targetDir);

  return {
    sourceType,
    sourceUrl: sanitizeOptionalText(getField(file, 'sourceUrl') ?? getField(file, 'source_url')),
    name: displayNameFromManifest(installed.manifest, sanitizeOptionalText(getField(file, 'name'))),
    version: sanitizeOptionalText(installed.manifest.version),
    installedPath: installed.installedPath
  };
}

async function installJsonExtension(body: JsonInstallBody, extensionId: string) {
  const sourceType = body.sourceType ?? body.source_type;
  if (!isExtensionSourceType(sourceType) || (sourceType !== 'github' && sourceType !== 'manual')) {
    throw new Error('JSON 安装只支持 source_type=github/manual');
  }

  const sourceUrl = sanitizeOptionalText(body.sourceUrl ?? body.source_url);
  if (sourceType === 'manual') {
    const installedPath = sanitizeOptionalText(body.installedPath ?? body.installed_path);
    const name = sanitizeOptionalText(body.name);
    if (!installedPath || !name) {
      throw new Error('manual 扩展必须提供 name 和 installed_path');
    }
    return {
      sourceType,
      sourceUrl,
      name,
      version: sanitizeOptionalText(body.version),
      installedPath
    };
  }

  if (!sourceUrl) {
    throw new Error('source_url 不能为空');
  }

  const installed = await installFromGithub(sourceUrl, extensionTargetDir(extensionId));
  return {
    sourceType,
    sourceUrl,
    name: displayNameFromManifest(installed.manifest, sanitizeOptionalText(body.name)),
    version: sanitizeOptionalText(installed.manifest.version),
    installedPath: installed.installedPath
  };
}

export async function extensionsRoutes(app: FastifyInstance) {
  app.get('/extensions', async (request, reply) => {
    const user = await authenticateRequest(request, reply);
    if (!user) return;
    return { extensions: await listExtensions() };
  });

  app.post<{ Body: JsonInstallBody }>('/extensions', async (request, reply) => {
    const user = await authenticateRequest(request, reply);
    if (!user) return;

    if (user.role !== 'boss') {
      reply.code(403).send({ error: 'FORBIDDEN', message: '权限不足' });
      return;
    }

    const extensionId = crypto.randomUUID();

    try {
      let installed;
      if (request.isMultipart()) {
        const file = await request.file();
        if (!file) {
          throw new Error('请选择扩展文件');
        }
        installed = await installUploadedExtension(file, extensionId);
      } else {
        installed = await installJsonExtension(request.body ?? {}, extensionId);
      }

      const extension = await createExtension({
        id: extensionId,
        name: installed.name,
        version: installed.version,
        sourceType: installed.sourceType,
        sourceUrl: installed.sourceUrl,
        installedPath: installed.installedPath,
        enabled: true
      });

      return { extension };
    } catch (error) {
      await fs.rm(extensionTargetDir(extensionId), { recursive: true, force: true });
      const message = error instanceof Error ? error.message : '扩展安装失败';
      reply.code(400).send({ error: 'EXTENSION_INSTALL_FAILED', message });
    }
  });

  app.patch<{ Params: ExtensionParams; Body: Partial<ExtensionToggleRequest> }>('/extensions/:id', async (request, reply) => {
    const user = await authenticateRequest(request, reply);
    if (!user) return;

    if (user.role !== 'boss') {
      reply.code(403).send({ error: 'FORBIDDEN', message: '权限不足' });
      return;
    }

    if (typeof request.body?.enabled !== 'boolean') {
      reply.code(400).send({ error: 'INVALID_INPUT', message: 'enabled 必须是布尔值' });
      return;
    }

    const extension = await setExtensionEnabled(request.params.id, request.body.enabled);
    if (!extension) {
      reply.code(404).send({ error: 'EXTENSION_NOT_FOUND', message: '扩展不存在' });
      return;
    }

    return { extension };
  });

  app.delete<{ Params: ExtensionParams }>('/extensions/:id', async (request, reply) => {
    const user = await authenticateRequest(request, reply);
    if (!user) return;

    if (user.role !== 'boss') {
      reply.code(403).send({ error: 'FORBIDDEN', message: '权限不足' });
      return;
    }

    const extension = await deleteExtension(request.params.id);
    if (!extension) {
      reply.code(404).send({ error: 'EXTENSION_NOT_FOUND', message: '扩展不存在' });
      return;
    }

    await fs.rm(extension.installedPath, { recursive: true, force: true });
    return { ok: true };
  });

  app.get<{ Params: WorkspaceParams }>('/workspaces/:id/extensions', async (request, reply) => {
    const user = await authenticateRequest(request, reply);
    if (!user) return;

    const workspaceId = parsePositiveInt(request.params.id);
    if (!workspaceId) {
      reply.code(404).send({ error: 'WORKSPACE_NOT_FOUND', message: '工作区不存在' });
      return;
    }

    return { extensions: await listExtensionsForWorkspace(workspaceId) };
  });

  app.post<{ Params: WorkspaceParams; Body: { extensionId?: unknown } }>('/workspaces/:id/extensions', async (request, reply) => {
    const user = await authenticateRequest(request, reply);
    if (!user) return;

    if (user.role !== 'boss') {
      reply.code(403).send({ error: 'FORBIDDEN', message: '权限不足' });
      return;
    }

    const workspaceId = parsePositiveInt(request.params.id);
    const extensionId = sanitizeText(request.body?.extensionId);
    if (!workspaceId || !extensionId) {
      reply.code(400).send({ error: 'INVALID_INPUT', message: 'workspaceId 和 extensionId 必填' });
      return;
    }

    const extension = await findExtension(extensionId);
    if (!extension) {
      reply.code(404).send({ error: 'EXTENSION_NOT_FOUND', message: '扩展不存在' });
      return;
    }

    await bindExtensionToWorkspace(workspaceId, extensionId);
    return { ok: true };
  });

  app.delete<{ Params: WorkspaceExtensionParams }>('/workspaces/:id/extensions/:extId', async (request, reply) => {
    const user = await authenticateRequest(request, reply);
    if (!user) return;

    if (user.role !== 'boss') {
      reply.code(403).send({ error: 'FORBIDDEN', message: '权限不足' });
      return;
    }

    const workspaceId = parsePositiveInt(request.params.id);
    if (!workspaceId) {
      reply.code(400).send({ error: 'INVALID_INPUT', message: 'workspaceId 必须是正整数' });
      return;
    }

    await unbindExtensionFromWorkspace(workspaceId, request.params.extId);
    return { ok: true };
  });
}
