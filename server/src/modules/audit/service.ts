import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type {
  ActionLogInput,
  ActionLogResponse,
  ActionScreenshotResponse,
  ActorType,
  ApprovalStatus
} from 'shared';
import type { AuthUser } from '../auth/types.js';
import { findActionLogActor, insertActionLog, setScreenshotPath } from './repository.js';

export const MAX_SCREENSHOT_BYTES = 4 * 1024 * 1024;

const validActorTypes = new Set<ActorType>(['human', 'ai']);
const validApprovalStatuses = new Set<ApprovalStatus>(['auto', 'pending', 'approved', 'denied']);

export class AuditServiceError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: string,
    message: string
  ) {
    super(message);
    this.name = 'AuditServiceError';
  }
}

export function getDataRoot() {
  return process.env.PANDAO_DATA_ROOT ?? 'C:\\pandao-browser-server\\data';
}

function getShanghaiPathParts(now = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  const [year, month, day] = formatter.format(now).split('-');
  return { year, month, day };
}

type RawActionLogBody = Partial<ActionLogInput> & {
  actor_type?: unknown;
  shop_id?: unknown;
  action_type?: unknown;
  action_payload?: unknown;
  risk_level?: unknown;
  approval_status?: unknown;
};

function readString(value: unknown) {
  return typeof value === 'string' ? value : undefined;
}

function isActorType(value: string): value is ActorType {
  return validActorTypes.has(value as ActorType);
}

function isApprovalStatus(value: string): value is ApprovalStatus {
  return validApprovalStatuses.has(value as ApprovalStatus);
}

function sanitizeActionLogInput(body: RawActionLogBody): ActionLogInput {
  const actorType = readString(body.actorType) ?? readString(body.actor_type) ?? 'human';
  const actionType = (readString(body.actionType) ?? readString(body.action_type) ?? '').trim();
  const shopId = Number(body.shopId ?? body.shop_id);

  if (!isActorType(actorType)) {
    throw new AuditServiceError(400, 'INVALID_INPUT', 'actorType 无效');
  }

  if (!Number.isInteger(shopId) || shopId <= 0) {
    throw new AuditServiceError(400, 'INVALID_INPUT', 'shopId 必须是正整数');
  }

  if (!actionType || actionType.length > 64) {
    throw new AuditServiceError(400, 'INVALID_INPUT', 'actionType 必须是 1-64 字符');
  }

  const approvalStatus = readString(body.approvalStatus) ?? readString(body.approval_status) ?? 'auto';
  if (!isApprovalStatus(approvalStatus)) {
    throw new AuditServiceError(400, 'INVALID_INPUT', 'approvalStatus 无效');
  }

  return {
    actorType,
    shopId,
    actionType,
    actionPayload: body.actionPayload ?? body.action_payload ?? null,
    before: body.before ?? null,
    after: body.after ?? null,
    // TODO[WO-010]: replace green-only default with boundary rule engine output.
    riskLevel: 'green',
    approvalStatus
  };
}

export async function createActionLog(
  user: AuthUser,
  body: RawActionLogBody,
  ipAddress: string | null,
  userAgent: string | null
): Promise<ActionLogResponse> {
  const input = sanitizeActionLogInput(body);

  return insertActionLog({
    ...input,
    actorId: user.id,
    ipAddress,
    userAgent
  });
}

export async function saveScreenshotForLog(
  user: AuthUser,
  logId: string,
  screenshot: Buffer
): Promise<ActionScreenshotResponse> {
  if (!logId) {
    throw new AuditServiceError(400, 'INVALID_INPUT', 'log_id 不能为空');
  }

  if (!screenshot.length || screenshot.length > MAX_SCREENSHOT_BYTES) {
    throw new AuditServiceError(413, 'SCREENSHOT_TOO_LARGE', '截图不能超过 4MB');
  }

  const actorId = await findActionLogActor(logId);
  if (!actorId || actorId !== user.id) {
    throw new AuditServiceError(403, 'FORBIDDEN', '无权上传该日志截图');
  }

  const { year, month, day } = getShanghaiPathParts();
  const relativePath = `${year}/${month}/${day}/${randomUUID()}.png`;
  const absolutePath = path.join(getDataRoot(), 'screenshots', year, month, day);
  await fs.mkdir(absolutePath, { recursive: true });
  await fs.writeFile(path.join(absolutePath, path.basename(relativePath)), screenshot);

  const saved = await setScreenshotPath(logId, user.id, relativePath);
  if (!saved) {
    throw new AuditServiceError(403, 'FORBIDDEN', '无权上传该日志截图');
  }

  return { ok: true, path: relativePath };
}
