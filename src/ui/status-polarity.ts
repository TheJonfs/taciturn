// Visual convention for status-effect badges.
//
// Per Session 31.5 polish #1: a consistent positive/negative coloring
// across the panels that show statuses (unit detail panel, tile info
// panel's effect-icon slot). Polarity reads off the status type's
// `aiHints.polarity` — `'buff' | 'debuff' | undefined`. An undeclared
// polarity is treated as `'debuff'` per the catalog's documented AI
// default (the safer assumption: never propose application to allies
// for an undeclared status).
//
// The colors are subdued so a long status list doesn't drown out the
// neighboring text; they read as accents, not solid bars.

import type { StatusEffectType } from '@engine/index.ts';

export interface StatusBadgeStyle {
  readonly background: string;
  readonly color: string;
  readonly borderColor: string;
}

export const POSITIVE_BADGE: StatusBadgeStyle = {
  background: 'rgba(95, 168, 107, 0.18)',
  color: '#9fd8a4',
  borderColor: 'rgba(95, 168, 107, 0.45)',
};

export const NEGATIVE_BADGE: StatusBadgeStyle = {
  background: 'rgba(194, 92, 92, 0.18)',
  color: '#e8a8a8',
  borderColor: 'rgba(194, 92, 92, 0.45)',
};

export function badgeStyleFor(type: StatusEffectType | null): StatusBadgeStyle {
  if (type === null) return NEGATIVE_BADGE;
  const polarity = type.aiHints?.polarity ?? 'debuff';
  return polarity === 'buff' ? POSITIVE_BADGE : NEGATIVE_BADGE;
}
