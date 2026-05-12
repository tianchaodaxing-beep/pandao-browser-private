import type {
  ProxyDto,
  ProxyInput,
  ProxyProvider,
  ProxyStatus,
  ShopProxyDto
} from 'shared';
import { decryptPassword, encryptPassword } from '../../utils/crypto.js';
import type { AuthUser } from '../auth/types.js';
import { getShopForUser } from '../shops/service.js';
import {
  bindProxyToShop,
  findProxyCredentialSecretForShop,
  findShopProxy,
  insertProxyRows,
  listProxies,
  unbindProxy,
  type EncryptedProxyInput,
  type ProxyListFilters
} from './repository.js';

export const proxyProviders = ['lunaproxy', '922s5'] as const satisfies ProxyProvider[];
export const proxyProtocols = ['http', 'socks5'] as const;
export const proxyStatuses = ['active', 'broken', 'reserved'] as const satisfies ProxyStatus[];

export class ProxyServiceError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: string,
    message: string
  ) {
    super(message);
    this.name = 'ProxyServiceError';
  }
}

export function isProxyProvider(value: unknown): value is ProxyProvider {
  return typeof value === 'string' && proxyProviders.includes(value as ProxyProvider);
}

export function isProxyProtocol(value: unknown): value is 'http' | 'socks5' {
  return typeof value === 'string' && proxyProtocols.includes(value as 'http' | 'socks5');
}

export function isProxyStatus(value: unknown): value is ProxyStatus {
  return typeof value === 'string' && proxyStatuses.includes(value as ProxyStatus);
}

export async function createProxyBatch(rows: ProxyInput[]): Promise<ProxyDto[]> {
  const encryptedRows: EncryptedProxyInput[] = rows.map((row) => {
    let password: string | null = row.password?.trim() ? row.password : null;
    const encrypted = password ? encryptPassword(password) : null;
    password = null;
    void password;

    return {
      provider: row.provider,
      protocol: row.protocol,
      host: row.host,
      port: row.port,
      username: row.username?.trim() ? row.username.trim() : null,
      encrypted: encrypted?.encrypted ?? null,
      iv: encrypted?.iv ?? null,
      tag: encrypted?.tag ?? null,
      country: row.country?.trim() ? row.country.trim().toUpperCase() : 'KR',
      city: row.city?.trim() ? row.city.trim() : null
    };
  });

  return insertProxyRows(encryptedRows);
}

export async function listProxyPool(filters: ProxyListFilters = {}) {
  return listProxies(filters);
}

export async function bindProxy(proxyId: number, shopId: number) {
  const result = await bindProxyToShop(proxyId, shopId);

  if (result.ok) {
    return result.proxy;
  }

  switch (result.code) {
    case 'PROXY_NOT_FOUND':
      throw new ProxyServiceError(404, result.code, '代理不存在');
    case 'SHOP_NOT_FOUND':
      throw new ProxyServiceError(404, result.code, '店铺不存在');
    case 'PROXY_ALREADY_BOUND':
      throw new ProxyServiceError(409, result.code, '代理已经绑定到其他店铺');
    case 'SHOP_ALREADY_BOUND':
      throw new ProxyServiceError(409, result.code, '店铺已经绑定其他代理');
    case 'PROXY_UNAVAILABLE':
      throw new ProxyServiceError(409, result.code, '代理状态不可绑定');
  }
}

export async function unbindProxyForBoss(proxyId: number) {
  const ok = await unbindProxy(proxyId);

  if (!ok) {
    throw new ProxyServiceError(404, 'PROXY_NOT_FOUND', '代理不存在');
  }
}

export async function getShopProxyForUser(user: AuthUser, shopId: number): Promise<ShopProxyDto | null> {
  const shop = await getShopForUser(user, shopId);

  if (!shop) {
    throw new ProxyServiceError(404, 'SHOP_NOT_FOUND', '店铺不存在或无权限');
  }

  return findShopProxy(shopId);
}

export async function getShopProxyCredentialForUser(user: AuthUser, shopId: number) {
  const shop = await getShopForUser(user, shopId);

  if (!shop) {
    throw new ProxyServiceError(404, 'SHOP_NOT_FOUND', '店铺不存在或无权限');
  }

  const secret = await findProxyCredentialSecretForShop(shopId);

  if (!secret) {
    throw new ProxyServiceError(404, 'PROXY_NOT_FOUND', '店铺未绑定代理');
  }

  if (!secret.encrypted || !secret.iv || !secret.tag) {
    return {
      username: secret.username,
      password: null
    };
  }

  let password: string | null = decryptPassword({
    encrypted: secret.encrypted,
    iv: secret.iv,
    tag: secret.tag
  });

  const response = {
    username: secret.username,
    password
  };

  password = null;
  void password;

  return response;
}
