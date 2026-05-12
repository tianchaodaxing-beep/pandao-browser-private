import pg from 'pg';
import type { Pool as PoolType } from 'pg';
import { getDatabaseConfig } from './config.js';

const { Pool } = pg;

let pool: PoolType | null = null;

export function getDbPool(): PoolType {
  if (!pool) {
    pool = new Pool({
      connectionString: getDatabaseConfig().connectionString
    });
  }

  return pool;
}

export async function closeDbPool() {
  if (!pool) {
    return;
  }

  await pool.end();
  pool = null;
}
