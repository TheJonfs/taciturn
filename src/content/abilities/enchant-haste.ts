// Haste — Auramancy (Enchanter, S72). Charged AoE ally-buff: applies the
// timed `quickening` status (Speed × 1.5) to every unit in a 1-square
// diamond.
//
// Chance tuning (the three Auramancy buffs share it): baseChance 95 lands
// ~88% net on a default-Faith ally — the round-number pick for the brief's
// "~90%". The status formula is
//   net = (baseChance/100) × Faith_factor × MA_factor
// with Faith_factor = (F_caster/100)(F_target/100) = 0.7 × 0.7 = 0.49 at
// default Faith 70, and MA_factor = 0.9 + MA/10 = 1.9 at the Enchanter's
// MA 10. So 0.95 × 0.49 × 1.9 ≈ 0.884. The texture the brief wants falls
// straight out of the formula: a single MA Up (MA 12 → factor 2.1) pushes
// to ~98% (climbs toward always-on as MA is buffed), while a Faith-50
// ally drops to ~63% and a Faith-40 ally to ~51% (low-Faith allies are
// pointedly harder — intended, not a bug). No resistance tag, so no
// resistance term.
//
// Friendly fire is ruleset-global (v1 true) and `excludeCaster: false`, so
// the diamond buffs the caster too AND any enemy caught in the footprint —
// the Cure-style spatial downside (don't catch an enemy in your Haste).
//
// MP 10 (the priciest Auramancy buff — Haste is the strongest), actionSpeed
// 30 (the charged-buff tier — Earth Blessing / Fire Embrace cohort). The
// applied `quickening` is `per_unit_ct` (duration 6), so it expires and the
// Enchanter re-applies — the dedicated-buffer's recurring work.

import {
  abilityId,
  bucketId,
  statusTypeId,
  type ActiveAbilityDefinition,
} from '@engine/index.ts';

export const enchantHaste: ActiveAbilityDefinition = {
  id: abilityId('enchant_haste'),
  name: 'Haste',
  kind: 'active',
  bucket: bucketId('first_action'),
  baseCost: 1,
  availability: 'available',
  tags: ['magical'],
  targeting: {
    kind: 'unit_or_tile',
    range: { horizontal: 4, vertical: 99 },
    rangeMode: 'arc',
  },
  actionSpeed: 30,
  mpCost: 10,
  effects: {
    statusEffects: [
      {
        typeId: statusTypeId('quickening'),
        target: 'primary_target',
        baseChance: 95,
        duration: 6,
      },
    ],
    aoe: {
      excludeCaster: false,
      shape: { kind: 'diamond', radius: 1 },
      verticalTolerance: 1,
    },
  },
};
