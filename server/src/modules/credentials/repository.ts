import type { QueryResultRow } from 'pg';
import { getDbPool } from '../../db/pool.js';

export type CredentialTokenInput = {
  jti: string;
  userId: number;
  shopId: number;
  expiresAt: Date;
  ipAddress: string | null;
};

export type ShopCredentialSecret = {
  username: string;
  encrypted: Buffer;
  iv: Buffer;
  tag: Buffer;
};

function toSecret(row: QueryResultRow): ShopCredentialSecret {
  return {
    username: String(row.username),
    encrypted: Buffer.from(row.password_encrypted),
    iv: Buffer.from(row.password_iv),
    tag: Buffer.from(row.password_tag)
  };
}

export async function storeCredentialToken(input: CredentialTokenInput) {
  await getDbPool().query(
    `INSERT INTO credential_tokens (jti, user_id, shop_id, expires_at, ip_address)
     VALUES ($1, $2, $3, $4, $5)`,
    [input.jti, input.userId, input.shopId, input.expiresAt, input.ipAddress]
  );
}

export async function consumeCredentialToken(jti: string, userId: number, shopId: number) {
  const result = await getDbPool().query(
    `UPDATE credential_tokens
     SET used_at = NOW()
     WHERE jti = $1
       AND user_id = $2
       AND shop_id = $3
       AND used_at IS NULL
       AND expires_at > NOW()
     RETURNING id`,
    [jti, userId, shopId]
  );

  return Boolean(result.rowCount);
}

export async function activeShopExists(shopId: number) {
  const result = await getDbPool().query(
    `SELECT id
     FROM shops
     WHERE id = $1
       AND status = 'active'
     LIMIT 1`,
    [shopId]
  );

  return Boolean(result.rowCount);
}

export async function findShopCredentialSecret(shopId: number): Promise<ShopCredentialSecret | null> {
  const result = await getDbPool().query(
    `SELECT username, password_encrypted, password_iv, password_tag
     FROM shop_credentials
     WHERE shop_id = $1
     LIMIT 1`,
    [shopId]
  );

  return result.rowCount ? toSecret(result.rows[0]) : null;
}
