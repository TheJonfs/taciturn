// Shimmer Cloak — universal body armor (any class). Defensive option
// that pairs a meaningful HP cushion (+75) with +10 evade across all
// three facings (front / side / back). Distinct from the existing
// Mantle of Protection accessory's defensive package by sitting in the
// body slot — pairs with any accessory.
//
// Composition: `statMods.maxHpBase` adds to base HP via the standard
// equipment contribution. `evasionMods` runs through `runModifyEvasion`
// on each incoming physical hit's `pickEvasion` — additive to class
// baseline. Even-spread (no F-only / B-only asymmetry) so the value
// shows up regardless of how the wearer gets positioned in melee.

import { itemId, type ArmorEquipment } from '@engine/index.ts';

export const shimmerCloak: ArmorEquipment = {
  id: itemId('shimmer_cloak'),
  name: 'Shimmer Cloak',
  availability: 'available',
  kind: 'armor',
  statMods: { maxHpBase: 75 },
  evasionMods: { front: 10, side: 10, back: 10 },
};
