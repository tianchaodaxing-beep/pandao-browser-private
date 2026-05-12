export type Role = 'boss' | 'manager' | 'staff' | 'ai';

export type AuthStatus = 'active' | 'disabled' | 'frozen';

export type AuthUser = {
  id: number;
  username: string;
  role: Role;
  teamId: number | null;
  displayName: string | null;
  status: AuthStatus;
};

export type LoginRequest = {
  username: string;
  password: string;
};

export type LoginResponse = {
  token: string;
  refreshToken: string;
  user: AuthUser;
};

export type RefreshRequest = {
  refreshToken: string;
};

export type RefreshResponse = {
  token: string;
  refreshToken: string;
};
