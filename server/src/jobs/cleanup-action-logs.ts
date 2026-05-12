import cron from 'node-cron';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { Dirent } from 'node:fs';
import type { FastifyInstance } from 'fastify';
import { deleteExpiredActionLogs } from '../modules/audit/repository.js';
import { getDataRoot } from '../modules/audit/service.js';

const RETENTION_DAYS = 180;

async function deleteExpiredScreenshots(dir: string, cutoffTime: number): Promise<number> {
  let deleted = 0;
  let entries: Dirent[];

  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch (error) {
    if ((error as { code?: string }).code === 'ENOENT') {
      return 0;
    }
    throw error;
  }

  for (const entry of entries) {
    const absolutePath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      deleted += await deleteExpiredScreenshots(absolutePath, cutoffTime);
      continue;
    }

    if (!entry.isFile() || path.extname(entry.name).toLowerCase() !== '.png') {
      continue;
    }

    const stat = await fs.stat(absolutePath);
    if (stat.mtimeMs < cutoffTime) {
      await fs.unlink(absolutePath);
      deleted += 1;
    }
  }

  return deleted;
}

export async function runActionLogCleanup(app?: FastifyInstance) {
  const cutoffTime = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
  const deletedRows = await deleteExpiredActionLogs();
  const screenshotRoot = path.join(getDataRoot(), 'screenshots');
  const deletedScreenshots = await deleteExpiredScreenshots(screenshotRoot, cutoffTime);

  app?.log.info(
    { deletedRows, deletedScreenshots },
    'action log cleanup finished'
  );

  return { deletedRows, deletedScreenshots };
}

export function startActionLogCleanup(app: FastifyInstance) {
  if (process.env.NODE_ENV !== 'production' || process.env.CRON_DISABLED === 'true') {
    app.log.info('action log cleanup cron disabled');
    return;
  }

  cron.schedule(
    '0 3 * * *',
    () => {
      void runActionLogCleanup(app).catch((error) => {
        app.log.error(error, 'action log cleanup failed');
      });
    },
    { timezone: 'Asia/Shanghai' }
  );
}
