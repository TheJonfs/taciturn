// Vulnerable (Lightning) — one-shot damage amplifier consumed on the
// next damage-received event.
//
// Per session 20 plaintext review and ADR-0032: Vulnerable doesn't decay
// by time. Its lifecycle is event-driven via `customTrigger.kind:
// 'on_damage_received'` — when the affected unit takes damage through
// the seven-stage pipeline (any tag combination except `'healing'`),
// the status's `onDamageReceived` handler appends a × 1.5 multiplier
// to the in-flight `DamageContext` and emits a `status_remove`
// against itself for one-shot consumption.
//
// Composition with other multipliers is multiplicative — Vulnerable
// stacks with variance, resistance, and crit. A 1.5× Vulnerable on a
// crit (×1.5) yields effective ×2.25 burst damage, matching the
// kit's "set up Vulnerable, then crit through it" tactical loop.
//
// Bypassed by `system_damage` events (Poison ticks, Storm Caller
// self-cost, falling damage) — those don't run the seven-stage pipeline
// per ADR-0027, so Vulnerable's hook doesn't fire and the status isn't
// consumed. Design intent: Vulnerable is a debuff that amplifies
// *attacks*, not a generic damage amplifier.
//
// REFRESH stacking — re-applying Vulnerable while it's already up just
// resets the source/timestamp. The 1.5× isn't stackable; multiple
// applications don't compound.
//
// `'lightning'` resistance tag — composes with the BMG status
// application formula's `(1 - target_resistance/100)` term so a
// lightning-resistant target is harder to mark.

import {
  statusHook,
  statusTypeId,
  type DamageContext,
  type ProposedAction,
  type StatusEffectType,
} from '@engine/index.ts';

const VULNERABLE_MULTIPLIER = 1.5;

export const vulnerable: StatusEffectType = {
  id: statusTypeId('vulnerable'),
  name: 'Vulnerable',
  tags: ['negative', 'lightning'],
  durationMode: 'custom',
  customTrigger: { kind: 'on_damage_received' },
  stackingRule: 'REFRESH',
  resistanceTag: 'lightning',

  hooks: [
    statusHook('onDamageReceived', (args) => {
      // Healing-tagged effects skip — Vulnerable doesn't amplify cures
      // and isn't consumed by them. Defensive: a heal-tagged handler
      // earlier in the chain shouldn't trigger consumption.
      if (args.ctx.damageTags.has('healing')) return args.ctx;
      // Skip if the action already missed (evasion check failed
      // upstream). A miss does no damage; consuming Vulnerable on a
      // miss would feel bad. The pipeline finalize stage zeroes
      // damage on miss anyway, but skipping here also avoids the
      // status_remove emission so the buff stays up for the next
      // attempt.
      if (!args.ctx.hit) return args.ctx;

      const newCtx: DamageContext = {
        ...args.ctx,
        multipliers: [
          ...args.ctx.multipliers,
          { source: 'vulnerable', factor: VULNERABLE_MULTIPLIER },
        ],
      };
      const removal: ProposedAction = {
        type: 'status_remove',
        source: 'system',
        payload: {
          targetId: args.unit.id,
          statusTypeId: statusTypeId('vulnerable'),
        },
      };
      return { ctx: newCtx, emittedActions: [removal] };
    }),
  ],
};
