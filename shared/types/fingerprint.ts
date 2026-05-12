export type FingerprintConfig = {
  userAgent: string;
  platform: 'Win32';
  language: 'ko-KR';
  languages: ['ko-KR', 'ko', 'en-US'];
  canvasSeed: number;
  webglVendor: string;
  webglRenderer: string;
  audioOffset: number;
  hardwareConcurrency: 4 | 6 | 8 | 12 | 16;
  screenWidth: number;
  screenHeight: number;
  timezone: 'Asia/Seoul';
  fonts: string[];
};
