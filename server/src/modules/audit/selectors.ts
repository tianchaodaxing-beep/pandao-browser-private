import type { ActionSelectorEntry, ActionSelectorMap, ShopPlatform } from 'shared';
import selectors from '../../data/action-selectors.json' with { type: 'json' };

const selectorMap = selectors as ActionSelectorMap;

export function getActionSelectors(platform: ShopPlatform): ActionSelectorEntry[] {
  return selectorMap[platform] ?? [];
}
