import { randomBytes, randomInt } from 'node:crypto';
import type { FingerprintConfig } from 'shared';

const userAgents = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.6367.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.6478.0 Safari/537.36'
];

const webglProfiles = [
  {
    vendor: 'Google Inc. (NVIDIA)',
    renderer: 'ANGLE (NVIDIA, NVIDIA GeForce GTX 1660 Direct3D11 vs_5_0 ps_5_0, D3D11)'
  },
  {
    vendor: 'Google Inc. (NVIDIA)',
    renderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 2060 Direct3D11 vs_5_0 ps_5_0, D3D11)'
  },
  {
    vendor: 'Google Inc. (NVIDIA Corporation)',
    renderer: 'ANGLE (NVIDIA Corporation, NVIDIA GeForce GTX 1050 Ti Direct3D11 vs_5_0 ps_5_0, D3D11)'
  },
  {
    vendor: 'Google Inc. (Intel)',
    renderer: 'ANGLE (Intel, Intel(R) UHD Graphics 630 Direct3D11 vs_5_0 ps_5_0, D3D11)'
  },
  {
    vendor: 'Google Inc. (Intel)',
    renderer: 'ANGLE (Intel, Intel(R) Iris(R) Xe Graphics Direct3D11 vs_5_0 ps_5_0, D3D11)'
  },
  {
    vendor: 'Google Inc. (AMD)',
    renderer: 'ANGLE (AMD, AMD Radeon RX 580 Direct3D11 vs_5_0 ps_5_0, D3D11)'
  },
  {
    vendor: 'Google Inc. (AMD)',
    renderer: 'ANGLE (AMD, AMD Radeon RX 6600 Direct3D11 vs_5_0 ps_5_0, D3D11)'
  },
  {
    vendor: 'Google Inc. (NVIDIA)',
    renderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0, D3D11)'
  }
];

const hardwareConcurrencyValues = [4, 6, 8, 12, 16] as const;

const screenProfiles = [
  { width: 1920, height: 1080 },
  { width: 1536, height: 864 },
  { width: 2560, height: 1440 },
  { width: 1366, height: 768 },
  { width: 1440, height: 900 }
];

const fontPool = [
  'Malgun Gothic',
  'Nanum Gothic',
  'Nanum Myeongjo',
  'Gulim',
  'Dotum',
  'Batang',
  'Gungsuh',
  '맑은 고딕',
  '나눔고딕',
  'Arial',
  'Times New Roman',
  'Courier New',
  'Verdana',
  'Tahoma',
  'Trebuchet MS',
  'Comic Sans MS',
  'Impact',
  'Lucida Console',
  'Georgia',
  'Calibri'
];

function pickOne<T>(items: readonly T[]): T {
  return items[randomInt(0, items.length)];
}

function randomFloat(min: number, max: number, decimals: number) {
  const precision = 10 ** decimals;
  const value = randomInt(Math.floor(min * precision), Math.floor(max * precision) + 1) / precision;
  return Number(value.toFixed(decimals));
}

function shuffled<T>(items: readonly T[]): T[] {
  return [...items].sort(() => randomBytes(1)[0] - 128);
}

function pickFonts() {
  const count = randomInt(12, 17);
  return shuffled(fontPool).slice(0, count);
}

export function generateFingerprint(): FingerprintConfig {
  const webgl = pickOne(webglProfiles);
  const screen = pickOne(screenProfiles);

  return {
    userAgent: pickOne(userAgents),
    platform: 'Win32',
    language: 'ko-KR',
    languages: ['ko-KR', 'ko', 'en-US'],
    canvasSeed: randomInt(1, 10001),
    webglVendor: webgl.vendor,
    webglRenderer: webgl.renderer,
    audioOffset: randomFloat(0.0001, 0.001, 6),
    hardwareConcurrency: pickOne(hardwareConcurrencyValues),
    screenWidth: screen.width,
    screenHeight: screen.height,
    timezone: 'Asia/Seoul',
    fonts: pickFonts()
  };
}
