import { app } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { ActionLogInput } from 'shared';

const MAX_QUEUE_BYTES = 50 * 1024 * 1024;
const FLUSH_INTERVAL_MS = 30_000;

type QueueRecord = {
  log: ActionLogInput;
  screenshotBase64: null;
};

type UploadLogOnly = (log: ActionLogInput) => Promise<void>;

let flushTimer: NodeJS.Timeout | null = null;
let flushing = false;

function getQueuePath() {
  return path.join(app.getPath('userData'), 'action-queue.jsonl');
}

async function readQueueRecords(): Promise<QueueRecord[]> {
  try {
    const content = await fs.readFile(getQueuePath(), 'utf8');
    return content
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => JSON.parse(line) as QueueRecord);
  } catch (error) {
    if ((error as { code?: string }).code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}

async function writeQueueRecords(records: QueueRecord[]) {
  await fs.mkdir(path.dirname(getQueuePath()), { recursive: true });
  const content = records.map((record) => JSON.stringify(record)).join('\n');
  await fs.writeFile(getQueuePath(), content ? `${content}\n` : '');
}

async function trimQueueIfNeeded(records: QueueRecord[]) {
  let trimmed = records;

  while (Buffer.byteLength(trimmed.map((record) => JSON.stringify(record)).join('\n'), 'utf8') > MAX_QUEUE_BYTES) {
    trimmed = trimmed.slice(1);
    console.log('[action-recorder] queue full');
  }

  return trimmed;
}

export async function enqueueAction(log: ActionLogInput) {
  const records = await readQueueRecords();
  records.push({ log, screenshotBase64: null });
  await writeQueueRecords(await trimQueueIfNeeded(records));
}

export async function flushActionQueue(uploadLogOnly: UploadLogOnly) {
  if (flushing) {
    return;
  }

  flushing = true;
  try {
    const records = await readQueueRecords();
    const remaining: QueueRecord[] = [];

    for (const record of records) {
      try {
        await uploadLogOnly(record.log);
      } catch {
        remaining.push(record);
      }
    }

    await writeQueueRecords(await trimQueueIfNeeded(remaining));
  } finally {
    flushing = false;
  }
}

export function startActionQueueFlush(uploadLogOnly: UploadLogOnly) {
  if (flushTimer) {
    return;
  }

  flushTimer = setInterval(() => {
    void flushActionQueue(uploadLogOnly);
  }, FLUSH_INTERVAL_MS);
  flushTimer.unref();
}
