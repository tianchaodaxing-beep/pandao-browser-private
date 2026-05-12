import type { FastifyInstance } from 'fastify';
import { findUserById } from '../modules/auth/repository.js';
import type { AuthJwtPayload, AuthUser } from '../modules/auth/types.js';
import { isBlacklisted, registerAccessToken } from '../modules/emergency/blacklist.js';

export async function authenticateWsToken(app: FastifyInstance, token: string | undefined): Promise<AuthUser | null> {
  if (!token) {
    return null;
  }

  try {
    const payload = await app.jwt.verify<AuthJwtPayload>(token);

    if (payload.type !== 'access') {
      return null;
    }

    if (isBlacklisted(payload.jti)) {
      return null;
    }

    if (payload.jti && payload.exp) {
      registerAccessToken(payload.jti, payload.userId, new Date(payload.exp * 1000));
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
