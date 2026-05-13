import type { FastifyInstance } from 'fastify';
import type { WorkspaceAssignmentInput, WorkspaceCredentialInput } from 'shared';
import { authenticateRequest } from '../auth/guards.js';
import { requireKeystoreUnlocked } from '../keystore/guards.js';
import {
  assignWorkspaceForBoss,
  createWorkspaceForBoss,
  getWorkspaceForUser,
  isWorkspacePlatform,
  isWorkspaceStatus,
  listCategoriesForUser,
  listWorkspacesForUser,
  parsePositiveInt,
  parseSortOrder,
  setWorkspaceCredentialForUser,
  updateWorkspaceForBoss
} from './service.js';

type CreateWorkspaceBody = {
  name?: unknown;
  platform?: unknown;
  teamId?: unknown;
  defaultUrl?: unknown;
  category?: unknown;
  icon?: unknown;
  sortOrder?: unknown;
};

type UpdateWorkspaceBody = Partial<CreateWorkspaceBody> & {
  status?: unknown;
};

type WorkspaceParams = {
  id: string;
};

function sanitizeText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function sanitizeOptionalText(value: unknown) {
  const text = sanitizeText(value);
  return text ? text : null;
}

function parseNullableTeamId(value: unknown) {
  return value === undefined || value === null ? null : parsePositiveInt(value);
}

export async function workspacesRoutes(app: FastifyInstance) {
  app.get('/', async (request, reply) => {
    const user = await authenticateRequest(request, reply);

    if (!user) {
      return;
    }

    const workspaces = await listWorkspacesForUser(user);
    return { workspaces, shops: workspaces };
  });

  app.get('/categories', async (request, reply) => {
    const user = await authenticateRequest(request, reply);

    if (!user) {
      return;
    }

    return { categories: await listCategoriesForUser(user) };
  });

  app.get<{ Params: WorkspaceParams }>('/:id', async (request, reply) => {
    const user = await authenticateRequest(request, reply);

    if (!user) {
      return;
    }

    const workspaceId = parsePositiveInt(request.params.id);

    if (!workspaceId) {
      reply.code(404).send({ error: 'WORKSPACE_NOT_FOUND', message: '工作区不存在' });
      return;
    }

    const workspace = await getWorkspaceForUser(user, workspaceId);

    if (!workspace) {
      reply.code(404).send({ error: 'WORKSPACE_NOT_FOUND', message: '工作区不存在' });
      return;
    }

    return { workspace, shop: workspace };
  });

  app.post<{ Body: CreateWorkspaceBody }>('/', async (request, reply) => {
    const user = await authenticateRequest(request, reply);

    if (!user) {
      return;
    }

    if (user.role !== 'boss') {
      reply.code(403).send({ error: 'FORBIDDEN', message: '权限不足' });
      return;
    }

    const name = sanitizeText(request.body?.name);
    const platform = request.body?.platform;

    if (!name || !isWorkspacePlatform(platform)) {
      reply.code(400).send({ error: 'INVALID_INPUT', message: '工作区名称和平台不能为空' });
      return;
    }

    const teamId = parseNullableTeamId(request.body?.teamId);

    if (request.body?.teamId !== undefined && request.body.teamId !== null && !teamId) {
      reply.code(400).send({ error: 'INVALID_INPUT', message: 'teamId 必须是正整数' });
      return;
    }

    const workspace = await createWorkspaceForBoss({
      name,
      platform,
      teamId,
      defaultUrl: sanitizeOptionalText(request.body?.defaultUrl),
      category: sanitizeOptionalText(request.body?.category),
      icon: sanitizeOptionalText(request.body?.icon),
      sortOrder: parseSortOrder(request.body?.sortOrder)
    });

    return { workspace, shop: workspace };
  });

  app.patch<{ Params: WorkspaceParams; Body: UpdateWorkspaceBody }>('/:id', async (request, reply) => {
    const user = await authenticateRequest(request, reply);

    if (!user) {
      return;
    }

    if (user.role !== 'boss') {
      reply.code(403).send({ error: 'FORBIDDEN', message: '权限不足' });
      return;
    }

    const workspaceId = parsePositiveInt(request.params.id);

    if (!workspaceId) {
      reply.code(404).send({ error: 'WORKSPACE_NOT_FOUND', message: '工作区不存在' });
      return;
    }

    const patch: Parameters<typeof updateWorkspaceForBoss>[1] = {};
    if (request.body?.name !== undefined) patch.name = sanitizeText(request.body.name);
    if (request.body?.platform !== undefined) {
      if (!isWorkspacePlatform(request.body.platform)) {
        reply.code(400).send({ error: 'INVALID_INPUT', message: 'platform 不合法' });
        return;
      }
      patch.platform = request.body.platform;
    }
    if (request.body?.teamId !== undefined) {
      const teamId = parseNullableTeamId(request.body.teamId);
      if (request.body.teamId !== null && !teamId) {
        reply.code(400).send({ error: 'INVALID_INPUT', message: 'teamId 必须是正整数' });
        return;
      }
      patch.teamId = teamId;
    }
    if (request.body?.defaultUrl !== undefined) patch.defaultUrl = sanitizeOptionalText(request.body.defaultUrl);
    if (request.body?.category !== undefined) patch.category = sanitizeOptionalText(request.body.category);
    if (request.body?.icon !== undefined) patch.icon = sanitizeOptionalText(request.body.icon);
    if (request.body?.sortOrder !== undefined) patch.sortOrder = parseSortOrder(request.body.sortOrder);
    if (request.body?.status !== undefined) {
      if (!isWorkspaceStatus(request.body.status)) {
        reply.code(400).send({ error: 'INVALID_INPUT', message: 'status 不合法' });
        return;
      }
      patch.status = request.body.status;
    }

    const workspace = await updateWorkspaceForBoss(workspaceId, patch);

    if (!workspace) {
      reply.code(404).send({ error: 'WORKSPACE_NOT_FOUND', message: '工作区不存在' });
      return;
    }

    return { workspace, shop: workspace };
  });

  app.post<{ Params: WorkspaceParams; Body: Partial<WorkspaceCredentialInput> }>('/:id/credentials', async (request, reply) => {
    const user = await authenticateRequest(request, reply);

    if (!user) {
      return;
    }

    if (user.role !== 'boss' && user.role !== 'manager') {
      reply.code(403).send({ error: 'FORBIDDEN', message: '权限不足' });
      return;
    }

    await requireKeystoreUnlocked(request, reply);

    if (reply.sent) {
      return;
    }

    const workspaceId = parsePositiveInt(request.params.id);
    const username = sanitizeText(request.body?.username);
    const password = typeof request.body?.password === 'string' ? request.body.password : '';

    if (!workspaceId) {
      reply.code(404).send({ error: 'WORKSPACE_NOT_FOUND', message: '工作区不存在' });
      return;
    }

    if (!username || !password) {
      reply.code(400).send({ error: 'INVALID_INPUT', message: '账号和密码不能为空' });
      return;
    }

    const result = await setWorkspaceCredentialForUser(user, workspaceId, username, password);

    if (!result) {
      reply.code(404).send({ error: 'WORKSPACE_NOT_FOUND', message: '工作区不存在' });
      return;
    }

    return { ok: true, credential: result };
  });

  app.post<{ Params: WorkspaceParams; Body: Partial<WorkspaceAssignmentInput> }>('/:id/assign', async (request, reply) => {
    const user = await authenticateRequest(request, reply);

    if (!user) {
      return;
    }

    if (user.role !== 'boss') {
      reply.code(403).send({ error: 'FORBIDDEN', message: '权限不足' });
      return;
    }

    const workspaceId = parsePositiveInt(request.params.id);
    const userId = parsePositiveInt(request.body?.userId);

    if (!workspaceId || !userId) {
      reply.code(400).send({ error: 'INVALID_INPUT', message: 'workspaceId 和 userId 必须是正整数' });
      return;
    }

    const workspace = await getWorkspaceForUser(user, workspaceId);

    if (!workspace) {
      reply.code(404).send({ error: 'WORKSPACE_NOT_FOUND', message: '工作区不存在' });
      return;
    }

    await assignWorkspaceForBoss(workspaceId, userId, user.id);
    return { ok: true };
  });
}

export const shopsRoutes = workspacesRoutes;
