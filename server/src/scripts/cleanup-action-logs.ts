import 'dotenv/config';
import { closeDbPool } from '../db/pool.js';
import { runActionLogCleanup } from '../jobs/cleanup-action-logs.js';

async function main() {
  const result = await runActionLogCleanup();
  console.log(JSON.stringify({ ok: true, ...result }, null, 2));
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDbPool();
  });
