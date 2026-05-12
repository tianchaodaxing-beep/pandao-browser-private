import type { FastifyInstance } from 'fastify';
import type { CredentialExchangeResponse, CredentialTokenResponse } from 'shared';
import { decryptPassword } from '../../utils/crypto.js';
import type { AuthUser } from '../auth/types.js';
import { getShopForUser } from '../shops/service.js';
import {
  activeShopExists,
  consumeCredentialToken,
  findShopCredentialSecret,
  storeCredentialToken
} from './repository.js';
import { getPlatformSelector } from './selectors.js';
import {
  createCredentialJti,
  getCredentialExpiry,
  signCredentialToken,
  verifyCredentialToken
} from './token.js';

export class CredentialServiceError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: string,
    message: string
  ) {
    super(message);
    this.name = 'CredentialServiceError';
  }
}

const shanghaiFormatter = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Asia/Shanghai',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false
});

function formatShanghaiDate(value: Date): string {
  return shanghaiFormatter.format(value);
}

export async function issueCredentialToken(
  app: FastifyInstance,
  user: AuthUser,
  shopId: number,
  ipAddress: string | null
): Promise<CredentialTokenResponse> {
  const shop = await getShopForUser(user, shopId);

  if (!shop) {
    if (await activeShopExists(shopId)) {
      throw new CredentialServiceError(403, 'FORBIDDEN', '权限不足');
    }

    throw new CredentialServiceError(404, 'SHOP_NOT_FOUND', '店铺不存在');
  }

  const selector = getPlatformSelector(shop.platform);
  const jti = createCredentialJti();
  const expiresAt = getCredentialExpiry();
  await storeCredentialToken({
    jti,
    userId: user.id,
    shopId,
    expiresAt,
    ipAddress
  });

  return {
    token: signCredentialToken(app, user, shopId, jti),
    expiresAt: formatShanghaiDate(expiresAt),
    selector
  };
}

export async function exchangeCredentialToken(
  app: FastifyInstance,
  user: AuthUser,
  token: string
): Promise<CredentialExchangeResponse> {
  const payload = await verifyCredentialToken(app, token);

  if (!payload || payload.userId !== user.id) {
    throw new CredentialServiceError(401, 'INVALID_CREDENTIAL_TOKEN', '凭证已失效');
  }

  const consumed = await consumeCredentialToken(payload.jti, user.id, payload.shopId);

  if (!consumed) {
    throw new CredentialServiceError(401, 'INVALID_CREDENTIAL_TOKEN', '凭证已失效');
  }

  const secret = await findShopCredentialSecret(payload.shopId);

  if (!secret) {
    throw new CredentialServiceError(404, 'CREDENTIAL_NOT_FOUND', '店铺账号未配置');
  }

  let password: string | null = decryptPassword({
    encrypted: secret.encrypted,
    iv: secret.iv,
    tag: secret.tag
  });

  const response = {
    username: secret.username,
    password: password as string
  };

  password = null;
  void password;

  return response;
}
