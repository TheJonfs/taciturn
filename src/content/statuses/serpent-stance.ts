// Serpent Stance (Session 76) — set by Serpent's Coil. +50 Water resistance /
// −50 Fire. One of the Monk's four mutually-exclusive elemental stances
// (`exclusivityGroup: 'stance'`). See `fox-stance.ts` for the shared model.

import { statusHook, statusTypeId, type StatusEffectType } from '@engine/index.ts';

export const serpentStance: StatusEffectType = {
  id: statusTypeId('serpent_stance'),
  name: 'Serpent Stance',
  tags: ['neutral'],
  durationMode: 'permanent',
  stackingRule: 'REFRESH',
  exclusivityGroup: 'stance',
  hooks: [
    statusHook('modifyResistance', (args) => {
      if (args.tag === 'water') return args.baseValue + 50;
      if (args.tag === 'fire') return args.baseValue - 50;
      return args.baseValue;
    }),
  ],
};
