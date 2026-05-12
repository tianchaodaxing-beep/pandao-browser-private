import type { QueryResultRow } from 'pg';
import type { FingerprintConfig, Shop, ShopPlatform, ShopStatus } from 'shared';
import { getDbPool } from '../../db/pool.js';
import type { AuthUser } from '../auth/types.js';

export type CreateShopInput = {
  name: string;
  platform: ShopPlatform;
  teamId: number | null;
  defaultUrl: string | null;
  fingerprintConfig: FingerprintConfig | null;
};

export type EncryptedCredentialInput = {
  shopId: number;
  username: string;
  encrypted: Buffer;
  iv: Buffer;
  tag: Buffer;
  updatedBy: number;
};

const shanghaiFormatter = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Asia/Shanghai',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false
});

function formatShanghaiDate(value: Date | string): string {
  return shanghaiFormatter.format(new Date(value));
}

function toShop(row: QueryResultRow): Shop {
  return {
    id: Number(row.id),
    name: String(row.name),
    platform: row.platform as ShopPlatform,
    teamId: row.team_id === null ? null : Number(row.team_id),
    defaultUrl: row.default_url === null ? null : String(row.default_url),
    proxyId: row.proxy_id === null ? null : Number(row.proxy_id),
    fingerprintConfig: row.fingerprint_config as FingerprintConfig | null,
    status: row.status as ShopStatus,
    createdAt: formatShanghaiDate(row.created_at)
  };
}

const shopColumnNames = [
  'id',
  'name',
  'platform',
  'team_id',
  'default_url',
  'proxy_id',
  'fingerprint_config',
  'status',
  'created_at'
];

function selectShopColumns(alias = '') {
  const prefix = alias ? `${alias}.` : '';
  return shopColumnNames.map((column) => `${prefix}${column}`).join(', ');
}

export async function createShop(input: CreateShopInput): Promise<Shop> {
  const result = await getDbPool().query(
    `INSERT INTO shops (name, platform, team_id, default_url, proxy_id, fingerprint_config, status)
     VALUES ($1, $2, $3, $4, NULL, $5, 'active')
     RETURNING ${selectShopColumns()}`,
    [input.name, input.platform, input.teamId, input.defaultUrl, input.fingerprintConfig]
  );

  return toShop(result.rows[0]);
}

export async function listActiveShopsWithoutFingerprint(): Promise<Array<{ id: number }>> {
  const result = await getDbPool().query(
    `SELECT id
     FROM shops
     WHERE status = 'active'
       AND fingerprint_config IS NULL
     ORDER BY id ASC`
  );

  return result.rows.map((row) => ({ id: Number(row.id) }));
}

export async function listActiveShopFingerprints(): Promise<Array<{ id: number; fingerprintConfig: FingerprintConfig }>> {
  const result = await getDbPool().query(
    `SELECT id, fingerprint_config
     FROM shops
     WHERE status = 'active'
       AND fingerprint_config IS NOT NULL
     ORDER BY id ASC`
  );

  return result.rows.map((row) => ({
    id: Number(row.id),
    fingerprintConfig: row.fingerprint_config as FingerprintConfig
  }));
}

export async function updateShopFingerprint(shopId: number, fingerprintConfig: FingerprintConfig) {
  await getDbPool().query(
    `UPDATE shops
     SET fingerprint_config = $2
     WHERE id = $1
       AND fingerprint_config IS NULL`,
    [shopId, fingerprintConfig]
  );
}

export async function listAccessibleShops(user: AuthUser): Promise<Shop[]> {
  if (user.role === 'boss') {
    const result = await getDbPool().query(
      `SELECT ${selectShopColumns()}
       FROM shops
       WHERE status = 'active'
       ORDER BY id ASC`
    );
    return result.rows.map(toShop);
  }

  if (user.role === 'manager') {
    const result = await getDbPool().query(
      `SELECT ${selectShopColumns('s')}
       FROM shops s
       JOIN teams t ON t.id = s.team_id
       WHERE t.manager_id = $1
         AND s.status = 'active'
       ORDER BY s.id ASC`,
      [user.id]
    );
    return result.rows.map(toShop);
  }

  const result = await getDbPool().query(
    `SELECT ${selectShopColumns('s')}
     FROM shops s
     JOIN shop_assignments sa ON sa.shop_id = s.id
     WHERE sa.user_id = $1
       AND s.status = 'active'
     ORDER BY s.id ASC`,
    [user.id]
  );
  return result.rows.map(toShop);
}

export async function findAccessibleShop(user: AuthUser, shopId: number): Promise<Shop | null> {
  const shops = await listAccessibleShops(user);
  return shops.find((shop) => shop.id === shopId) ?? null;
}

export async function upsertShopCredential(input: EncryptedCredentialInput) {
  const result = await getDbPool().query(
    `INSERT INTO shop_credentials (
       shop_id, username, password_encrypted, password_iv, password_tag, updated_by
     )
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (shop_id) DO UPDATE
       SET username = EXCLUDED.username,
           password_encrypted = EXCLUDED.password_encrypted,
           password_iv = EXCLUDED.password_iv,
           password_tag = EXCLUDED.password_tag,
           updated_by = EXCLUDED.updated_by,
           updated_at = NOW()
     RETURNING shop_id, username, updated_at`,
    [input.shopId, input.username, input.encrypted, input.iv, input.tag, input.updatedBy]
  );

  return {
    shopId: Number(result.rows[0].shop_id),
    username: String(result.rows[0].username),
    updatedAt: formatShanghaiDate(result.rows[0].updated_at)
  };
}

export async function assignShopToUser(shopId: number, userId: number, grantedBy: number) {
  await getDbPool().query(
    `INSERT INTO shop_assignments (user_id, shop_id, granted_by)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id, shop_id) DO UPDATE
       SET granted_by = EXCLUDED.granted_by,
           granted_at = NOW()`,
    [userId, shopId, grantedBy]
  );
}
