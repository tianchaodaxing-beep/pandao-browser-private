import type { QueryResultRow } from 'pg';
import type { Pool, PoolClient } from 'pg';
import type { FingerprintConfig, Workspace, WorkspacePlatform, WorkspaceStatus } from 'shared';
import { getDbPool } from '../../db/pool.js';
import type { AuthUser } from '../auth/types.js';

export type CreateWorkspaceInput = {
  name: string;
  platform: WorkspacePlatform;
  category: string | null;
  icon: string | null;
  sortOrder: number;
  teamId: number | null;
  defaultUrl: string | null;
  fingerprintConfig: FingerprintConfig | null;
};

export type UpdateWorkspaceInput = Partial<Omit<CreateWorkspaceInput, 'fingerprintConfig'>> & {
  status?: WorkspaceStatus;
  fingerprintConfig?: FingerprintConfig | null;
};

export type EncryptedCredentialInput = {
  shopId: number;
  username: string;
  encrypted: Buffer;
  iv: Buffer;
  tag: Buffer;
  updatedBy: number;
};

const defaultCategories = ['ERP', '电商', '运营', '工具'];

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

function toWorkspace(row: QueryResultRow): Workspace {
  return {
    id: Number(row.id),
    name: String(row.name),
    platform: row.platform as WorkspacePlatform,
    category: row.category === null ? null : String(row.category),
    icon: row.icon === null ? null : String(row.icon),
    sortOrder: row.sort_order === null ? 0 : Number(row.sort_order),
    teamId: row.team_id === null ? null : Number(row.team_id),
    defaultUrl: row.default_url === null ? null : String(row.default_url),
    proxyId: row.proxy_id === null ? null : Number(row.proxy_id),
    fingerprintConfig: row.fingerprint_config as FingerprintConfig | null,
    status: row.status as WorkspaceStatus,
    createdAt: formatShanghaiDate(row.created_at)
  };
}

const workspaceColumnNames = [
  'id',
  'name',
  'platform',
  'category',
  'icon',
  'sort_order',
  'team_id',
  'default_url',
  'proxy_id',
  'fingerprint_config',
  'status',
  'created_at'
];

function selectWorkspaceColumns(alias = '') {
  const prefix = alias ? `${alias}.` : '';
  return workspaceColumnNames.map((column) => `${prefix}${column}`).join(', ');
}

export async function createWorkspace(input: CreateWorkspaceInput): Promise<Workspace> {
  const result = await getDbPool().query(
    `INSERT INTO workspaces (
       name, platform, category, icon, sort_order, team_id,
       default_url, proxy_id, fingerprint_config, status
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, NULL, $8, 'active')
     RETURNING ${selectWorkspaceColumns()}`,
    [
      input.name,
      input.platform,
      input.category,
      input.icon,
      input.sortOrder,
      input.teamId,
      input.defaultUrl,
      input.fingerprintConfig
    ]
  );

  return toWorkspace(result.rows[0]);
}

export async function updateWorkspace(workspaceId: number, input: UpdateWorkspaceInput): Promise<Workspace | null> {
  const assignments: string[] = [];
  const values: unknown[] = [];

  const push = (column: string, value: unknown) => {
    values.push(value);
    assignments.push(`${column} = $${values.length}`);
  };

  if (input.name !== undefined) push('name', input.name);
  if (input.platform !== undefined) push('platform', input.platform);
  if (input.category !== undefined) push('category', input.category);
  if (input.icon !== undefined) push('icon', input.icon);
  if (input.sortOrder !== undefined) push('sort_order', input.sortOrder);
  if (input.teamId !== undefined) push('team_id', input.teamId);
  if (input.defaultUrl !== undefined) push('default_url', input.defaultUrl);
  if (input.fingerprintConfig !== undefined) push('fingerprint_config', input.fingerprintConfig);
  if (input.status !== undefined) push('status', input.status);

  if (!assignments.length) {
    return findWorkspaceById(workspaceId);
  }

  values.push(workspaceId);
  const result = await getDbPool().query(
    `UPDATE workspaces
     SET ${assignments.join(', ')}
     WHERE id = $${values.length}
     RETURNING ${selectWorkspaceColumns()}`,
    values
  );

  return result.rowCount ? toWorkspace(result.rows[0]) : null;
}

export async function findWorkspaceById(workspaceId: number): Promise<Workspace | null> {
  const result = await getDbPool().query(
    `SELECT ${selectWorkspaceColumns()}
     FROM workspaces
     WHERE id = $1
     LIMIT 1`,
    [workspaceId]
  );

  return result.rowCount ? toWorkspace(result.rows[0]) : null;
}

export async function listWorkspaceCategories(): Promise<string[]> {
  const result = await getDbPool().query(
    `SELECT DISTINCT category
     FROM workspaces
     WHERE status = 'active'
       AND category IS NOT NULL
       AND category <> ''
     ORDER BY category ASC`
  );
  return Array.from(new Set([...defaultCategories, ...result.rows.map((row) => String(row.category))]));
}

export async function listActiveWorkspacesWithoutFingerprint(): Promise<Array<{ id: number }>> {
  const result = await getDbPool().query(
    `SELECT id
     FROM workspaces
     WHERE status = 'active'
       AND fingerprint_config IS NULL
     ORDER BY id ASC`
  );

  return result.rows.map((row) => ({ id: Number(row.id) }));
}

export async function listActiveWorkspaceFingerprints(): Promise<Array<{ id: number; fingerprintConfig: FingerprintConfig }>> {
  const result = await getDbPool().query(
    `SELECT id, fingerprint_config
     FROM workspaces
     WHERE status = 'active'
       AND fingerprint_config IS NOT NULL
     ORDER BY id ASC`
  );

  return result.rows.map((row) => ({
    id: Number(row.id),
    fingerprintConfig: row.fingerprint_config as FingerprintConfig
  }));
}

export async function updateWorkspaceFingerprint(workspaceId: number, fingerprintConfig: FingerprintConfig) {
  await getDbPool().query(
    `UPDATE workspaces
     SET fingerprint_config = $2
     WHERE id = $1
       AND fingerprint_config IS NULL`,
    [workspaceId, fingerprintConfig]
  );
}

export async function listAccessibleWorkspaces(user: AuthUser): Promise<Workspace[]> {
  if (user.role === 'boss') {
    const result = await getDbPool().query(
      `SELECT ${selectWorkspaceColumns()}
       FROM workspaces
       WHERE status = 'active'
       ORDER BY sort_order ASC, id ASC`
    );
    return result.rows.map(toWorkspace);
  }

  if (user.role === 'manager') {
    const result = await getDbPool().query(
      `SELECT ${selectWorkspaceColumns('w')}
       FROM workspaces w
       JOIN teams t ON t.id = w.team_id
       WHERE t.manager_id = $1
         AND w.status = 'active'
       ORDER BY w.sort_order ASC, w.id ASC`,
      [user.id]
    );
    return result.rows.map(toWorkspace);
  }

  const result = await getDbPool().query(
    `SELECT ${selectWorkspaceColumns('w')}
     FROM workspaces w
     JOIN shop_assignments sa ON sa.shop_id = w.id
     WHERE sa.user_id = $1
       AND w.status = 'active'
     ORDER BY w.sort_order ASC, w.id ASC`,
    [user.id]
  );
  return result.rows.map(toWorkspace);
}

export async function findAccessibleWorkspace(user: AuthUser, workspaceId: number): Promise<Workspace | null> {
  const workspaces = await listAccessibleWorkspaces(user);
  return workspaces.find((workspace) => workspace.id === workspaceId) ?? null;
}

export async function upsertWorkspaceCredential(input: EncryptedCredentialInput) {
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

export async function assignWorkspaceToUser(workspaceId: number, userId: number, grantedBy: number) {
  await getDbPool().query(
    `INSERT INTO shop_assignments (user_id, shop_id, granted_by)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id, shop_id) DO UPDATE
       SET granted_by = EXCLUDED.granted_by,
           granted_at = NOW()`,
    [userId, workspaceId, grantedBy]
  );
}

export async function updateWorkspaceProxyBinding(
  workspaceId: number,
  proxyId: number | null,
  db: Pool | PoolClient = getDbPool()
) {
  await db.query(
    `UPDATE workspaces
     SET proxy_id = $2
     WHERE id = $1
       AND status = 'active'`,
    [workspaceId, proxyId]
  );
}

export const createShop = createWorkspace;
export const updateShop = updateWorkspace;
export const listActiveShopsWithoutFingerprint = listActiveWorkspacesWithoutFingerprint;
export const listActiveShopFingerprints = listActiveWorkspaceFingerprints;
export const updateShopFingerprint = updateWorkspaceFingerprint;
export const listAccessibleShops = listAccessibleWorkspaces;
export const findAccessibleShop = findAccessibleWorkspace;
export const upsertShopCredential = upsertWorkspaceCredential;
export const assignShopToUser = assignWorkspaceToUser;
export const updateShopProxyBinding = updateWorkspaceProxyBinding;
export type CreateShopInput = CreateWorkspaceInput;
