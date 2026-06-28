// Fox Stance (Session 76) — one of the Monk's four mutually-exclusive
// elemental stances, set by Foxfire. +50 Fire resistance / −50 Earth.
//
// The four stances share `exclusivityGroup: 'stance'`; a Monk holds at most
// one. Each Fist clears the group then sets its own (replace semantics,
// handled pre-resolve in `reduceUseAbility`); Chakra clears to neutral. The
// resistance modifiers ride a `modifyResistance` hook, mirroring the
// Resonance (tagged_resistance_shift) pattern — but the deltas are fixed per
// stance rather than carried on customState.
//
// `neutral` tag: a stance is neither a stealable buff (Steal Buffs skips it)
// nor a clearable debuff (Esuna / Remedy skip it) — it's a class mechanic the
// Monk manages itself. `permanent` durationMode: never ticks or expires;
// cleared only by another Fist or Chakra. No `aiHints` — the AI does not
// stance-manage (the depth is player-facing per the S76 brief).

import { statusHook, statusTypeId, type StatusEffectType } from '@engine/index.ts';

export const foxStance: StatusEffectType = {
  id: statusTypeId('fox_stance'),
  name: 'Fox Stance',
  tags: ['neutral'],
  durationMode: 'permanent',
  stackingRule: 'REFRESH',
  exclusivityGroup: 'stance',
  hooks: [
    statusHook('modifyResistance', (args) => {
      if (args.tag === 'fire') return args.baseValue + 50;
      if (args.tag === 'earth') return args.baseValue - 50;
      return args.baseValue;
    }),
  ],
};
