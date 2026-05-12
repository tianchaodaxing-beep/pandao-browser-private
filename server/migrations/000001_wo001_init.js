/** @type {import('node-pg-migrate').MigrationBuilderActions} */
export const shorthands = undefined;

export function up() {
  // WO-001 prepares the migration pipeline only. Business tables start in WO-002.
}

export function down() {
  // No-op.
}
