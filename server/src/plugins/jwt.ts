import fastifyJwt from '@fastify/jwt';
import type { FastifyInstance } from 'fastify';

export function getJwtSecrets() {
  const accessSecret = process.env.JWT_SECRET;
  const refreshSecret = process.env.JWT_REFRESH_SECRET;

  if (!accessSecret || !refreshSecret) {
    throw new Error(
      '缺少 JWT_SECRET 或 JWT_REFRESH_SECRET 环境变量，服务端禁止使用默认 JWT 密钥启动。'
    );
  }

  return { accessSecret, refreshSecret };
}

export function registerJwt(app: FastifyInstance) {
  const secrets = getJwtSecrets();

  app.decorate('jwtSecrets', secrets);

  void app.register(fastifyJwt, {
    secret: secrets.accessSecret,
    sign: {
      algorithm: 'HS256'
    },
    verify: {
      algorithms: ['HS256']
    }
  });
}
