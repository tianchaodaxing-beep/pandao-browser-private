import { BrowserView, BrowserWindow, dialog, session } from 'electron';
import path from 'node:path';
import type { Shop, ShopOpenResponse, WorkspaceDetachResponse, WorkspaceViewBounds } from 'shared';
import { scheduleActionRecorder } from '../action-recorder/scheduler.js';
import { exchangeCredentialToken, requestCredentialToken } from '../credential-fill/api-client-ext.js';
import { injectCredentialFields } from '../credential-fill/injector.js';
import { isCredentialLoginUrl } from '../credential-fill/matcher.js';
import { getCredentialFillSelector } from '../credential-fill/selectors.js';
import { loadExtensions, unloadAll } from '../extension-engine/loader.js';
import { applyStealthSessionPolicy, injectStealth } from '../stealth/injector.js';
import { defaultPlatformUrls } from '../browser-engine/platform-urls.js';
import { applyProxyToSession } from '../browser-engine/proxy.js';

type ActiveWorkspaceView = {
  workspace: Shop;
  view: BrowserView;
  partition: string;
};

const detachedWindows = new Map<number, BrowserWindow>();
const workspaceSessionPartitions = new Set<string>();
const emergencyStorageTypes = ['cookies', 'localstorage', 'indexdb'] as const;

let hostWindow: BrowserWindow | null = null;
let activeWorkspace: ActiveWorkspaceView | null = null;
let lastBounds: WorkspaceViewBounds = { x: 320, y: 112, width: 820, height: 600 };

export class WorkspaceProxyOpenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WorkspaceProxyOpenError';
  }
}

export const ShopProxyOpenError = WorkspaceProxyOpenError;

function getWorkspacePreloadPath() {
  return path.join(__dirname, '../browser-engine/preload-shop.js');
}

function normalizeWorkspaceUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed.replace(/^\/+/, '')}`;
}

function getWorkspaceUrl(workspace: Shop) {
  const raw = workspace.defaultUrl ?? defaultPlatformUrls[workspace.platform] ?? 'https://xinhuonianhua.com/';
  return normalizeWorkspaceUrl(raw);
}

function getWorkspacePartition(workspaceId: number) {
  return `persist:workspace-${workspaceId}`;
}

function closeView(view: BrowserView) {
  if (!view.webContents.isDestroyed()) {
    view.webContents.close();
  }
}

function clearActiveView() {
  if (!activeWorkspace) {
    return;
  }

  if (hostWindow && !hostWindow.isDestroyed()) {
    hostWindow.removeBrowserView(activeWorkspace.view);
  }

  closeView(activeWorkspace.view);
  activeWorkspace = null;
}

function applyBounds() {
  if (!activeWorkspace || !hostWindow || hostWindow.isDestroyed()) {
    return;
  }

  activeWorkspace.view.setBounds({
    x: Math.max(0, Math.floor(lastBounds.x)),
    y: Math.max(0, Math.floor(lastBounds.y)),
    width: Math.max(100, Math.floor(lastBounds.width)),
    height: Math.max(100, Math.floor(lastBounds.height))
  });
}

export function attachWorkspaceHostWindow(window: BrowserWindow) {
  hostWindow = window;
  hostWindow.on('closed', () => {
    if (hostWindow === window) {
      hostWindow = null;
      clearActiveView();
    }
  });
}

export function setWorkspaceViewBounds(bounds: WorkspaceViewBounds) {
  lastBounds = bounds;
  applyBounds();
}

export function focusIfExists(workspaceId: number): boolean {
  if (activeWorkspace?.workspace.id === workspaceId && hostWindow && !hostWindow.isDestroyed()) {
    if (hostWindow.isMinimized()) {
      hostWindow.restore();
    }
    hostWindow.focus();
    return true;
  }

  const detached = detachedWindows.get(workspaceId);
  if (detached && !detached.isDestroyed()) {
    if (detached.isMinimized()) {
      detached.restore();
    }
    detached.focus();
    return true;
  }

  detachedWindows.delete(workspaceId);
  return false;
}

async function attemptCredentialFill(webContents: Electron.WebContents, workspace: Shop) {
  if (webContents.isDestroyed()) {
    return;
  }

  const url = webContents.getURL();
  let password: string | null = null;

  try {
    const localSelector = getCredentialFillSelector(workspace.platform);

    if (!localSelector || !isCredentialLoginUrl(url, localSelector)) {
      console.log(`[credential-fill] skipped: non-login URL, workspace=${workspace.id}, url=${url}`);
      return;
    }

    const tokenResponse = await requestCredentialToken(workspace.id);

    if (!isCredentialLoginUrl(url, tokenResponse.selector)) {
      console.log(`[credential-fill] skipped: non-login URL, workspace=${workspace.id}, url=${url}`);
      return;
    }

    const credentials = await exchangeCredentialToken(tokenResponse.token);
    password = credentials.password;

    const result = await injectCredentialFields(webContents, {
      shopId: workspace.id,
      selector: tokenResponse.selector,
      username: credentials.username,
      password
    });

    if (!result.filled) {
      console.log(`[credential-fill] selector miss, workspace=${workspace.id}, url=${url}`);
      return;
    }

    console.log(`[credential-fill] filled, workspace=${workspace.id}, url=${url}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : '自动填密失败';
    console.log(`[credential-fill] skipped: workspace=${workspace.id}, reason=${message}`);
  } finally {
    password = null;
    void password;
  }
}

function scheduleCredentialFill(webContents: Electron.WebContents, workspace: Shop) {
  setTimeout(() => {
    void attemptCredentialFill(webContents, workspace);
  }, 200);
}

function wireWorkspaceWebContents(view: BrowserView, workspace: Shop) {
  view.webContents.setWindowOpenHandler(({ url }) => {
    void view.webContents.loadURL(url);
    return { action: 'deny' };
  });

  view.webContents.on('dom-ready', () => {
    void injectStealth(view.webContents, workspace.id, workspace.fingerprintConfig);
  });

  view.webContents.on('did-finish-load', () => {
    scheduleCredentialFill(view.webContents, workspace);
    scheduleActionRecorder(view.webContents, workspace);
  });
}

async function prepareSession(workspace: Shop) {
  const partition = getWorkspacePartition(workspace.id);
  workspaceSessionPartitions.add(partition);
  const workspaceSession = session.fromPartition(partition);
  await unloadAll(workspaceSession);
  applyStealthSessionPolicy(workspaceSession, workspace.fingerprintConfig);

  try {
    await applyProxyToSession(workspaceSession, workspace);
  } catch (error) {
    const message = `工作区 ${workspace.name} 代理失败,请联系老板`;
    console.log(`[workspaces] proxy failed workspace=${workspace.id}: ${error instanceof Error ? error.message : String(error)}`);
    dialog.showErrorBox('代理失败', message);
    throw new WorkspaceProxyOpenError(message);
  }

  await loadExtensions(workspaceSession, workspace.id);
  return { partition, workspaceSession };
}

export async function activateWorkspace(workspace: Shop): Promise<ShopOpenResponse> {
  if (focusIfExists(workspace.id) && activeWorkspace?.workspace.id === workspace.id) {
    scheduleCredentialFill(activeWorkspace.view.webContents, workspace);
    scheduleActionRecorder(activeWorkspace.view.webContents, workspace);
    return { ok: true };
  }

  if (!hostWindow || hostWindow.isDestroyed()) {
    throw new Error('主窗口尚未就绪');
  }

  clearActiveView();
  const { partition } = await prepareSession(workspace);
  const view = new BrowserView({
    webPreferences: {
      preload: getWorkspacePreloadPath(),
      partition,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  activeWorkspace = { workspace, view, partition };
  wireWorkspaceWebContents(view, workspace);
  hostWindow.setBrowserView(view);
  applyBounds();

  if (process.env.VITE_DEV_SERVER_URL) {
    view.webContents.openDevTools({ mode: 'detach' });
  }

  const targetUrl = getWorkspaceUrl(workspace);
  void view.webContents.loadURL(targetUrl).catch((error) => {
    console.log(`[workspaces] load failed workspace=${workspace.id}: ${error instanceof Error ? error.message : String(error)}`);
  });
  console.log(`[workspaces] activated workspace=${workspace.id}, partition=${partition}, url=${targetUrl}`);

  return { ok: true };
}

export function detachWorkspace(workspaceId: number): WorkspaceDetachResponse {
  if (focusIfExists(workspaceId) && activeWorkspace?.workspace.id !== workspaceId) {
    return { ok: true };
  }

  if (!activeWorkspace || activeWorkspace.workspace.id !== workspaceId) {
    return { ok: true };
  }

  const detachedWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 640,
    title: `${activeWorkspace.workspace.name} - PANDAO Browser`,
    backgroundColor: '#ffffff'
  });
  const view = activeWorkspace.view;
  const workspace = activeWorkspace.workspace;

  if (hostWindow && !hostWindow.isDestroyed()) {
    hostWindow.removeBrowserView(view);
  }

  detachedWindow.setBrowserView(view);
  const setDetachedBounds = () => {
    const bounds = detachedWindow.getContentBounds();
    view.setBounds({ x: 0, y: 0, width: bounds.width, height: bounds.height });
  };
  setDetachedBounds();
  detachedWindow.on('resize', setDetachedBounds);
  detachedWindow.on('closed', () => {
    detachedWindows.delete(workspace.id);
    closeView(view);
  });
  detachedWindows.set(workspace.id, detachedWindow);
  activeWorkspace = null;
  return { ok: true };
}

export function closeWorkspace(workspaceId: number) {
  if (activeWorkspace?.workspace.id === workspaceId) {
    clearActiveView();
    return;
  }

  const detached = detachedWindows.get(workspaceId);
  if (!detached || detached.isDestroyed()) {
    detachedWindows.delete(workspaceId);
    return;
  }

  detached.close();
}

export function reloadWorkspace(workspaceId: number) {
  if (activeWorkspace?.workspace.id === workspaceId && !activeWorkspace.view.webContents.isDestroyed()) {
    activeWorkspace.view.webContents.reload();
    return;
  }

  const detached = detachedWindows.get(workspaceId);
  if (!detached || detached.isDestroyed()) {
    return;
  }

  const [view] = detached.getBrowserViews();
  view?.webContents.reload();
}

export function openWorkspaceDevTools(workspaceId: number) {
  if (activeWorkspace?.workspace.id === workspaceId && !activeWorkspace.view.webContents.isDestroyed()) {
    activeWorkspace.view.webContents.openDevTools({ mode: 'detach' });
    return;
  }

  const detached = detachedWindows.get(workspaceId);
  if (!detached || detached.isDestroyed()) {
    return;
  }

  const [view] = detached.getBrowserViews();
  view?.webContents.openDevTools({ mode: 'detach' });
}

export function closeAllShopWindows() {
  clearActiveView();

  for (const [workspaceId, workspaceWindow] of detachedWindows.entries()) {
    if (!workspaceWindow.isDestroyed()) {
      workspaceWindow.close();
    }
    detachedWindows.delete(workspaceId);
  }
}

export async function clearAllShopStorageData() {
  await Promise.all(
    Array.from(workspaceSessionPartitions).map((partition) =>
      session.fromPartition(partition).clearStorageData({
        storages: [...emergencyStorageTypes]
      })
    )
  );
}

export const openShop = activateWorkspace;
export const closeShop = closeWorkspace;
