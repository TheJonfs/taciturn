// Winged Boots — TABA Ch3 mobility accessory (M3 equipment expansion).
// Move +1, Jump +5.
//
// Jump +5 trivializes most terrain, but a sheer cliff still needs a
// plan — calibrated against Ignore Height (Jump +99 for 3 equip
// points), per the lineup. The doc's latent question stands (no
// established equip-point ↔ gear-power conversion rate); logged in the
// open-decisions register, not resolved here.
//
// TABA-only: `hidden` + campaign pool (chapter 3, shop).

import { itemId, type AccessoryEquipment } from '@engine/index.ts';

export const wingedBoots: AccessoryEquipment = {
  id: itemId('winged_boots'),
  name: 'Winged Boots',
  availability: 'hidden',
  kind: 'accessory',
  movementMods: { moveRange: 1, jump: 5 },
};
