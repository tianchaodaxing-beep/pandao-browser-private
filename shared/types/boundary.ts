import type { RiskLevel } from './actions.js';

export type BoundaryAction = {
  command: string;
  payload?: unknown;
  currentValue?: unknown;
};

export type EvaluationResult = {
  riskLevel: RiskLevel;
  approvalRequired: boolean;
  reason: string;
};

export type EmergencyEventType =
  | 'boundary_red_attempted'
  | 'manual_lockout'
  | 'frozen_ai'
  | 'expired_approval'
  | 'manual_unfreeze';

export type EmergencyScope = 'all' | 'team' | 'employee' | 'shop' | 'ai' | 'task';

export type EmergencyEventInput = {
  triggeredBy: number | null;
  eventType: EmergencyEventType;
  scope: EmergencyScope;
  scopeTargetId: number | null;
  reason: string;
  affectedUsers?: number[];
  metadata?: unknown;
};
