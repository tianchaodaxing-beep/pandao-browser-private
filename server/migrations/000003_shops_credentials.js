/** @type {import('node-pg-migrate').MigrationBuilderActions} */
export const shorthands = undefined;

export function up(pgm) {
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS shops (
      id SERIAL PRIMARY KEY,
      name VARCHAR(128) NOT NULL,
      platform VARCHAR(32) NOT NULL CHECK (platform IN ('naver_smartstore', 'coupang', 'gmarket', '11st')),
      team_id INT REFERENCES teams(id) ON DELETE SET NULL,
      default_url VARCHAR(255),
      proxy_id INT NULL,
      fingerprint_config JSONB,
      status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'archived')),
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_shops_team_id ON shops(team_id);
    CREATE INDEX IF NOT EXISTS idx_shops_status ON shops(status);

    CREATE TABLE IF NOT EXISTS shop_credentials (
      id SERIAL PRIMARY KEY,
      shop_id INT UNIQUE NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
      username VARCHAR(255) NOT NULL,
      password_encrypted BYTEA NOT NULL,
      password_iv BYTEA NOT NULL,
      password_tag BYTEA NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW(),
      updated_by INT REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS shop_assignments (
      user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      shop_id INT NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
      granted_at TIMESTAMP DEFAULT NOW(),
      granted_by INT REFERENCES users(id) ON DELETE SET NULL,
      PRIMARY KEY (user_id, shop_id)
    );

    CREATE INDEX IF NOT EXISTS idx_shop_assignments_user_id ON shop_assignments(user_id);
    CREATE INDEX IF NOT EXISTS idx_shop_assignments_shop_id ON shop_assignments(shop_id);
  `);
}

export function down(pgm) {
  pgm.sql(`
    DROP TABLE IF EXISTS shop_assignments;
    DROP TABLE IF EXISTS shop_credentials;
    DROP TABLE IF EXISTS shops;
  `);
}
