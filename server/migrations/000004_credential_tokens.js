/** @type {import('node-pg-migrate').MigrationBuilderActions} */
export const shorthands = undefined;

export function up(pgm) {
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS credential_tokens (
      id BIGSERIAL PRIMARY KEY,
      jti UUID UNIQUE NOT NULL,
      user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      shop_id INT NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
      issued_at TIMESTAMP DEFAULT NOW(),
      expires_at TIMESTAMP NOT NULL,
      used_at TIMESTAMP NULL,
      ip_address VARCHAR(64) NULL
    );

    CREATE INDEX IF NOT EXISTS idx_credential_tokens_user_id ON credential_tokens(user_id);
    CREATE INDEX IF NOT EXISTS idx_credential_tokens_expires_at ON credential_tokens(expires_at);
  `);
}

export function down(pgm) {
  pgm.sql(`
    DROP TABLE IF EXISTS credential_tokens;
  `);
}
