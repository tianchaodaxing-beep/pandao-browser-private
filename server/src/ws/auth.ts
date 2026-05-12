import type { FastifyInstance } from 'fastify';
import { findUserById } from '../modules/auth/repository.js';
import type { AuthJwtPayload, AuthUser } from '../modules/auth/types.js';

export async function authenticateWsToken(app: FastifyInstance, token: string | undefined): Promise<AuthUser | null> {
  if (!token) {
    return null;
  }

  try {
    const payload = await app.jwt.verify<AuthJwtPayload>(token);

    if (payload.type !== 'access') {
      return null;
    }

    const user = await findUserById(payload.userId);
    if (!user || user.status !== 'active') {
      return null;
    }

    return user;
  } catch {
    return null;
  }
}
