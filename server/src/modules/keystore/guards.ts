import type { FastifyReply, FastifyRequest } from 'fastify';
import { isKeystoreUnlocked } from './state.js';

export async function requireKeystoreUnlocked(_request: FastifyRequest, reply: FastifyReply) {
  if (!isKeystoreUnlocked()) {
    return reply.code(503).send({
      error: 'KEY_LOCKED',
      message: '主密钥未注入,请联系老板 unlock'
    });
  }
}
