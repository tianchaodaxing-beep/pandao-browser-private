import type { AuthUser } from '../auth/types.js';
import { broadcastWsEvent, sendWsEvent } from '../../ws/registry.js';
import { blacklistAccessTokensForUsers } from './blacklist.js';
import { listAffectedUsersByScope, recordEmergencyEvent } from './repository.js';
import type { LockoutRequest, LockoutResponse, LockoutScope } from 'shared';

const lockoutScopes = ['all', 'team', 'employee', 'shop'] as const satisfies LockoutScope[];

export class EmergencyValidationError extends Error {
  statusCode: number;
  code: string;

  constructor(statusCode: number, code: string, message: string) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

function isLockoutScope(value: unknown): value is LockoutScope {
  return typeof value === 'string' && lockoutScopes.includes(value as LockoutScope);
}

function normalizeTargetId(value: unknown): number | null {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export function normalizeLockoutRequest(body: Partial<LockoutRequest> & { target_id?: unknown }): LockoutRequest {
  if (!isLockoutScope(body.scope)) {
    throw new EmergencyValidationError(400, 'INVALID_SCOPE', 'scope must be all, team, employee, or shop');
  }

  const targetId = normalizeTargetId(body.targetId ?? body.target_id);
  const reason = typeof body.reason === 'string' ? body.reason.trim() : '';

  if (reason.length < 4) {
    throw new EmergencyValidationError(400, 'INVALID_REASON', 'reason must be at least 4 characters');
  }

  if (body.scope === 'all') {
    return { scope: body.scope, targetId: null, reason };
  }

  if (!targetId) {
    throw new EmergencyValidationError(400, 'TARGET_REQUIRED', 'target_id is required for this scope');
  }

  return { scope: body.scope, targetId, reason };
}

export async function performManualLockout(user: AuthUser, request: LockoutRequest): Promise<LockoutResponse> {
  const affectedUserIds = await listAffectedUsersByScope({
    scope: request.scope,
    targetId: request.targetId ?? null
  });

  if (!affectedUserIds) {
    throw new EmergencyValidationError(404, 'TARGET_NOT_FOUND', 'target not found');
  }

  const event = await recordEmergencyEvent({
    triggeredBy: user.id,
    eventType: 'manual_lockout',
    scope: request.scope,
    scopeTargetId: request.targetId ?? null,
    reason: request.reason,
    affectedUsers: affectedUserIds,
    metadata: {
      targetId: request.targetId ?? null
    }
  });
  blacklistAccessTokensForUsers(affectedUserIds);
  const payload = {
    scope: request.scope,
    reason: request.reason,
    ts: event.triggeredAt,
    affectedUserIds
  };

  if (request.scope === 'all') {
    broadcastWsEvent('emergency.lockout', payload);
  } else {
    for (const userId of affectedUserIds) {
      sendWsEvent(userId, 'emergency.lockout', payload);
    }
  }

  return {
    ok: true,
    affected: affectedUserIds,
    eventId: event.id
  };
}
