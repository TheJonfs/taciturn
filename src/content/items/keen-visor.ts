// Keen Visor — TABA Ch2 second-pass universal head, precision lane (M3
// equipment expansion). Hit ×1.1, Crit +5.
//
// The new-effect head (heads don't carry HP scaling — bodies do): the
// accuracy/crit package for any attacker. Pairs with Arcane Lens (the
// accessory twin: ×1.1 hit, +10 crit) — stacking both is the dedicated
// precision build (×1.21 hit, +15 crit before Vicious Dagger). Crit
// rides the same additive `crit_chance` statMod as Arcane Lens / the
// Vicious Dagger; hit rides `outgoingHitChanceMultipliers`.
//
// Universal (no class restriction).
//
// TABA-only: `hidden` + campaign pool (chapter 2, shop).

import { itemId, type HeadgearEquipment } from '@engine/index.ts';

export const keenVisor: HeadgearEquipment = {
  id: itemId('keen_visor'),
  name: 'Keen Visor',
  availability: 'hidden',
  kind: 'headgear',
  statMods: { crit_chance: 5 },
  outgoingHitChanceMultipliers: [1.1],
};
