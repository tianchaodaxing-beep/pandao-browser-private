import type { FingerprintConfig } from 'shared';
import { buildAudioScript } from './scripts/audio.js';
import { buildCanvasScript } from './scripts/canvas.js';
import { buildFontsScript } from './scripts/fonts.js';
import { buildNavigatorScript } from './scripts/navigator.js';
import { buildScreenScript } from './scripts/screen.js';
import { buildTimezoneScript } from './scripts/timezone.js';
import { buildWebglScript } from './scripts/webgl.js';
import { buildWebrtcScript } from './scripts/webrtc.js';

function serializeFingerprint(fingerprint: FingerprintConfig) {
  return JSON.stringify(fingerprint).replaceAll('<', '\\u003c');
}

export function buildStealthScript(fingerprint: FingerprintConfig) {
  return `
(() => {
  const fp = ${serializeFingerprint(fingerprint)};
  if (window.__pandaoStealthInjected) {
    return;
  }
  Object.defineProperty(window, '__pandaoStealthInjected', {
    value: true,
    configurable: false,
    enumerable: false
  });
${buildNavigatorScript()}
${buildCanvasScript()}
${buildWebglScript()}
${buildAudioScript()}
${buildTimezoneScript()}
${buildScreenScript()}
${buildFontsScript()}
${buildWebrtcScript()}
})();
`;
}
