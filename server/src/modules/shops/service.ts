import type { FingerprintConfig, ShopPlatform } from 'shared';
import { encryptPassword } from '../../utils/crypto.js';
import type { AuthUser } from '../auth/types.js';
import { generateFingerprint } from './fingerprint-generator.js';
import {
  assignShopToUser,
  createShop,
  findAccessibleShop,
  listAccessibleShops,
  upsertShopCredential,
  type CreateShopInput
} from './repository.js';

export const shopPlatforms = ['naver_smartstore', 'coupang', 'gmarket', '11st'] as const;

export type CreateShopForBossInput = Omit<CreateShopInput, 'fingerprintConfig'> & {
  fingerprintConfig?: FingerprintConfig | null;
};

export function isShopPlatform(value: unknown): value is ShopPlatform {
  return typeof value === 'string' && shopPlatforms.includes(value as ShopPlatform);
}

export function parsePositiveInt(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export async function listShopsForUser(user: AuthUser) {
  return listAccessibleShops(user);
}

export async function getShopForUser(user: AuthUser, shopId: number) {
  return findAccessibleShop(user, shopId);
}

export async function createShopForBoss(input: CreateShopForBossInput) {
  return createShop({
    ...input,
    fingerprintConfig: input.fingerprintConfig ?? generateFingerprint()
  });
}

export async function setShopCredentialForUser(
  user: AuthUser,
  shopId: number,
  username: string,
  plainPassword: string
) {
  const shop = await findAccessibleShop(user, shopId);

  if (!shop) {
    return null;
  }

  let password: string | null = plainPassword;
  const encrypted = encryptPassword(password);
  password = null;
  void password;

  return upsertShopCredential({
    shopId,
    username,
    encrypted: encrypted.encrypted,
    iv: encrypted.iv,
    tag: encrypted.tag,
    updatedBy: user.id
  });
}

export async function assignShopForBoss(shopId: number, userId: number, grantedBy: number) {
  await assignShopToUser(shopId, userId, grantedBy);
}
