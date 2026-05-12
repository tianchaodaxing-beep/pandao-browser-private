/// <reference types="vite/client" />

import type {
  AiTask,
  AiTaskExecutionResponse,
  AuthUser,
  LockStatusResponse,
  LoginRequest,
  ProxyBatchRequest,
  ProxyBatchResponse,
  ProxyBindResponse,
  ProxyListResponse,
  ProxyUnbindResponse,
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
        listProxies: () => Promise<ProxyListResponse>;
        batchProxies: (request: ProxyBatchRequest) => Promise<ProxyBatchResponse>;
        bindProxy: (proxyId: number, shopId: number) => Promise<ProxyBindResponse>;
        unbindProxy: (proxyId: number) => Promise<ProxyUnbindResponse>;
      };
      shops: {
        list: () => Promise<ShopListResponse>;
        open: (shopId: number) => Promise<ShopOpenResponse>;
        close: (shopId: number) => Promise<void>;
      };
      ai: {
        wsUrl: () => Promise<string>;
        list: () => Promise<{ tasks: AiTask[] }>;
        get: (taskId: number) => Promise<{ task: AiTask }>;
        execute: (taskId: number) => Promise<AiTaskExecutionResponse>;
        confirm: (taskId: number) => Promise<AiTaskExecutionResponse>;
      };
    };
  }
}

export {};
