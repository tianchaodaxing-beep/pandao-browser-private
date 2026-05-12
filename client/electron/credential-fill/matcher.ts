import type { PlatformSelector } from 'shared';

export function isCredentialLoginUrl(url: string, selector: PlatformSelector) {
  try {
    return new RegExp(selector.loginUrlPattern).test(url);
  } catch {
    return false;
  }
}
