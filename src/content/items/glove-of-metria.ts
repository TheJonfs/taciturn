// Glove of Metria — Session 74 caster accessory (the AoE scaler). MA +1,
// and the wearer's spells gain +1 Spell Power for each target beyond the
// first — a reward for casting wide.
//
// Substrate: `spellPowerModifiers: [{ delta: 1, perExtraTarget: true }]`
// rides the existing `modifySpellPower` hook (Wand of Potential's flat-SP
// pattern), now threaded with the cast's `targetCount` (ADR-0127). The
// per-extra-target contribution is `delta × max(0, targetCount - 1)`, so a
// single-target cast gains nothing, a 3-cluster gains +2 SP, a field-wide
// 5-target Math cast gains +4 SP. Magical-only by virtue of living in the
// magical damage handler (no tagFilter → every spell).
//
// Balance (the batch epicenter): because Math Skill threads targetCount
// like AoE, the Glove amplifies a Calculator's field-wide casts (Chris's
// S74 call — apply everywhere, tune from playtest). It also rewards the
// AI's own S73 cohesion clustering, and punishes the enemy for bunching.
// SP is the magical power coefficient, so +1 is proportionally larger on
// low-SP spells (Precision Fire SP 3 → +33% per extra target) than high.

import { itemId, type AccessoryEquipment } from '@engine/index.ts';

export const gloveOfMetria: AccessoryEquipment = {
  id: itemId('glove_of_metria'),
  name: 'Glove of Metria',
  availability: 'available',
  kind: 'accessory',
  statMods: { ma: 1 },
  spellPowerModifiers: [{ delta: 1, perExtraTarget: true }],
};
