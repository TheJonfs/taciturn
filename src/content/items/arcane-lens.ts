// Arcane Lens — precision accessory. Weapon accuracy × 1.10 via the
// Session 29 `modifyOutgoingHitChance` hook; crit rate +10pp via
// additive `modifyStatQuery('crit_chance')`. Enables the "speedy War
// Axe wielder" archetype as a high-variance physical DPS pole.

import { itemId, type AccessoryEquipment } from '@engine/index.ts';

export const arcaneLens: AccessoryEquipment = {
  id: itemId('arcane_lens'),
  name: 'Arcane Lens',
  availability: 'available',
  kind: 'accessory',
  statMods: { crit_chance: 10 },
  outgoingHitChanceMultipliers: [1.1],
};
