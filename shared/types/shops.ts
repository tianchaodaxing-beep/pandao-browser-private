import type { FingerprintConfig } from './fingerprint.js';

export type ShopPlatform = 'naver_smartstore' | 'coupang' | 'gmarket' | '11st';

export type ShopStatus = 'active' | 'archived';

export type Shop = {
  id: number;
  name: string;
  platform: ShopPlatform;
  teamId: number | null;
  defaultUrl: string | null;
  proxyId: number | null;
  fingerprintConfig: FingerprintConfig | null;
  status: ShopStatus;
  createdAt: string;
};

export type ShopCredentialInput = {
  username: string;
  password: string;
};

export type LockStatusResponse = {
  locked: boolean;
};

export type UnlockResponse = LockStatusResponse;

export type ShopAssignmentInput = {
  userId: number;
  shopId?: number;
};

export type ShopListResponse = {
  shops: Shop[];
};

export type ShopOpenRequest = {
  shopId: number;
};

export type ShopOpenResponse = {
  ok: true;
};

export type ShopCloseRequest = {
  shopId: number;
};

export type ShopCreateRequest = {
  name: string;
  platform: ShopPlatform;
  defaultUrl?: string | null;
  teamId?: number | null;
};

export type ShopCreateResponse = {
  shop: Shop;
};
