// Esuna — Auramancy (Enchanter, S72). Charged AoE cleanse: removes every
// negative status from each unit in a 1-square diamond. The removal
// counterpart to the three Auramancy buffs — 100% and Faith-independent
// (you don't "miss" a cleanse; removal isn't application).
//
// Resolves through the `cleanse` ability effect (mirrors the Remedy
// consumable): strips every non-buff, non-equipment, non-`remedyImmune`
// status — so Esuna clears the same set Remedy does (Poison, Blind,
// Silence, Stop, Don't Act / Move, Slow, Burn, etc.) but NOT the committed
// stat-down weakenings (PA/MA/Brave/Faith/Speed Down opt out via
// `remedyImmune`). If a future call wants Esuna to also strip stat-downs,
// drop the `remedyImmune` skip in the dispatcher — a one-line lever.
//
// Friendly fire + `excludeCaster: false`: the diamond also cleanses the
// caster (self-Esuna a Silence) AND any enemy in the footprint — cleansing
// an enemy's debuffs is the Cure-style spatial downside, so aim at your own
// cluster.
//
// MP 8, actionSpeed 30 — the Auramancy tier. Instant-feeling within the
// charged-buff cohort; no status roll (deterministic removal).

import {
  abilityId,
  bucketId,
  type ActiveAbilityDefinition,
} from '@engine/index.ts';

export const esuna: ActiveAbilityDefinition = {
  id: abilityId('esuna'),
  name: 'Esuna',
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
    cleanse: { polarity: 'debuff' },
    aoe: {
      excludeCaster: false,
      shape: { kind: 'diamond', radius: 1 },
      verticalTolerance: 1,
    },
  },
};
