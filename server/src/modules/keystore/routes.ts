import type { FastifyInstance } from 'fastify';
import type { LockStatusResponse, UnlockResponse } from 'shared';
import { authenticateRequest } from '../auth/guards.js';
import { isKeystoreUnlocked, setMasterKey } from './state.js';

function bodyToBuffer(body: unknown): Buffer | null {
  return Buffer.isBuffer(body) ? body : null;
}

export async function keystoreRoutes(app: FastifyInstance) {
  app.get('/lock-status', async (request, reply): Promise<LockStatusResponse | void> => {
    const user = await authenticateRequest(request, reply);

    if (!user) {
      return;
    }

    return { locked: !isKeystoreUnlocked() };
  });

  app.post('/unlock', async (request, reply): Promise<UnlockResponse | void> => {
    const user = await authenticateRequest(request, reply);

    if (!user) {
      return;
    }

    if (user.role !== 'boss') {
      reply.code(403).send({ error: 'FORBIDDEN', message: '权限不足' });
      return;
    }

    const body = bodyToBuffer(request.body);

    if (!body || body.length !== 32) {
      reply.code(400).send({ error: 'INVALID_MASTER_KEY', message: 'master.key 必须正好 32 字节' });
      return;
    }

    setMasterKey(body);
    return { locked: false };
  });
}
