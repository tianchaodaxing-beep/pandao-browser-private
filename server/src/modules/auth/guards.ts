import type { FastifyReply, FastifyRequest } from 'fastify';
import { isBlacklisted, registerAccessToken } from '../emergency/blacklist.js';
import { findUserById } from './repository.js';
import type { AuthJwtPayload, AuthUser } from './types.js';

export async function authenticateRequest(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<AuthUser | null> {
  try {
    await request.jwtVerify();
    const payload = request.user as AuthJwtPayload;

    if (payload.type !== 'access') {
      reply.code(401).send({ error: 'UNAUTHORIZED', message: '登录状态无效' });
      return null;
    }

    if (isBlacklisted(payload.jti)) {
      reply.code(401).send({ error: 'EMERGENCY_LOCKOUT', message: '账号已被应急下线,请重新登录' });
      return null;
    }

    if (payload.jti && payload.exp) {
      registerAccessToken(payload.jti, payload.userId, new Date(payload.exp * 1000));
    }

    const user = await findUserById(payload.userId);

    if (!user || user.status !== 'active') {
      reply.code(401).send({ error: 'UNAUTHORIZED', message: '登录状态无效' });
      return null;
    }

    return user;
  } catch {
    reply.code(401).send({ error: 'UNAUTHORIZED', message: '请先登录' });
    return null;
  }
}
