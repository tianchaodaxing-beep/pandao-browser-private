import type { AuthUser, EmergencyEventInput, EvaluationResult } from 'shared';
import { getDbPool } from '../../db/pool.js';
import { dispatchBoundaryRedAlert } from './alert-webhook.js';

export async function recordEmergencyEvent(input: EmergencyEventInput) {
  const result = await getDbPool().query(
    `INSERT INTO emergency_events (
       triggered_by, event_type, scope, scope_target_id, reason, affected_users, metadata
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, triggered_at`,
    [
      input.triggeredBy,
      input.eventType,
      input.scope,
      input.scopeTargetId,
      input.reason,
      input.affectedUsers ?? [],
      input.metadata ?? null
    ]
  );

  return {
    id: Number(result.rows[0].id),
    triggeredAt: new Date(result.rows[0].triggered_at).toISOString()
  };
}

export async function freezeAiUser(userId: number, hours = 1): Promise<Date> {
  const result = await getDbPool().query(
    `UPDATE users
     SET frozen_until = NOW() + ($2::text || ' hours')::interval
     WHERE id = $1
       AND role = 'ai'
     RETURNING frozen_until`,
    [userId, hours]
  );

  if (!result.rowCount) {
    throw new Error('AI user not found for freeze');
  }

  return new Date(result.rows[0].frozen_until);
}

export async function unfreezeUser(userId: number): Promise<boolean> {
  const result = await getDbPool().query(
    `UPDATE users
     SET frozen_until = NULL
     WHERE id = $1
     RETURNING id`,
    [userId]
  );

  return Boolean(result.rowCount);
}

export async function handleBoundaryRedAttempt(input: {
  user: AuthUser;
  shopId: number;
  command: string;
  payload: unknown;
  decision: EvaluationResult;
}) {
  const frozenUntil = await freezeAiUser(input.user.id, 1);
  await recordEmergencyEvent({
    triggeredBy: input.user.id,
    eventType: 'boundary_red_attempted',
    scope: 'ai',
    scopeTargetId: input.user.id,
    reason: input.decision.reason,
    affectedUsers: [input.user.id],
    metadata: {
      shopId: input.shopId,
      command: input.command,
      payload: input.payload,
      frozenUntil: frozenUntil.toISOString()
    }
  });

  await dispatchBoundaryRedAlert({ ...input, frozenUntil });
  return frozenUntil;
}
