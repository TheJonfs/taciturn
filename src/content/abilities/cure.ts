// Cure — the Templar's AoE heal (S62 rework of the S13 placeholder).
//
// Healing is the damage pipeline with tag inversion: the 'healing' tag
// triggers the MA × power × faithFactor formula at the base stage and
// flips the finalize stage's polarity (HP rises rather than falls). The
// cap stage clamps to (maxHp − currentHp) so healing never overflows.
//
// Spec (templar-concept-notes.md):
//   - Heal = MA × 8 × faithFactor (~0.49 at faith 70) ≈ 3.9 × MA before
//     boosts, ≈ 4.9 × MA with the Templar's innate Emissary (+25%).
//     Below Potion's 12 × PA single-target — worse on one target, better
//     across a cluster (the niche).
//   - Shape: diamond r1 (5 tiles — identical footprint to a cross r1),
//     boostable by Aether Bloom's AoE-expand support. S65: switched cross
//     r1 → diamond r1 so the boost grows it into a proper diamond r2 (13
//     tiles) rather than a thin cross r2 (9) — matching the Mage AoEs
//     (Fire Storm etc.) that made the same switch in S26. No change at the
//     base size; the two shapes coincide at radius 1.
//   - Friendly fire ON (ruleset default): the diamond heals every unit it
//     covers — allies AND enemies (the spatial-identity downside). The
//     caster heals too (`excludeCaster: false`), enabling the self-Cure /
//     Unified Calling MP loop once those land.
//   - Vertical tolerance 1 (per Chris, S62); infinite vertical *range*
//     (all magic) via vertical 99.
//   - MP 8. Action speed 40 — fast (existing fastest spells = 30), so it
//     lands before the board shifts: placement is a fair reactive puzzle,
//     not commit-and-pray. actionSpeed > 0 ⇒ charged.
//
// 'magical' (added S18) lets Water Mage's Flow State (refunds 10 CT after
// any 'magical' cast) and resistance/handler dispatch see Cure as magical.
// 'holy' tags the Templar's Glabados flavor.

import {
  abilityId,
  bucketId,
  type ActiveAbilityDefinition,
} from '@engine/index.ts';

export const cure: ActiveAbilityDefinition = {
  id: abilityId('cure'),
  name: 'Cure',
  kind: 'active',
  bucket: bucketId('secondary_command_sets'),
  baseCost: 1,
  availability: 'available', // S62: surfaced via the Templar's command set
  tags: ['magical', 'holy', 'healing'],
  targeting: {
    kind: 'unit_or_tile',
    range: { horizontal: 4, vertical: 99 },
    rangeMode: 'arc',
  },
  actionSpeed: 40,
  mpCost: 8,
  effects: {
    damage: {
      tags: ['magical', 'holy', 'healing'],
      power_coefficient: 8,
      variance: { min: 0.95, max: 1.05 },
    },
    aoe: {
      // Friendly fire is ruleset-global (v1 default true), so the diamond
      // heals allies and enemies alike; excludeCaster false lets it heal
      // the caster too (self-Cure loop).
      excludeCaster: false,
      shape: { kind: 'diamond', radius: 1 },
      verticalTolerance: 1,
    },
  },
};
