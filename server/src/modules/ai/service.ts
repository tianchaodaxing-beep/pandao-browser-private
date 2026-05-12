import type {
  AiRiskLevel,
  AiTask,
  AiTaskInput,
  AiTaskResultInput,
  AiTaskResultStatus,
  AuthUser
} from 'shared';
import { findUserRecordById } from '../auth/repository.js';
import { handleBoundaryRedAttempt } from '../boundary/engine.js';
import { boundaryEvaluate } from './boundary-stub.js';
import { dispatchToShopStaff, notifyAiTaskApproved, notifyAiTaskDenied, notifyManager } from './dispatcher.js';
import {
  approvePendingAiTask,
  canUserAccessShop,
  canUserManageShop,
  completeAssignedAiTask,
  denyPendingAiTask,
  findActiveShop,
  findAiTaskById,
  insertAiTask,
  listAssignedOpenAiTasks,
  listPendingApprovalTasksForUser,
  updateAiTaskBoundary
} from './repository.js';

export class AiServiceError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: string,
    message: string
  ) {
    super(message);
    this.name = 'AiServiceError';
  }
}

function parsePositiveInt(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function readString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

type RawAiTaskInput = Partial<AiTaskInput> & {
  shop_id?: unknown;
  currentValue?: unknown;
  current_value?: unknown;
};

type SanitizedAiTaskInput = AiTaskInput & {
  currentValue?: unknown;
};

function sanitizeTaskInput(body: RawAiTaskInput): SanitizedAiTaskInput {
  const command = readString(body.command);
  const shopId = parsePositiveInt(body.shopId ?? body.shop_id);

  if (!command || command.length > 64) {
    throw new AiServiceError(400, 'INVALID_INPUT', 'command must be 1-64 characters');
  }

  if (!shopId) {
    throw new AiServiceError(400, 'INVALID_INPUT', 'shopId must be a positive integer');
  }

  return {
    command,
    shopId,
    payload: body.payload ?? null,
    currentValue: body.currentValue ?? body.current_value
  };
}

function sanitizeResultInput(body: Partial<AiTaskResultInput>): {
  status: AiTaskResultStatus;
  result: unknown;
} {
  const status = readString(body.status);

  if (status !== 'done' && status !== 'failed') {
    throw new AiServiceError(400, 'INVALID_INPUT', 'status must be done or failed');
  }

  const message = readString(body.message);
  const result = body.result ?? {
    status,
    ...(message ? { message } : {})
  };

  return {
    status,
    result
  };
}

async function assertAiCanSubmit(user: AuthUser) {
  if (user.role !== 'ai') {
    throw new AiServiceError(403, 'FORBIDDEN', 'only ai users can submit ai tasks');
  }

  const record = await findUserRecordById(user.id);
  if (!record || record.status !== 'active') {
    throw new AiServiceError(401, 'UNAUTHORIZED', 'ai account is not active');
  }

  if (record.frozenUntil && record.frozenUntil > new Date()) {
    throw new AiServiceError(423, 'AI_FROZEN', 'AI account is frozen');
  }
}

async function dispatchIfApproved(task: AiTask) {
  if (task.status !== 'approved') {
    return task;
  }

  const dispatchedTask = await dispatchToShopStaff(task);
  notifyAiTaskApproved(dispatchedTask);
  return dispatchedTask;
}

export async function submitAiTask(user: AuthUser, body: RawAiTaskInput) {
  await assertAiCanSubmit(user);
  const input = sanitizeTaskInput(body);

  const shop = await findActiveShop(input.shopId);
  if (!shop) {
    throw new AiServiceError(404, 'SHOP_NOT_FOUND', 'shop not found');
  }

  const decision = boundaryEvaluate({
    command: input.command,
    payload: input.payload ?? null,
    currentValue: input.currentValue
  });

  if (decision.status === 'denied') {
    await handleBoundaryRedAttempt({
      user,
      shopId: input.shopId,
      command: input.command,
      payload: input.payload ?? null,
      decision
    });
    throw new AiServiceError(403, 'BOUNDARY_RED', '触发边界红灯，AI 已冻结 1 小时');
  }

  const created = await insertAiTask({
    aiId: user.id,
    shopId: input.shopId,
    command: input.command,
    payload: input.payload ?? null
  });

  const evaluated = await updateAiTaskBoundary(
    created.id,
    decision.status,
    decision.riskLevel as AiRiskLevel,
    decision.approvalRequired
  );

  if (evaluated.status === 'denied') {
    notifyAiTaskDenied(evaluated);
    return evaluated;
  }

  if (evaluated.status === 'pending') {
    await notifyManager(evaluated);
    return evaluated;
  }

  return dispatchIfApproved(evaluated);
}

export async function getAiTaskForUser(user: AuthUser, taskId: number) {
  const task = await findAiTaskById(taskId);

  if (!task) {
    throw new AiServiceError(404, 'TASK_NOT_FOUND', 'task not found');
  }

  if (task.aiId === user.id || task.assignedTo === user.id) {
    return task;
  }

  const canAccess = await canUserAccessShop(user.id, user.role, task.shopId);
  if (!canAccess) {
    throw new AiServiceError(403, 'FORBIDDEN', 'no permission for this task');
  }

  return task;
}

export async function listAssignedAiTasks(user: AuthUser) {
  if (user.role === 'ai') {
    return [];
  }

  return listAssignedOpenAiTasks(user.id);
}

export async function listPendingApprovalTasks(user: AuthUser) {
  return listPendingApprovalTasksForUser(user.id, user.role);
}

export async function approveAiTaskForUser(user: AuthUser, taskId: number) {
  const task = await findAiTaskById(taskId);

  if (!task) {
    throw new AiServiceError(404, 'TASK_NOT_FOUND', 'task not found');
  }

  const canApprove = await canUserManageShop(user.id, user.role, task.shopId);
  if (!canApprove) {
    throw new AiServiceError(403, 'FORBIDDEN', 'only manager or boss can approve this task');
  }

  const approved = await approvePendingAiTask(taskId);
  if (!approved) {
    throw new AiServiceError(409, 'TASK_STATE_CONFLICT', 'task is not pending');
  }

  return dispatchIfApproved(approved);
}

export async function denyAiTaskForUser(user: AuthUser, taskId: number, reason: string | null) {
  const task = await findAiTaskById(taskId);

  if (!task) {
    throw new AiServiceError(404, 'TASK_NOT_FOUND', 'task not found');
  }

  const canDeny = await canUserManageShop(user.id, user.role, task.shopId);
  if (!canDeny) {
    throw new AiServiceError(403, 'FORBIDDEN', 'only manager or boss can deny this task');
  }

  const denied = await denyPendingAiTask(taskId, reason);
  if (!denied) {
    throw new AiServiceError(409, 'TASK_STATE_CONFLICT', 'task is not pending');
  }

  notifyAiTaskDenied(denied);
  return denied;
}

export async function submitAiTaskResult(user: AuthUser, taskId: number, body: Partial<AiTaskResultInput>) {
  const task = await findAiTaskById(taskId);

  if (!task) {
    throw new AiServiceError(404, 'TASK_NOT_FOUND', 'task not found');
  }

  if (task.assignedTo !== user.id) {
    throw new AiServiceError(403, 'FORBIDDEN', 'task is not assigned to this user');
  }

  if (task.status !== 'approved' && task.status !== 'executing') {
    throw new AiServiceError(409, 'TASK_STATE_CONFLICT', 'task is not executable');
  }

  const input = sanitizeResultInput(body);
  const completed = await completeAssignedAiTask(taskId, user.id, input.status, input.result);

  if (!completed) {
    throw new AiServiceError(409, 'TASK_STATE_CONFLICT', 'task could not be completed');
  }

  return completed;
}

export function parseTaskId(value: unknown) {
  return parsePositiveInt(value);
}
