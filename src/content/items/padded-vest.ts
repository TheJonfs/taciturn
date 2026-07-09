// Padded Vest — TABA Ch1 universal body (M3 equipment expansion).
// HP +50, no riders: the gear-generation-1 bulk baseline every class
// can wear. Pairs against Padded Jacket (HP/MP split) as Ch1's
// universal-lane choice.
//
// TABA-only: `hidden` + campaign pool (chapter 1, shop).

import { itemId, type ArmorEquipment } from '@engine/index.ts';

export const paddedVest: ArmorEquipment = {
  id: itemId('padded_vest'),
  name: 'Padded Vest',
  availability: 'hidden',
  kind: 'armor',
  statMods: { maxHpBase: 50 },
};
