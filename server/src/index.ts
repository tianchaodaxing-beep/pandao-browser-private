import 'dotenv/config';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import Fastify from 'fastify';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { closeDbPool } from './db/pool.js';
import { startActionLogCleanup } from './jobs/cleanup-action-logs.js';
import { adminRoutes } from './modules/admin/routes.js';
import { auditRoutes } from './modules/audit/routes.js';
import { authRoutes } from './modules/auth/routes.js';
import { credentialsRoutes, shopCredentialTokenRoutes } from './modules/credentials/routes.js';
import { proxiesRoutes } from './modules/proxies/routes.js';
import { shopsRoutes } from './modules/shops/routes.js';
import { teamsRoutes } from './modules/teams/routes.js';
import { usersRoutes } from './modules/users/routes.js';
import { registerJwt } from './plugins/jwt.js';

const DEFAULT_HOST = '127.0.0.1';
const DEFAULT_PORT = 3001;

export function buildServer() {
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? 'info',
      redact: {
        paths: [
          'req.headers.authorization',
          'req.body.password',
          'req.body.action_payload',
          'req.body.actionPayload',
          'req.body.rows.*.password',
          '*.proxyPassword',
          'res.body.password',
          '*.password',
          '*.password.*'
        ],
        censor: '[REDACTED]',
        remove: false
      }
    }
  });

  void app.register(cors, {
    origin: true
  });

  app.addContentTypeParser(
    'application/octet-stream',
    { parseAs: 'buffer', bodyLimit: 1024 },
    (_request, body, done) => {
      done(null, body);
    }
  );

  void app.register(multipart, {
    limits: {
      fileSize: 4 * 1024 * 1024
    }
  });

  registerJwt(app);
  void app.register(authRoutes, {
    prefix: '/auth'
  });
  void app.register(adminRoutes, {
    prefix: '/admin'
  });
  void app.register(shopsRoutes, {
    prefix: '/shops'
  });
  void app.register(shopCredentialTokenRoutes, {
    prefix: '/shops'
  });
  void app.register(proxiesRoutes, {
    prefix: '/proxies'
  });
  void app.register(credentialsRoutes, {
    prefix: '/credentials'
  });
  void app.register(auditRoutes, {
    prefix: '/actions'
  });
  void app.register(usersRoutes, {
    prefix: '/users'
  });
  void app.register(teamsRoutes, {
    prefix: '/teams'
  });

  app.get('/health', async () => {
    return { status: 'ok' };
  });

  app.addHook('onClose', async () => {
    await closeDbPool();
  });

  startActionLogCleanup(app);

  return app;
}

async function start() {
  const app = buildServer();
  const host = process.env.HOST ?? DEFAULT_HOST;
  const port = Number(process.env.PORT ?? DEFAULT_PORT);

  try {
    await app.listen({ host, port });
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }

  const shutdown = async () => {
    await app.close();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

const currentFile = fileURLToPath(import.meta.url);
const invokedFile = process.argv[1] ? path.resolve(process.argv[1]) : '';

if (currentFile === invokedFile) {
  void start();
}
