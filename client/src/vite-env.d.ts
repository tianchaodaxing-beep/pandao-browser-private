/// <reference types="vite/client" />

import type {
  AiTask,
  AiTaskExecutionResponse,
  AuthUser,
  EmergencyLockoutWsPayload,
  EmergencyStatusResponse,
  LockStatusResponse,
  LockoutRequest,
  LockoutResponse,
  LoginRequest,
  ProxyBatchRequest,
  ProxyBatchResponse,
  ProxyBindResponse,
  ProxyListResponse,
  ProxyUnbindResponse,
  ShopCreateRequest,
  ShopCreateResponse,
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
        emergencyStatus: () => Promise<EmergencyStatusResponse>;
        emergencyLockout: (request: LockoutRequest) => Promise<LockoutResponse>;
        onEmergencyLockout: (handler: (payload: EmergencyLockoutWsPayload) => void) => () => void;
      };
      shops: {
        list: () => Promise<ShopListResponse>;
        create: (request: ShopCreateRequest) => Promise<ShopCreateResponse>;
        open: (shopId: number) => Promise<ShopOpenResponse>;
        close: (shopId: number) => Promise<void>;
      };
      ai: {
        wsUrl: () => Promise<string>;
        list: () => Promise<{ tasks: AiTask[] }>;
        pending: () => Promise<{ tasks: AiTask[] }>;
        get: (taskId: number) => Promise<{ task: AiTask }>;
        approve: (taskId: number) => Promise<{ task: AiTask }>;
        deny: (taskId: number, reason?: string) => Promise<{ task: AiTask }>;
        execute: (taskId: number) => Promise<AiTaskExecutionResponse>;
        confirm: (taskId: number) => Promise<AiTaskExecutionResponse>;
      };
    };
  }
}

export {};
