import type { QueryResultRow } from 'pg';
import type { AiRiskLevel, AiTask, AiTaskResultStatus, AiTaskStatus, Role } from 'shared';
import { getDbPool } from '../../db/pool.js';

export type AiTaskInsertInput = {
  aiId: number;
  shopId: number;
  command: string;
  payload: unknown | null;
};

export type DispatchCandidate = {
  userId: number;
  role: Role;
};

export type ShopSummary = {
  id: number;
  name: string;
};

const aiTaskStatuses = ['pending', 'approved', 'denied', 'executing', 'done', 'failed'] as const;
const riskLevels = ['green', 'yellow', 'red'] as const;

const aiTaskColumns = `
  id, ai_id, shop_id, command, payload, status, risk_level,
  approval_required, assigned_to, result, created_at, approved_at, executed_at, escalated_at
`;

function assertAiTaskStatus(value: unknown): AiTaskStatus {
  if (typeof value !== 'string' || !aiTaskStatuses.includes(value as AiTaskStatus)) {
    throw new Error(`Unsupported ai task status: ${String(value)}`);
  }

  return value as AiTaskStatus;
}

function assertRiskLevel(value: unknown): AiRiskLevel {
  if (typeof value !== 'string' || !riskLevels.includes(value as AiRiskLevel)) {
    throw new Error(`Unsupported risk level: ${String(value)}`);
  }

  return value as AiRiskLevel;
}

function optionalIso(value: unknown): string | null {
  return value ? new Date(value as Date | string).toISOString() : null;
}

function toAiTask(row: QueryResultRow): AiTask {
  return {
    id: Number(row.id),
    aiId: Number(row.ai_id),
    shopId: Number(row.shop_id),
    command: String(row.command),
    payload: row.payload ?? null,
    status: assertAiTaskStatus(row.status),
    riskLevel: assertRiskLevel(row.risk_level),
    approvalRequired: Boolean(row.approval_required),
    assignedTo: row.assigned_to === null ? null : Number(row.assigned_to),
    result: row.result ?? null,
    createdAt: new Date(row.created_at).toISOString(),
    approvedAt: optionalIso(row.approved_at),
    executedAt: optionalIso(row.executed_at),
    escalatedAt: optionalIso(row.escalated_at)
  };
}

export async function insertAiTask(input: AiTaskInsertInput): Promise<AiTask> {
  const result = await getDbPool().query(
    `INSERT INTO ai_tasks (ai_id, shop_id, command, payload, status, risk_level, approval_required)
     VALUES ($1, $2, $3, $4, 'pending', 'green', TRUE)
     RETURNING ${aiTaskColumns}`,
    [input.aiId, input.shopId, input.command, input.payload]
  );

  return toAiTask(result.rows[0]);
}

export async function updateAiTaskBoundary(
  taskId: number,
  status: Extract<AiTaskStatus, 'pending' | 'approved' | 'denied'>,
  riskLevel: AiRiskLevel,
  approvalRequired: boolean
): Promise<AiTask> {
  const result = await getDbPool().query(
    `UPDATE ai_tasks
     SET status = $2::varchar,
         risk_level = $3::varchar,
         approval_required = $4,
         approved_at = CASE WHEN $2::text = 'approved' THEN NOW() ELSE approved_at END
     WHERE id = $1
     RETURNING ${aiTaskColumns}`,
    [taskId, status, riskLevel, approvalRequired]
  );

  return toAiTask(result.rows[0]);
}

export async function findAiTaskById(taskId: number): Promise<AiTask | null> {
  const result = await getDbPool().query(
    `SELECT ${aiTaskColumns}
     FROM ai_tasks
     WHERE id = $1
     LIMIT 1`,
    [taskId]
  );

  return result.rowCount ? toAiTask(result.rows[0]) : null;
}

export async function listAssignedOpenAiTasks(userId: number): Promise<AiTask[]> {
  const result = await getDbPool().query(
    `SELECT ${aiTaskColumns}
     FROM ai_tasks
     WHERE assigned_to = $1
       AND status IN ('approved', 'executing')
     ORDER BY created_at DESC
     LIMIT 50`,
    [userId]
  );

  return result.rows.map(toAiTask);
}

export async function listPendingApprovalTasksForUser(userId: number, role: Role): Promise<AiTask[]> {
  if (role === 'boss') {
    const result = await getDbPool().query(
      `SELECT ${aiTaskColumns}
       FROM ai_tasks
       WHERE status = 'pending'
         AND approval_required = TRUE
       ORDER BY created_at DESC
       LIMIT 100`
    );

    return result.rows.map(toAiTask);
  }

  if (role !== 'manager') {
    return [];
  }

  const result = await getDbPool().query(
    `SELECT
       task.id, task.ai_id, task.shop_id, task.command, task.payload, task.status, task.risk_level,
       task.approval_required, task.assigned_to, task.result, task.created_at, task.approved_at,
       task.executed_at, task.escalated_at
     FROM ai_tasks task
     JOIN workspaces s ON s.id = task.shop_id
     JOIN teams t ON t.id = s.team_id
     WHERE task.status = 'pending'
       AND task.approval_required = TRUE
       AND t.manager_id = $1
     ORDER BY task.created_at DESC
     LIMIT 100`,
    [userId]
  );

  return result.rows.map(toAiTask);
}

export async function setAiTaskAssignedTo(taskId: number, userId: number): Promise<AiTask | null> {
  const result = await getDbPool().query(
    `UPDATE ai_tasks
     SET assigned_to = $2
     WHERE id = $1
       AND status = 'approved'
     RETURNING ${aiTaskColumns}`,
    [taskId, userId]
  );

  return result.rowCount ? toAiTask(result.rows[0]) : null;
}

export async function approvePendingAiTask(taskId: number): Promise<AiTask | null> {
  const result = await getDbPool().query(
    `UPDATE ai_tasks
     SET status = 'approved',
         approved_at = NOW()
     WHERE id = $1
       AND status = 'pending'
     RETURNING ${aiTaskColumns}`,
    [taskId]
  );

  return result.rowCount ? toAiTask(result.rows[0]) : null;
}

export async function denyPendingAiTask(taskId: number, reason: string | null): Promise<AiTask | null> {
  const result = await getDbPool().query(
    `UPDATE ai_tasks
     SET status = 'denied',
         result = $2
     WHERE id = $1
       AND status = 'pending'
     RETURNING ${aiTaskColumns}`,
    [taskId, reason ? { message: reason } : null]
  );

  return result.rowCount ? toAiTask(result.rows[0]) : null;
}

export async function completeAssignedAiTask(
  taskId: number,
  assignedTo: number,
  status: AiTaskResultStatus,
  resultPayload: unknown
): Promise<AiTask | null> {
  const result = await getDbPool().query(
    `UPDATE ai_tasks
     SET status = $3,
         result = $4,
         executed_at = NOW()
     WHERE id = $1
       AND assigned_to = $2
       AND status IN ('approved', 'executing')
     RETURNING ${aiTaskColumns}`,
    [taskId, assignedTo, status, resultPayload]
  );

  return result.rowCount ? toAiTask(result.rows[0]) : null;
}

export async function findActiveShop(shopId: number): Promise<ShopSummary | null> {
  const result = await getDbPool().query(
    `SELECT id, name
     FROM workspaces
     WHERE id = $1
       AND status = 'active'
     LIMIT 1`,
    [shopId]
  );

  if (!result.rowCount) {
    return null;
  }

  return {
    id: Number(result.rows[0].id),
    name: String(result.rows[0].name)
  };
}

export async function canUserManageShop(userId: number, role: Role, shopId: number): Promise<boolean> {
  if (role === 'boss') {
    return true;
  }

  if (role !== 'manager') {
    return false;
  }

  const result = await getDbPool().query(
    `SELECT 1
     FROM workspaces s
     JOIN teams t ON t.id = s.team_id
     WHERE s.id = $1
       AND t.manager_id = $2
     LIMIT 1`,
    [shopId, userId]
  );

  return Boolean(result.rowCount);
}

export async function canUserAccessShop(userId: number, role: Role, shopId: number): Promise<boolean> {
  if (role === 'boss') {
    return true;
  }

  if (role === 'manager') {
    return canUserManageShop(userId, role, shopId);
  }

  if (role !== 'staff') {
    return false;
  }

  const result = await getDbPool().query(
    `SELECT 1
     FROM shop_assignments
     WHERE user_id = $1
       AND shop_id = $2
     LIMIT 1`,
    [userId, shopId]
  );

  return Boolean(result.rowCount);
}

export async function findDispatchCandidates(shopId: number): Promise<DispatchCandidate[]> {
  const staff = await getDbPool().query(
    `SELECT u.id, u.role
     FROM shop_assignments sa
     JOIN users u ON u.id = sa.user_id
     WHERE sa.shop_id = $1
       AND u.role = 'staff'
       AND u.status = 'active'
       AND (u.frozen_until IS NULL OR u.frozen_until <= NOW())
     ORDER BY u.id ASC`,
    [shopId]
  );

  if (staff.rowCount) {
    return staff.rows.map((row) => ({ userId: Number(row.id), role: row.role as Role }));
  }

  const managers = await getDbPool().query(
    `SELECT u.id, u.role
     FROM workspaces s
     JOIN teams t ON t.id = s.team_id
     JOIN users u ON u.id = t.manager_id
     WHERE s.id = $1
       AND u.role = 'manager'
       AND u.status = 'active'
       AND (u.frozen_until IS NULL OR u.frozen_until <= NOW())
     ORDER BY u.id ASC`,
    [shopId]
  );

  if (managers.rowCount) {
    return managers.rows.map((row) => ({ userId: Number(row.id), role: row.role as Role }));
  }

  const bosses = await getDbPool().query(
    `SELECT id, role
     FROM users
     WHERE role = 'boss'
       AND status = 'active'
       AND (frozen_until IS NULL OR frozen_until <= NOW())
     ORDER BY id ASC`
  );

  return bosses.rows.map((row) => ({ userId: Number(row.id), role: row.role as Role }));
}

export async function findApprovalRecipients(shopId: number): Promise<DispatchCandidate[]> {
  const recipients = new Map<number, DispatchCandidate>();
  const managerResult = await getDbPool().query(
    `SELECT u.id, u.role
     FROM workspaces s
     JOIN teams t ON t.id = s.team_id
     JOIN users u ON u.id = t.manager_id
     WHERE s.id = $1
       AND u.role = 'manager'
       AND u.status = 'active'
       AND (u.frozen_until IS NULL OR u.frozen_until <= NOW())`,
    [shopId]
  );

  for (const row of managerResult.rows) {
    recipients.set(Number(row.id), { userId: Number(row.id), role: row.role as Role });
  }

  const bossResult = await getDbPool().query(
    `SELECT id, role
     FROM users
     WHERE role = 'boss'
       AND status = 'active'
       AND (frozen_until IS NULL OR frozen_until <= NOW())
     ORDER BY id ASC`
  );

  for (const row of bossResult.rows) {
    recipients.set(Number(row.id), { userId: Number(row.id), role: row.role as Role });
  }

  return [...recipients.values()];
}

export async function findActiveBossIds(): Promise<number[]> {
  const result = await getDbPool().query(
    `SELECT id
     FROM users
     WHERE role = 'boss'
       AND status = 'active'
       AND (frozen_until IS NULL OR frozen_until <= NOW())
     ORDER BY id ASC`
  );

  return result.rows.map((row) => Number(row.id));
}

export async function markOverduePendingAiTasks(): Promise<AiTask[]> {
  const result = await getDbPool().query(
    `UPDATE ai_tasks
     SET escalated_at = NOW()
     WHERE status = 'pending'
       AND approval_required = TRUE
       AND escalated_at IS NULL
       AND created_at < NOW() - INTERVAL '24 hours'
     RETURNING ${aiTaskColumns}`
  );

  return result.rows.map(toAiTask);
}
