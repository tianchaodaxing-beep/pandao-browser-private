import type {
  ActionLogInput,
  ActionLogResponse,
  ActionScreenshotResponse,
  ActionSelectorsResponse
} from 'shared';
import { requestAuthedJson } from '../browser-engine/api-client.js';

export async function getActionSelectors(shopId: number) {
  const result = await requestAuthedJson<ActionSelectorsResponse>(`/shops/${shopId}/action-selectors`, {
    method: 'GET'
  });
  return result.selectors;
}

export async function postActionLog(log: ActionLogInput): Promise<ActionLogResponse> {
  return requestAuthedJson<ActionLogResponse>('/actions/log', {
    method: 'POST',
    body: JSON.stringify(log)
  });
}

export async function postActionScreenshot(logId: string, screenshot: Buffer): Promise<ActionScreenshotResponse> {
  const form = new FormData();
  const screenshotBytes = screenshot.buffer.slice(
    screenshot.byteOffset,
    screenshot.byteOffset + screenshot.byteLength
  ) as ArrayBuffer;
  form.append('log_id', logId);
  form.append('screenshot', new Blob([screenshotBytes], { type: 'image/png' }), 'screenshot.png');

  return requestAuthedJson<ActionScreenshotResponse>('/actions/screenshot', {
    method: 'POST',
    body: form
  });
}
