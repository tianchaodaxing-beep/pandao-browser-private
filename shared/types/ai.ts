import type { RiskLevel } from './actions.js';

export type AiTaskStatus = 'pending' | 'approved' | 'denied' | 'executing' | 'done' | 'failed';

export type AiTaskCommand = 'query.product.list' | 'query.order.list' | 'product.price.update' | string;

export type AiRiskLevel = RiskLevel;

export type AiTaskInput = {
  command: AiTaskCommand;
  shopId: number;
  payload?: unknown;
};

export type AiTask = {
  id: number;
  aiId: number;
  shopId: number;
  command: AiTaskCommand;
  payload: unknown | null;
  status: AiTaskStatus;
  riskLevel: AiRiskLevel;
  approvalRequired: boolean;
  assignedTo: number | null;
  result: unknown | null;
  createdAt: string;
  approvedAt: string | null;
  executedAt: string | null;
  escalatedAt: string | null;
};

export type AiTaskSubmitResponse = {
  id: number;
  status: AiTaskStatus;
  riskLevel: AiRiskLevel;
  approvalRequired: boolean;
};

export type AiTaskResultStatus = 'done' | 'failed';

export type AiTaskResultInput = {
  status: AiTaskResultStatus;
  result?: unknown;
  message?: string;
};

export type AiTaskExecutionResponse = {
  ok: true;
  taskId: number;
  status: AiTaskResultStatus;
  message?: string;
};

export type WsEventType =
  | 'ai.task.assigned'
  | 'ai.task.approved'
  | 'ai.task.denied'
  | 'ai.task.pending'
  | 'emergency.approval_overdue'
  | 'emergency.lockout';

export type WsEvent<TPayload extends object = Record<string, unknown>> = {
  type: WsEventType;
  payload: TPayload;
  ts: string;
};
