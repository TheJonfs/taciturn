## ADR-0025: AoE per-target dispatch substrate, per-target seed branching, modifyAoeShape hook, reaction-cap accounting fix

**Status:** Accepted
**Date:** 2026-05-06

## Context

Session 17a is the engine substrate for AoE damage application — the precursor to Earth Mage's AoE / Ultimate (session 17b) and the Knight expansion / equipment integration (session 17c). The roadmap (`docs/roadmap-sessions-14-20.md` § Session 17) called for AoE per-target dispatch, the AoE shape modifier hook (Fire's "larger AoE" rider in session 19 is the planned consumer), vertical tolerance enforcement, and a fix to the reaction-cap accounting limitation noted in ADR-0024.

ADR-0024's noted reaction-cap limitation: `commitAction`'s cap accounting keyed on the emitted action's `actorId`, but `system_apply_status` emissions don't carry actorId — so reactions like Earth Resilience's self-buff bypassed the per-unit-per-turn cap. Unhittable in session 16 (Earth Resilience triggers at most once per attacker turn under v1 Brave 100), but session 17's AoE makes it routine: an AoE that hits a Resilience-bearing reactor twice would self-buff twice. The fix lands here ahead of any AoE consumer.

Decisions in scope:

1. **AoE shape declaration** — where the AoE spec lives on `AbilityDefinition`, what it carries.
2. **`AoeShape` type relocation** — moving the shape vocabulary from `engine/map/aoe.ts` to `engine/types/aoe-shape.ts`.
3. **Per-target seed branching** — convention for branching the action seed per affected target.
4. **AoE per-target dispatcher** — `resolveAbilityTargets` as the new entry point shared by instant and charged paths.
5. **`modifyAoeShape` hook** — signature, runner, where it fires.
6. **Vertical tolerance enforcement** — default value source, override mechanism.
7. **Caster exclusion default** — caster excluded from their own AoE by default.
8. **Friendly-fire policy** — sourced from the ruleset, not the per-ability spec.
9. **Reaction-cap accounting fix** — `GeneratedReaction { action, reactorId }`, `QueueEntry.reactorId`.
10. **Caster-target status effects in AoE** — explicit constraint (rejected; v1 has no use case).

## Decisions

### AoE shape declaration: `AoeSpec` on `AbilityEffects`

```typescript
export interface AoeSpec {
  readonly shape: AoeShape;
  readonly verticalTolerance?: number;
  readonly excludeCaster?: boolean;
}

export interface AbilityEffects {
  readonly statusEffects?: ReadonlyArray<StatusEffectSpec>;
  readonly damage?: DamageSpec;
  readonly aoe?: AoeSpec;  // ← NEW
}
```

The AoE rides on `effects.aoe`, parallel to `damage` and `statusEffects`. `targeting` (the input the player provides) stays separate from `aoe` (how that input expands). `targeting.kind: 'tile' | 'unit' | 'self'` plus `effects.aoe?` gives all four useful combinations:

- `tile` + no aoe → tile-anchored single-target (e.g., `bolt`, the v1 throwaway charged spell).
- `tile` + aoe → tile-anchored AoE (Earth's AoE / Ultimate; the canonical pattern).
- `unit` + aoe → unit-anchored AoE (FFT's "Holy Explosion" pattern; v1 has no consumer).
- `self` + aoe → self-centered AoE (Lightning Mage's nova in session 20).

**Why per-effect, not per-targeting:** the targeting tells you where the *anchor* lands; the AoE tells you what happens *from* that anchor. They're orthogonal. Bundling them on `targeting` would force every targeting variant to encode AoE-or-not, which is design noise.

### `AoeShape` type relocation: `engine/types/aoe-shape.ts`

The pure data shapes (`AoeShape`, `AoeOffset`, `AoeAnchor`) move from `engine/map/aoe.ts` to `engine/types/aoe-shape.ts`. The algorithms (`shapeOffsets`, `aoeFootprint`) stay in `engine/map/aoe.ts`, which now imports the types from `engine/types/`.

**Why:** `engine/catalog/definitions/ability-definition.ts` needs to name `AoeShape` for `AoeSpec`. Catalogs sit above map in the layering arrow (the catalog defines ability data; the map computes spatial queries against state). Importing `engine/map/` into `engine/catalog/` would invert the layer; relocating just the type vocabulary keeps the layering clean. `engine/map/aoe.ts` re-exports the types so existing callers that import shape types from there keep working.

### Per-target seed branching: `perTargetSeed(actionSeed, targetIndex)`

Lives in `engine/actions/seed.ts` alongside `deriveActionSeed`. Two important properties:

- **`targetIndex === 0` is identity:** `perTargetSeed(seed, 0) === seed`. Single-target callers — every non-AoE ability in v1, plus any non-AoE charged spell — see no RNG drift across the AoE refactor. Replays of pre-session-17 logs continue to produce bit-identical outcomes.
- **`targetIndex >= 1` runs the splitmix32 mixer** (the same one in `deriveActionSeed`). One mixer step disperses the seed across all sub-streams (variance 0, evasion 1, brave 2, status chance 3) so a per-target stream is independent of the per-sub-stream offset.

The dispatcher passes `perTargetSeed(args.seed, i)` for each affected target's call to `resolveAbilityEffect`. Inside `resolveAbilityEffect`, the existing sub-stream offsets work unchanged — they're now layered on top of a per-target stream rather than the global action stream.

**Why a single mixer step rather than `seed XOR (targetIndex * stride)`:** XOR with a stride biases adjacent indices to share low bits, which can correlate sub-stream rolls that XOR low offsets (variance / evasion). The mixer produces well-distributed seeds across all 32 bits.

**Why identity at index 0 specifically:** preserves single-target RNG bit-for-bit. Any non-AoE caller reaches the dispatcher at `targetIndex === 0`; their outcomes don't shift. The cost is one branch per single-target call (`if (targetIndex === 0) return actionSeed`), which is free.

### AoE per-target dispatcher: `resolveAbilityTargets`

A new function in `engine/actions/reducers.ts` that bridges the proposed `AbilityTarget` to the per-target `resolveAbilityEffect` body. Two modes:

- **Single-target** (no `effects.aoe`): resolves the target to a unit (or null for empty-tile / self-no-unit) and calls `resolveAbilityEffect` once with `perTargetSeed(seed, 0)`.
- **AoE** (`effects.aoe` set): expands the anchor into the shape's footprint, filters affected units, sorts deterministically, calls `resolveAbilityEffect` per target with branched seeds.

`reduceUseAbility` calls `resolveAbilityTargets` once per cast. `reduceChargedActionResolve` calls it once per `TargetRef` in `ca.targets` (v1 charged spells have at most one ref each). The pre-flight silent-fizzle cases in `reduceChargedActionResolve` (unit-not-found, KO'd target, non-AoE empty-tile-no-caster-effects) stay in the reducer to preserve the existing "no per-target result emitted" semantics for those cases.

**Stable target ordering** is by unit id (lexicographic) — UnitId is a branded string. Stable across replays and across slight test-fixture id changes (lexicographic compare on a fixed id set is deterministic).

**Why a separate dispatcher rather than folding AoE into `resolveAbilityEffect`:** `resolveAbilityEffect` is the per-target body — damage pipeline, per-effect status loop, post-application onActionTargeted. AoE is the *fan-out* over targets. Mixing them would couple two concerns; splitting them keeps each focused. The dispatcher also owns the AoE-specific decisions (anchor resolution, footprint, friendly-fire filter, caster exclusion, target ordering) that don't apply to the per-target body.

### `modifyAoeShape` hook

```typescript
modifyAoeShape: {
  args: {
    unit: Unit;            // the caster (attacker)
    ability: ActiveAbilityDefinition;
    baseShape: AoeShape;
  };
  return: AoeShape;
}
```

Fires against the **caster's** hooks (statuses, equipped passives, equipment, class traits). Each handler receives the running shape and returns a new one; the chain composes in source-tier and per-handler priority order. Pure-compute hook — no emission slot.

v1 has no consumer; Fire Mage's "larger AoE" rider in session 19 is the planned first user, alongside future "Cast Bigger" / "Wide Cast" passives.

The runner (`runModifyAoeShape`) sits in `engine/hooks/runners.ts` next to other `modify*` runners. Composition is sequential, identity for an empty handler set.

**Why a separate hook rather than baking into `modifyStatQuery`:** `modifyStatQuery` is for numeric stats; `AoeShape` is a discriminated-union shape. Forcing it through `modifyStatQuery` would either require encoding the shape as numbers (lossy) or generalizing `modifyStatQuery` beyond its current contract. A separate hook keeps each one's signature honest, matching ADR-0005's typing principle.

### Vertical tolerance enforcement

The dispatcher reads `aoe.verticalTolerance ?? ruleset.rangeDefaults.aoeVerticalTolerance` and passes it to `aoeFootprint`. Per-ability override takes precedence; the ruleset default (v1: 1) covers unannotated abilities. `aoeFootprint` already enforces the `|tile.elevation - anchor.elevation| <= verticalTolerance` filter from session 4.

**Edge case — value 0:** explicit "must be exact same elevation." Distinct from `undefined` which falls back to the ruleset default. The `??` operator preserves this distinction; `||` would conflate 0 with unset.

### Caster exclusion default: true

`aoe.excludeCaster` defaults to `true` — the FFT-canonical behavior. A caster casting an AoE doesn't damage themselves even when standing in the footprint. Setting `excludeCaster: false` opts into self-hit (Lightning Mage's "Nova" pattern in session 20: a self-centered AoE that does include the caster).

**Why default true:** every Mage AoE in the session 14–20 roadmap excludes the caster. Defaulting to true keeps the common case unannotated. Self-hit is the unusual choice that should surface in the spec.

### Friendly-fire: ruleset, not per-ability

Friendly fire is a ruleset behavior (`ruleset.behaviors.friendlyFire`, v1 default `true`), not a per-ability flag. When `false`, the dispatcher excludes units on the caster's team (not including the caster, since `excludeCaster` is the separate self-hit toggle).

**Why ruleset, not per-ability:** friendly-fire-on-vs-off is a global gameplay-mode decision (a "campaign mode" might disable friendly fire to lower the difficulty floor). Per-ability flags would let one ability claim "this doesn't hit allies" — but in v1 every AoE follows the ruleset's policy. If a future ability needs the per-ability override (e.g., a "Selective Storm" that only hits enemies), it adds an `affectsAllies?: boolean` to `AoeSpec` then.

### Reaction-cap accounting fix: `GeneratedReaction { action, reactorId }`

`runOnActionTargeted` now returns `ReadonlyArray<GeneratedReaction>` instead of `ReadonlyArray<ProposedAction>`. Each entry pairs the proposed reaction action with the reactor id (`args.unit.id` — the unit whose hooks fired). `ReduceResult.generatedReactions` carries the same shape; `commitAction` enqueues each reaction with `entry.reactorId` set on the QueueEntry.

The cap check in `commitAction` keys on `entry.reactorId` instead of the previous `effectiveProposed.actorId`. The `'actorId' in effectiveProposed` test is removed entirely — reactions whose emitted actions don't carry actorId (system_apply_status from Earth Resilience) now account correctly.

**Why a separate `GeneratedReaction` shape rather than forcing reactorId onto ProposedAction:** the reactor id is chain-bookkeeping, not action data. ProposedAction is the controller-facing shape — it shouldn't carry chain metadata that controllers don't supply. Separating the wrapper from the payload keeps each shape meaningful.

**Where the type lives:** `engine/types/action.ts` next to `ProposedAction`. It's a chain-control shape but it lives in the type tier so runners and reducers can both name it without crossing layers.

### Caster-target status effects in AoE: rejected

The dispatcher throws when an AoE-flagged ability declares a status effect with `target: 'caster'`. v1 has no such ability; deferring the question keeps the dispatcher simple. When a future ability needs the combination (e.g., a self-buff-while-AoE-damaging spell), the dispatcher gains a once-per-cast caster-effect application step before the per-target loop.

**Why throw rather than no-op:** an undeclared semantic is worse than an explicit error. A future content author writing a caster-target-AoE combination should see the constraint surface immediately, not silently get only one of the two effects.

## Consequences

- **AoeSpec joins AbilityEffects** — abilities that declare `aoe` now expand. v1 abilities omit it; their behavior is bit-identical to pre-session-17 (single-target dispatch with `perTargetSeed(seed, 0) === seed`).
- **`AoeShape` types move tier** — from `engine/map/` to `engine/types/`. Existing callers of `engine/map/aoe.ts` continue to work via re-exports.
- **`modifyAoeShape` joins the closed hook surface** — now 11 hooks total. Pure-compute, no emission slot. Per CLAUDE rule 8, this is a deliberate engine change.
- **Per-target seed branching is the canonical AoE RNG pattern** — `perTargetSeed(actionSeed, targetIndex)` is the entry point. Future random subsystems within a per-target body (a custom-trigger status's roll, a future second hit roll) inherit per-target independence by riding on the per-target seed.
- **Reaction cap is reactor-keyed, not actor-keyed** — `system_apply_status` reactions account correctly. Future reaction emissions with similar actorId-less shapes inherit the fix.
- **Caster-target status effects in AoE throw** — until a v1 consumer surfaces. Documented constraint, not silently dropped behavior.
- **The dispatcher is the canonical entry point for ability resolution** — `reduceUseAbility` and `reduceChargedActionResolve` both route through it. The `reduceChargedActionResolve` per-TargetRef loop is unchanged in structure; only the inner call changed from `resolveAbilityEffect` to `resolveAbilityTargets`.

## References

- ADR-0024 — session 16's status formula and emission shape; this ADR resolves the reaction-cap accounting limitation noted there.
- ADR-0021 — Brave-gated reaction trigger; the per-reaction Brave roll inside `runOnActionTargeted` is unchanged. The reactor id is now stamped on each emitted reaction; the Brave roll continues to fold per-reaction index into the seed.
- ADR-0023 — charged action lifecycle; the per-TargetRef loop in `reduceChargedActionResolve` is preserved structurally.
- `docs/design/map-and-battlefield.md` ("Area of effect") — the algorithmic basis for `aoeFootprint`, unchanged.
- `docs/roadmap-sessions-14-20.md` § Session 17 — the planning document for the AoE substrate.
- `src/engine/actions/seed.ts` — `perTargetSeed`.
- `src/engine/actions/reducers.ts` — `resolveAbilityTargets` dispatcher.
- `src/engine/hooks/hooks.ts` / `runners.ts` — `modifyAoeShape` signature and runner.
- `src/engine/actions/commit.ts` — reactor-id-keyed cap accounting.
- `src/engine/types/aoe-shape.ts` — relocated shape vocabulary.
- `src/engine/types/action.ts` — `GeneratedReaction`.
- `src/engine/actions/aoe-substrate.test.ts` — substrate test coverage.
