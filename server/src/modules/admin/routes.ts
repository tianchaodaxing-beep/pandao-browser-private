import type { FastifyInstance } from 'fastify';
import { recordEmergencyEvent, unfreezeUser } from '../boundary/engine.js';
import { authenticateRequest } from '../auth/guards.js';
import { keystoreRoutes } from '../keystore/routes.js';

type UnfreezeParams = {
  userId: string;
};

function parsePositiveInt(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export async function adminRoutes(app: FastifyInstance) {
  await app.register(keystoreRoutes);

  app.post<{ Params: UnfreezeParams }>('/unfreeze/:userId', async (request, reply) => {
    const user = await authenticateRequest(request, reply);

    if (!user) {
      return;
    }

    if (user.role !== 'boss') {
      reply.code(403).send({ error: 'FORBIDDEN', message: 'only boss can unfreeze users' });
      return;
    }

    const targetUserId = parsePositiveInt(request.params.userId);
    if (!targetUserId) {
      reply.code(404).send({ error: 'USER_NOT_FOUND', message: 'user not found' });
      return;
    }

    const unfrozen = await unfreezeUser(targetUserId);
    if (!unfrozen) {
      reply.code(404).send({ error: 'USER_NOT_FOUND', message: 'user not found' });
      return;
    }

    await recordEmergencyEvent({
      triggeredBy: user.id,
      eventType: 'manual_unfreeze',
      scope: 'ai',
      scopeTargetId: targetUserId,
      reason: 'manual unfreeze by boss',
      affectedUsers: [targetUserId],
      metadata: {
        targetUserId
      }
    });

    return { ok: true, userId: targetUserId, frozenUntil: null };
  });
}
