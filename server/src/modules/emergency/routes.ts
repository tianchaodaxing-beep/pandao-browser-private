import type { FastifyInstance } from 'fastify';
import type { LockoutRequest } from 'shared';
import { authenticateRequest } from '../auth/guards.js';
import { getEmergencyStatus } from './repository.js';
import { EmergencyValidationError, normalizeLockoutRequest, performManualLockout } from './service.js';

type LockoutBody = Partial<LockoutRequest> & {
  target_id?: unknown;
};

export async function emergencyRoutes(app: FastifyInstance) {
  app.post<{ Body: LockoutBody }>('/lockout', async (request, reply) => {
    const user = await authenticateRequest(request, reply);

    if (!user) {
      return;
    }

    if (user.role !== 'boss') {
      reply.code(403).send({ error: 'FORBIDDEN', message: 'only boss can trigger emergency lockout' });
      return;
    }

    try {
      const lockoutRequest = normalizeLockoutRequest(request.body ?? {});
      return await performManualLockout(user, lockoutRequest);
    } catch (error) {
      if (error instanceof EmergencyValidationError) {
        reply.code(error.statusCode).send({ error: error.code, message: error.message });
        return;
      }

      throw error;
    }
  });

  app.get('/status', async (request, reply) => {
    const user = await authenticateRequest(request, reply);

    if (!user) {
      return;
    }

    return getEmergencyStatus(user.id);
  });
}
