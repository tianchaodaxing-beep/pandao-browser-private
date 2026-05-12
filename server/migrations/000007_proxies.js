/** @type {import('node-pg-migrate').MigrationBuilderActions} */
export const shorthands = undefined;

export function up(pgm) {
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS proxies (
      id SERIAL PRIMARY KEY,
      provider VARCHAR(32) NOT NULL CHECK (provider IN ('lunaproxy', '922s5')),
      protocol VARCHAR(10) NOT NULL CHECK (protocol IN ('http', 'socks5')),
      host VARCHAR(128) NOT NULL,
      port INT NOT NULL CHECK (port > 0 AND port <= 65535),
      username VARCHAR(255),
      password_encrypted BYTEA,
      password_iv BYTEA,
      password_tag BYTEA,
      country VARCHAR(8) NOT NULL DEFAULT 'KR',
      city VARCHAR(64),
      status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'broken', 'reserved')),
      last_check_at TIMESTAMP,
      bound_shop_id INT REFERENCES shops(id) ON DELETE SET NULL,
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_proxies_provider ON proxies(provider);
    CREATE INDEX IF NOT EXISTS idx_proxies_status ON proxies(status);
    CREATE INDEX IF NOT EXISTS idx_proxies_country ON proxies(country);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_proxies_bound_shop_id
      ON proxies(bound_shop_id)
      WHERE bound_shop_id IS NOT NULL;

    CREATE INDEX IF NOT EXISTS idx_shops_proxy_id ON shops(proxy_id);

    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'fk_shops_proxy_id'
      ) THEN
        ALTER TABLE shops
          ADD CONSTRAINT fk_shops_proxy_id
          FOREIGN KEY (proxy_id)
          REFERENCES proxies(id)
          ON DELETE SET NULL;
      END IF;
    END
    $$;
  `);
}

export function down(pgm) {
  pgm.sql(`
    ALTER TABLE shops DROP CONSTRAINT IF EXISTS fk_shops_proxy_id;
    DROP INDEX IF EXISTS idx_shops_proxy_id;
    DROP INDEX IF EXISTS idx_proxies_bound_shop_id;
    DROP INDEX IF EXISTS idx_proxies_country;
    DROP INDEX IF EXISTS idx_proxies_status;
    DROP INDEX IF EXISTS idx_proxies_provider;
    DROP TABLE IF EXISTS proxies;
  `);
}
