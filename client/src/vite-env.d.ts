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
  ExtensionInstallRequest,
  ExtensionInstallResponse,
  ExtensionListResponse,
  ShopCreateRequest,
  ShopCreateResponse,
  ShopListResponse,
  ShopOpenResponse,
  UnlockResponse,
  WorkspaceCategoriesResponse,
  WorkspaceCreateRequest,
  WorkspaceCreateResponse,
  WorkspaceDetachResponse,
  WorkspaceExtensionBindResponse,
  WorkspaceExtensionsResponse,
  WorkspaceListResponse,
  WorkspaceUpdateRequest,
  WorkspaceUpdateResponse,
  WorkspaceViewBounds
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
      workspaces: {
        list: () => Promise<WorkspaceListResponse>;
        categories: () => Promise<WorkspaceCategoriesResponse>;
        create: (request: WorkspaceCreateRequest) => Promise<WorkspaceCreateResponse>;
        update: (workspaceId: number, request: WorkspaceUpdateRequest) => Promise<WorkspaceUpdateResponse>;
        activate: (workspaceId: number) => Promise<ShopOpenResponse>;
        detach: (workspaceId: number) => Promise<WorkspaceDetachResponse>;
        close: (workspaceId: number) => Promise<void>;
        reload: (workspaceId: number) => Promise<void>;
        openDevTools: (workspaceId: number) => Promise<void>;
        setViewBounds: (bounds: WorkspaceViewBounds) => Promise<void>;
      };
      extensions: {
        list: () => Promise<ExtensionListResponse>;
        installFile: (
          fileName: string,
          bytes: Uint8Array,
          sourceType: 'crx' | 'zip',
          name?: string | null
        ) => Promise<ExtensionInstallResponse>;
        installGithub: (request: ExtensionInstallRequest) => Promise<ExtensionInstallResponse>;
        uninstall: (extensionId: string) => Promise<{ ok: true }>;
        toggle: (extensionId: string, enabled: boolean) => Promise<ExtensionInstallResponse>;
        listForWorkspace: (workspaceId: number) => Promise<WorkspaceExtensionsResponse>;
        bind: (workspaceId: number, extensionId: string) => Promise<WorkspaceExtensionBindResponse>;
        unbind: (workspaceId: number, extensionId: string) => Promise<{ ok: true }>;
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
