import type { FastifyInstance } from 'fastify';
import { v4 as uuidv4 } from 'uuid';
import { registerAccessToken } from '../emergency/blacklist.js';
import type { AuthJwtPayload, AuthUser, RefreshJwtPayload } from './types.js';

export const ACCESS_TOKEN_TTL_SECONDS = 2 * 60 * 60;
export const REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60;

export function createRefreshJti() {
  return uuidv4();
}

export function getRefreshExpiry(now = new Date()): Date {
  return new Date(now.getTime() + REFRESH_TOKEN_TTL_SECONDS * 1000);
}

export function signAccessToken(app: FastifyInstance, user: AuthUser): string {
  const jti = uuidv4();
  const expiresAt = new Date(Date.now() + ACCESS_TOKEN_TTL_SECONDS * 1000);
  const payload: AuthJwtPayload = {
    sub: String(user.id),
    type: 'access',
    userId: user.id,
    username: user.username,
    role: user.role,
    jti
  };

  const token = app.jwt.sign(payload, {
    algorithm: 'HS256',
    expiresIn: ACCESS_TOKEN_TTL_SECONDS
  });

  registerAccessToken(jti, user.id, expiresAt);
  return token;
}

export function signRefreshToken(app: FastifyInstance, user: AuthUser, jti: string): string {
  const payload: RefreshJwtPayload = {
    sub: String(user.id),
    type: 'refresh',
    userId: user.id,
    username: user.username,
    role: user.role,
    jti
  };

  return app.jwt.sign(payload, {
    key: app.jwtSecrets.refreshSecret,
    algorithm: 'HS256',
    expiresIn: REFRESH_TOKEN_TTL_SECONDS
  });
}
