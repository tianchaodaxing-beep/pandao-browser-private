import type { FastifyReply, FastifyRequest } from 'fastify';
import type { AuthStatus, Role } from 'shared';
import { authenticateRequest } from '../auth/guards.js';
import { authRoles } from '../auth/types.js';

const authStatuses = ['active', 'disabled', 'frozen'] as const satisfies AuthStatus[];

export function isAuthRole(value: unknown): value is Role {
  return typeof value === 'string' && authRoles.includes(value as Role);
}

export function assertRole(value: unknown): Role {
  if (!isAuthRole(value)) {
    throw new Error(`Unsupported role: ${String(value)}`);
  }

  return value;
}

export function assertStatus(value: unknown): AuthStatus {
  if (typeof value !== 'string' || !authStatuses.includes(value as AuthStatus)) {
    throw new Error(`Unsupported status: ${String(value)}`);
  }

  return value as AuthStatus;
}

export function requireRole(...roles: Role[]) {
  return async function roleGuard(request: FastifyRequest, reply: FastifyReply) {
    const user = await authenticateRequest(request, reply);

    if (!user) {
      return;
    }

    if (!roles.includes(user.role)) {
      reply.code(403).send({ error: 'FORBIDDEN', message: '权限不足' });
    }
  };
}
