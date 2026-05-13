import { app, BrowserWindow, Menu, dialog, ipcMain, safeStorage, session } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
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
  LoginResponse,
  ProxyBatchRequest,
  ProxyBatchResponse,
  ProxyBindRequest,
  ProxyBindResponse,
  ProxyListResponse,
  ProxyUnbindResponse,
  RefreshResponse,
  ShopCloseRequest,
  ShopCreateRequest,
  ShopCreateResponse,
  ShopListResponse,
  ShopOpenRequest,
  ShopOpenResponse,
  UnlockResponse
} from 'shared';
import { executeAiTask } from './ai-bridge/executor.js';
import { registerActionRecorderHandlers } from './action-recorder/main-bridge.js';
import { ApiRequestError, getShop, listShops } from './browser-engine/api-client.js';
import {
  ShopProxyOpenError,
  clearAllShopStorageData,
  closeAllShopWindows,
  closeShop,
  openShop
} from './browser-engine/window-manager.js';
import { EmergencyWsClient, buildWsUrl } from './ws/client.js';

app.setName('pandao-browser');
app.commandLine.appendSwitch('disable-features', 'WebRtcHideLocalIpsWithMdns');
registerActionRecorderHandlers();

type StoredTokens = {
  token: string;
  refreshToken: string;
};

const API_BASE_URL =
  process.env.PANDAO_API_BASE_URL ??
  process.env.VITE_API_BASE_URL ??
  'https://browser-api.xinhuonianhua.com';
const emergencyStorageTypes = ['cookies', 'localstorage', 'indexdb'] as const;
let emergencyWsClient: EmergencyWsClient | null = null;

class IpcApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string
  ) {
    super(message);
    this.name = 'IpcApiError';
  }
}

function getAuthFilePath() {
  return path.join(app.getPath('userData'), 'auth.bin');
}

async function readStoredTokens(): Promise<StoredTokens | null> {
  try {
    const encrypted = await fs.readFile(getAuthFilePath());
    return JSON.parse(safeStorage.decryptString(encrypted)) as StoredTokens;
  } catch {
    return null;
  }
}

async function writeStoredTokens(tokens: StoredTokens) {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('当前系统不可用 safeStorage，拒绝明文保存登录态。');
  }

  await fs.mkdir(path.dirname(getAuthFilePath()), { recursive: true });
  await fs.writeFile(getAuthFilePath(), safeStorage.encryptString(JSON.stringify(tokens)));
}

async function clearStoredTokens() {
  await fs.rm(getAuthFilePath(), { force: true });
}

async function apiJson<T>(urlPath: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${urlPath}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init.headers
    }
  });

  if (!response.ok) {
    let message = '请求失败';
    let code: string | undefined;
    try {
      const body = (await response.json()) as { message?: string; error?: string };
      message = body.message ?? body.error ?? message;
      code = body.error;
    } catch {
      // Keep generic message.
    }
    throw new IpcApiError(message, response.status, code);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

async function fetchMe(token: string): Promise<AuthUser> {
  const result = await apiJson<{ user: AuthUser }>('/auth/me', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`
    }
  });
  return result.user;
}

async function refreshTokens(refreshToken: string): Promise<StoredTokens> {
  const result = await apiJson<RefreshResponse>('/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({ refreshToken })
  });
  return result;
}

async function getActiveTokens(): Promise<StoredTokens> {
  const tokens = await readStoredTokens();

  if (!tokens) {
    throw new Error('请先登录');
  }

  try {
    await fetchMe(tokens.token);
    return tokens;
  } catch (error) {
    if (error instanceof IpcApiError && error.code === 'EMERGENCY_LOCKOUT') {
      await clearStoredTokens();
      throw error;
    }

    const refreshed = await refreshTokens(tokens.refreshToken);
    await writeStoredTokens(refreshed);
    return refreshed;
  }
}

async function apiAuthedJson<T>(urlPath: string, init: RequestInit = {}): Promise<T> {
  const tokens = await getActiveTokens();
  return apiJson<T>(urlPath, {
    ...init,
    headers: {
      Authorization: `Bearer ${tokens.token}`,
      ...init.headers
    }
  });
}

function parseTaskId(value: unknown) {
  const taskId = Number(value);
  if (!Number.isInteger(taskId) || taskId <= 0) {
    throw new Error('Invalid AI task id');
  }
  return taskId;
}

async function provideWsToken(): Promise<string | null> {
  try {
    const tokens = await getActiveTokens();
    return tokens.token;
  } catch {
    return null;
  }
}

function emitEmergencyLockout(payload: EmergencyLockoutWsPayload) {
  for (const browserWindow of BrowserWindow.getAllWindows()) {
    if (!browserWindow.isDestroyed()) {
      browserWindow.webContents.send('emergency.lockout', payload);
    }
  }
}

async function clearEmergencyStorageData() {
  await Promise.all([
    session.defaultSession.clearStorageData({
      storages: [...emergencyStorageTypes]
    }),
    clearAllShopStorageData()
  ]);
}

async function handleEmergencyLockout(payload: EmergencyLockoutWsPayload) {
  emergencyWsClient?.stop();
  closeAllShopWindows();
  try {
    await clearEmergencyStorageData();
  } catch (error) {
    console.log(`[emergency] failed to clear storage: ${error instanceof Error ? error.message : String(error)}`);
  }
  await clearStoredTokens();
  emitEmergencyLockout(payload);
}

ipcMain.handle('auth.login', async (_event, credentials: LoginRequest): Promise<AuthUser> => {
  const result = await apiJson<LoginResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(credentials)
  });

  await writeStoredTokens({
    token: result.token,
    refreshToken: result.refreshToken
  });
  emergencyWsClient?.reconnectNow();

  return result.user;
});

ipcMain.handle('auth.me', async (): Promise<AuthUser | null> => {
  const tokens = await readStoredTokens();

  if (!tokens) {
    return null;
  }

  try {
    return await fetchMe(tokens.token);
  } catch (error) {
    if (error instanceof IpcApiError && error.code === 'EMERGENCY_LOCKOUT') {
      await clearStoredTokens();
      return null;
    }

    try {
      const refreshed = await refreshTokens(tokens.refreshToken);
      await writeStoredTokens(refreshed);
      return await fetchMe(refreshed.token);
    } catch {
      await clearStoredTokens();
      return null;
    }
  }
});

ipcMain.handle('auth.logout', async (): Promise<void> => {
  const tokens = await readStoredTokens();

  if (tokens) {
    try {
      await apiJson<void>('/auth/logout', {
        method: 'POST',
        body: JSON.stringify({ refreshToken: tokens.refreshToken })
      });
    } catch {
      // Local logout must still clear encrypted tokens.
    }
  }

  await clearStoredTokens();
  emergencyWsClient?.stop();
});

ipcMain.handle('admin.lockStatus', async (): Promise<LockStatusResponse> => {
  return apiAuthedJson<LockStatusResponse>('/admin/lock-status', {
    method: 'GET'
  });
});

ipcMain.handle('admin.unlock', async (_event, keyBytes: number[]): Promise<UnlockResponse> => {
  const key = Buffer.from(keyBytes);
  if (key.length !== 32) {
    key.fill(0);
    throw new Error('master.key 必须正好 32 字节');
  }

  const tokens = await getActiveTokens();
  const response = await fetch(`${API_BASE_URL}/admin/unlock`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${tokens.token}`,
      'Content-Type': 'application/octet-stream'
    },
    body: key
  });
  key.fill(0);

  if (!response.ok) {
    let message = '解锁失败';
    try {
      const body = (await response.json()) as { message?: string; error?: string };
      message = body.message ?? body.error ?? message;
    } catch {
      // Keep generic message.
    }
    throw new Error(message);
  }

  return (await response.json()) as UnlockResponse;
});

ipcMain.handle('admin.listProxies', async (): Promise<ProxyListResponse> => {
  return apiAuthedJson<ProxyListResponse>('/proxies', {
    method: 'GET'
  });
});

ipcMain.handle('admin.batchProxies', async (_event, request: ProxyBatchRequest): Promise<ProxyBatchResponse> => {
  return apiAuthedJson<ProxyBatchResponse>('/proxies', {
    method: 'POST',
    body: JSON.stringify(request)
  });
});

ipcMain.handle(
  'admin.bindProxy',
  async (_event, request: ProxyBindRequest & { proxyId: number }): Promise<ProxyBindResponse> => {
    return apiAuthedJson<ProxyBindResponse>(`/proxies/${request.proxyId}/bind`, {
      method: 'POST',
      body: JSON.stringify({ shopId: request.shopId } satisfies ProxyBindRequest)
    });
  }
);

ipcMain.handle('admin.unbindProxy', async (_event, proxyId: number): Promise<ProxyUnbindResponse> => {
  return apiAuthedJson<ProxyUnbindResponse>(`/proxies/${proxyId}/bind`, {
    method: 'DELETE'
  });
});

ipcMain.handle('admin.emergencyStatus', async (): Promise<EmergencyStatusResponse> => {
  return apiAuthedJson<EmergencyStatusResponse>('/emergency/status', {
    method: 'GET'
  });
});

ipcMain.handle('admin.emergencyLockout', async (_event, request: LockoutRequest): Promise<LockoutResponse> => {
  return apiAuthedJson<LockoutResponse>('/emergency/lockout', {
    method: 'POST',
    body: JSON.stringify({
      scope: request.scope,
      target_id: request.targetId ?? null,
      reason: request.reason
    })
  });
});

ipcMain.handle('shops.list', async (): Promise<ShopListResponse> => {
  return { shops: await listShops() };
});

ipcMain.handle('shops.create', async (_event, request: ShopCreateRequest): Promise<ShopCreateResponse> => {
  return apiAuthedJson<ShopCreateResponse>('/shops', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: request.name,
      platform: request.platform,
      defaultUrl: request.defaultUrl ?? null,
      teamId: request.teamId ?? null
    })
  });
});

ipcMain.handle('shops.open', async (_event, request: ShopOpenRequest): Promise<ShopOpenResponse> => {
  try {
    const shop = await getShop(request.shopId);
    return await openShop(shop);
  } catch (error) {
    if (error instanceof ShopProxyOpenError) {
      throw new Error(error.message);
    }

    if (error instanceof ApiRequestError && error.status === 404) {
      dialog.showErrorBox('打开店铺失败', '店铺不存在或无权限');
      throw new Error('店铺不存在或无权限');
    }

    const message = error instanceof Error ? error.message : '打开店铺失败';
    const displayMessage = message.includes('服务器无法连接') ? '服务器无法连接,请联系老板' : message;
    dialog.showErrorBox('打开店铺失败', displayMessage);
    throw new Error(displayMessage);
  }
});

ipcMain.handle('shops.close', async (_event, request: ShopCloseRequest): Promise<void> => {
  closeShop(request.shopId);
});

ipcMain.handle('ai.wsUrl', async (): Promise<string> => {
  const tokens = await getActiveTokens();
  return buildWsUrl(API_BASE_URL, tokens.token);
});

ipcMain.handle('ai.list', async (): Promise<{ tasks: AiTask[] }> => {
  return apiAuthedJson<{ tasks: AiTask[] }>('/ai/tasks/assigned', {
    method: 'GET'
  });
});

ipcMain.handle('ai.pending', async (): Promise<{ tasks: AiTask[] }> => {
  return apiAuthedJson<{ tasks: AiTask[] }>('/ai/tasks/pending', {
    method: 'GET'
  });
});

ipcMain.handle('ai.get', async (_event, value: unknown): Promise<{ task: AiTask }> => {
  return apiAuthedJson<{ task: AiTask }>(`/ai/task/${parseTaskId(value)}`, {
    method: 'GET'
  });
});

ipcMain.handle('ai.approve', async (_event, value: unknown): Promise<{ task: AiTask }> => {
  return apiAuthedJson<{ task: AiTask }>(`/ai/task/${parseTaskId(value)}/approve`, {
    method: 'POST'
  });
});

ipcMain.handle('ai.deny', async (_event, value: unknown): Promise<{ task: AiTask }> => {
  const request = value as { taskId?: unknown; reason?: unknown };
  const reason = typeof request?.reason === 'string' ? request.reason : undefined;

  return apiAuthedJson<{ task: AiTask }>(`/ai/task/${parseTaskId(request?.taskId)}/deny`, {
    method: 'POST',
    body: JSON.stringify({ reason })
  });
});

ipcMain.handle('ai.execute', async (_event, value: unknown): Promise<AiTaskExecutionResponse> => {
  return executeAiTask(parseTaskId(value));
});

ipcMain.handle('ai.confirm', async (_event, value: unknown): Promise<AiTaskExecutionResponse> => {
  return executeAiTask(parseTaskId(value));
});

function createMainWindow() {
  const mainWindow = new BrowserWindow({
    width: 1180,
    height: 760,
    minWidth: 960,
    minHeight: 620,
    backgroundColor: '#f6f7fb',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  const devServerUrl = process.env.VITE_DEV_SERVER_URL;

  if (devServerUrl) {
    void mainWindow.loadURL(devServerUrl);
  } else {
    void mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

app.whenReady().then(() => {
  // 去掉默认 File/Edit/View/Window/Help 菜单(英文,不需要)
  Menu.setApplicationMenu(null);
  emergencyWsClient = new EmergencyWsClient(API_BASE_URL, provideWsToken, handleEmergencyLockout);
  emergencyWsClient.start();
  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  closeAllShopWindows();
});
