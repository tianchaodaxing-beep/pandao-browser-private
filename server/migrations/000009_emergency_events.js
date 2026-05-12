/** @type {import('node-pg-migrate').MigrationBuilderActions} */
export const shorthands = undefined;

export function up(pgm) {
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS emergency_events (
      id BIGSERIAL PRIMARY KEY,
      triggered_by INT REFERENCES users(id) ON DELETE SET NULL,
      event_type VARCHAR(32) NOT NULL
        CHECK (event_type IN (
          'boundary_red_attempted',
          'manual_lockout',
          'frozen_ai',
          'expired_approval',
          'manual_unfreeze'
        )),
      scope VARCHAR(20) NOT NULL,
      scope_target_id INT,
      reason TEXT NOT NULL,
      affected_users INT[] NOT NULL DEFAULT '{}',
      metadata JSONB,
      triggered_at TIMESTAMP DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_emergency_events_type_time
      ON emergency_events(event_type, triggered_at DESC);
    CREATE INDEX IF NOT EXISTS idx_emergency_events_triggered_by
      ON emergency_events(triggered_by, triggered_at DESC);

    ALTER TABLE ai_tasks
      ADD COLUMN IF NOT EXISTS escalated_at TIMESTAMP;

    CREATE INDEX IF NOT EXISTS idx_ai_tasks_pending_escalation
      ON ai_tasks(status, created_at DESC)
      WHERE status = 'pending' AND approval_required = TRUE;
  `);
}

export function down(pgm) {
  pgm.sql(`
    DROP INDEX IF EXISTS idx_ai_tasks_pending_escalation;
    ALTER TABLE ai_tasks DROP COLUMN IF EXISTS escalated_at;
    DROP INDEX IF EXISTS idx_emergency_events_triggered_by;
    DROP INDEX IF EXISTS idx_emergency_events_type_time;
    DROP TABLE IF EXISTS emergency_events;
  `);
}
