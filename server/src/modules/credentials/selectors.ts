import type { PlatformSelector, PlatformSelectors, ShopPlatform } from 'shared';
import selectors from '../../data/platform-selectors.json' with { type: 'json' };

const selectorMap = selectors as PlatformSelectors;

export function getPlatformSelector(platform: ShopPlatform): PlatformSelector {
  const selector = selectorMap[platform];

  if (!selector) {
    throw new Error(`缺少平台选择器:${platform}`);
  }

  return selector;
}

export function getAllPlatformSelectors(): PlatformSelectors {
  return selectorMap;
}
