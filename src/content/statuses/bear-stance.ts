// Bear Stance (Session 76) — set by Bear's Heave. +50 Earth resistance /
// −50 Lightning. One of the Monk's four mutually-exclusive elemental stances
// (`exclusivityGroup: 'stance'`). See `fox-stance.ts` for the shared model.

import { statusHook, statusTypeId, type StatusEffectType } from '@engine/index.ts';

export const bearStance: StatusEffectType = {
  id: statusTypeId('bear_stance'),
  name: 'Bear Stance',
  tags: ['neutral'],
  durationMode: 'permanent',
  stackingRule: 'REFRESH',
  exclusivityGroup: 'stance',
  hooks: [
    statusHook('modifyResistance', (args) => {
      if (args.tag === 'earth') return args.baseValue + 50;
      if (args.tag === 'lightning') return args.baseValue - 50;
      return args.baseValue;
    }),
  ],
};
