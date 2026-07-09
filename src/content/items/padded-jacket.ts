// Padded Jacket — TABA Ch1 universal body (M3 equipment expansion).
// HP +30 / MP +15: the hybrid split against Padded Vest's pure +50 HP —
// Ch1's universal-lane choice is "all bulk" vs "bulk + casts".
//
// TABA-only: `hidden` + campaign pool (chapter 1, shop).

import { itemId, type ArmorEquipment } from '@engine/index.ts';

export const paddedJacket: ArmorEquipment = {
  id: itemId('padded_jacket'),
  name: 'Padded Jacket',
  availability: 'hidden',
  kind: 'armor',
  statMods: { maxHpBase: 30, maxMpBase: 15 },
};
