// Slip Free — the Thief's Reaction. When a debuff is applied to the Thief,
// it immediately shrugs off one tick of the incoming duration (a 3-turn Stop
// lands as 2; a 1-tick debuff is negated outright). The slippery skirmisher's
// control resistance.
//
// Consumes the `modifyIncomingStatusDuration` target-side hook (ADR for the
// Thief substrate) — it fires inside `applyStatus` before the instance is
// built, so the shave is applied at the moment of application, not after a
// tick. Brave-gated like any reaction: the apply path rolls Brave/100 once
// and forwards `braveTriggered`, so the Thief's Brave investment also raises
// Slip Free's fire rate (the same Brave that fuels its steal contests).
//
// Gate: only `'negative'`-tagged statuses (Stop, Slow, Don't Move, Blind,
// DoTs, …). Buffs lack the tag; Charging is `'neutral'` and is self-applied
// anyway (the apply path already excludes self-sourced applications), so the
// Thief never shaves its own charge. Permanent stat-down debuffs (PA Down et
// al.) have no finite duration, so there's nothing to shave — Slip Free is
// specifically a counter to *timed* control.

import {
  abilityId,
  bucketId,
  passiveHook,
  type PassiveAbilityDefinition,
} from '@engine/index.ts';

const SLIP_FREE_SHAVE = 1;

export const slipFree: PassiveAbilityDefinition = {
  id: abilityId('slip_free'),
  name: 'Slip Free',
  kind: 'passive',
  bucket: bucketId('reaction'),
  baseCost: 1,
  availability: 'available',
  hooks: [
    passiveHook('modifyIncomingStatusDuration', (args) => {
      if (!args.braveTriggered) return args.baseDuration;
      if (!args.statusTags.includes('negative')) return args.baseDuration;
      return args.baseDuration - SLIP_FREE_SHAVE;
    }),
  ],
};
