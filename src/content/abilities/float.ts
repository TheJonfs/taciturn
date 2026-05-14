// Float — Movement-bucket passive that adds every water-tagged terrain
// to canEnter. Demonstrates the structural-modifier hook surface
// (`modifyCanEnter`); composes with Tidewalker (which reduces cost
// once the terrain is enterable).
//
// Session 33 (ADR-0073): keys on the `'water'` tag rather than the
// literal `'water'` terrain. With River Ridge's `water_shallow` /
// `water_deep` split, Float adds both regardless of depth — "walking
// on water" is depth-agnostic.
//
// Cost-2 in v1: situationally crucial (water-heavy maps), niche
// elsewhere.

import {
  abilityId,
  addTerrainsWithTag,
  bucketId,
  passiveHook,
  type PassiveAbilityDefinition,
} from '@engine/index.ts';

export const float: PassiveAbilityDefinition = {
  id: abilityId('float'),
  name: 'Float',
  kind: 'passive',
  bucket: bucketId('movement'),
  baseCost: 1,
  availability: 'hidden',
  hooks: [
    passiveHook('modifyCanEnter', (args) =>
      addTerrainsWithTag(args.baseValue, args.terrainRegistry, 'water'),
    ),
  ],
};
