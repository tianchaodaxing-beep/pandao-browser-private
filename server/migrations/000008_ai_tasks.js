/** @type {import('node-pg-migrate').MigrationBuilderActions} */
export const shorthands = undefined;

export function up(pgm) {
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS ai_tasks (
      id BIGSERIAL PRIMARY KEY,
      ai_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      shop_id INT NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
      command VARCHAR(64) NOT NULL,
      payload JSONB,
      status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'approved', 'denied', 'executing', 'done', 'failed')),
      risk_level VARCHAR(10) NOT NULL DEFAULT 'green'
        CHECK (risk_level IN ('green', 'yellow', 'red')),
      approval_required BOOLEAN NOT NULL DEFAULT TRUE,
      assigned_to INT REFERENCES users(id) ON DELETE SET NULL,
      result JSONB,
      created_at TIMESTAMP DEFAULT NOW(),
      approved_at TIMESTAMP,
      executed_at TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_ai_tasks_ai_id ON ai_tasks(ai_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_ai_tasks_shop_id ON ai_tasks(shop_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_ai_tasks_status ON ai_tasks(status, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_ai_tasks_assigned_to ON ai_tasks(assigned_to, created_at DESC);
  `);
}

export function down(pgm) {
  pgm.sql(`
    DROP INDEX IF EXISTS idx_ai_tasks_assigned_to;
    DROP INDEX IF EXISTS idx_ai_tasks_status;
    DROP INDEX IF EXISTS idx_ai_tasks_shop_id;
    DROP INDEX IF EXISTS idx_ai_tasks_ai_id;
    DROP TABLE IF EXISTS ai_tasks;
  `);
}
