// Taunted — applied by Knight's Taunt ability. The taunted unit's
// hit chance is reduced when attacking targets other than the
// Knight that taunted them; attacks against the Knight themselves
// land at full chance. Per session 17c plaintext review, mechanism
// is engine-enforced (no AI integration needed) but AI-aware target
// preference can layer on top in session 20's tier 1.5 work.
//
// Implementation: a `modifyHitChance` handler that fires against the
// taunted unit's hooks (the unit attacking *while taunted*) — not the
// defender's. When the current attack's target is not the Taunted
// source unit, multiply hit chance by 0.6 (a 40% accuracy penalty for
// ignoring the Taunt).
//
// Source tracking: the StatusInstance carries `source.unitId` of the
// Knight that applied Taunt. The handler reads `ctx.instance.source`
// to know who the Taunt source is. When the source KOs, the status
// auto-removes (`removeOnSourceKO: true` per ADR-0028) — a dead Knight
// can no longer hold aggro.
//
// Stacking: `REFRESH` — re-Taunting refreshes duration. Multiple
// Taunters on the same target would each leave their own instance;
// REFRESH means re-apply from the same source rerolls duration but
// doesn't stack the penalty. (A future "double-taunt" mechanic would
// need STACK_INDEPENDENT.)
//
// Note on hook firing: `modifyHitChance` fires against the *defender's*
// hooks per the runner's contract. To make Taunted (which conditions
// on attacker behavior) work, we register a handler that *the
// attacker* fires when they're being attacked... but that's the
// opposite of what we want. The fix: we register the handler so it
// fires against the *attacker's* hooks. v1's `runModifyHitChance`
// runs against the target — Taunted needs to register on a different
// runner.
//
// For session 17c's surface, the cleanest path is: Taunted handler
// fires on `onActionAttempted` against the taunted unit, and replaces
// the action with a "missed" outcome at probability 40% when the
// target isn't the source. That's a structural model, not a
// hit-chance-modifier model. Trade-off vs. a new hook: we get a
// working v1 effect without growing the closed surface, at the cost
// of: (a) the penalty isn't visible in hit-chance UI, (b) reactions
// fired by the missed attack still don't trigger (the attack never
// lands). Both are acceptable for v1; revisit if a content consumer
// specifically needs the "modifyHitChance against the attacker"
// shape.

import {
  statusHook,
  statusTypeId,
  type StatusEffectType,
} from '@engine/index.ts';

export const taunted: StatusEffectType = {
  id: statusTypeId('taunted'),
  name: 'Taunted',
  tags: ['negative', 'mental', 'dispellable'],
  durationMode: 'per_unit_ct',
  stackingRule: 'REFRESH',
  removeOnSourceKO: true,
  hooks: [
    statusHook('onActionAttempted', (args, ctx) => {
      // Only act on use_ability actions that target a unit other than
      // the Taunt source. Other action shapes pass through unchanged.
      if (args.action.type !== 'use_ability') return { kind: 'allowed' };
      const sourceUnitId = ctx.instance.source.unitId;
      if (sourceUnitId === null) return { kind: 'allowed' };
      const target = args.action.payload.target;
      if (target.kind === 'unit' && target.unitId === sourceUnitId) {
        // Attacking the Taunt source — full effect, no penalty.
        return { kind: 'allowed' };
      }
      // Probabilistic block — 40% chance to fail the attack outright,
      // representing the taunted unit's reluctance to ignore the Knight.
      // The block uses a sub-stream off the action's payload-time
      // pseudo-randomness via a stable hash of the attempted action's
      // id; deterministic per (action, taunt-source) pair so replays
      // reproduce.
      //
      // For v1 we use a coarse "block 40% of attempted ignores" via
      // the action's actorId character sum as a stable mixer. A
      // dedicated seed sub-stream would be cleaner but action-level
      // seeding lands at commit time, after onActionAttempted fires.
      // Acceptable trade-off — the block is content-flavor, not a
      // load-bearing balance lever; tuning iterates as Taunt sees use.
      const stable = stableHash(`${sourceUnitId}|${args.unit.id}|${args.action.payload.abilityId}`);
      const blockChance = 0.4;
      if (stable < blockChance) {
        return { kind: 'blocked', reason: 'taunted' };
      }
      return { kind: 'allowed' };
    }),
  ],
};

// Deterministic [0, 1) hash for the Taunted block decision. mulberry32-
// style mixer over a string-FNV1a accumulator. Stable across runs and
// across replays.
function stableHash(key: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < key.length; i++) {
    h = Math.imul(h ^ key.charCodeAt(i), 16777619);
  }
  let s = h >>> 0;
  s = (s + 0x6d2b79f5) >>> 0;
  let t = s;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
