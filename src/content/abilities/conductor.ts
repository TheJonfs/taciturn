// Conductor — Lightning Mage's Support.
//
// Multiplies caster's MA by × 1.25 always-on while equipped. Composes
// with PA/MA Up/Down statuses additively-then-multiplicatively (additive
// modifiers stack first, then Conductor's multiplier scales the result).
// Distinct from MA Up (additive +1 per stack) — Conductor is the
// percentage-based shape.
//
// Per session 20 plaintext review:
//   - baseCost 2 (free for Lightning Mage)
//   - Hooks `modifyStatQuery` against `'ma'`, returning baseValue × 1.25
//   - Math.floor at the end keeps stat reads integer-friendly
//
// Composition order: equipment registers first in the source-tier
// chain (per DEFAULT_HOOK_SOURCE_TIER_ORDER: equipment → class →
// passive → status). Conductor lives in the passive tier; status MA
// modifiers (MA Up / MA Down) run later in the chain. So the stat
// query sees: baseStats.ma → Conductor multiplies → MA Up adds →
// MA Down subtracts. With a base MA 8 Lightning Mage, MA Up +1, MA
// Down -2: Conductor produces 10, then MA Up makes 11, MA Down makes
// 9. The order matters — Conductor multiplies before additive
// modifiers compose.

import {
  abilityId,
  bucketId,
  passiveHook,
  type PassiveAbilityDefinition,
} from '@engine/index.ts';

const CONDUCTOR_MULTIPLIER = 1.25;

export const conductor: PassiveAbilityDefinition = {
  id: abilityId('conductor'),
  name: 'Conductor',
  kind: 'passive',
  bucket: bucketId('support'),
  baseCost: 2,
  tags: ['lightning'],
  hooks: [
    passiveHook('modifyStatQuery', (args) => {
      if (args.statName !== 'ma') return args.baseValue;
      return Math.floor(args.baseValue * CONDUCTOR_MULTIPLIER);
    }),
  ],
};
