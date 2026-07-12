// Silence — blocks magical and voice-tagged actions.
//
// Hooks `onActionAttempted` against the *actor's* hooks: when a unit
// attempts a UseAbility whose ability has the 'magical' or 'voice'
// tag, Silence returns `{ kind: 'blocked', reason: 'silenced' }` and
// the engine refuses the action.
//
// Charged-spell resolution: per ADR-0023, `reduceChargedActionResolve`
// runs the caster's `onActionAttempted` chain at resolution time,
// passing a synthetic UseAbility ProposedAction reflecting the
// caster + ability. So Silence on a Charging caster automatically
// fizzles the charge at resolution — no extra wiring needed.
//
// Tag access: the hook runner (per ADR-0024) pre-resolves the action's
// ability tags and passes them via `args.abilityTags`, so this handler
// doesn't need catalog access.
//
// Resistance tag: none today. Like Blind, Silence is a "mental" /
// "voice" flavored status; if session 17+ adds a 'silence' or 'mental'
// resistance tag, this status would adopt it.

import {
  statusHook,
  statusTypeId,
  type ActionAttemptResult,
  type StatusEffectType,
} from '@engine/index.ts';

const SILENCED_TAGS: ReadonlyArray<string> = ['magical', 'voice'];

export const silence: StatusEffectType = {
  id: statusTypeId('silence'),
  name: 'Silence',
  tags: ['negative', 'mental'],
  durationMode: 'per_unit_ct',
  stackingRule: 'REFRESH',
  aiHints: { polarity: 'debuff', value: 22 },
  hooks: [
    statusHook('onActionAttempted', (args): ActionAttemptResult => {
      if (args.action.type !== 'use_ability') return { kind: 'allowed' };
      for (const tag of SILENCED_TAGS) {
        if (args.abilityTags.has(tag)) {
          return { kind: 'blocked', reason: 'silenced' };
        }
      }
      return { kind: 'allowed' };
    }),
  ],
};
