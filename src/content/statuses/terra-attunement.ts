// Terra Attunement — the Terra Robe's earned-ramp accumulator (TABA M3).
// +1 MA per stack, permanent, rest of battle. Granted ONCE per earth-
// damage spell the wearer resolves (the robe's `spellResolvedSelfStatuses`
// rider on `onActionResolved` — once per spell, not per target, which is
// the load-bearing cap that keeps a field-wide Cataclysm from granting a
// stack per victim).
//
// Cornered Focus pattern exactly: STACK_ADDITIVE sums each grant onto a
// single instance's magnitude; the modifyStatQuery hook adds it to MA.
// Battle-length-bounded by construction (statuses die with the battle),
// so no cap is needed — the lineup's ruling. Positive polarity; permanent
// (in-battle) persists through KO per ADR-0079.

import {
  statusHook,
  statusTypeId,
  type StatusEffectType,
} from '@engine/index.ts';

export const terraAttunement: StatusEffectType = {
  id: statusTypeId('terra_attunement'),
  name: 'Terra Attunement',
  tags: ['positive', 'earth'],
  durationMode: 'permanent',
  stackingRule: 'STACK_ADDITIVE',
  defaultMagnitude: 1,
  aiHints: { polarity: 'buff' },
  hooks: [
    statusHook('modifyStatQuery', (args, ctx) => {
      if (args.statName !== 'ma') return args.baseValue;
      const magnitude = ctx.instance.magnitude ?? 1;
      return args.baseValue + magnitude;
    }),
  ],
};
