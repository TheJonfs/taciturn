// Tidewalker — Water Mage's class-free Movement passive.
//
// `modifyTerrainCosts` chain handler: clamps the unit's water-tile cost
// at a floor of 1, decrementing by 1 from whatever the running cost is.
// In v1, water-cost defaults to 1 in pathfinding (no class has an
// elevated water entry); tidewalker is therefore a no-op against
// today's content. The ability is forward-compatible — future terrain
// types or modifiers that raise the cost (rough-water, currents, etc.)
// get the -1 floor-at-1 treatment automatically.
//
// Note the canEnter caveat: Water Mage's canEnter is ground-only by
// default. Tidewalker reduces *cost*, not *eligibility*; combining with
// Float (or a class that includes water in canEnter) is required to
// actually traverse water tiles. The two passives compose cleanly.
//
// Cost-1 in v1: small, niche, and self-evidently "Water's mobility
// signature." Pairs naturally with Float on cross-classed builds.

import {
  abilityId,
  bucketId,
  passiveHook,
  type PassiveAbilityDefinition,
  type TerrainType,
} from '@engine/index.ts';

export const tidewalker: PassiveAbilityDefinition = {
  id: abilityId('tidewalker'),
  name: 'Tidewalker',
  kind: 'passive',
  bucket: bucketId('movement'),
  baseCost: 1,
  availability: 'available',
  tags: ['water'],
  hooks: [
    passiveHook('modifyTerrainCosts', (args) => {
      const next = new Map<TerrainType, number>(args.baseValue);
      const current = next.get('water') ?? 1;
      next.set('water', Math.max(1, current - 1));
      return next;
    }),
  ],
};
