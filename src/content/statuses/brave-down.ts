// Brave Down — additive flat −Brave per stack, permanent for the battle
// (Session 42). The Assassin's Undermine applies this at magnitude 20.
//
// Permadebuff by design: `durationMode: 'permanent'` (null duration)
// persists through KO per ADR-0079, and `remedyImmune` keeps Remedy from
// clearing it (per Chris's Session 42 convention — stat-reduction
// debuffs are committed weakenings, not curable ailments). Once it
// lands, the target wears it for the rest of the battle.
//
// STACK_ADDITIVE sums repeated Undermines onto one instance (−20, −40,
// …). The anti-synergy is intentional: lowering target Brave drops the
// Brave-and-Speed application chance of the Assassin's own Brave-gated
// moves against that target, so stacking has diminishing returns.
//
// Hooks: modifyStatQuery for `'brave'` — subtracts `magnitude`, floored
// at 1 (mirrors PA/MA Down). Brave feeds reaction-trigger chance
// (Brave/100) and Brave-factor status applications, so reducing it
// suppresses the target's reactions and any Brave-gated infliction.

import {
  statusHook,
  statusTypeId,
  type StatusEffectType,
} from '@engine/index.ts';

export const braveDown: StatusEffectType = {
  id: statusTypeId('brave_down'),
  name: 'Brave Down',
  tags: ['negative'],
  durationMode: 'permanent',
  stackingRule: 'STACK_ADDITIVE',
  defaultMagnitude: 20,
  remedyImmune: true,
  hooks: [
    statusHook('modifyStatQuery', (args, ctx) => {
      if (args.statName !== 'brave') return args.baseValue;
      const magnitude = ctx.instance.magnitude ?? 20;
      return Math.max(1, args.baseValue - magnitude);
    }),
  ],
};
