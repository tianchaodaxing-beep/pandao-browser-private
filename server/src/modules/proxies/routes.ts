import type { FastifyInstance, FastifyReply } from 'fastify';
import type { ProxyBatchRequest, ProxyBindRequest, ProxyInput } from 'shared';
import { authenticateRequest } from '../auth/guards.js';
import { requireKeystoreUnlocked } from '../keystore/guards.js';
import { parsePositiveInt } from '../shops/service.js';
import {
  ProxyServiceError,
  bindProxy,
  createProxyBatch,
  isProxyProvider,
  isProxyProtocol,
  isProxyStatus,
  listProxyPool,
  unbindProxyForBoss
} from './service.js';

type ProxyParams = {
  id: string;
};

type ProxyListQuery = {
  provider?: string;
  status?: string;
  bound?: string;
};

function sendProxyError(reply: FastifyReply, error: unknown) {
  if (error instanceof ProxyServiceError) {
    reply.code(error.statusCode).send({ error: error.code, message: error.message });
    return true;
  }

  return false;
}

function sanitizeText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function sanitizeOptionalText(value: unknown) {
  const text = sanitizeText(value);
  return text ? text : null;
}

function parsePort(value: unknown) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 && parsed <= 65535 ? parsed : null;
}

function normalizeProxyInput(value: unknown): ProxyInput | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const row = value as Record<string, unknown>;
  const provider = row.provider;
  const protocol = row.protocol;
  const host = sanitizeText(row.host);
  const port = parsePort(row.port);

  if (!isProxyProvider(provider) || !isProxyProtocol(protocol) || !host || !port) {
    return null;
  }

  return {
    provider,
    protocol,
    host,
    port,
    username: sanitizeOptionalText(row.username),
    password: sanitizeOptionalText(row.password),
    country: sanitizeOptionalText(row.country),
    city: sanitizeOptionalText(row.city)
  };
}

function parseBoundFilter(value: unknown): boolean | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === 'true' || value === '1') {
    return true;
  }

  if (value === 'false' || value === '0') {
    return false;
  }

  return undefined;
}

export async function proxiesRoutes(app: FastifyInstance) {
  app.get<{ Querystring: ProxyListQuery }>('/', async (request, reply) => {
    const user = await authenticateRequest(request, reply);

    if (!user) {
      return;
    }

    if (user.role !== 'boss') {
      reply.code(403).send({ error: 'FORBIDDEN', message: '权限不足' });
      return;
    }

    const provider = request.query.provider;
    const status = request.query.status;
    const bound = parseBoundFilter(request.query.bound);

    if (provider !== undefined && !isProxyProvider(provider)) {
      reply.code(400).send({ error: 'INVALID_INPUT', message: 'provider 不合法' });
      return;
    }

    if (status !== undefined && !isProxyStatus(status)) {
      reply.code(400).send({ error: 'INVALID_INPUT', message: 'status 不合法' });
      return;
    }

    if (request.query.bound !== undefined && bound === undefined) {
      reply.code(400).send({ error: 'INVALID_INPUT', message: 'bound 必须是 true/false' });
      return;
    }

    return {
      proxies: await listProxyPool({
        provider,
        status,
        bound
      })
    };
  });

  app.post<{ Body: Partial<ProxyBatchRequest> }>('/', async (request, reply) => {
    const user = await authenticateRequest(request, reply);

    if (!user) {
      return;
    }

    if (user.role !== 'boss') {
      reply.code(403).send({ error: 'FORBIDDEN', message: '权限不足' });
      return;
    }

    await requireKeystoreUnlocked(request, reply);

    if (reply.sent) {
      return;
    }

    const rows = Array.isArray(request.body?.rows)
      ? request.body.rows.map(normalizeProxyInput)
      : [];

    if (!rows.length || rows.some((row) => row === null)) {
      reply.code(400).send({ error: 'INVALID_INPUT', message: '代理行数据不合法' });
      return;
    }

    if (rows.length > 500) {
      reply.code(400).send({ error: 'INVALID_INPUT', message: '单次最多导入 500 条代理' });
      return;
    }

    const inserted = await createProxyBatch(rows as ProxyInput[]);
    return { ok: true, inserted };
  });

  app.post<{ Params: ProxyParams; Body: Partial<ProxyBindRequest> }>('/:id/bind', async (request, reply) => {
    const user = await authenticateRequest(request, reply);

    if (!user) {
      return;
    }

    if (user.role !== 'boss') {
      reply.code(403).send({ error: 'FORBIDDEN', message: '权限不足' });
      return;
    }

    const proxyId = parsePositiveInt(request.params.id);
    const shopId = parsePositiveInt(request.body?.shopId);

    if (!proxyId || !shopId) {
      reply.code(400).send({ error: 'INVALID_INPUT', message: 'proxyId 和 shopId 必须是正整数' });
      return;
    }

    try {
      const proxy = await bindProxy(proxyId, shopId);
      return { ok: true, proxy };
    } catch (error) {
      if (!sendProxyError(reply, error)) {
        throw error;
      }
    }
  });

  app.delete<{ Params: ProxyParams }>('/:id/bind', async (request, reply) => {
    const user = await authenticateRequest(request, reply);

    if (!user) {
      return;
    }

    if (user.role !== 'boss') {
      reply.code(403).send({ error: 'FORBIDDEN', message: '权限不足' });
      return;
    }

    const proxyId = parsePositiveInt(request.params.id);

    if (!proxyId) {
      reply.code(400).send({ error: 'INVALID_INPUT', message: 'proxyId 必须是正整数' });
      return;
    }

    try {
      await unbindProxyForBoss(proxyId);
      return { ok: true };
    } catch (error) {
      if (!sendProxyError(reply, error)) {
        throw error;
      }
    }
  });

}
