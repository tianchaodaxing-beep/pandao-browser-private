/** @type {import('node-pg-migrate').MigrationBuilderActions} */
export const shorthands = undefined;

export function up(pgm) {
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS action_logs (
      id BIGSERIAL PRIMARY KEY,
      actor_id INT REFERENCES users(id),
      actor_type VARCHAR(10) CHECK (actor_type IN ('human', 'ai')),
      shop_id INT REFERENCES shops(id),
      action_type VARCHAR(64) NOT NULL,
      action_payload JSONB,
      before_value JSONB,
      after_value JSONB,
      risk_level VARCHAR(10) CHECK (risk_level IN ('green', 'yellow', 'red')),
      approval_status VARCHAR(20) CHECK (approval_status IN ('auto', 'pending', 'approved', 'denied')),
      approved_by INT REFERENCES users(id),
      ip_address VARCHAR(64),
      user_agent TEXT,
      screenshot_path VARCHAR(255),
      created_at TIMESTAMP DEFAULT NOW(),
      retention_until TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_action_logs_actor ON action_logs(actor_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_action_logs_shop ON action_logs(shop_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_action_logs_risk ON action_logs(risk_level, approval_status);

    CREATE OR REPLACE FUNCTION set_action_logs_retention() RETURNS TRIGGER AS $$
    BEGIN
      IF NEW.created_at IS NULL THEN
        NEW.created_at := NOW();
      END IF;
      IF NEW.retention_until IS NULL THEN
        NEW.retention_until := NEW.created_at + INTERVAL '180 days';
      END IF;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    DROP TRIGGER IF EXISTS tg_action_logs_set_retention ON action_logs;
    CREATE TRIGGER tg_action_logs_set_retention
    BEFORE INSERT ON action_logs
    FOR EACH ROW EXECUTE FUNCTION set_action_logs_retention();

    CREATE OR REPLACE FUNCTION prevent_action_logs_modify() RETURNS TRIGGER AS $$
    BEGIN
      RAISE EXCEPTION 'action_logs is immutable';
    END;
    $$ LANGUAGE plpgsql;

    DROP TRIGGER IF EXISTS tg_action_logs_immutable ON action_logs;
    CREATE TRIGGER tg_action_logs_immutable
    BEFORE UPDATE OR DELETE ON action_logs
    FOR EACH ROW EXECUTE FUNCTION prevent_action_logs_modify();
  `);
}

export function down(pgm) {
  pgm.sql(`
    DROP TRIGGER IF EXISTS tg_action_logs_immutable ON action_logs;
    DROP TRIGGER IF EXISTS tg_action_logs_set_retention ON action_logs;
    DROP FUNCTION IF EXISTS prevent_action_logs_modify();
    DROP FUNCTION IF EXISTS set_action_logs_retention();
    DROP TABLE IF EXISTS action_logs;
  `);
}
