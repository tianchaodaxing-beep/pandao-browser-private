/// <reference types="vite/client" />

import type {
  AuthUser,
  LockStatusResponse,
  LoginRequest,
  ShopListResponse,
  ShopOpenResponse,
  UnlockResponse
} from 'shared';

declare global {
  interface Window {
    pandao?: {
      auth: {
        login: (credentials: LoginRequest) => Promise<AuthUser>;
        logout: () => Promise<void>;
        me: () => Promise<AuthUser | null>;
      };
      admin: {
        lockStatus: () => Promise<LockStatusResponse>;
        unlock: (keyBytes: Uint8Array) => Promise<UnlockResponse>;
      };
      shops: {
        list: () => Promise<ShopListResponse>;
        open: (shopId: number) => Promise<ShopOpenResponse>;
        close: (shopId: number) => Promise<void>;
      };
    };
  }
}

export {};
