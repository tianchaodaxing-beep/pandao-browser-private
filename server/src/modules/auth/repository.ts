import type { QueryResultRow } from 'pg';
import { getDbPool } from '../../db/pool.js';
import { assertRole, assertStatus } from '../rbac/index.js';
import type { AuthUser, UserRecord } from './types.js';

function toUser(row: QueryResultRow): AuthUser {
  return {
    id: Number(row.id),
    username: String(row.username),
    role: assertRole(row.role),
    teamId: row.team_id === null ? null : Number(row.team_id),
    displayName: row.display_name === null ? null : String(row.display_name),
    status: assertStatus(row.status)
  };
}

function toUserRecord(row: QueryResultRow): UserRecord {
  return {
    ...toUser(row),
    passwordHash: String(row.password_hash),
    frozenUntil: row.frozen_until ? new Date(row.frozen_until) : null
  };
}

export async function findUserByUsername(username: string): Promise<UserRecord | null> {
  const result = await getDbPool().query(
    `SELECT id, username, password_hash, role, team_id, display_name, status, frozen_until
     FROM users
     WHERE username = $1
     LIMIT 1`,
    [username]
  );

  return result.rowCount ? toUserRecord(result.rows[0]) : null;
}

export async function findUserById(userId: number): Promise<AuthUser | null> {
  const result = await getDbPool().query(
    `SELECT id, username, role, team_id, display_name, status
     FROM users
     WHERE id = $1
     LIMIT 1`,
    [userId]
  );

  return result.rowCount ? toUser(result.rows[0]) : null;
}

export async function findUserRecordById(userId: number): Promise<UserRecord | null> {
  const result = await getDbPool().query(
    `SELECT id, username, password_hash, role, team_id, display_name, status, frozen_until
     FROM users
     WHERE id = $1
     LIMIT 1`,
    [userId]
  );

  return result.rowCount ? toUserRecord(result.rows[0]) : null;
}

export async function updateLastLogin(userId: number) {
  await getDbPool().query('UPDATE users SET last_login_at = NOW() WHERE id = $1', [userId]);
}

export async function storeRefreshToken(userId: number, jti: string, expiresAt: Date) {
  await getDbPool().query(
    `INSERT INTO refresh_tokens (user_id, jti, expires_at)
     VALUES ($1, $2, $3)`,
    [userId, jti, expiresAt]
  );
}

export async function revokeRefreshToken(jti: string) {
  await getDbPool().query(
    `UPDATE refresh_tokens
     SET revoked_at = NOW()
     WHERE jti = $1 AND revoked_at IS NULL`,
    [jti]
  );
}

export async function findUserByRefreshJti(jti: string): Promise<AuthUser | null> {
  const result = await getDbPool().query(
    `SELECT u.id, u.username, u.role, u.team_id, u.display_name, u.status
     FROM refresh_tokens rt
     JOIN users u ON u.id = rt.user_id
     WHERE rt.jti = $1
       AND rt.revoked_at IS NULL
       AND rt.expires_at > NOW()
       AND u.status = 'active'
     LIMIT 1`,
    [jti]
  );

  return result.rowCount ? toUser(result.rows[0]) : null;
}

export async function upsertBossUser(passwordHash: string) {
  const result = await getDbPool().query(
    `INSERT INTO users (username, password_hash, role, display_name, status)
     VALUES ('boss', $1, 'boss', $2, 'active')
     ON CONFLICT (username) DO UPDATE
       SET password_hash = EXCLUDED.password_hash,
           role = 'boss',
           display_name = EXCLUDED.display_name,
           status = 'active',
           frozen_until = NULL
     RETURNING id, username, role, team_id, display_name, status`,
    [passwordHash, 'Boss']
  );

  return toUser(result.rows[0]);
}

export async function upsertAiUser(passwordHash: string) {
  const result = await getDbPool().query(
    `INSERT INTO users (username, password_hash, role, display_name, status)
     VALUES ('ai', $1, 'ai', $2, 'active')
     ON CONFLICT (username) DO UPDATE
       SET password_hash = EXCLUDED.password_hash,
           role = 'ai',
           display_name = EXCLUDED.display_name,
           status = 'active',
           frozen_until = NULL
     RETURNING id, username, role, team_id, display_name, status`,
    [passwordHash, 'Secretary AI']
  );

  return toUser(result.rows[0]);
}
