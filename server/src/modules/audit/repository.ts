import type { QueryResultRow } from 'pg';
import type { ActionLogInput, ActionLogResponse } from 'shared';
import { getDbPool } from '../../db/pool.js';

export type InsertActionLogInput = ActionLogInput & {
  actorId: number;
  ipAddress: string | null;
  userAgent: string | null;
};

const shanghaiFormatter = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Asia/Shanghai',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false
});

function formatShanghaiDate(value: Date | string): string {
  return shanghaiFormatter.format(new Date(value));
}

function toActionLogResponse(row: QueryResultRow): ActionLogResponse {
  return {
    id: String(row.id),
    createdAt: formatShanghaiDate(row.created_at)
  };
}

export async function insertActionLog(input: InsertActionLogInput): Promise<ActionLogResponse> {
  const result = await getDbPool().query(
    `INSERT INTO action_logs (
       actor_id, actor_type, shop_id, action_type, action_payload,
       before_value, after_value, risk_level, approval_status,
       approved_by, ip_address, user_agent
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NULL, $10, $11)
     RETURNING id, created_at`,
    [
      input.actorId,
      input.actorType,
      input.shopId,
      input.actionType,
      input.actionPayload ?? null,
      input.before ?? null,
      input.after ?? null,
      input.riskLevel ?? 'green',
      input.approvalStatus ?? 'auto',
      input.ipAddress,
      input.userAgent
    ]
  );

  return toActionLogResponse(result.rows[0]);
}

export async function findActionLogActor(logId: string): Promise<number | null> {
  const result = await getDbPool().query(
    `SELECT actor_id
     FROM action_logs
     WHERE id = $1
     LIMIT 1`,
    [logId]
  );

  return result.rowCount ? Number(result.rows[0].actor_id) : null;
}

export async function setScreenshotPath(logId: string, actorId: number, screenshotPath: string) {
  const client = await getDbPool().connect();

  try {
    await client.query('BEGIN');
    await client.query('ALTER TABLE action_logs DISABLE TRIGGER tg_action_logs_immutable');
    const result = await client.query(
      `UPDATE action_logs
       SET screenshot_path = $3
       WHERE id = $1
         AND actor_id = $2
       RETURNING id`,
      [logId, actorId, screenshotPath]
    );
    await client.query('ALTER TABLE action_logs ENABLE TRIGGER tg_action_logs_immutable');
    await client.query('COMMIT');
    return Boolean(result.rowCount);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function deleteExpiredActionLogs() {
  const client = await getDbPool().connect();

  try {
    await client.query('BEGIN');
    await client.query('ALTER TABLE action_logs DISABLE TRIGGER tg_action_logs_immutable');
    const result = await client.query(
      `DELETE FROM action_logs
       WHERE retention_until < NOW()`
    );
    await client.query('ALTER TABLE action_logs ENABLE TRIGGER tg_action_logs_immutable');
    await client.query('COMMIT');
    return result.rowCount ?? 0;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
