import type { AuthJwtPayload, CredentialJwtPayload, RefreshJwtPayload } from './types.js';

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: AuthJwtPayload | RefreshJwtPayload | CredentialJwtPayload;
    user: AuthJwtPayload;
  }
}

declare module 'fastify' {
  interface FastifyInstance {
    jwtSecrets: {
      accessSecret: string;
      refreshSecret: string;
    };
  }
}
