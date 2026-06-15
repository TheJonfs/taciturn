// Enthralled — the Thief's Steal Heart charm. The roster's first
// control-override status: for its duration, the wearer is driven by the
// charmer's team (the `controlOverride` flag + `customState.charmerTeam`, read
// by the engine's `effectiveController`) while its own `team` — and thus
// roster / win-loss membership and friend/foe — is unchanged (v1 control-only
// scope, ADR-0111). Unlike Stop it does NOT skip turns: the puppet acts every
// turn, just for the wrong side.
//
// Duration 3 (per_unit_ct — three of the puppet's own turns, the same cadence
// as Stop). Fragile by design: any *attack* damage the puppet takes rolls a
// 50% chance to snap the charm early (`onDamageReceived`). Note this fires on
// pipeline damage only — a friendly-fire hit or the controller's own AoE rolls
// it, but `system_damage` DoT ticks (Poison / Burn) bypass the pipeline and do
// NOT, so the charm is slightly less fragile than "any damage" (flagged in
// playtest-watch).
//
// Re-charm is gated by the paired `heartwarded` immunity (applied alongside
// this by Steal Heart, outlasting it) — see steal-heart.ts. The 24-MP cost is
// the other anti-chain throttle.
//
// `customState.charmerTeam` is set at apply time by the stealHeart effect.

import {
  statusHook,
  statusTypeId,
  unitFloatFromSeed,
  type ProposedAction,
  type StatusEffectType,
} from '@engine/index.ts';

const ENTHRALLED_ID = statusTypeId('enthralled');

// Distinct seed sub-stream for the break-on-damage roll (variance 0, evasion
// 1, brave reactions 2, status chance 3, procs 8, incoming-status-duration 9,
// ability chance 16 are taken).
const CHARM_BREAK_SUB_STREAM = 11;
const CHARM_BREAK_CHANCE = 0.5;

export const enthralled: StatusEffectType = {
  id: ENTHRALLED_ID,
  name: 'Enthralled',
  tags: ['negative', 'mental'],
  durationMode: 'per_unit_ct',
  stackingRule: 'REFRESH',
  controlOverride: true,
  hooks: [
    statusHook('onDamageReceived', (args) => {
      // Break only on a landed, non-healing attack. (DoT / system_damage
      // bypasses the pipeline, so this hook never sees it.)
      if (!args.ctx.hit) return args.ctx;
      if (args.ctx.damageTags.has('healing')) return args.ctx;
      // No seed (some fixtures omit it) → don't roll; the charm holds.
      if (args.ctx.actionSeed === undefined) return args.ctx;
      const roll = unitFloatFromSeed((args.ctx.actionSeed ^ CHARM_BREAK_SUB_STREAM) >>> 0);
      if (roll >= CHARM_BREAK_CHANCE) return args.ctx;
      const removal: ProposedAction = {
        type: 'status_remove',
        source: 'system',
        payload: { targetId: args.unit.id, statusTypeId: ENTHRALLED_ID },
      };
      return { ctx: args.ctx, emittedActions: [removal] };
    }),
  ],
};
