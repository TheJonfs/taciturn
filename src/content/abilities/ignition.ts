// Ignition — Fire Mage's Support (first of two; the other is Aether
// Bloom).
//
// Whenever the Fire Mage deals magical damage that lands, applies 1
// stack of Burn to the target. Composes freely with all magical spells
// — Fire's own kit, Cure (cross-classed), or any future magical
// damage. Each per-target damage event in an AoE cast triggers Ignition
// independently, so Fire Storm with Ignition equipped applies Burn to
// every damaged target.
//
// Per session 19 plaintext review:
//   - baseCost 2; free for Fire Mage (listed in `freeAbilities`)
//   - Fires on `onDamageDealt` against the attacker's hooks
//   - Filter: ability damage tags include `'magical'` and exclude
//     `'healing'` — Cure won't trigger Burn-on-allies. Magical damage
//     always lands per BMG, so we don't need to gate on hit/finalDamage
//     (the pipeline has no missing-magical-damage path)
//   - 1 stack of Burn applied via `system_apply_status` with
//     `sourceUnitId = attacker.id` so Burn's composeApplyState reads
//     the *Fire Mage's* MA at trigger time
//
// Hook timing note (Session 31.5 / ADR-0069 update): `onDamageDealt`
// fires at the target stage AFTER `evasion_check` but BEFORE
// `resistance_check`. The handler sees the resolved `ctx.hit` (so
// future physical-attack consumers can gate on hit/miss) but the
// pre-resistance ctx (so multipliers haven't folded in). For Ignition
// this is fine: magical-only abilities skip evasion entirely, and
// Burn application is keyed off "damage was attempted," not "post-
// resistance damage value." The earlier pre-31.5 framing was that
// onDamageDealt ran before evasion — corrected by ADR-0069 because
// the Session 30 proc surface (Bolt Hammer) needed a meaningful hit
// gate.

import {
  abilityId,
  bucketId,
  passiveHook,
  statusTypeId,
  type PassiveAbilityDefinition,
  type ProposedAction,
} from '@engine/index.ts';

const BURN_TYPE_ID = statusTypeId('burn');

export const ignition: PassiveAbilityDefinition = {
  id: abilityId('ignition'),
  name: 'Ignition',
  kind: 'passive',
  bucket: bucketId('support'),
  baseCost: 2,
  availability: 'available',
  tags: ['fire'],
  hooks: [
    passiveHook('onDamageDealt', (args) => {
      const tags = args.ctx.damageTags;
      if (!tags.has('magical')) return args.ctx;
      if (tags.has('healing')) return args.ctx;
      // Note: ctx.target.vitals.hp is the *pre-damage* value here (the
      // attacker stage runs before damage application). A target at 0
      // HP wouldn't have been a valid attack target in the first place;
      // a target that gets KO'd by this damage drops the Burn application
      // at the system_apply_status reducer (it skips KO'd targets).
      const burnApply: ProposedAction = {
        type: 'system_apply_status',
        source: 'system',
        payload: {
          targetId: args.ctx.target.id,
          statusTypeId: BURN_TYPE_ID,
          sourceUnitId: args.ctx.attacker.id,
          stackQuantity: 1,
        },
      };
      const existing = args.ctx.emittedActions ?? [];
      return { ...args.ctx, emittedActions: [...existing, burnApply] };
    }),
  ],
};
