import type { Pool, PoolClient, QueryResultRow } from 'pg';
import type { EmergencyEventInput, EmergencyStatusResponse, LockoutScope } from 'shared';
import { getDbPool } from '../../db/pool.js';

export type EmergencyDb = Pick<Pool | PoolClient, 'query'>;

type ScopeTarget = {
  scope: LockoutScope;
  targetId: number | null;
};

function dbOrDefault(db?: EmergencyDb): EmergencyDb {
  return db ?? getDbPool();
}

function rowsToIds(rows: QueryResultRow[]) {
  return rows.map((row) => Number(row.id));
}

async function ensureTargetExists(table: 'teams' | 'users' | 'workspaces', targetId: number, db: EmergencyDb) {
  const result = await db.query(`SELECT id FROM ${table} WHERE id = $1 LIMIT 1`, [targetId]);
  return Boolean(result.rowCount);
}

export async function listActiveUserIds(db = dbOrDefault()): Promise<number[]> {
  const result = await db.query(
    `SELECT id
     FROM users
     WHERE status = 'active'
     ORDER BY id ASC`
  );

  return rowsToIds(result.rows);
}

export async function listAffectedUsersByTeam(teamId: number, db = dbOrDefault()): Promise<number[] | null> {
  const exists = await ensureTargetExists('teams', teamId, db);
  if (!exists) {
    return null;
  }

  const result = await db.query(
    `SELECT DISTINCT u.id
     FROM users u
     LEFT JOIN teams t ON t.id = $1
     WHERE u.status = 'active'
       AND (u.team_id = $1 OR u.id = t.manager_id)
     ORDER BY u.id ASC`,
    [teamId]
  );

  return rowsToIds(result.rows);
}

export async function listAffectedUsersByEmployee(userId: number, db = dbOrDefault()): Promise<number[] | null> {
  const result = await db.query(
    `SELECT id
     FROM users
     WHERE id = $1
       AND status = 'active'
     ORDER BY id ASC`,
    [userId]
  );

  if (!result.rowCount) {
    return null;
  }

  return rowsToIds(result.rows);
}

export async function listAffectedUsersByShop(shopId: number, db = dbOrDefault()): Promise<number[] | null> {
  const exists = await ensureTargetExists('workspaces', shopId, db);
  if (!exists) {
    return null;
  }

  const result = await db.query(
    `SELECT DISTINCT u.id
     FROM users u
     LEFT JOIN shop_assignments sa ON sa.user_id = u.id AND sa.shop_id = $1
     LEFT JOIN workspaces s ON s.id = $1
     LEFT JOIN teams t ON t.id = s.team_id
     WHERE u.status = 'active'
       AND (sa.user_id IS NOT NULL OR u.id = t.manager_id)
     ORDER BY u.id ASC`,
    [shopId]
  );

  return rowsToIds(result.rows);
}

export async function listAffectedUsersByScope(target: ScopeTarget, db = dbOrDefault()): Promise<number[] | null> {
  if (target.scope === 'all') {
    return listActiveUserIds(db);
  }

  if (!target.targetId) {
    return null;
  }

  if (target.scope === 'team') {
    return listAffectedUsersByTeam(target.targetId, db);
  }

  if (target.scope === 'employee') {
    return listAffectedUsersByEmployee(target.targetId, db);
  }

  return listAffectedUsersByShop(target.targetId, db);
}

export async function recordEmergencyEvent(input: EmergencyEventInput, db = dbOrDefault()) {
  const result = await db.query(
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

export async function getEmergencyStatus(userId: number, db = dbOrDefault()): Promise<EmergencyStatusResponse> {
  const result = await db.query(
    `SELECT
       COUNT(*) FILTER (
         WHERE event_type = 'manual_lockout'
           AND triggered_at >= NOW() - INTERVAL '24 hours'
       ) AS lockouts_last_24h,
       COUNT(*) FILTER (
         WHERE event_type = 'manual_lockout'
           AND triggered_at >= NOW() - INTERVAL '24 hours'
           AND affected_users @> ARRAY[$1]::int[]
       ) AS self_lockouts
     FROM emergency_events`,
    [userId]
  );

  const row = result.rows[0] ?? { lockouts_last_24h: 0, self_lockouts: 0 };
  return {
    lockoutsLast24h: Number(row.lockouts_last_24h),
    selfLockedOut: Number(row.self_lockouts) > 0
  };
}
