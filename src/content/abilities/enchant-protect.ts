// Protect — Auramancy (Enchanter, S72). Charged AoE ally-buff: applies the
// timed `protect_cast` status (+50 physical resistance ⇒ 0.5× incoming
// physical) to every unit in a 1-square diamond.
//
// Shares the Auramancy buff chance tuning (see enchant-haste.ts): baseChance
// 95 ≈ 88% net on a default-Faith ally at the Enchanter's MA 10, scaling up
// with MA and down on low-Faith allies.
//
// Friendly fire + `excludeCaster: false`: buffs the caster and any enemy in
// the footprint (the Cure-style positioning downside — a Protected enemy is
// a real own-goal, so place the diamond on your own cluster).
//
// MP 8, actionSpeed 30. `protect_cast` is `per_unit_ct` (duration 6) — it
// expires; the Enchanter re-applies.
//
// Balance watch (S72): reliable physical damage reduction shifts time-to-kill
// across the roster — flagged for the playtest pile.

import {
  abilityId,
  bucketId,
  statusTypeId,
  type ActiveAbilityDefinition,
} from '@engine/index.ts';

export const enchantProtect: ActiveAbilityDefinition = {
  id: abilityId('enchant_protect'),
  name: 'Protect',
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
  mpCost: 8,
  effects: {
    statusEffects: [
      {
        typeId: statusTypeId('protect_cast'),
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
