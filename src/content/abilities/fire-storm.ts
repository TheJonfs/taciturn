// Fire Storm — Fire Mage's AoE.
//
// Charged tile-anchored AoE magical fire damage. Base shape is `diamond r1`
// (5 tiles); when the caster has Aether Bloom equipped (free for Fire
// Mage), `modifyAoeShape` enlarges to `diamond r2` (13 tiles) per ADR-0031.
// The base shape is the "cross-classed mage's Fire Storm" — modest;
// equipping Aether Bloom on Fire Mage (default loadout) gives the proper
// "Fire identity" footprint.
//
// Per session 19 plaintext review (shape revised session 26):
//   - power_coefficient 4, mpCost 16, actionSpeed 25 (lower power than
//     non-AoE casts since shape is wider; mid-tier charge)
//   - range horizontal 4 / vertical 2, arc (target tile)
//   - shape diamond r1 (base, 5 tiles); Aether Bloom enlarges to diamond
//     r2 (13 tiles, was 9 under the pre-session-26 cross-r1 base)
//   - excludeCaster: false (S55: caster can be caught in their own offensive blast
//     when Fire Storm lands within r1 of their tile)
//
// Friendly fire follows ruleset default (true in v1) — Fire Storm hits
// allies caught in the AoE. Tactical placement is part of the cast.

import {
  abilityId,
  bucketId,
  type ActiveAbilityDefinition,
} from '@engine/index.ts';

export const fireStorm: ActiveAbilityDefinition = {
  id: abilityId('fire_storm'),
  // S40 name-update pass: display name 'Fireball'; id preserved.
  name: 'Fireball',
  kind: 'active',
  bucket: bucketId('first_action'),
  baseCost: 1,
  availability: 'available',
  tags: ['magical', 'fire'],
  targeting: {
    kind: 'unit_or_tile',
    range: { horizontal: 4, vertical: 99 },
    rangeMode: 'arc',
  },
  actionSpeed: 25,
  mpCost: 16,
  effects: {
    damage: {
      tags: ['magical', 'fire'],
      power_coefficient: 6,
    },
    aoe: {
      // S55 (supersedes ADR-0025 #7 for offensive AoE): the caster CAN be caught
      // in their own offensive blast. Target-anchored shapes now hit the caster if
      // the footprint reaches their tile; caster-anchored cone/line footprints
      // start one tile ahead, so this is a no-op for those two.
      excludeCaster: false,
      shape: { kind: 'diamond', radius: 1 },
    },
  },
};
