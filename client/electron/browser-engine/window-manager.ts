import { BrowserWindow, session } from 'electron';
import path from 'node:path';
import type { Shop, ShopOpenResponse } from 'shared';
import { scheduleActionRecorder } from '../action-recorder/scheduler.js';
import { exchangeCredentialToken, requestCredentialToken } from '../credential-fill/api-client-ext.js';
import { injectCredentialFields } from '../credential-fill/injector.js';
import { isCredentialLoginUrl } from '../credential-fill/matcher.js';
import { getCredentialFillSelector } from '../credential-fill/selectors.js';
import { applyStealthSessionPolicy, injectStealth } from '../stealth/injector.js';
import { defaultPlatformUrls } from './platform-urls.js';

const shopWindows = new Map<number, BrowserWindow>();

function getShopPreloadPath() {
  return path.join(__dirname, 'preload-shop.js');
}

function getShopUrl(shop: Shop) {
  return shop.defaultUrl ?? defaultPlatformUrls[shop.platform];
}

function getExistingShopWindow(shopId: number): BrowserWindow | null {
  const existingWindow = shopWindows.get(shopId);

  if (!existingWindow || existingWindow.isDestroyed()) {
    shopWindows.delete(shopId);
    return null;
  }

  return existingWindow;
}

function focusShopWindow(shopWindow: BrowserWindow) {
  if (shopWindow.isMinimized()) {
    shopWindow.restore();
  }
  shopWindow.focus();
}

export function focusIfExists(shopId: number): boolean {
  const existingWindow = getExistingShopWindow(shopId);

  if (!existingWindow) {
    return false;
  }

  focusShopWindow(existingWindow);
  return true;
}

async function attemptCredentialFill(shopWindow: BrowserWindow, shop: Shop) {
  if (shopWindow.isDestroyed()) {
    return;
  }

  const url = shopWindow.webContents.getURL();
  let password: string | null = null;

  try {
    const localSelector = getCredentialFillSelector(shop.platform);

    if (!localSelector || !isCredentialLoginUrl(url, localSelector)) {
      console.log(`[credential-fill] skipped: non-login URL, shop=${shop.id}, url=${url}`);
      return;
    }

    const tokenResponse = await requestCredentialToken(shop.id);

    if (!isCredentialLoginUrl(url, tokenResponse.selector)) {
      console.log(`[credential-fill] skipped: non-login URL, shop=${shop.id}, url=${url}`);
      return;
    }

    const credentials = await exchangeCredentialToken(tokenResponse.token);
    password = credentials.password;

    const result = await injectCredentialFields(shopWindow.webContents, {
      shopId: shop.id,
      selector: tokenResponse.selector,
      username: credentials.username,
      password
    });

    if (!result.filled) {
      console.log(`[credential-fill] selector miss, shop=${shop.id}, url=${url}`);
      return;
    }

    console.log(`[credential-fill] filled, shop=${shop.id}, url=${url}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : '自动填密码失败';
    console.log(`[credential-fill] skipped: shop=${shop.id}, reason=${message}`);
  } finally {
    password = null;
    void password;
  }
}

function scheduleCredentialFill(shopWindow: BrowserWindow, shop: Shop) {
  setTimeout(() => {
    void attemptCredentialFill(shopWindow, shop);
  }, 200);
}

export function openShop(shop: Shop): ShopOpenResponse {
  const existingWindow = getExistingShopWindow(shop.id);

  if (existingWindow) {
    focusShopWindow(existingWindow);
    console.log(`[shops] focus existing shop window: ${shop.id}`);
    scheduleCredentialFill(existingWindow, shop);
    scheduleActionRecorder(existingWindow, shop);
    return { ok: true };
  }

  const title = `${shop.name} - PANDAO Browser`;
  const partition = `persist:shop-${shop.id}`;
  const shopSession = session.fromPartition(partition);
  applyStealthSessionPolicy(shopSession, shop.fingerprintConfig);

  const shopWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 640,
    title,
    backgroundColor: '#ffffff',
    webPreferences: {
      preload: getShopPreloadPath(),
      partition,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  shopWindows.set(shop.id, shopWindow);

  shopWindow.on('closed', () => {
    shopWindows.delete(shop.id);
    console.log(`[shops] closed shop window: ${shop.id}`);
  });

  shopWindow.on('page-title-updated', (event) => {
    event.preventDefault();
    shopWindow.setTitle(title);
  });

  shopWindow.webContents.setWindowOpenHandler(() => {
    return { action: 'deny' };
  });

  shopWindow.webContents.on('dom-ready', () => {
    void injectStealth(shopWindow.webContents, shop.id, shop.fingerprintConfig);
  });

  shopWindow.webContents.on('did-finish-load', () => {
    scheduleCredentialFill(shopWindow, shop);
    scheduleActionRecorder(shopWindow, shop);
  });

  // TODO[WO-007]: session.setProxy(...) for shop-bound proxy.
  // TODO[WO-007]: handle proxy auth.

  if (process.env.NODE_ENV !== 'production') {
    shopWindow.webContents.openDevTools({ mode: 'detach' });
  }

  const targetUrl = getShopUrl(shop);
  void shopWindow.loadURL(targetUrl).catch((error) => {
    console.log(`[shops] load failed for shop ${shop.id}: ${error instanceof Error ? error.message : String(error)}`);
  });
  console.log(`[shops] opened shop window: ${shop.id}, partition=${partition}, url=${targetUrl}`);

  return { ok: true };
}

export function closeShop(shopId: number) {
  const existingWindow = shopWindows.get(shopId);

  if (!existingWindow || existingWindow.isDestroyed()) {
    shopWindows.delete(shopId);
    return;
  }

  existingWindow.close();
}

export function closeAllShopWindows() {
  for (const [shopId, shopWindow] of shopWindows.entries()) {
    if (!shopWindow.isDestroyed()) {
      shopWindow.close();
    }
    shopWindows.delete(shopId);
  }
}
