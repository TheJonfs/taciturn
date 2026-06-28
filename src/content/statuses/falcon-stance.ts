// Falcon Stance (Session 76) — set by Storm Stoop. +50 Lightning resistance /
// −50 Water. One of the Monk's four mutually-exclusive elemental stances
// (`exclusivityGroup: 'stance'`). See `fox-stance.ts` for the shared model.

import { statusHook, statusTypeId, type StatusEffectType } from '@engine/index.ts';

export const falconStance: StatusEffectType = {
  id: statusTypeId('falcon_stance'),
  name: 'Falcon Stance',
  tags: ['neutral'],
  durationMode: 'permanent',
  stackingRule: 'REFRESH',
  exclusivityGroup: 'stance',
  hooks: [
    statusHook('modifyResistance', (args) => {
      if (args.tag === 'lightning') return args.baseValue + 50;
      if (args.tag === 'water') return args.baseValue - 50;
      return args.baseValue;
    }),
  ],
};
