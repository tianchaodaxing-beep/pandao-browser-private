import websocket from '@fastify/websocket';
import type { FastifyInstance } from 'fastify';
import { authenticateWsToken } from './auth.js';
import { addWsConnection, removeWsConnection } from './registry.js';

type WsQuery = {
  token?: string;
};

export async function wsRoutes(app: FastifyInstance) {
  await app.register(websocket);

  app.get<{ Querystring: WsQuery }>('/ws', { websocket: true }, async (connection, request) => {
    const user = await authenticateWsToken(app, request.query.token);

    if (!user) {
      connection.socket.close(4401, 'unauthorized');
      return;
    }

    addWsConnection(user.id, connection.socket);
    request.log.info({ userId: user.id, role: user.role }, 'websocket connected');

    connection.socket.on('close', () => {
      removeWsConnection(user.id, connection.socket);
      request.log.info({ userId: user.id }, 'websocket closed');
    });

    connection.socket.on('error', () => {
      removeWsConnection(user.id, connection.socket);
    });
  });
}
