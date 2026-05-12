import type { PlatformSelector, PlatformSelectors, ShopPlatform } from 'shared';
import selectors from './platform-selectors.json';

const selectorMap = selectors as PlatformSelectors;

export function getCredentialFillSelector(platform: ShopPlatform): PlatformSelector | null {
  return selectorMap[platform] ?? null;
}
