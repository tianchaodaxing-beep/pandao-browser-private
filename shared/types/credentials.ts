import type { ShopPlatform } from './shops.js';

export type PlatformSelector = {
  loginUrlPattern: string;
  username: string;
  password: string;
  submitHint: string;
};

export type PlatformSelectors = Record<ShopPlatform, PlatformSelector>;

export type CredentialTokenResponse = {
  token: string;
  expiresAt: string;
  selector: PlatformSelector;
};

export type CredentialExchangeRequest = {
  token: string;
};

export type CredentialExchangeResponse = {
  username: string;
  password: string;
};
