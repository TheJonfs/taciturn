// Resistance Save — the accumulating elemental-resistance buff granted by
// the Enchanter's Resistance Save Reaction (S72). Each time the unit takes
// magical damage, the reaction applies +10 here; STACK_ADDITIVE sums every
// application onto a single instance (Speed Save / Cornered Focus / Updraft
// pattern), so the magnitude is the running "+N to each elemental
// resistance" counter — one clean instance, not a pile of stacks.
//
// Uncapped by decision (S72 brief D3, consistent with the other stat-Saves):
// nothing clamps the accumulation, so a unit hammered by magic all battle
// trends toward elemental immunity. The modifyResistance composition is itself
// uncapped at the status layer (ADR-0057); the damage pipeline's
// resistance > 100 reads as immune, not absorb (no absorption in v1).
//
// Permanent (in-battle), positive polarity. Per ADR-0079 the permanent (null)
// duration persists through KO. Polarity 'buff' means Remedy never touches it
// (and the Thief's Steal Buffs can lift the accumulated resistance — the same
// interaction the other polarity-buff Saves carry).
//
// Hook: modifyResistance for the four elemental tags (earth / water / fire /
// lightning) — adds `magnitude` to the running per-tag resistance. Physical /
// holy / dark / other tags are untouched (this is an *elemental* save).

import {
  statusHook,
  statusTypeId,
  type StatusEffectType,
} from '@engine/index.ts';

const ELEMENTAL_TAGS = new Set(['earth', 'water', 'fire', 'lightning']);

export const resistanceSave: StatusEffectType = {
  id: statusTypeId('resistance_save'),
  name: 'Resistance Save',
  tags: ['positive'],
  durationMode: 'permanent',
  stackingRule: 'STACK_ADDITIVE',
  defaultMagnitude: 10,
  aiHints: { polarity: 'buff' },
  hooks: [
    statusHook('modifyResistance', (args, ctx) => {
      if (!ELEMENTAL_TAGS.has(args.tag)) return args.baseValue;
      const magnitude = ctx.instance.magnitude ?? 0;
      return args.baseValue + magnitude;
    }),
  ],
};
