import type { QueryResultRow } from 'pg';
import type { BrowserExtension, ExtensionSourceType } from 'shared';
import { getDbPool } from '../../db/pool.js';

export type CreateExtensionInput = {
  id: string;
  name: string;
  version: string | null;
  sourceType: ExtensionSourceType;
  sourceUrl: string | null;
  installedPath: string;
  enabled: boolean;
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

function toExtension(row: QueryResultRow): BrowserExtension {
  return {
    id: String(row.id),
    name: String(row.name),
    version: row.version === null ? null : String(row.version),
    sourceType: row.source_type as ExtensionSourceType,
    sourceUrl: row.source_url === null ? null : String(row.source_url),
    installedPath: String(row.installed_path),
    enabled: Boolean(row.enabled),
    installedAt: formatShanghaiDate(row.installed_at)
  };
}

const extensionColumns = `
  id, name, version, source_type, source_url, installed_path, enabled, installed_at
`;

export async function createExtension(input: CreateExtensionInput): Promise<BrowserExtension> {
  const result = await getDbPool().query(
    `INSERT INTO extensions (
       id, name, version, source_type, source_url, installed_path, enabled
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING ${extensionColumns}`,
    [input.id, input.name, input.version, input.sourceType, input.sourceUrl, input.installedPath, input.enabled]
  );

  return toExtension(result.rows[0]);
}

export async function listExtensions(): Promise<BrowserExtension[]> {
  const result = await getDbPool().query(
    `SELECT ${extensionColumns}
     FROM extensions
     ORDER BY installed_at DESC, name ASC`
  );

  return result.rows.map(toExtension);
}

export async function findExtension(extensionId: string): Promise<BrowserExtension | null> {
  const result = await getDbPool().query(
    `SELECT ${extensionColumns}
     FROM extensions
     WHERE id = $1
     LIMIT 1`,
    [extensionId]
  );

  return result.rowCount ? toExtension(result.rows[0]) : null;
}

export async function setExtensionEnabled(extensionId: string, enabled: boolean): Promise<BrowserExtension | null> {
  const result = await getDbPool().query(
    `UPDATE extensions
     SET enabled = $2
     WHERE id = $1
     RETURNING ${extensionColumns}`,
    [extensionId, enabled]
  );

  return result.rowCount ? toExtension(result.rows[0]) : null;
}

export async function deleteExtension(extensionId: string): Promise<BrowserExtension | null> {
  const result = await getDbPool().query(
    `DELETE FROM extensions
     WHERE id = $1
     RETURNING ${extensionColumns}`,
    [extensionId]
  );

  return result.rowCount ? toExtension(result.rows[0]) : null;
}

export async function listExtensionsForWorkspace(workspaceId: number): Promise<BrowserExtension[]> {
  const result = await getDbPool().query(
    `SELECT ${extensionColumns.split(',').map((column) => `e.${column.trim()}`).join(', ')}
     FROM workspace_extensions we
     JOIN extensions e ON e.id = we.extension_id
     WHERE we.workspace_id = $1
     ORDER BY e.name ASC`,
    [workspaceId]
  );

  return result.rows.map(toExtension);
}

export async function bindExtensionToWorkspace(workspaceId: number, extensionId: string) {
  await getDbPool().query(
    `INSERT INTO workspace_extensions (workspace_id, extension_id)
     VALUES ($1, $2)
     ON CONFLICT (workspace_id, extension_id) DO NOTHING`,
    [workspaceId, extensionId]
  );
}

export async function unbindExtensionFromWorkspace(workspaceId: number, extensionId: string) {
  await getDbPool().query(
    `DELETE FROM workspace_extensions
     WHERE workspace_id = $1
       AND extension_id = $2`,
    [workspaceId, extensionId]
  );
}
