## ADR-0032: Crit infrastructure, chain damage, self-damage, Vulnerable, magical reactions

**Status:** Accepted
**Date:** 2026-05-09

## Context

Session 20 ships Lightning Mage. The class's signature mechanics pull in five engine extensions that are individually small but worth recording together because they share substrate (the damage pipeline + the existing custom-trigger pattern from ADR-0030) and because their combined shape determines several v1 calibration questions:

1. **Critical hits** — Lightning's identity is "crit chance, crit damage, and the ability to load up an ally's crit." Static Embrace applies a Crit_modifier status; Lightning Strike and Storm Caller benefit from raised crit chance.
2. **Chain damage** — Chain Lightning's AoE scales each target's damage with cluster size: more targets in the radius = harder hit per target.
3. **Self-damage cost** — Storm Caller's "ultimate" pays 25% of the caster's max HP per cast.
4. **Vulnerable status** — Magnetic Mark applies a one-shot debuff that amplifies the *next* damage taken, then auto-removes.
5. **Magical reactions** — Discharge fires on incoming damage of *any* tag (physical or magical), confirming the engine's reaction surface is tag-agnostic by default.

These split into:

- **Substrate decisions** that affect the engine's hook surface and pipeline — recorded here.
- **Content shape decisions** (Lightning's seven abilities, the demo battle wiring) — recorded in commit messages and roadmap entries.

The session is also the second consumer of ADR-0030's custom-trigger pattern, validating the design (`customTrigger.kind` adds one enum value; no new hook surface).

Decisions in scope:

1. `crit_chance` / `crit_multiplier` as new `StatName`s and `BaseStats` fields.
2. `crit_roll` damage-pipeline handler at the variance stage, layered on top of `variance_roll`.
3. `damage.chainBonus` on `DamageSpec` + `targetCount` plumbing through the pipeline.
4. `selfDamage` on `ActiveAbilityDefinition` + `ability_self_cost` `SystemDamageSource` variant.
5. `customTrigger.kind: 'on_damage_received'` for Vulnerable's lifecycle.
6. Magical-reaction confirmation (no engine change required; Discharge proves the surface).

## Decisions

### Crit infrastructure

`StatName` and `BaseStats` gain `'crit_chance'` and `'crit_multiplier'`:

```typescript
export type StatName =
  | 'spd' | 'moveRange' | 'jump'
  | 'pa' | 'ma' | 'maxHp'
  | 'brave' | 'faith'
  | 'crit_chance' | 'crit_multiplier'; // session 20

export interface BaseStats {
  // ...
  readonly crit_chance: number;     // [0, 100], read as percentage
  readonly crit_multiplier: number; // applied multiplicatively on hit
}
```

A new `crit_roll` damage handler ships at the **variance stage**, after `variance_roll`:

```typescript
const DEFAULT_DAMAGE_PIPELINE = {
  // ...
  variance: ['variance_roll', 'crit_roll'],
  // ...
};
```

**Composition with variance:** crit is a separate multiplier appended to `ctx.multipliers`, layered on top of every other multiplier (variance, resistance, Vulnerable). It does *not* replace the variance roll. A 5% crit at × 1.5 on top of a Vulnerable target's × 1.5 yields × 2.25 effective. Per Chris's session 20 plaintext call.

**Stat queries via `modifyStatQuery`:** the handler reads `crit_chance` and `crit_multiplier` through `runModifyStatQuery` against the attacker's hooks, so equipment, Crit_modifier status, and any future crit-modifying surface compose without per-handler awareness.

**Short-circuit:** when the queried `crit_chance <= 0`, the handler returns `ctx` unchanged. Pre-session-20 fixtures opt out of crits by setting `crit_chance: 0, crit_multiplier: 1` — keeps existing damage assertions deterministic without a code-level toggle.

**Healing skip:** `'healing'`-tagged effects skip the crit roll entirely. v1 has no "crit heal" mechanic; if one ships, the handler's `if (ctx.damageTags.has('healing')) return ctx;` line moves to its consumer.

**Seed sub-stream index 4:** distinct from variance (0), evasion (1), Brave-reaction (2), status chance (3), and ability chance (16). Adjacent to the damage-pipeline rolls, far from status-application substreams.

**v1 calibration:** demo battle units carry `crit_chance: 5, crit_multiplier: 1.5`. Lightning Mage's Static Embrace (Crit_modifier +20) raises a buffed ally to 25%. Stat caps remain `[1, 100]` for percentage-shaped stats by convention; `crit_chance` is not currently capped explicitly, but values > 100 clamp at the runtime float comparison `r < crit_chance / 100`.

### Chain damage (`damage.chainBonus`)

`DamageSpec` gains:

```typescript
readonly chainBonus?: { readonly powerPerAdditionalTarget: number };
```

`DamageContext` gains:

```typescript
readonly targetCount: number;
```

`runDamagePipeline` accepts an optional `targetCount` (defaults to 1 in the orchestrator). The dispatcher passes `affected.length` for AoE casts; single-target callers omit (default 1). Both base-stage handlers (`physical_pa_wp`, `magical_ma_power`) read the effective coefficient via the shared helper:

```typescript
function effectivePowerCoefficient(ability, targetCount) {
  const base = ability.effects.damage?.power_coefficient ?? 1;
  const chainBonus = ability.effects.damage?.chainBonus;
  if (chainBonus === undefined) return base;
  return base + chainBonus.powerPerAdditionalTarget * Math.max(0, targetCount - 1);
}
```

**Uniform across cluster:** the same scaled scalar applies to every target in the AoE (a 3-cluster Chain Lightning hits each target for power 10, not 8/9/10). Per Chris's session 20 plaintext call.

**Healing skip:** `healing_base` does NOT call the helper — no v1 healing ability scales with cluster size. The skip is a one-line preservation of the prior behavior; if a future healing AoE wants chain-scaling, the helper extends to it.

### Self-damage (`selfDamage` field + `ability_self_cost` source)

`ActiveAbilityDefinition` gains:

```typescript
readonly selfDamage?: { readonly fraction: number };
```

`SystemDamageSource` gains:

```typescript
| { readonly kind: 'ability_self_cost'; readonly abilityId: AbilityId; readonly casterId: UnitId }
```

The dispatcher (`resolveAbilityTargets`) emits a labeled `system_damage` against the caster after per-target dispatch resolves:

```typescript
const amount = Math.floor(selfDamage.fraction * caster.baseStats.maxHpBase);
// Emit system_damage with source { kind: 'ability_self_cost', ... }
```

**Once per cast, regardless of cluster size:** even if the Ultimate hits 3 targets in a future AoE variant, the caster pays the cost exactly once.

**Bypasses pipeline:** `system_damage` doesn't run the seven-stage pipeline (per ADR-0027). No resistance, no reactions, no Vulnerable amplification on the caster's own self-cost. It's a cost, not a hit.

**Untyped (`tags: []`):** doesn't compose with the caster's own resistances. A lightning-resistant Lightning Mage doesn't dodge their own Storm Caller cost.

**Discrete labeled action enables a future preventer:** Chris asked for an avenue to allow a future item or ability to prevent self-cost. The labeled `source: { kind: 'ability_self_cost', abilityId, casterId }` lets a future preventer register an `onActionAttempted` handler that matches on `payload.source.kind === 'ability_self_cost'` and returns `blocked`. No new hook surface required — the existing `onActionAttempted` chain already runs against system actions.

**Caster-KO short-circuit:** the dispatcher checks `caster.vitals.hp > 0` before emission. For charged abilities, `reduceChargedActionResolve` already short-circuits on caster KO, so this is belt-and-suspenders.

### Vulnerable — `customTrigger.kind: 'on_damage_received'`

`CustomTriggerSpec` (ADR-0030) gains a second variant:

```typescript
export type CustomTriggerSpec =
  | { readonly kind: 'on_unit_ct_100' }       // Burn (session 19)
  | { readonly kind: 'on_damage_received' };  // Vulnerable (session 20)
```

The Vulnerable status's lifecycle is fully driven by an `onDamageReceived` hook handler:

```typescript
hooks: [
  statusHook('onDamageReceived', (args) => {
    if (args.ctx.damageTags.has('healing')) return args.ctx;
    if (!args.ctx.hit) return args.ctx;
    return {
      ctx: { ...args.ctx, multipliers: [..., { source: 'vulnerable', factor: 1.5 }] },
      emittedActions: [{ type: 'status_remove', ... }],
    };
  }),
],
```

**No new hook surface needed.** Per ADR-0030's framing, each `customTrigger.kind` maps to an existing engine hook. `'on_damage_received'` rides the existing `onDamageReceived` chain that fires at the target stage of the damage pipeline.

**Skip on miss:** an evasion-failed attack doesn't consume Vulnerable. The pipeline finalize stage zeroes damage on miss, and the handler's `if (!args.ctx.hit) return args.ctx;` short-circuit prevents the status_remove emission. Re-attempt-friendly.

**Skip on healing:** Vulnerable doesn't amplify cures (would feel terrible) and isn't consumed by them.

**Bypassed by `system_damage`:** Poison ticks, Storm Caller self-cost, falling damage all flow through `system_damage`, which doesn't run the seven-stage pipeline. Vulnerable's hook doesn't fire on those events; the status persists. Design intent: Vulnerable amplifies *attacks*, not all damage sources.

**Resistance tag `'lightning'`:** composes with the BMG status application formula's `(1 - target_resistance/100)` term so a lightning-resistant target is harder to mark.

### Magical reactions (no engine change)

Per ADR-0021, reactions trigger on `onActionTargeted` against the target's hooks; the runner doesn't pre-filter on damage tag. Session 20's Discharge demonstrates this: the reaction compiler's `triggerCondition` omits `damageTagsAny`, so the trigger matches both physical and magical incoming damage. Counter's choice to gate on `'physical'` is per-content (Counter is FFT-canonical physical-only), not engine-imposed.

This is a confirmation ADR; no engine work landed for this specific item.

## Consequences

**Positive:**

- Crit infrastructure is uniform across the damage pipeline. Future content (crit-on-back-attack, crit-on-low-HP, etc.) plugs into the same `crit_chance` / `crit_multiplier` `modifyStatQuery` surface — no per-mechanic handling.
- `chainBonus` is a small, focused field on `DamageSpec`. Future "scales with cluster" mechanics extend the field rather than threading new context through the pipeline.
- `selfDamage` reuses `system_damage` infrastructure (per ADR-0027) — no new system-action variant, no new reducer branch. The labeled `source` discriminator is the avenue for a future preventer.
- Vulnerable validates the second consumer of the custom-trigger pattern (ADR-0030). One enum-value addition; no new hook surface.
- Magical reactions confirm the existing surface; the v1 reaction compiler's tag-filter primitives (`damageTagsAny`, `damageTagsNone`) cover both Counter's narrow physical-gate and Discharge's broad damage-of-any-kind gate.

**Negative / open:**

- Crit and Vulnerable both compose multiplicatively at distinct pipeline stages. Final damage = `base × variance × resistance × vulnerable × crit`. This product is associative and commutative — order doesn't change the result — but the value can grow quickly when several multipliers stack. Session 20's calibration assumes a Lightning Mage rarely crits AND vulnerables AND ignites in one attack; if playtesting reveals burst damage cliff-edges, capping or smoothing would happen at the cap stage, not by reordering or removing handlers.
- `crit_chance` is not currently capped at 100. A future Crit_modifier-stack-heavy build could push effective crit_chance past 100; the runtime comparison `r < crit_chance / 100` simply means r < 1+ which always succeeds — no bug, but worth a soft cap if ever an issue.
- `selfDamage` doesn't go through `applyDamageToTarget`'s caster-target onDamageReceived hook. A future "caster takes self-damage AND a debuff applies" mechanic would need a different shape — flagged for whenever a consumer surfaces.
- Vulnerable could theoretically fire twice in chain ordering if two damage events hit the same target before the first `status_remove` processes (e.g., a reactor counters, the counter targets the same Vulnerable unit). v1 reaction patterns don't create this case (Counter targets the attacker, not the original target), so it's a documented edge case rather than a bug. The engine's idempotent `status_remove` handles double emission gracefully.
- Pre-existing bug noted: [reducers.ts:1259](src/engine/actions/reducers.ts:1259) — the non-skipped turn_start fan-out doesn't include `custom + on_unit_ct_100`, so Burn never ticks on a normal turn. Discovered during session 20 work; flagged in handoff for a follow-up session, not fixed here. Doesn't affect Vulnerable (which uses `on_damage_received`, fired via the damage pipeline rather than turn_start).
- 8th ability (`discharge_strike`) for Discharge: the reaction compiler's `use_ability` effect kind requires a paired active ability to invoke. `discharge_strike` is the active that Discharge's reaction emits — not visible in any First Action command set, only used by the reaction. Mirrors how Counter emits `attack`. The total content shape is "5 actives in lightning_spells + 1 reaction passive + 1 hidden retaliation active + 1 support passive" (8 abilities), even though the player-visible identity is the canonical seven (5 actives + reaction + support).

## References

- Battle Mechanics Guide, "Critical hits" (forthcoming addition pending session 20 documentation pass).
- ADR-0017: System actions for status side effects.
- ADR-0027: `system_damage` and `permanent_per_unit_ct` and onDamageReceived emissions.
- ADR-0030: Custom-trigger status pattern + composeApplyState + STACK_COUNT_ADDITIVE.
- ADR-0021: Brave-gated reaction trigger; reaction surface is tag-agnostic by default.
- `docs/roadmap-sessions-14-20.md` "Session 20 — Lightning Mage + AI refresh."
