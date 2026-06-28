// Storm Stoop (Session 76) — lightning-tagged Fist with reach. A caster-
// anchored line (length 3, vertical tolerance 3, Flame-Lance-shaped) of
// PA × coefficient physical damage tagged Lightning; sets Falcon Stance
// (+50 Lightning / −50 Water) on the caster.
//
// The reach is the rider: a melee bruiser that can poke down a 3-tile lane
// (kinematic-stop line — a too-tall wall ends the lane). NOT weapon-tagged,
// so each hit lands at `PA × power_coefficient`, not the PA² punch.
//
// Physical (hitRoll present) so each target in the line rolls evasion. Instant
// (actionSpeed 0). Stance management runs pre-resolve in `reduceUseAbility`.

import {
  abilityId,
  bucketId,
  statusTypeId,
  type ActiveAbilityDefinition,
} from '@engine/index.ts';

export const stormStoop: ActiveAbilityDefinition = {
  id: abilityId('storm_stoop'),
  name: 'Storm Stoop',
  kind: 'active',
  bucket: bucketId('first_action'),
  baseCost: 1,
  availability: 'available',
  tags: ['lightning'],
  targeting: {
    kind: 'unit_or_tile',
    range: { horizontal: 3, vertical: 99 },
    rangeMode: 'straight_line',
  },
  actionSpeed: 0,
  mpCost: 6,
  hitRoll: {},
  effects: {
    clearCasterExclusivityGroup: 'stance',
    setStance: statusTypeId('falcon_stance'),
    damage: {
      // S76 tune: 3 → 5. Competitive with the punch while a notch below Foxfire
      // — Storm Stoop's upside is the line AoE (it can catch a whole lane).
      tags: ['physical', 'lightning'],
      power_coefficient: 5,
      variance: { min: 0.9, max: 1.1 },
    },
    aoe: {
      excludeCaster: false,
      shape: { kind: 'line', length: 3 },
      anchorMode: 'caster',
      verticalTolerance: 3,
    },
  },
};
