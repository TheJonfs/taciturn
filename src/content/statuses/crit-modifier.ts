// Crit_modifier (Lightning) — additive boost to crit_chance, permanent
// for the battle.
//
// Per session 20 plaintext review and ADR-0032: the canonical applier
// is Lightning Mage's Static Embrace (Buff). Default magnitude +20
// percentage points — applied to a Knight (base crit_chance 0) produces
// 20%; applied to a unit with the v1 baseline 5% produces 25%. The
// `crit_roll` damage-pipeline handler reads `crit_chance` via
// `modifyStatQuery`, so the magnitude composes cleanly.
//
// STACK_INDEPENDENT — multiple applications produce parallel instances
// (e.g., two casters each grant a +20 buff → effective +40). The
// pattern matches Earth Mage's Earthen Resolve. Permanent durationMode
// — direct stat shifts persist for the remainder of the battle, per the
// session 19 PA Up / MA Up precedent.

import {
  statusHook,
  statusTypeId,
  type StatusEffectType,
} from '@engine/index.ts';

export const critModifier: StatusEffectType = {
  id: statusTypeId('crit_modifier'),
  name: 'Crit Modifier',
  tags: ['positive'],
  durationMode: 'permanent',
  stackingRule: 'STACK_INDEPENDENT',
  defaultMagnitude: 20,
  aiHints: { polarity: 'buff' },
  hooks: [
    statusHook('modifyStatQuery', (args, ctx) => {
      if (args.statName !== 'crit_chance') return args.baseValue;
      const magnitude = ctx.instance.magnitude ?? 20;
      return args.baseValue + magnitude;
    }),
  ],
};
