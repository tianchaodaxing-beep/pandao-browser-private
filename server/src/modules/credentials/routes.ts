import type { FastifyInstance, FastifyReply } from 'fastify';
import type { CredentialExchangeRequest } from 'shared';
import { getActionSelectors } from '../audit/selectors.js';
import { authenticateRequest } from '../auth/guards.js';
import { requireKeystoreUnlocked } from '../keystore/guards.js';
import { getShopForUser, parsePositiveInt } from '../shops/service.js';
import {
  CredentialServiceError,
  exchangeCredentialToken,
  issueCredentialToken
} from './service.js';

type ShopParams = {
  id: string;
};

function sendCredentialError(reply: FastifyReply, error: unknown) {
  if (error instanceof CredentialServiceError) {
    reply.code(error.statusCode).send({ error: error.code, message: error.message });
    return true;
  }

  return false;
}

export async function shopCredentialTokenRoutes(app: FastifyInstance) {
  app.get<{ Params: ShopParams }>('/:id/credential-token', async (request, reply) => {
    const user = await authenticateRequest(request, reply);

    if (!user) {
      return;
    }

    const shopId = parsePositiveInt(request.params.id);

    if (!shopId) {
      reply.code(404).send({ error: 'SHOP_NOT_FOUND', message: '店铺不存在' });
      return;
    }

    try {
      return await issueCredentialToken(app, user, shopId, request.ip ?? null);
    } catch (error) {
      if (!sendCredentialError(reply, error)) {
        throw error;
      }
    }
  });

  app.get<{ Params: ShopParams }>('/:id/action-selectors', async (request, reply) => {
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
      reply.code(404).send({ error: 'SHOP_NOT_FOUND', message: '店铺不存在或无权限' });
      return;
    }

    return { selectors: getActionSelectors(shop.platform) };
  });
}

export async function credentialsRoutes(app: FastifyInstance) {
  app.post<{ Body: Partial<CredentialExchangeRequest> }>('/exchange', async (request, reply) => {
    const user = await authenticateRequest(request, reply);

    if (!user) {
      return;
    }

    await requireKeystoreUnlocked(request, reply);

    if (reply.sent) {
      return;
    }

    const token = typeof request.body?.token === 'string' ? request.body.token : '';

    if (!token) {
      reply.code(400).send({ error: 'INVALID_INPUT', message: 'token 不能为空' });
      return;
    }

    try {
      return await exchangeCredentialToken(app, user, token);
    } catch (error) {
      if (!sendCredentialError(reply, error)) {
        throw error;
      }
    }
  });
}
