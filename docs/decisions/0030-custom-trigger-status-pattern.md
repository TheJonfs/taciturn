## ADR-0030: Custom-trigger status pattern, type-method customState composition, STACK_COUNT_ADDITIVE implementation

**Status:** Accepted
**Date:** 2026-05-09

## Context

Session 19 ships Fire Mage. The class's signature mechanic — Burn — sits in a part of the status design space that the existing duration modes (per_unit_ct, global_ticks, turn_based, conditional, permanent, permanent_per_unit_ct) don't capture cleanly:

- Burn doesn't decay by time. Each application adds N stacks; each tick at the affected unit's CT-100 boundary deals damage, then drops one stack; the status removes when stacks reach 0.
- Burn's per-stack damage derives from the *applier's* MA at apply time. A high-MA Fire Mage's stacks hit harder than a low-MA applier's stacks; mixed-source Burn (multiple appliers stacking on the same target) needs to remember each stack's contribution independently.
- Burn's stacking shape (STACK_COUNT_ADDITIVE per ADR-0018) was reserved as an enum value in 13.7 with `apply.ts` throwing on the branch. Session 19 implements the branch.

Past the immediate Burn need, the broader pattern is "status type with a lifecycle event other than time decrement." Vulnerable in session 20 wants the same shape (trigger on damage taken; remove on consumption). Generalizing here so Vulnerable plugs into the same substrate.

Decisions in scope:

1. **`'custom'` durationMode + `customTrigger` field** — declarative shape for "this status's lifecycle is not time-driven."
2. **Reuse existing hooks for trigger firing** — no new hook surface; `'on_unit_ct_100'` rides the existing `status_tick` → `onTick` path.
3. **`composeApplyState` static method on StatusEffectType** — apply-time customState computation with access to the caster, the requested stack quantity, and the existing instance (if any).
4. **`customStateOnDecrement` static method on StatusEffectType** — decrement-time customState transform, called by `status_decrement_stack` before the count decrement.
5. **STACK_COUNT_ADDITIVE branch in `applyStackingRule`** — incoming.stacks adds to existing.stacks; customState is taken from incoming (composeApplyState pre-merged it).
6. **`stackQuantity?: number` on `StatusEffectSpec`** — abilities that apply >1 stack per cast (Spark applies 2).

## Decisions

### `'custom'` durationMode + `customTrigger` field

`DurationMode` gains one value:

```typescript
export type DurationMode =
  | 'global_ticks'
  | 'per_unit_ct'
  | 'turn_based'
  | 'conditional'
  | 'permanent'
  | 'permanent_per_unit_ct'
  | 'custom';        // new
```

`StatusEffectType` gains an optional field:

```typescript
readonly customTrigger?: { readonly kind: 'on_unit_ct_100' };
```

The `kind` union grows as new triggers ship (session 20's Vulnerable adds `'on_damage_received'`). v1 ships only `'on_unit_ct_100'` for Burn.

**Semantic:** `durationMode === 'custom'` declares that the status's lifecycle is event-driven, not time-driven. `customTrigger` declares which event drives it. The two fields together are a discriminated declaration; either both are set or neither (`'custom'` without `customTrigger` is a content authoring error and `applyStatus` throws).

`computeInitialDuration` returns `null` for `'custom'` (the type has no time-based duration). `reduceStatusTick` short-circuits the duration-decrement branch when `durationMode === 'custom'`.

### Reuse existing hooks for firing — no new hook surface

For `customTrigger.kind === 'on_unit_ct_100'`, the trigger event coincides with the existing per-unit-CT status_tick fan-out at `turn_start`. The fan-out's filter expands:

```typescript
// reduceTurnStart status_tick fan-out — expanded for custom-trigger.
if (
  type.durationMode === 'per_unit_ct' ||
  type.durationMode === 'permanent_per_unit_ct' ||
  (type.durationMode === 'custom' && type.customTrigger?.kind === 'on_unit_ct_100')
) {
  generated.push({ type: 'status_tick', source: 'system', payload: { unitId, statusTypeId: status.typeId } });
}
```

Burn's `onTick` handler does the work — sums `customState.stackDamages`, emits `system_damage`, emits `status_decrement_stack`. The status_tick reducer skips its duration decrement when `durationMode === 'custom'` (the customStateOnDecrement path handles per-stack metadata).

For `customTrigger.kind === 'on_damage_received'` (session 20's Vulnerable), the firing already happens via `onDamageReceived` against the affected unit's hooks — no engine change needed beyond declaring the customTrigger field. Vulnerable's onDamageReceived handler emits the damage multiplier into the in-flight ctx and a `status_remove` against itself.

**Why no new `onCustomTrigger` hook:** the existing event hooks (`onTick`, `onDamageReceived`, `onActionResolved`, etc.) already cover the trigger surface for the conceivable v1/v2 custom-trigger kinds. A dedicated `onCustomTrigger` would either duplicate these or add a thin indirection without payoff. Each customTrigger.kind maps to the natural existing hook.

### `composeApplyState` — apply-time customState computation

`StatusEffectType` gains an optional method:

```typescript
readonly composeApplyState?: (args: {
  readonly state: GameState;
  readonly catalog: Catalog;
  readonly caster: Unit | null;          // null when applied without a unit caster
  readonly existingInstance: StatusInstance | null;
  readonly requestedStackQuantity: number;
}) => { readonly customState?: Readonly<Record<string, unknown>>; readonly stacks?: number };
```

Called by `applyStatus` after partitioning the unit's existing same-type instances and before `buildCandidate` constructs the incoming instance. The returned `customState` (if any) replaces the candidate's customState; the returned `stacks` (if any) replaces the candidate's stacks.

For Burn:

```typescript
composeApplyState: ({ state, catalog, caster, existingInstance, requestedStackQuantity }) => {
  const ma = caster
    ? runModifyStatQuery(state, catalog, { unit: caster, statName: 'ma', baseValue: caster.baseStats.ma })
    : 0;
  const perStackDamage = Math.floor(ma * BURN_COEFFICIENT);
  const newStackValues = Array(requestedStackQuantity).fill(perStackDamage);
  const existingStacks =
    (existingInstance?.customState?.stackDamages as number[] | undefined) ?? [];
  const merged = [...existingStacks, ...newStackValues];
  return { customState: { stackDamages: merged }, stacks: merged.length };
};
```

The composer's responsibility is to compute the *resulting* customState (post-merge with existing). STACK_COUNT_ADDITIVE's stacking branch then uses `incoming.customState` and `incoming.stacks` directly — no further merge.

**Why a static method on the type rather than a hook:** the apply-time computation is deterministic and per-status (no chain composition makes sense — one Burn definition, one composer). A hook would require collector / runner machinery for no payoff, and would let multiple sources contend over the same instance's customState.

**Why pass the existing instance into the composer:** STACK_COUNT_ADDITIVE explicitly merges with existing state; the composer needs to see the existing customState to produce the merged form. Other stacking rules (REFRESH, REPLACE, STACK_INDEPENDENT) call composeApplyState with `existingInstance: null` — they don't merge.

### `customStateOnDecrement` — decrement-time customState transform

`StatusEffectType` gains a second optional method:

```typescript
readonly customStateOnDecrement?: (instance: StatusInstance) => Readonly<Record<string, unknown>> | undefined;
```

Called by `reduceStatusDecrementStack` before the count decrement. Returns the new customState to attach to the decremented instance. For Burn:

```typescript
customStateOnDecrement: (instance) => {
  const stackDamages = (instance.customState?.stackDamages as number[] | undefined) ?? [];
  return { ...instance.customState, stackDamages: stackDamages.slice(1) };  // FIFO shift
}
```

When `stacks` reaches 0 after decrement, the reducer's existing remove path fires (which calls `removeStatus` and runs onRemove handlers). The stale customState on the dropped instance is irrelevant — the instance is gone.

**FIFO drop, not LIFO:** the first stack added drops first, so the latest applier's contribution outlives earlier weaker stacks. This rewards continued application from a strong applier (their latest stack persists longest), and matches the "fading burn" mental model — the oldest flame burns out first.

### STACK_COUNT_ADDITIVE branch implementation

The previously-throwing branch in `applyStackingRule`:

```typescript
case 'STACK_COUNT_ADDITIVE': {
  const head = existing[0]!;
  const incomingStacks = incoming.stacks ?? 1;
  const totalStacks = (head.stacks ?? 1) + incomingStacks;
  const merged: StatusInstance = {
    ...head,
    stacks: totalStacks,
    ...(incoming.customState !== undefined ? { customState: incoming.customState } : {}),
    remainingDuration: incoming.remainingDuration,  // refresh (null for 'custom')
  };
  return {
    newInstancesOfType: [merged, ...existing.slice(1)],
    result: { kind: 'stacked', mode: 'additive', instance: merged },
    lifecycle: NO_LIFECYCLE,
  };
}
```

When the type defines `composeApplyState`, the composer has already computed the merged customState and the new total stack count — STACK_COUNT_ADDITIVE just splats those onto the head. When the type doesn't define it (a hypothetical future stack-counting status with no custom state), the rule falls back to "increment count by incoming.stacks; preserve head's customState."

### `stackQuantity` on `StatusEffectSpec`

```typescript
interface StatusEffectSpec {
  readonly typeId: StatusTypeId;
  readonly target: 'caster' | 'primary_target';
  readonly baseChance?: number;
  readonly applyAlways?: boolean;
  readonly factors?: StatusFormulaFactors;
  readonly magnitude?: number;
  readonly duration?: number;
  readonly customState?: Readonly<Record<string, unknown>>;
  readonly stackQuantity?: number;   // new — default 1; Spark passes 2
}
```

`resolveAbilityEffect` forwards `stackQuantity` into `applyStatus`'s args. `applyStatus` forwards to `composeApplyState` as `requestedStackQuantity`. When the type has no composer, `stackQuantity` is reflected onto the candidate's `stacks` field directly (so STACK_COUNT_ADDITIVE without a composer still respects the spec's quantity).

## Consequences

### Positive

- **Burn's design intent is preserved.** Per-stack MA snapshot at apply means a strong applier's stacks hit hard for the rest of their lifetime, even if the applier's MA shifts later. Mixed-source Burn (multi-applier stacking) preserves each stack's contribution independently.
- **No new hook surface.** Custom-trigger statuses use existing `onTick` / `onDamageReceived` / `onActionResolved` hooks for their trigger events. The closed hook list stays at 13.
- **Two new type methods are static and per-status.** No chain composition, no collector/runner machinery, no per-source provenance to track. Cheaper than a hook.
- **Vulnerable plugs in cleanly in session 20.** Add `'on_damage_received'` to the customTrigger.kind union; Vulnerable's onDamageReceived handler is the firing site. No additional engine work expected.
- **STACK_COUNT_ADDITIVE has a real consumer.** The previously-throwing branch is now exercised end-to-end.

### Trade-offs

- **`composeApplyState` reads MA via a state lookup.** The function takes the full `state` and `catalog` so it can call `runModifyStatQuery`. This is a minor expansion of buildCandidate's surface but follows the precedent set by `onTick`'s `state`/`catalog` args (Regen needs the same for its heal computation).
- **customState shape is per-status convention.** Burn's `stackDamages: number[]` is read by Burn's onTick handler and Burn's customStateOnDecrement; if a future status wants to inspect Burn's customState (a "Burn analyzer"), it has to know the shape. This is true of any escape hatch; preferable to a generic stack-metadata abstraction that no other status needs yet.
- **`'custom'` durationMode is a marker, not a behavior.** The mode itself doesn't dictate firing — it dictates *non-time-decrement*. The customTrigger field disambiguates what does fire. Two-field declaration is slightly more verbose than a single tagged-union, but matches the existing `permanent_per_unit_ct` approach (which encoded the orthogonal product the same way).

### Future work surfaced

- **Vulnerable in session 20.** customTrigger.kind grows by `'on_damage_received'`. Vulnerable's onDamageReceived handler fires the multiplier into ctx and emits status_remove against itself.
- **Other custom-trigger kinds.** Future content might need `'on_action_attempted'` (a status that triggers when its bearer tries to act), `'on_move'` (trigger when bearer moves), etc. Each adds an enum value and identifies its existing-hook firing site.
- **More expressive stack metadata.** If a future status needs richer per-stack data (a stacked buff with per-stack expiry timers), the customState array shape generalizes; only the per-status composer / customStateOnDecrement need to know the new shape.
- **Stack-cap policy.** Burn has no stack cap in v1 (theoretical maximum is "as many casts as you can fit"). If a future content consumer wants a cap, the composer is the natural place — return early when `existingStacks.length >= CAP`. Or add a `maxStacks?: number` field on StatusEffectType for engine enforcement.

## Alternatives considered

- **A new `onCustomTrigger` hook.** Rejected per "Reuse existing hooks for firing." Each customTrigger.kind maps cleanly to an existing hook (CT-100 → onTick, damage taken → onDamageReceived). A dedicated hook would either duplicate these or add an indirection layer.
- **Burn-specific system action (`status_burn_decrement`).** Rejected — would balloon the action union per custom-trigger status. The customStateOnDecrement type-method approach handles all custom-state-bearing statuses through the existing `status_decrement_stack` reducer.
- **Live MA read at trigger time (no per-stack snapshot).** Rejected per Chris's design intent — the proficiency of who lit the burn should outlast the applier's later MA shifts. Snapshot at apply preserves the multi-applier story; live read collapses it.
- **Reuse `STACK_INDEPENDENT` instead of `STACK_COUNT_ADDITIVE`.** Each Burn application creates a separate instance. Rejected — the BMG semantic is one trigger per CT-100 with `stacks × per_stack_damage`; STACK_INDEPENDENT would mean N ticks per CT-100 across N instances. Different mechanics.
- **Two-axis decomposition of stacking (count + magnitude as orthogonal axes).** Rejected per ADR-0018 as over-engineering. The rule-per-shape approach stays clean.
- **`stackQuantity` as a field on the StatusEffectType (not the spec).** Considered — would mean Burn always applies 2 stacks. Rejected because Spark wants 2 but Smolder wants 1; per-application control belongs on the spec.

## References

- ADR-0017 — system actions for status side effects (`status_decrement_stack` lands here; this ADR puts a real consumer behind it).
- ADR-0018 — STACK_COUNT_ADDITIVE stacking rule (this ADR ships the implementation).
- ADR-0024 — status formula and emission shape (composeApplyState parallels onTick's "static work that needs state/catalog access").
- ADR-0027 — `permanent_per_unit_ct` durationMode (precedent for orthogonal-product duration modes).
- `docs/battle-mechanics-guide.md` — "Burn-specific stacking and decay" section (the mechanic this ADR ships).
- `src/engine/types/duration-mode.ts` — `'custom'` enum value.
- `src/engine/catalog/definitions/status-effect-type.ts` — `customTrigger`, `composeApplyState`, `customStateOnDecrement` fields.
- `src/engine/status/apply.ts` — composeApplyState integration in buildCandidate.
- `src/engine/status/stacking.ts` — STACK_COUNT_ADDITIVE branch implementation.
- `src/engine/actions/reducers.ts` — reduceTurnStart fan-out filter, reduceStatusTick custom-mode short-circuit, reduceStatusDecrementStack customStateOnDecrement integration.
- `src/content/statuses/burn.ts` — Burn definition (the worked example).
