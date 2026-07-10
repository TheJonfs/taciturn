// Scoured — the Scouring Wand's accumulating resistance shred (TABA M3).
// −33 to ALL four elemental resistances per stack, permanent, unbounded.
//
// Chris's ruling: NO floor and no self-cap — resistance has no lower
// bound ((100 − r)/100 scales linearly), so a team that spends turns
// stacking Scoured drives the target arbitrarily deep. The opportunity
// cost (each stack is a WP-3 poke instead of a real action) is the
// balancing lever; "if the player wants to spend extra turns driving
// resistance into the deep negatives rather than getting on with the
// casting, we'll let them walk into that trap." Watch: dual-wield
// accelerates stacking (two procs per Attack).
//
// Cornered Focus accumulator pattern: STACK_ADDITIVE onto magnitude;
// the modifyResistance hook subtracts 33 × magnitude on each element.
// Negative polarity (Remedy-class cleansing is the counterplay);
// permanent in-battle.

import {
  statusHook,
  statusTypeId,
  type StatusEffectType,
} from '@engine/index.ts';

const ELEMENTS = ['fire', 'water', 'earth', 'lightning'];
const SHRED_PER_STACK = 33;

export const scoured: StatusEffectType = {
  id: statusTypeId('scoured'),
  name: 'Scoured',
  tags: ['negative'],
  durationMode: 'permanent',
  stackingRule: 'STACK_ADDITIVE',
  defaultMagnitude: 1,
  aiHints: { polarity: 'debuff' },
  hooks: [
    statusHook('modifyResistance', (args, ctx) => {
      if (!ELEMENTS.includes(args.tag)) return args.baseValue;
      const magnitude = ctx.instance.magnitude ?? 1;
      return args.baseValue - SHRED_PER_STACK * magnitude;
    }),
  ],
};
