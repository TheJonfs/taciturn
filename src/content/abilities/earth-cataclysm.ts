// Earth Cataclysm — Earth Mage's Ultimate.
//
// Charged tile-anchored AoE (diamond shape, radius 1) magical earth
// damage with three independently-rolled status riders: non-expiring
// Poison, Don't Act, Don't Move. Earth's identity is "lockdown over
// damage" — the power-10 base is on the lower end of where Lightning
// or Fire will land their Ultimates, with the status combo carrying
// the load.
//
// Per session 17b plaintext review:
//   - power 10, mpCost 30, actionSpeed 18 (slower than Quake's 25 —
//     ~6 ticks to charge at the floor; the caster typically sees their
//     next turn pass before the spell lands)
//   - shape: diamond radius 1 (session 26 — was `cross r1` pre-session-26;
//     identical at r1, but Aether-Bloom-enlarged diamond r2 is 13 tiles)
//   - excludeCaster: true (default)
//   - friendly fire: per ruleset
//   - vertical tolerance: 1 (default)
//   - Poison baseChance 60% (non-expiring; fundamental "do not let me
//     resolve" threat)
//   - Don't Act baseChance 40%, duration 24
//   - Don't Move baseChance 40%, duration 24
//   - range horizontal 4 / vertical 2, arc
//
// Expected hit count: ~1.4 statuses per affected target (sum of
// independent probabilities, modulated by the cluster Earth Communion
// might be on the caster). About 16% of targets get all three; about
// 36% get none. Target coverage modulated by per-target seed branching —
// each affected target rolls independently for each of the three riders.

import {
  abilityId,
  bucketId,
  statusTypeId,
  type ActiveAbilityDefinition,
} from '@engine/index.ts';

export const earthCataclysm: ActiveAbilityDefinition = {
  id: abilityId('earth_cataclysm'),
  // S40 name-update pass: display name 'Cataclysm'; id preserved.
  name: 'Cataclysm',
  kind: 'active',
  bucket: bucketId('first_action'),
  baseCost: 1,
  availability: 'available',
  tags: ['magical', 'earth'],
  targeting: {
    kind: 'unit_or_tile',
    range: { horizontal: 4, vertical: 2 },
    rangeMode: 'arc',
  },
  actionSpeed: 18,
  mpCost: 30,
  effects: {
    damage: {
      tags: ['magical', 'earth'],
      power_coefficient: 12,
    },
    aoe: {
      shape: { kind: 'diamond', radius: 1 },
    },
    statusEffects: [
      {
        typeId: statusTypeId('poison'),
        target: 'primary_target',
        baseChance: 60,
      },
      {
        typeId: statusTypeId('dont_act'),
        target: 'primary_target',
        baseChance: 40,
        duration: 3,
      },
      {
        typeId: statusTypeId('dont_move'),
        target: 'primary_target',
        baseChance: 40,
        duration: 3,
      },
    ],
  },
};
