import type { AuthStatus, AuthUser, Role } from 'shared';

export const authRoles = ['boss', 'manager', 'staff', 'ai'] as const satisfies Role[];

export type AuthJwtPayload = {
  sub: string;
  type: 'access';
  userId: number;
  username: string;
  role: Role;
  jti?: string;
  exp?: number;
};

export type RefreshJwtPayload = {
  sub: string;
  type: 'refresh';
  userId: number;
  username: string;
  role: Role;
  jti: string;
};

export type CredentialJwtPayload = {
  sub: string;
  type: 'credential';
  userId: number;
  shopId: number;
  jti: string;
};

export type AuthTokenPair = {
  token: string;
  refreshToken: string;
};

export type UserRecord = AuthUser & {
  passwordHash: string;
  frozenUntil: Date | null;
};

export type { AuthStatus, AuthUser, Role };
