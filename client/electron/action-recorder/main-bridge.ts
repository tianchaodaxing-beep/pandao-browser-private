import { ipcMain } from 'electron';
import type { ActionLogInput, ActionRecorderPayload } from 'shared';
import { postActionLog, postActionScreenshot } from './api-client.js';
import { enqueueAction, flushActionQueue, startActionQueueFlush } from './queue.js';

let registered = false;

const mandatoryScreenshotActions = new Set([
  'product.price.update',
  'product.create',
  'product.unlist',
  'product.relist',
  'customer.reply.review.medium',
  'customer.reply.review.bad',
  'order.cancel'
]);

function shouldCaptureScreenshot(log: ActionLogInput) {
  if (log.riskLevel === 'yellow' || log.riskLevel === 'red') {
    return true;
  }

  if (mandatoryScreenshotActions.has(log.actionType)) {
    return true;
  }

  if (log.actionType.startsWith('order.refund.')) {
    return true;
  }

  if (log.actionType === 'order.shipment.fill') {
    return Math.random() < 0.1;
  }

  return false;
}

function normalizePayload(payload: unknown): ActionLogInput | null {
  const raw = payload as Partial<ActionRecorderPayload> | null;

  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const shopId = Number(raw.shopId);
  const actionType = typeof raw.actionType === 'string' ? raw.actionType.trim() : '';

  if (!Number.isInteger(shopId) || shopId <= 0 || !actionType || actionType.length > 64) {
    return null;
  }

  return {
    actorType: 'human',
    shopId,
    actionType,
    actionPayload: raw.actionPayload ?? null,
    before: raw.before ?? null,
    after: raw.after ?? null,
    riskLevel: raw.riskLevel ?? 'green',
    approvalStatus: raw.approvalStatus ?? 'auto'
  };
}

async function uploadLogOnly(log: ActionLogInput) {
  await postActionLog(log);
}

export function registerActionRecorderHandlers() {
  if (registered) {
    return;
  }
  registered = true;

  startActionQueueFlush(uploadLogOnly);

  ipcMain.handle('action-recorder.report', async (event, payload: unknown) => {
    const log = normalizePayload(payload);

    if (!log) {
      throw new Error('动作上报格式无效');
    }

    try {
      const result = await postActionLog(log);
      let screenshotUploaded = false;

      if (shouldCaptureScreenshot(log)) {
        try {
          const image = await event.sender.capturePage();
          const screenshot = image.toPNG();
          try {
            const screenshotResult = await postActionScreenshot(result.id, screenshot);
            screenshotUploaded = Boolean(screenshotResult.path);
          } finally {
            screenshot.fill(0);
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : '截图上传失败';
          console.log(`[action-recorder] screenshot skipped log=${result.id} reason=${message}`);
        }
      }

      console.log(`[action-recorder] uploaded log=${result.id} screenshot=${screenshotUploaded ? 'yes' : 'no'}`);
      void flushActionQueue(uploadLogOnly);
      return { ok: true, logId: result.id, screenshot: screenshotUploaded };
    } catch (error) {
      await enqueueAction(log);
      const message = error instanceof Error ? error.message : '动作日志上传失败';
      console.log(`[action-recorder] queued offline log, reason=${message}`);
      return { ok: true, queued: true };
    }
  });
}
