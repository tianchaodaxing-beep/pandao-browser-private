/** @type {import('node-pg-migrate').MigrationBuilderActions} */
export const shorthands = undefined;

export function up(pgm) {
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS teams (
      id SERIAL PRIMARY KEY,
      name VARCHAR(64) NOT NULL,
      manager_id INT
    );

    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username VARCHAR(64) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      role VARCHAR(20) NOT NULL CHECK (role IN ('boss', 'manager', 'staff', 'ai')),
      team_id INT REFERENCES teams(id) ON DELETE SET NULL,
      display_name VARCHAR(64),
      status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'disabled', 'frozen')),
      frozen_until TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW(),
      last_login_at TIMESTAMP
    );

    ALTER TABLE teams
      ADD CONSTRAINT teams_manager_id_fkey
      FOREIGN KEY (manager_id) REFERENCES users(id) ON DELETE SET NULL;

    CREATE UNIQUE INDEX IF NOT EXISTS users_username_unique_idx ON users(username);

    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id BIGSERIAL PRIMARY KEY,
      user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      jti UUID UNIQUE NOT NULL,
      issued_at TIMESTAMP DEFAULT NOW(),
      expires_at TIMESTAMP NOT NULL,
      revoked_at TIMESTAMP NULL
    );

    CREATE UNIQUE INDEX IF NOT EXISTS refresh_tokens_jti_unique_idx ON refresh_tokens(jti);
    CREATE INDEX IF NOT EXISTS refresh_tokens_user_id_idx ON refresh_tokens(user_id);
    CREATE INDEX IF NOT EXISTS refresh_tokens_expires_at_idx ON refresh_tokens(expires_at);
  `);
}

export function down(pgm) {
  pgm.sql(`
    DROP TABLE IF EXISTS refresh_tokens;
    ALTER TABLE IF EXISTS teams DROP CONSTRAINT IF EXISTS teams_manager_id_fkey;
    DROP TABLE IF EXISTS users;
    DROP TABLE IF EXISTS teams;
  `);
}
