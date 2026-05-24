// Golden Hairpin — universal headgear (any class). MP-economy piece:
// thin HP bump (+10) plus a 50% MP cost reduction on every cast. The
// inverse shape of Staff of Power's `mpCostMultipliers: [1.2]` (× 1.20
// MP cost). Stacks multiplicatively with other mpCost modifiers per
// the standard equipment-contribution composition (a Calculator
// running both Staff of Power and Golden Hairpin lands at 0.5 × 1.2
// = 0.6 net cost — still a meaningful net reduction).
//
// Target user is anyone who fields a high-MP spell list: mages running
// out of casts mid-battle, Calculators paying the per-target Math Skill
// tax, or even a Knight running a secondary mage command set with a
// shallow MP pool. The thin HP makes it a non-obvious pick for a
// front-line tank — the slot competes with Steel Helm / Tactical Mask /
// Crusader's Helm there — but the MP halving is a real lever for any
// cast-heavy build.

import { itemId, type HeadgearEquipment } from '@engine/index.ts';

export const goldenHairpin: HeadgearEquipment = {
  id: itemId('golden_hairpin'),
  name: 'Golden Hairpin',
  availability: 'available',
  kind: 'headgear',
  statMods: { maxHpBase: 10 },
  mpCostMultipliers: [0.5],
};
