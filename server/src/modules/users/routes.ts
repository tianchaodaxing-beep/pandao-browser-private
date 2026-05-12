import type { FastifyInstance } from 'fastify';
import { authenticateRequest } from '../auth/guards.js';

export async function usersRoutes(app: FastifyInstance) {
  app.get('/me', async (request, reply) => {
    const user = await authenticateRequest(request, reply);

    if (!user) {
      return;
    }

    return { user };
  });
}
