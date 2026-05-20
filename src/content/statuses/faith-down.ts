// Faith Down — additive flat −Faith per stack, permanent for the battle
// (Session 42). The Assassin's Sow Doubt applies this at magnitude 20.
//
// Mirror of Brave Down; see brave-down.ts for the permadebuff rationale
// (persists through KO per ADR-0079, `remedyImmune` per the Session 42
// convention, STACK_ADDITIVE diminishing returns via the Faith-and-Speed
// chance gate).
//
// Double-edged by design: Faith scales BOTH the target's magical damage
// AND incoming magical effects against them — Sow Doubt weakens the
// target's spells but also reduces the Assassin's allied mages' damage
// into that target. Net value depends on team composition (a watch-for).
//
// Hooks: modifyStatQuery for `'faith'` — subtracts `magnitude`, floored
// at 1 (mirrors PA/MA Down).

import {
  statusHook,
  statusTypeId,
  type StatusEffectType,
} from '@engine/index.ts';

export const faithDown: StatusEffectType = {
  id: statusTypeId('faith_down'),
  name: 'Faith Down',
  tags: ['negative'],
  durationMode: 'permanent',
  stackingRule: 'STACK_ADDITIVE',
  defaultMagnitude: 20,
  remedyImmune: true,
  hooks: [
    statusHook('modifyStatQuery', (args, ctx) => {
      if (args.statName !== 'faith') return args.baseValue;
      const magnitude = ctx.instance.magnitude ?? 20;
      return Math.max(1, args.baseValue - magnitude);
    }),
  ],
};
