import { app, safeStorage } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { RefreshResponse, Shop, ShopListResponse } from 'shared';

type StoredTokens = {
  token: string;
  refreshToken: string;
};

type ApiErrorBody = {
  error?: string;
  message?: string;
};

export class ApiRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

const API_BASE_URL =
  process.env.PANDAO_API_BASE_URL ??
  process.env.VITE_API_BASE_URL ??
  'https://browser-api.xinhuonianhua.com';

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

function isNetworkError(error: unknown) {
  return error instanceof TypeError || error instanceof Error && /fetch failed|ECONNREFUSED|ENOTFOUND/i.test(error.message);
}

async function parseApiError(response: Response): Promise<ApiRequestError> {
  let body: ApiErrorBody = {};
  try {
    body = (await response.json()) as ApiErrorBody;
  } catch {
    // Keep generic message below.
  }

  return new ApiRequestError(body.message ?? body.error ?? '请求失败', response.status, body.error);
}

async function requestJson<T>(urlPath: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  const isFormDataBody = typeof FormData !== 'undefined' && init.body instanceof FormData;

  try {
    response = await fetch(`${API_BASE_URL}${urlPath}`, {
      ...init,
      headers: {
        ...(isFormDataBody ? {} : { 'Content-Type': 'application/json' }),
        ...init.headers
      }
    });
  } catch (error) {
    if (isNetworkError(error)) {
      throw new Error('服务器无法连接,请联系老板');
    }
    throw error;
  }

  if (!response.ok) {
    throw await parseApiError(response);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

async function refreshTokens(refreshToken: string): Promise<StoredTokens> {
  return requestJson<RefreshResponse>('/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({ refreshToken })
  });
}

export async function requestAuthedJson<T>(urlPath: string, init: RequestInit = {}): Promise<T> {
  const tokens = await readStoredTokens();

  if (!tokens) {
    throw new Error('请先登录');
  }

  const buildAuthedInit = (token: string): RequestInit => ({
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...init.headers
    }
  });

  try {
    return await requestJson<T>(urlPath, buildAuthedInit(tokens.token));
  } catch (error) {
    if (!(error instanceof ApiRequestError) || error.status !== 401) {
      throw error;
    }
  }

  const refreshed = await refreshTokens(tokens.refreshToken);
  await writeStoredTokens(refreshed);
  return requestJson<T>(urlPath, buildAuthedInit(refreshed.token));
}

export async function listShops(): Promise<Shop[]> {
  const result = await requestAuthedJson<ShopListResponse>('/shops');
  return result.shops;
}

export async function getShop(shopId: number): Promise<Shop> {
  try {
    const result = await requestAuthedJson<{ shop: Shop }>(`/shops/${shopId}`);
    return result.shop;
  } catch (error) {
    if (error instanceof ApiRequestError && error.status === 503 && error.code === 'LOCKED') {
      const shops = await listShops();
      const shop = shops.find((item) => item.id === shopId);
      if (shop) {
        return shop;
      }
    }

    throw error;
  }
}
