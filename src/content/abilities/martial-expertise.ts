// Martial Expertise — Knight's Support passive (S41 replacement for
// Damage Reduction in the Knight kit).
//
// Multiplies caster's PA by × 1.25 always-on while equipped. Direct
// parallel to Conductor's MA × 1.25 on the Lightning Mage — the same
// "stat-bump-on-one-axis percentage-based Support" shape, swapped axis.
//
// Numbers per Session 41 plaintext review:
//   - baseCost 2 (free for Knight; matches Conductor's cost)
//   - Hooks `modifyStatQuery` against `'pa'`, returning baseValue × 1.25
//   - Math.floor at the end keeps stat reads integer-friendly
//
// Composition order: per DEFAULT_HOOK_SOURCE_TIER_ORDER (equipment →
// class → passive → status), Martial Expertise lives in the passive
// tier. Status PA modifiers (PA Up / PA Down, Combat Focus) run later
// in the chain. With a base PA 11 Knight, +1 PA Up, -2 PA Down:
// Martial Expertise produces 13 (11 × 1.25 → 13.75 → 13), then PA Up
// makes 14, PA Down makes 12. The multiplier composes before additive
// modifiers, matching Conductor's pattern.
//
// Effective PA at Knight baseline 11: → 13 (+2 effective when equipped).
// Free on Knight; cross-class costs 2 of the 3 Support capacity.

import {
  abilityId,
  bucketId,
  passiveHook,
  type PassiveAbilityDefinition,
} from '@engine/index.ts';

const MARTIAL_EXPERTISE_MULTIPLIER = 1.25;

export const martialExpertise: PassiveAbilityDefinition = {
  id: abilityId('martial_expertise'),
  name: 'Martial Expertise',
  kind: 'passive',
  bucket: bucketId('support'),
  baseCost: 2,
  availability: 'available',
  hooks: [
    passiveHook('modifyStatQuery', (args) => {
      if (args.statName !== 'pa') return args.baseValue;
      return Math.floor(args.baseValue * MARTIAL_EXPERTISE_MULTIPLIER);
    }),
  ],
};
