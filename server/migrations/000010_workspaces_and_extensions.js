/** @type {import('node-pg-migrate').MigrationBuilderActions} */
export const shorthands = undefined;

export function up(pgm) {
  pgm.sql(`
    DO $$
    BEGIN
      IF to_regclass('public.workspaces') IS NULL AND to_regclass('public.shops') IS NOT NULL THEN
        ALTER TABLE shops RENAME TO workspaces;
      END IF;
    END
    $$;

    ALTER TABLE workspaces DROP CONSTRAINT IF EXISTS shops_platform_check;
    ALTER TABLE workspaces DROP CONSTRAINT IF EXISTS workspaces_platform_check;
    ALTER TABLE workspaces ALTER COLUMN platform TYPE TEXT;
    ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS category TEXT;
    ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS icon TEXT;
    ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS sort_order INT NOT NULL DEFAULT 0;

    UPDATE workspaces
    SET category = COALESCE(category, '电商'),
        icon = COALESCE(icon, '🛒')
    WHERE platform = 'coupang';

    INSERT INTO workspaces (
      name, platform, category, icon, sort_order, team_id,
      default_url, proxy_id, fingerprint_config, status
    )
    SELECT 'PANDAO ERP', 'erp', 'ERP', '🏢', -20, NULL,
           'https://xinhuonianhua.com/admin', NULL, NULL, 'active'
    WHERE NOT EXISTS (
      SELECT 1 FROM workspaces WHERE default_url = 'https://xinhuonianhua.com/admin'
    );

    INSERT INTO workspaces (
      name, platform, category, icon, sort_order, team_id,
      default_url, proxy_id, fingerprint_config, status
    )
    SELECT 'PANDAO 官网', 'erp', 'ERP', '🌐', -10, NULL,
           'https://xinhuonianhua.com/', NULL, NULL, 'active'
    WHERE NOT EXISTS (
      SELECT 1 FROM workspaces WHERE default_url = 'https://xinhuonianhua.com/'
    );

    CREATE INDEX IF NOT EXISTS idx_workspaces_category_sort
      ON workspaces(category, sort_order, id);
    CREATE INDEX IF NOT EXISTS idx_workspaces_platform
      ON workspaces(platform);

    CREATE TABLE IF NOT EXISTS extensions (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      version TEXT,
      source_type TEXT NOT NULL CHECK (source_type IN ('crx','zip','github','manual')),
      source_url TEXT NULL,
      installed_path TEXT NOT NULL,
      enabled BOOLEAN NOT NULL DEFAULT true,
      installed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS workspace_extensions (
      workspace_id INT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      extension_id TEXT NOT NULL REFERENCES extensions(id) ON DELETE CASCADE,
      PRIMARY KEY (workspace_id, extension_id)
    );

    CREATE INDEX IF NOT EXISTS idx_workspace_extensions_extension_id
      ON workspace_extensions(extension_id);
  `);
}

export function down(pgm) {
  pgm.sql(`
    DROP INDEX IF EXISTS idx_workspace_extensions_extension_id;
    DROP TABLE IF EXISTS workspace_extensions;
    DROP TABLE IF EXISTS extensions;

    DELETE FROM workspaces
    WHERE default_url IN ('https://xinhuonianhua.com/admin', 'https://xinhuonianhua.com/')
      AND platform = 'erp';

    DELETE FROM workspaces
    WHERE platform NOT IN ('naver_smartstore', 'coupang', 'gmarket', '11st');

    DROP INDEX IF EXISTS idx_workspaces_platform;
    DROP INDEX IF EXISTS idx_workspaces_category_sort;

    ALTER TABLE workspaces DROP COLUMN IF EXISTS sort_order;
    ALTER TABLE workspaces DROP COLUMN IF EXISTS icon;
    ALTER TABLE workspaces DROP COLUMN IF EXISTS category;
    ALTER TABLE workspaces ADD CONSTRAINT shops_platform_check
      CHECK (platform IN ('naver_smartstore', 'coupang', 'gmarket', '11st'));

    DO $$
    BEGIN
      IF to_regclass('public.shops') IS NULL AND to_regclass('public.workspaces') IS NOT NULL THEN
        ALTER TABLE workspaces RENAME TO shops;
      END IF;
    END
    $$;
  `);
}
