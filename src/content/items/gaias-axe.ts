// Gaia's Axe — TABA Ch3 elemental axe (M3 equipment expansion). WP 16,
// accuracy 75, Earth-imbued strikes, +50 Earth resistance, the axe
// family's [0.9, 1.3] band.
//
// The Flametongue pattern at Ch3 scale: the 'earth' weapon tag merges
// into every strike's damage tags, so target Earth resistance modulates
// the hit (weakness-exploit upside / resistance downside self-balances
// the big WP — the lineup's rationale). The wearer's own +50 Earth res
// is the wielder-identity rider.
//
// TABA-only: `hidden` + campaign pool (chapter 3, shop).

import { itemId, type WeaponEquipment } from '@engine/index.ts';

export const gaiasAxe: WeaponEquipment = {
  id: itemId('gaias_axe'),
  name: "Gaia's Axe",
  availability: 'hidden',
  kind: 'weapon',
  weaponType: 'axe',
  wp: 16,
  accuracy: 75,
  tags: ['axe', 'earth'],
  physicalVariance: { kind: 'static', min: 0.9, max: 1.3 },
  resistanceMods: new Map([['earth', 50]]),
};
