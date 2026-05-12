import { contextBridge, ipcRenderer } from 'electron';
import type { LoginRequest, ShopCloseRequest, ShopOpenRequest } from 'shared';

contextBridge.exposeInMainWorld('pandao', {
  auth: {
    login: (credentials: LoginRequest) => ipcRenderer.invoke('auth.login', credentials),
    logout: () => ipcRenderer.invoke('auth.logout'),
    me: () => ipcRenderer.invoke('auth.me')
  },
  admin: {
    lockStatus: () => ipcRenderer.invoke('admin.lockStatus'),
    unlock: (keyBytes: Uint8Array) => ipcRenderer.invoke('admin.unlock', Array.from(keyBytes))
  },
  shops: {
    list: () => ipcRenderer.invoke('shops.list'),
    open: (shopId: number) => ipcRenderer.invoke('shops.open', { shopId } satisfies ShopOpenRequest),
    close: (shopId: number) => ipcRenderer.invoke('shops.close', { shopId } satisfies ShopCloseRequest)
  }
});
