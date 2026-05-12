export type LockoutScope = 'all' | 'team' | 'employee' | 'shop';

export type LockoutRequest = {
  scope: LockoutScope;
  targetId?: number | null;
  reason: string;
};

export type LockoutResponse = {
  ok: true;
  affected: number[];
  eventId: number;
};

export type EmergencyStatusResponse = {
  lockoutsLast24h: number;
  selfLockedOut: boolean;
};

export type EmergencyLockoutWsPayload = {
  scope: LockoutScope;
  reason: string;
  ts: string;
  affectedUserIds: number[];
};
