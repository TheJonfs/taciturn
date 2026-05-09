## ADR-0029: Water Mage substrate — CT manipulation primitives, cone AoE, post-action hook

**Status:** Accepted
**Date:** 2026-05-09

## Context

Session 18 ships the Water Mage — a tempo-manipulator class whose seven-ability kit needs five new engine primitives:

1. **CT push as a damage rider** — Water Strike: "magical damage + on hit, target CT -= 2 × MA."
2. **Free-standing CT push with chance gate** — Tide Surge: "Faith-chance applies +2 × MA ally CT" (no damage component, runs the application-chance pipeline).
3. **Knockback as a damage rider** — Tidal Wave: "AoE damage + per-target chance of knockback 1." Maelstrom: "cone damage + always-knockback."
4. **Cone AoE shape** — Maelstrom: 3-deep cone projected from the caster's tile, direction derived from caster→target geometry.
5. **Post-action CT refund hook** — Flow State support: "magical actions refund 10 CT after resolution."

Plus a new status (Speed Down — additive flat -1 Speed, STACK_INDEPENDENT, permanent) and a new reaction effect kind (`ct_push` for Tidal Pull's self-CT bump on damage).

The substrate is sized so that subsequent Mage classes (Fire in session 19, Lightning in 20) can plug into the same primitives without reshaping the engine.

## Decision

### `system_ct_push` action

A new system action type adjusts a unit's CT by a signed delta. Floored at 0; not capped above 100 (the design permits pushes past trigger threshold per [docs/design/ct-system.md](../design/ct-system.md)).

```ts
interface SystemCtPushPayload {
  targetId: UnitId;
  delta: number; // signed
  source: SystemCtPushSource; // damage_rider | ct_effect | reaction | support
}
interface SystemCtPushOutcome {
  targetId: UnitId;
  delta: number; // requested
  applied: number; // post-floor (differs when clamping)
}
```

KO'd targets are skipped (`applied: 0`). Missing targets are silently skipped (idempotent — corner cases where chain-emitted pushes target just-removed units don't crash).

### `damage.ctPush` rider

`DamageSpec` gains an optional `ctPush?: { factor: number }`. Fires inside `resolveAbilityEffect` after the damage pipeline applies and before status-effect application. Gated on:

- `damageContext.hit === true`
- `damageDealt > 0`
- `!damageTags.has('healing')`
- target alive after damage

The emission is `system_ct_push` with `delta = -floor(factor × runModifyStatQuery(caster.ma))`. No Faith multiplier on the magnitude — the rider is a clean "on-hit" gate (per session 18 spec).

### `damage.knockback` rider

`DamageSpec` gains an optional `knockback?: { distance, chance?, factors? }`. When `chance` is set, runs `rollAbilityChance` (same Faith × MA factor model as status-application chance, no resistance lookup, no `modifyStatusApplicationChance` hook). When `chance` is omitted, fires deterministically.

Direction is **uniform across an AoE** — caster→`effectAnchorPosition` cardinal vector, captured by the dispatcher before per-target dispatch and threaded as `effectAnchorPosition: Position` on `ResolveAbilityEffectArgs`. For non-AoE single-target casts, the dispatcher sets `effectAnchorPosition` to the resolved target's position; AoE dispatch sets it to the original payload-target anchor (before any `anchorMode: 'caster'` override). The same field handles both flows uniformly.

Calls the existing `applyKnockback` primitive (from ADR-0026) inline; applies the position update directly to the working state and forwards any `fallingDamageAction` onto pipeline emissions.

### `effects.ctEffects`

`AbilityEffects` gains an optional `ctEffects: ReadonlyArray<CtEffectSpec>`:

```ts
interface CtEffectSpec {
  target: 'caster' | 'primary_target';
  factor: number; // signed: +2 = ally bump, -2 = enemy push
  baseChance?: number; // omitted → fire deterministically
  factors?: StatusFormulaFactors;
}
```

Distinct from `damage.ctPush` (the deterministic on-hit damage rider) — `ctEffects` runs the ability-chance gate (`rollAbilityChance`) and emits `system_ct_push` on success. v1 consumer is Tide Surge: `[{ target: 'primary_target', factor: 2, baseChance: 80 }]`. The chance machinery is shared with the knockback rider: a single `rollAbilityChance` helper covers both.

AoE + caster-target ctEffect throws (parallel to the existing AoE + caster-target status-effect throw); v1 has no consumer for the once-per-cast handling.

### `onActionResolved` hook

The closed hook surface grows from 12 → 13 hooks. Fires once per UseAbility / charged-action-resolve, on the actor's hooks, after all per-target dispatch and emissions have settled. Returns `{ emittedActions? }`. Reducers (`reduceUseAbility` and `reduceChargedActionResolve`) call `runOnActionResolved` after the per-target loop and forward emissions onto `generatedActions`.

```ts
onActionResolved: {
  args: {
    unit: Unit;
    action: ProposedAction;
    ability: ActiveAbilityDefinition | null;
  };
  return: { emittedActions?: ReadonlyArray<ProposedAction> };
};
```

v1 consumer is Flow State: gates on `args.ability?.tags?.includes('magical')` and emits `system_ct_push { delta: 10 }` against the actor.

### Cone AoE shape

`AoeShape` union grows by one variant: `{ kind: 'cone'; rows: ReadonlyArray<number> }`. Each row's width must be a positive odd integer (cones are symmetric around the forward axis; even widths have no canonical center and `shapeOffsets` rejects them).

Direction is **not stored on the shape** — the same cone definition rotates to point wherever the caster picks. `shapeOffsets(shape, direction?)` and `aoeFootprint({..., direction?})` accept an optional direction (defaulting to `'N'`). The dispatcher computes direction from caster→target-tile cardinal via a new `cardinalFromTo(from, to): CardinalDirection` helper (tie-break: prefer horizontal on perfect-diagonal vectors).

### `AoeSpec.anchorMode`

`AoeSpec` gains an optional `anchorMode: 'target' | 'caster'`, defaulting to `'target'`. Cone shapes require `anchorMode: 'caster'`; the AoE dispatcher throws on cone-with-target-anchor as a content-authoring error. Symmetric shapes (diamond/square/cross) tolerate either mode.

### Reaction compiler — `ct_push` effect kind

The reaction compiler grows from two effect kinds (`use_ability`, `apply_status`) to three. The new `ct_push` kind takes a `targetSelector` (`'self'` | `'attacker'`) and a signed `delta`, and emits `system_ct_push` against the selected target. Brave gating already runs at the `runOnActionTargeted` level (per ADR-0021); the compiler does not re-roll chance.

v1 consumer is Tidal Pull: `{ kind: 'ct_push', targetSelector: 'self', delta: 20 }`. Reaction-cap accounting via the per-reactor cap on `commitAction`'s queue entry continues to work — the runner stamps `reactorId: args.unit.id` on each emission, and the cap key reads from the queue entry independent of the emitted action's payload shape.

### Speed Down status

A new status type. Additive flat -1 Speed per stack via `modifyStatQuery` on `'spd'`. STACK_INDEPENDENT means each application creates a new instance (two casts of Brine on the same target → -2 Speed via two separate instances). `durationMode: 'permanent'` — never expires by time; cleared only by an explicit removal ability/item. `resistanceTag: 'water'` (no v1 unit has water resistance set; the tag is forward-compatible). Speed floor is enforced by `computeSpeed` reading the ruleset's bound, not by a per-status floor.

### Cure tag fix

Cure's `tags` and `effects.damage.tags` gain the `'magical'` tag. Pre-session-18, Cure was tagged `['holy', 'healing']` — semantically magical but not engine-tagged as such. Flow State gates on the `'magical'` ability tag for refund eligibility; without this fix, Cure casts wouldn't refund. The tag addition is functionally inert against the existing damage pipeline (the `magicalMaPower` handler computes the same value as `healingBase` for healing-tagged effects, and the resistance stage short-circuits on `'healing'` per ADR-0016).

## Consequences

### Positive

- **Five distinct CT-manipulation primitives, each with a clear semantic gate.** `damage.ctPush` (deterministic on-hit), `damage.knockback` with optional chance, `effects.ctEffects` (chance-gated standalone), reaction-compiler `ct_push` (Brave-gated reactor self/attacker push), `onActionResolved` (post-action support refund). Each one fires under different conditions; explicit shapes beat a unified "rider" abstraction with conditional dispatch.
- **Cone shape is parameterized by row widths.** Future "more affecting Maelstrom" expansion to `[1, 3, 5]` or any other tapering is one-line content change; no shape redefinition.
- **Knockback direction is uniform across AoE casts.** The `effectAnchorPosition` thread captures the original cast geometry once and reuses it per target; no dispatcher-special-casing.
- **`onActionResolved` is the natural home for future post-action mechanics.** Lightning's "Vulnerable consume" emission and Fire's "Burn stack apply" support could ride here without growing the surface.

### Trade-offs

- The `effectAnchorPosition` field on `ResolveAbilityEffectArgs` is required even when no rider needs it. Cost is small (a `Position` field threaded through one call), benefit is uniform handling across AoE / non-AoE / single-target.
- Cone direction is cardinal-only in v1 — diagonal cones are deferred. A perfect-diagonal target snaps to one of the four axes (tie-break: horizontal). When a content consumer wants 8-direction cones, the basis vector lookup grows by four entries and `cardinalFromTo` extends.
- The reaction-compiler's `ct_push` effect doesn't gate on damage-context (cap is reaction-cap only). If a future content consumer wants "self-CT push on hit, but only when damage > N," that gating is in `triggerCondition` — same shape Counter and Earth Resilience use.

### Future work surfaced

- **Knockback animation in the renderer.** Today the renderer pulls through `system_ct_push` with no visual; the position update shows up on the next animatable action's snapshot refresh. A real knockback animation (interpolated path, per the `KnockbackResult.path`) is a renderer concern for a later session.
- **AoE caster-target ctEffects.** The dispatcher throws on the combination. A future "self-burst CT" ability would fix this with the same once-per-cast pattern that caster-target status effects would use.
- **Diagonal cones.** Cardinal-only is a v1 simplification; diagonal cones grow `DIRECTION_BASIS` and `cardinalFromTo`.
- **Faith-modulated damage on CT push?** Today the `delta = -floor(factor × MA)` is unmodulated; if a future content consumer wants Faith composition (parallel to magical damage), the CT push helper takes the change.
- **`onActionResolved` for non-ability actions.** v1 fires it only inside use_ability / charged-action-resolve. Future Move-flavored consumers (e.g., a "moved this turn" passive) would extend the firing sites.

## Alternatives considered

- **Unified rider abstraction.** A single `riders` field with kind / gate / args. Rejected: with two kinds and two gates today, explicit shapes are more readable and TypeScript-friendly. Revisit when a third / fourth rider kind ships.
- **Storing cone direction on the shape itself.** Rejected: the same cone definition needs to rotate per-cast based on caster→target geometry. Direction is a runtime concern; the shape stays direction-agnostic.
- **Cone as `'custom'` shape with pre-computed offsets.** Rejected: cones are recurring (Maelstrom now; future cone-shaped breath weapons / line spells), and parametrizing by row widths makes the "more affecting Maelstrom" expansion trivial.
- **Faith-multiplier on the CT-push magnitude.** Considered for parity with magical damage, but the user spec is "no Faith multiplier on the push." The damage rider gate is on hit (Faith already factored into damage / chance to land); applying Faith again to the push magnitude is double-counting.
- **Naming the new hook `onAfterAction` instead of `onActionResolved`.** Rejected: the existing hook family uses verbs (`onActionAttempted`, `onActionTargeted`); `onActionResolved` matches the pattern.

## References

- [docs/design/ct-system.md](../design/ct-system.md) — CT push primitives, "discrete CT pushes can push above 100."
- [docs/design/action-resolution.md](../design/action-resolution.md) — damage pipeline, hook surface.
- [docs/design/status-effects.md](../design/status-effects.md) — `permanent` duration mode, STACK_INDEPENDENT.
- [docs/battle-mechanics-guide.md](../battle-mechanics-guide.md) — status application formula factors (Faith, MA).
- ADR-0021 — Brave-gated reaction trigger roll (composes with the new `ct_push` reaction effect).
- ADR-0024 — Status formula factor selection + reaction compiler shape.
- ADR-0026 — Forced-movement collision policy (knockback's mechanics).
- ADR-0027 — System-action emissions from hooks; `permanent_per_unit_ct` mode (Speed Down uses `permanent` instead, the no-tick variant).
- ADR-0028 — Equipment integration; sets the `power_coefficient` rename used by Water Mage damage specs.
