import type { AiRiskLevel } from 'shared';
import type { BoundaryAction } from 'shared';
import { evaluateAction } from '../boundary/rules.js';

export type BoundaryDecision = {
  status: 'approved' | 'pending' | 'denied';
  riskLevel: AiRiskLevel;
  approvalRequired: boolean;
  reason: string;
};

export function boundaryEvaluate(action: BoundaryAction): BoundaryDecision {
  const evaluation = evaluateAction(action);

  return {
    status: evaluation.riskLevel === 'green' ? 'approved' : evaluation.riskLevel === 'yellow' ? 'pending' : 'denied',
    riskLevel: evaluation.riskLevel,
    approvalRequired: evaluation.approvalRequired,
    reason: evaluation.reason
  };
}
