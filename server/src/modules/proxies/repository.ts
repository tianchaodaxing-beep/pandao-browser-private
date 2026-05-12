import type { PoolClient, QueryResultRow } from 'pg';
import type {
  ProxyDto,
  ProxyProvider,
  ProxyStatus,
  ShopProxyDto
} from 'shared';
import { getDbPool } from '../../db/pool.js';
import { updateShopProxyBinding } from '../shops/repository.js';

export type EncryptedProxyInput = {
  provider: ProxyProvider;
  protocol: 'http' | 'socks5';
  host: string;
  port: number;
  username: string | null;
  encrypted: Buffer | null;
  iv: Buffer | null;
  tag: Buffer | null;
  country: string;
  city: string | null;
};

export type ProxyListFilters = {
  provider?: ProxyProvider;
  status?: ProxyStatus;
  bound?: boolean;
};

export type ProxyCredentialSecret = {
  username: string | null;
  encrypted: Buffer | null;
  iv: Buffer | null;
  tag: Buffer | null;
};

export type ProxyBindResult =
  | { ok: true; proxy: ProxyDto }
  | {
      ok: false;
      code:
        | 'PROXY_NOT_FOUND'
        | 'SHOP_NOT_FOUND'
        | 'PROXY_ALREADY_BOUND'
        | 'SHOP_ALREADY_BOUND'
        | 'PROXY_UNAVAILABLE';
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

function nullableString(value: unknown): string | null {
  return value === null || value === undefined ? null : String(value);
}

function nullableBuffer(value: unknown): Buffer | null {
  return value === null || value === undefined ? null : Buffer.from(value as Buffer);
}

function toProxyDto(row: QueryResultRow): ProxyDto {
  return {
    id: Number(row.id),
    provider: row.provider as ProxyProvider,
    protocol: row.protocol as 'http' | 'socks5',
    host: String(row.host),
    port: Number(row.port),
    username: nullableString(row.username),
    country: String(row.country),
    city: nullableString(row.city),
    status: row.status as ProxyStatus,
    boundShopId: row.bound_shop_id === null ? null : Number(row.bound_shop_id),
    lastCheckAt: row.last_check_at === null ? null : formatShanghaiDate(row.last_check_at),
    createdAt: formatShanghaiDate(row.created_at),
    hasPassword: Boolean(row.has_password)
  };
}

function toShopProxyDto(row: QueryResultRow): ShopProxyDto {
  return {
    protocol: row.protocol as 'http' | 'socks5',
    host: String(row.host),
    port: Number(row.port),
    username: nullableString(row.username),
    country: String(row.country),
    city: nullableString(row.city),
    hasPassword: Boolean(row.has_password)
  };
}

function toCredentialSecret(row: QueryResultRow): ProxyCredentialSecret {
  return {
    username: nullableString(row.username),
    encrypted: nullableBuffer(row.password_encrypted),
    iv: nullableBuffer(row.password_iv),
    tag: nullableBuffer(row.password_tag)
  };
}

const proxySelectColumns = `
  id,
  provider,
  protocol,
  host,
  port,
  username,
  country,
  city,
  status,
  bound_shop_id,
  last_check_at,
  created_at,
  password_encrypted IS NOT NULL AS has_password
`;

export async function insertProxyRows(rows: EncryptedProxyInput[]): Promise<ProxyDto[]> {
  const client = await getDbPool().connect();

  try {
    await client.query('BEGIN');
    const inserted: ProxyDto[] = [];

    for (const row of rows) {
      const result = await client.query(
        `INSERT INTO proxies (
           provider, protocol, host, port, username,
           password_encrypted, password_iv, password_tag,
           country, city, status
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'active')
         RETURNING ${proxySelectColumns}`,
        [
          row.provider,
          row.protocol,
          row.host,
          row.port,
          row.username,
          row.encrypted,
          row.iv,
          row.tag,
          row.country,
          row.city
        ]
      );
      inserted.push(toProxyDto(result.rows[0]));
    }

    await client.query('COMMIT');
    return inserted;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function listProxies(filters: ProxyListFilters = {}): Promise<ProxyDto[]> {
  const clauses: string[] = [];
  const values: unknown[] = [];

  if (filters.provider) {
    values.push(filters.provider);
    clauses.push(`provider = $${values.length}`);
  }

  if (filters.status) {
    values.push(filters.status);
    clauses.push(`status = $${values.length}`);
  }

  if (filters.bound !== undefined) {
    clauses.push(filters.bound ? 'bound_shop_id IS NOT NULL' : 'bound_shop_id IS NULL');
  }

  const result = await getDbPool().query(
    `SELECT ${proxySelectColumns}
     FROM proxies
     ${clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''}
     ORDER BY id ASC`,
    values
  );

  return result.rows.map(toProxyDto);
}

async function findOtherProxyBoundToShop(client: PoolClient, proxyId: number, shopId: number) {
  const result = await client.query(
    `SELECT id
     FROM proxies
     WHERE bound_shop_id = $1
       AND id <> $2
     LIMIT 1
     FOR UPDATE`,
    [shopId, proxyId]
  );

  return result.rowCount ? Number(result.rows[0].id) : null;
}

export async function bindProxyToShop(proxyId: number, shopId: number): Promise<ProxyBindResult> {
  const client = await getDbPool().connect();

  try {
    await client.query('BEGIN');

    const proxyResult = await client.query(
      `SELECT ${proxySelectColumns}
       FROM proxies
       WHERE id = $1
       FOR UPDATE`,
      [proxyId]
    );

    if (!proxyResult.rowCount) {
      await client.query('ROLLBACK');
      return { ok: false, code: 'PROXY_NOT_FOUND' };
    }

    const proxy = toProxyDto(proxyResult.rows[0]);

    if (proxy.status === 'broken') {
      await client.query('ROLLBACK');
      return { ok: false, code: 'PROXY_UNAVAILABLE' };
    }

    if (proxy.boundShopId !== null && proxy.boundShopId !== shopId) {
      await client.query('ROLLBACK');
      return { ok: false, code: 'PROXY_ALREADY_BOUND' };
    }

    const shopResult = await client.query(
      `SELECT id, proxy_id
       FROM shops
       WHERE id = $1
         AND status = 'active'
       FOR UPDATE`,
      [shopId]
    );

    if (!shopResult.rowCount) {
      await client.query('ROLLBACK');
      return { ok: false, code: 'SHOP_NOT_FOUND' };
    }

    const currentShopProxyId = shopResult.rows[0].proxy_id === null ? null : Number(shopResult.rows[0].proxy_id);

    if (currentShopProxyId !== null && currentShopProxyId !== proxyId) {
      await client.query('ROLLBACK');
      return { ok: false, code: 'SHOP_ALREADY_BOUND' };
    }

    const otherProxyId = await findOtherProxyBoundToShop(client, proxyId, shopId);

    if (otherProxyId !== null) {
      await client.query('ROLLBACK');
      return { ok: false, code: 'SHOP_ALREADY_BOUND' };
    }

    const updated = await client.query(
      `UPDATE proxies
       SET bound_shop_id = $2,
           status = 'reserved'
       WHERE id = $1
       RETURNING ${proxySelectColumns}`,
      [proxyId, shopId]
    );

    await updateShopProxyBinding(shopId, proxyId, client);
    await client.query('COMMIT');

    return { ok: true, proxy: toProxyDto(updated.rows[0]) };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function unbindProxy(proxyId: number): Promise<boolean> {
  const client = await getDbPool().connect();

  try {
    await client.query('BEGIN');

    const proxyResult = await client.query(
      `SELECT id
       FROM proxies
       WHERE id = $1
       FOR UPDATE`,
      [proxyId]
    );

    if (!proxyResult.rowCount) {
      await client.query('ROLLBACK');
      return false;
    }

    await client.query(
      `UPDATE shops
       SET proxy_id = NULL
       WHERE proxy_id = $1`,
      [proxyId]
    );

    await client.query(
      `UPDATE proxies
       SET bound_shop_id = NULL,
           status = CASE WHEN status = 'reserved' THEN 'active' ELSE status END
       WHERE id = $1`,
      [proxyId]
    );

    await client.query('COMMIT');
    return true;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function findShopProxy(shopId: number): Promise<ShopProxyDto | null> {
  const result = await getDbPool().query(
    `SELECT
       p.protocol,
       p.host,
       p.port,
       p.username,
       p.country,
       p.city,
       p.password_encrypted IS NOT NULL AS has_password
     FROM shops s
     JOIN proxies p ON p.id = s.proxy_id
     WHERE s.id = $1
       AND s.status = 'active'
     LIMIT 1`,
    [shopId]
  );

  return result.rowCount ? toShopProxyDto(result.rows[0]) : null;
}

export async function findProxyCredentialSecretForShop(shopId: number): Promise<ProxyCredentialSecret | null> {
  const result = await getDbPool().query(
    `SELECT p.username, p.password_encrypted, p.password_iv, p.password_tag
     FROM shops s
     JOIN proxies p ON p.id = s.proxy_id
     WHERE s.id = $1
       AND s.status = 'active'
     LIMIT 1`,
    [shopId]
  );

  return result.rowCount ? toCredentialSecret(result.rows[0]) : null;
}
