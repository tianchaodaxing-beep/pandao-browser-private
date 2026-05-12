import type { FastifyInstance } from 'fastify';
import type { ShopAssignmentInput, ShopCredentialInput } from 'shared';
import { authenticateRequest } from '../auth/guards.js';
import { requireKeystoreUnlocked } from '../keystore/guards.js';
import {
  createShopForBoss,
  getShopForUser,
  isShopPlatform,
  listShopsForUser,
  parsePositiveInt,
  setShopCredentialForUser,
  assignShopForBoss
} from './service.js';

type CreateShopBody = {
  name?: unknown;
  platform?: unknown;
  teamId?: unknown;
  defaultUrl?: unknown;
};

type ShopParams = {
  id: string;
};

function sanitizeText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function sanitizeOptionalText(value: unknown) {
  const text = sanitizeText(value);
  return text ? text : null;
}

export async function shopsRoutes(app: FastifyInstance) {
  // 注意:不在 plugin 级注册 requireKeystoreUnlocked。
  // 只有真正做加解密的路由(POST /shops/:id/credentials)在自己 handler 内
  // 显式调用,避免锁定状态下读接口被一起卡住,影响员工日常使用。
  // 来源:主控 Claude Opus 4.7 二次验收返修(2026-05-12 上海)。

  app.get('/', async (request, reply) => {
    const user = await authenticateRequest(request, reply);

    if (!user) {
      return;
    }

    return { shops: await listShopsForUser(user) };
  });

  app.get<{ Params: ShopParams }>('/:id', async (request, reply) => {
    const user = await authenticateRequest(request, reply);

    if (!user) {
      return;
    }

    const shopId = parsePositiveInt(request.params.id);

    if (!shopId) {
      reply.code(404).send({ error: 'SHOP_NOT_FOUND', message: '店铺不存在' });
      return;
    }

    const shop = await getShopForUser(user, shopId);

    if (!shop) {
      reply.code(404).send({ error: 'SHOP_NOT_FOUND', message: '店铺不存在' });
      return;
    }

    return { shop };
  });

  app.post<{ Body: CreateShopBody }>('/', async (request, reply) => {
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

    if (!name || !isShopPlatform(platform)) {
      reply.code(400).send({ error: 'INVALID_INPUT', message: '店铺名称和平台不能为空' });
      return;
    }

    const teamId = request.body?.teamId === undefined || request.body.teamId === null
      ? null
      : parsePositiveInt(request.body.teamId);

    if (request.body?.teamId !== undefined && request.body.teamId !== null && !teamId) {
      reply.code(400).send({ error: 'INVALID_INPUT', message: 'teamId 必须是正整数' });
      return;
    }

    const shop = await createShopForBoss({
      name,
      platform,
      teamId,
      defaultUrl: sanitizeOptionalText(request.body?.defaultUrl)
    });

    return { shop };
  });

  app.post<{ Params: ShopParams; Body: Partial<ShopCredentialInput> }>('/:id/credentials', async (request, reply) => {
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

    const shopId = parsePositiveInt(request.params.id);
    const username = sanitizeText(request.body?.username);
    const password = typeof request.body?.password === 'string' ? request.body.password : '';

    if (!shopId) {
      reply.code(404).send({ error: 'SHOP_NOT_FOUND', message: '店铺不存在' });
      return;
    }

    if (!username || !password) {
      reply.code(400).send({ error: 'INVALID_INPUT', message: '账号和密码不能为空' });
      return;
    }

    const result = await setShopCredentialForUser(user, shopId, username, password);

    if (!result) {
      reply.code(404).send({ error: 'SHOP_NOT_FOUND', message: '店铺不存在' });
      return;
    }

    return { ok: true, credential: result };
  });

  app.post<{ Params: ShopParams; Body: Partial<ShopAssignmentInput> }>('/:id/assign', async (request, reply) => {
    const user = await authenticateRequest(request, reply);

    if (!user) {
      return;
    }

    // 决策 16:店铺分配只允许 boss。manager/staff/ai 一律 403。
    // 主控 Claude Opus 4.7 二次验收返修(2026-05-12 上海):从 boss+manager 收紧为仅 boss。
    if (user.role !== 'boss') {
      reply.code(403).send({ error: 'FORBIDDEN', message: '权限不足' });
      return;
    }

    const shopId = parsePositiveInt(request.params.id);
    const userId = parsePositiveInt(request.body?.userId);

    if (!shopId || !userId) {
      reply.code(400).send({ error: 'INVALID_INPUT', message: 'shopId 和 userId 必须是正整数' });
      return;
    }

    const shop = await getShopForUser(user, shopId);

    if (!shop) {
      reply.code(404).send({ error: 'SHOP_NOT_FOUND', message: '店铺不存在' });
      return;
    }

    await assignShopForBoss(shopId, userId, user.id);
    return { ok: true };
  });
}
