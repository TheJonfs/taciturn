// Bear's Heave (Session 76) — the grapple-throw Fist. Grabs an adjacent unit
// (enemy or ally) and places it on any chosen tile within a 2-diamond of where
// it stands; sets Bear Stance (+50 Earth / −50 Lightning) on the caster.
//
// 0 direct damage — the throw IS the point: heave an enemy onto a hazard or
// off a ledge (the drop emits unmitigated falling damage via the shared
// fall-damage path), or reposition a wounded ally to safety. Validation
// (`grapple_throw` targeting) enforces the grab reach, the throw radius, an
// existing + unoccupied + barrier-free destination, and an upward-elevation
// ceiling (downward is unbounded — ledge throws are the reward).
//
// Resolution short-circuits to `resolveGrappleThrow`; the stance management
// (clear group → set Bear) runs pre-resolve in `reduceUseAbility`, so it
// applies even though the throw bypasses the normal damage/status pipeline.
//
// Instant (actionSpeed 0). Throw coefficient (D1) is near-zero by design —
// there's no damage coefficient at all; the displacement is the whole kit.

import {
  abilityId,
  bucketId,
  statusTypeId,
  type ActiveAbilityDefinition,
} from '@engine/index.ts';

export const bearsHeave: ActiveAbilityDefinition = {
  id: abilityId('bears_heave'),
  name: "Bear's Heave",
  kind: 'active',
  bucket: bucketId('first_action'),
  baseCost: 1,
  availability: 'available',
  targeting: {
    kind: 'grapple_throw',
    range: { horizontal: 1, vertical: 3 },
    rangeMode: 'melee',
    throwRadius: 2,
    throwVerticalTolerance: 2,
  },
  actionSpeed: 0,
  mpCost: 4,
  effects: {
    clearCasterExclusivityGroup: 'stance',
    setStance: statusTypeId('bear_stance'),
    grappleThrow: true,
  },
};
