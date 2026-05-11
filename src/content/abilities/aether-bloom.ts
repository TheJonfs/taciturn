// Aether Bloom — Fire Mage's second Support, also free for Fire.
//
// Universal "+1 step" AoE expansion for magical AoE casts. Per ADR-0031:
// the passive registers `modifyAoeShape` and grows any magical AoE
// shape by one step (radius+1 for diamond/square/cross, length+1 for
// line, tile→cross r1; cone and custom unchanged). Filter is on the
// `'magical'` ability tag — works on Fire's own AoEs (Fire Storm) and
// would compose on a future cross-classed mage's AoE casts (e.g., a
// hypothetical Earth AoE would expand too).
//
// Per session 19 plaintext review:
//   - baseCost 2; free for Fire Mage (listed in `freeAbilities`)
//   - Universal magical-AoE expander, not Fire-specific
//   - Fire Storm's base shape `cross r1` (5 tiles) → `cross r2` (9
//     tiles) when this passive is equipped
//
// Composition: chained with another `modifyAoeShape` handler (e.g., a
// hypothetical "Mediator's Reach" passive that grows all AoEs further),
// the chain composes naturally — each handler grows the running shape,
// so two stacked expanders produce `+2 step` growth.
//
// Healing-tagged casts: Aether Bloom does NOT specifically exclude
// healing — a future group-heal AoE would grow too, which is the right
// "more allies in the heal" behavior. The filter is purely on
// `'magical'` presence.

import {
  abilityId,
  bucketId,
  enlargeAoeShape,
  passiveHook,
  type PassiveAbilityDefinition,
} from '@engine/index.ts';

export const aetherBloom: PassiveAbilityDefinition = {
  id: abilityId('aether_bloom'),
  name: 'Aether Bloom',
  kind: 'passive',
  bucket: bucketId('support'),
  baseCost: 2,
  availability: 'available',
  tags: ['fire'],
  hooks: [
    passiveHook('modifyAoeShape', (args) => {
      const tags = args.ability.tags ?? [];
      if (!tags.includes('magical')) return args.baseShape;
      return enlargeAoeShape(args.baseShape);
    }),
  ],
};
