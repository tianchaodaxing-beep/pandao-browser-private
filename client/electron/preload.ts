import { contextBridge, ipcRenderer } from 'electron';
import type { IpcRendererEvent } from 'electron';
import type {
  EmergencyLockoutWsPayload,
  LockoutRequest,
  LoginRequest,
  ProxyBatchRequest,
  ExtensionInstallRequest,
  ShopCloseRequest,
  ShopCreateRequest,
  ShopOpenRequest,
  WorkspaceCreateRequest,
  WorkspaceDetachRequest,
  WorkspaceUpdateRequest,
  WorkspaceViewBounds
} from 'shared';

contextBridge.exposeInMainWorld('pandao', {
  auth: {
    login: (credentials: LoginRequest) => ipcRenderer.invoke('auth.login', credentials),
    logout: () => ipcRenderer.invoke('auth.logout'),
    me: () => ipcRenderer.invoke('auth.me')
  },
  admin: {
    lockStatus: () => ipcRenderer.invoke('admin.lockStatus'),
    unlock: (keyBytes: Uint8Array) => ipcRenderer.invoke('admin.unlock', Array.from(keyBytes)),
    listProxies: () => ipcRenderer.invoke('admin.listProxies'),
    batchProxies: (request: ProxyBatchRequest) => ipcRenderer.invoke('admin.batchProxies', request),
    bindProxy: (proxyId: number, shopId: number) => ipcRenderer.invoke('admin.bindProxy', { proxyId, shopId }),
    unbindProxy: (proxyId: number) => ipcRenderer.invoke('admin.unbindProxy', proxyId),
    emergencyStatus: () => ipcRenderer.invoke('admin.emergencyStatus'),
    emergencyLockout: (request: LockoutRequest) => ipcRenderer.invoke('admin.emergencyLockout', request),
    onEmergencyLockout: (handler: (payload: EmergencyLockoutWsPayload) => void) => {
      const listener = (_event: IpcRendererEvent, payload: EmergencyLockoutWsPayload) => handler(payload);
      ipcRenderer.on('emergency.lockout', listener);
      return () => ipcRenderer.off('emergency.lockout', listener);
    }
  },
  shops: {
    list: () => ipcRenderer.invoke('shops.list'),
    create: (request: ShopCreateRequest) => ipcRenderer.invoke('shops.create', request),
    open: (shopId: number) => ipcRenderer.invoke('shops.open', { shopId } satisfies ShopOpenRequest),
    close: (shopId: number) => ipcRenderer.invoke('shops.close', { shopId } satisfies ShopCloseRequest)
  },
  workspaces: {
    list: () => ipcRenderer.invoke('workspaces.list'),
    categories: () => ipcRenderer.invoke('workspaces.categories'),
    create: (request: WorkspaceCreateRequest) => ipcRenderer.invoke('workspaces.create', request),
    update: (workspaceId: number, request: WorkspaceUpdateRequest) =>
      ipcRenderer.invoke('workspaces.update', { ...request, workspaceId }),
    activate: (workspaceId: number) => ipcRenderer.invoke('workspaces.activate', { workspaceId }),
    detach: (workspaceId: number) => ipcRenderer.invoke('workspaces.detach', { workspaceId } satisfies WorkspaceDetachRequest),
    close: (workspaceId: number) => ipcRenderer.invoke('workspaces.close', workspaceId),
    reload: (workspaceId: number) => ipcRenderer.invoke('workspaces.reload', workspaceId),
    openDevTools: (workspaceId: number) => ipcRenderer.invoke('workspaces.openDevTools', workspaceId),
    setViewBounds: (bounds: WorkspaceViewBounds) => ipcRenderer.invoke('workspaces.setViewBounds', bounds)
  },
  extensions: {
    list: () => ipcRenderer.invoke('extensions.list'),
    installFile: (fileName: string, bytes: Uint8Array, sourceType: 'crx' | 'zip', name?: string | null) =>
      ipcRenderer.invoke('extensions.installFile', { fileName, bytes: Array.from(bytes), sourceType, name }),
    installGithub: (request: ExtensionInstallRequest) => ipcRenderer.invoke('extensions.installGithub', request),
    uninstall: (extensionId: string) => ipcRenderer.invoke('extensions.uninstall', extensionId),
    toggle: (extensionId: string, enabled: boolean) => ipcRenderer.invoke('extensions.toggle', extensionId, enabled),
    listForWorkspace: (workspaceId: number) => ipcRenderer.invoke('extensions.listForWorkspace', workspaceId),
    bind: (workspaceId: number, extensionId: string) => ipcRenderer.invoke('extensions.bind', workspaceId, extensionId),
    unbind: (workspaceId: number, extensionId: string) => ipcRenderer.invoke('extensions.unbind', workspaceId, extensionId)
  },
  ai: {
    wsUrl: () => ipcRenderer.invoke('ai.wsUrl'),
    list: () => ipcRenderer.invoke('ai.list'),
    pending: () => ipcRenderer.invoke('ai.pending'),
    get: (taskId: number) => ipcRenderer.invoke('ai.get', taskId),
    approve: (taskId: number) => ipcRenderer.invoke('ai.approve', taskId),
    deny: (taskId: number, reason?: string) => ipcRenderer.invoke('ai.deny', { taskId, reason }),
    execute: (taskId: number) => ipcRenderer.invoke('ai.execute', taskId),
    confirm: (taskId: number) => ipcRenderer.invoke('ai.confirm', taskId)
  }
});
