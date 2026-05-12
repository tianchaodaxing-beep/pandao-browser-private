export type ActorType = 'human' | 'ai';
export type RiskLevel = 'green' | 'yellow' | 'red';
export type ApprovalStatus = 'auto' | 'pending' | 'approved' | 'denied';

export type ActionFieldSelector = {
  name: string;
  selector: string;
  read?: 'value' | 'textContent';
};

export type ActionSelectorEntry = {
  actionType: string;
  submitSelector: string;
  fields?: ActionFieldSelector[];
};

export type ActionSelectorMap = Record<string, ActionSelectorEntry[]>;

export type ActionLogInput = {
  actorType: ActorType;
  shopId: number;
  actionType: string;
  actionPayload?: unknown;
  before?: unknown;
  after?: unknown;
  riskLevel?: RiskLevel;
  approvalStatus?: ApprovalStatus;
};

export type ActionLogResponse = {
  id: string;
  createdAt: string;
};

export type ActionScreenshotResponse = {
  ok: true;
  path: string;
};

export type ActionSelectorsResponse = {
  selectors: ActionSelectorEntry[];
};

export type ActionRecorderPayload = {
  shopId: number;
  actionType: string;
  actionPayload?: unknown;
  before?: unknown;
  after?: unknown;
  riskLevel?: RiskLevel;
  approvalStatus?: ApprovalStatus;
};
