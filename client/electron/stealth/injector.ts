import type { Session, WebContents } from 'electron';
import type { FingerprintConfig } from 'shared';
import { buildStealthScript } from './build.js';

const blockedPermissions = new Set(['media', 'geolocation', 'camera', 'microphone']);

export function applyStealthSessionPolicy(shopSession: Session, fingerprint: FingerprintConfig | null) {
  if (fingerprint) {
    shopSession.setUserAgent(fingerprint.userAgent);
  }

  shopSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    callback(!blockedPermissions.has(permission));
  });
}

export async function injectStealth(
  webContents: WebContents,
  shopId: number,
  fingerprint: FingerprintConfig | null
) {
  if (!fingerprint || webContents.isDestroyed()) {
    return;
  }

  try {
    await webContents.executeJavaScript(buildStealthScript(fingerprint), true);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    console.log(`[stealth] inject failed shop=${shopId} reason=${reason.slice(0, 160)}`);
  }
}
