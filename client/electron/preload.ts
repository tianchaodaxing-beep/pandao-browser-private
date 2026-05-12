import { contextBridge, ipcRenderer } from 'electron';
import type { LoginRequest, ProxyBatchRequest, ShopCloseRequest, ShopOpenRequest } from 'shared';

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
    unbindProxy: (proxyId: number) => ipcRenderer.invoke('admin.unbindProxy', proxyId)
  },
  shops: {
    list: () => ipcRenderer.invoke('shops.list'),
    open: (shopId: number) => ipcRenderer.invoke('shops.open', { shopId } satisfies ShopOpenRequest),
    close: (shopId: number) => ipcRenderer.invoke('shops.close', { shopId } satisfies ShopCloseRequest)
  },
  ai: {
    wsUrl: () => ipcRenderer.invoke('ai.wsUrl'),
    list: () => ipcRenderer.invoke('ai.list'),
    get: (taskId: number) => ipcRenderer.invoke('ai.get', taskId),
    execute: (taskId: number) => ipcRenderer.invoke('ai.execute', taskId),
    confirm: (taskId: number) => ipcRenderer.invoke('ai.confirm', taskId)
  }
});
