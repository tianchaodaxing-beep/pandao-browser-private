import type { FastifyInstance } from 'fastify';
import { v4 as uuidv4 } from 'uuid';
import type { AuthUser, CredentialJwtPayload } from '../auth/types.js';

export const CREDENTIAL_TOKEN_TTL_SECONDS = 60;

export function createCredentialJti() {
  return uuidv4();
}

export function getCredentialExpiry(now = new Date()): Date {
  return new Date(now.getTime() + CREDENTIAL_TOKEN_TTL_SECONDS * 1000);
}

export function signCredentialToken(
  app: FastifyInstance,
  user: AuthUser,
  shopId: number,
  jti: string
) {
  const payload: CredentialJwtPayload = {
    sub: String(user.id),
    type: 'credential',
    userId: user.id,
    shopId,
    jti
  };

  return app.jwt.sign(payload, {
    algorithm: 'HS256',
    expiresIn: CREDENTIAL_TOKEN_TTL_SECONDS
  });
}

export async function verifyCredentialToken(app: FastifyInstance, token: string) {
  try {
    const payload = await app.jwt.verify<CredentialJwtPayload>(token, {
      algorithms: ['HS256']
    });

    if (
      payload.type !== 'credential' ||
      payload.sub !== String(payload.userId) ||
      !payload.jti ||
      !Number.isInteger(payload.userId) ||
      !Number.isInteger(payload.shopId)
    ) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}
