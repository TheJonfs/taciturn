// Expert's Tunic — TABA Ch3 universal mage body (M3 equipment
// expansion). HP +90, MA +3, −25% MP costs: the Silvered Vest heir with
// the pool→efficiency shift (MP economy through cheaper casts instead
// of a bigger tank).
//
// ALSO the diverse mage's Ch3 generalist body (lineup ruling): on-curve
// HP + MA without a robe's element specialization — the surviving Ch2
// Wizard's Robe (−50 HP for +4 MA and the res hole) stands as the
// riskier trade beside it.
//
// OPEN-DECISIONS FLAG (do not resolve silently): stacked with Golden
// Hairpin (×0.5), the multiplicative chain lands at ×0.375 MP cost —
// near-free casting for two slots. Both riders ride `mpCostMultipliers`
// (multiplicative by construction). Chris to confirm whether that erosion
// of the MP-attrition game stands or one piece gets an additive floor.
//
// TABA-only: `hidden` + campaign pool (chapter 3, shop).

import { itemId, type ArmorEquipment } from '@engine/index.ts';

export const expertsTunic: ArmorEquipment = {
  id: itemId('experts_tunic'),
  name: "Expert's Tunic",
  availability: 'hidden',
  kind: 'armor',
  statMods: { maxHpBase: 90, ma: 3 },
  mpCostMultipliers: [0.75],
};
