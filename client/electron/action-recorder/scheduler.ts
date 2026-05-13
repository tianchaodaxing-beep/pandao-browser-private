import type { WebContents } from 'electron';
import type { Shop } from 'shared';
import { getActionSelectors } from './api-client.js';
import { injectActionRecorder } from './injector.js';

export function scheduleActionRecorder(webContents: WebContents, shop: Shop) {
  setTimeout(() => {
    if (webContents.isDestroyed()) {
      return;
    }

    void (async () => {
      try {
        const selectors = await getActionSelectors(shop.id);
        const result = await injectActionRecorder(webContents, shop.id, selectors);
        if (result.attached) {
          console.log(`[action-recorder] listener attached, shop=${shop.id}`);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : '动作监听注入失败';
        console.log(`[action-recorder] inject skipped, shop=${shop.id}, reason=${message}`);
      }
    })();
  }, 1000);
}
