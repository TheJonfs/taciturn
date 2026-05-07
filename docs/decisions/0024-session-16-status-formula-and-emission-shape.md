## ADR-0024: Status application formula, hook emission shape, queryTurnSkipped extension, and Earth Mage substrate

**Status:** Accepted
**Date:** 2026-05-06

## Context

Session 16 implements the status-application formula, the system-action emission infrastructure for hook handlers (the deferred ADR-0017 commit), the spec-driven reaction compiler, and the first Earth Mage content (5 abilities + 5 statuses). This ADR captures the architectural decisions made in-session that aren't covered by ADR-0017's general commitment to emission infrastructure.

Decisions in scope:

1. **Hook emission shape** — granular per-hook emission slots (Option B) rather than a uniform wrapper.
2. **`queryTurnSkipped` return-shape extension** — `suppressStatusTicks` flag so Charging and Stop can express different per-unit-CT status-tick behavior.
3. **System actions for status side effects** — `system_heal`, `system_apply_status`, `status_remove`, `status_decrement_stack`. Each is a real Action with its own reducer.
4. **Status application formula** — wired into `resolveAbilityEffect` ahead of the apply pipeline. Per-effect seed branching for independent rolls.
5. **`modifyHitChance` and `modifyStatusApplicationChance` hooks** — two new hooks added to the closed surface.
6. **Reaction compiler** — `ReactionAbilityFields` → `PassiveHookRegistration[]`. Counter refactored to use it as the worked example. Earth Resilience is the first new consumer.
7. **`onTick` runner with emission filtering** — only the ticking status's own onTick handlers fire on a status_tick.
8. **Regen's Faith/MaxHP heal formula** — `(Faith / 100) × 0.10 × MaxHP` per session 16 plaintext review.
9. **Earth Resilience stacking** — STACK_INDEPENDENT.
10. **Earth Communion scope** — universal (any status this unit applies, not just earth-tagged).

## Decisions

### Hook emission shape: per-hook emission slots (Option B)

`onTick` gains the emission slot in session 16. Other emission-bearing hooks (`onApply`, `onRemove`, `onDamageReceived`, `onDamageDealt`, `onActionAttempted`, `onActionTargeted`) extend to support emissions when their first v1 consumer ships — currently planned for Sleep (session 17), Burn (session 19), and Vulnerable (session 20). Pure-compute hooks (`modifyStatQuery`, `modifyHitChance`, `modifyStatusApplicationChance`, `modifyCanEnter`, `modifyTerrainCosts`, `modifySpecialMovement`) never gain emissions — they're read-only by design.

`OnTickResult = { emittedActions?: ReadonlyArray<ProposedAction> }`. The runner (`runOnTick`) collects emissions across all firing handlers and returns them flat. The reducer (`reduceStatusTick`) appends them to its `generatedActions`; `commitAction` enqueues them like any other generated action.

**Why per-hook over uniform wrapper:** the closed hook list has two semantic halves — `modify*` hooks compute values, `on*`/`query*` hooks react to events. The two halves have different shapes already. Forcing `modifyStatQuery` to declare an emission capability it can never use is a false uniformity. Per-hook policy keeps each hook's signature honest.

**Why not a side channel (handler-callable `emit()` function):** breaks handler purity; testing requires mocking the emit channel; counter to "Pure functions where possible" in CLAUDE.md.

### `queryTurnSkipped` return shape

```typescript
type TurnSkipResult =
  | { reason: string; suppressStatusTicks: boolean }
  | null;
```

Stop returns `suppressStatusTicks: true` (frozen in time — Poison/Regen/Burn don't tick on a Stopped turn). Charging returns `suppressStatusTicks: false` (caster is conscious — DoTs progress while the spell charges).

**Implementation:** `reduceTurnStart` reads the flag and conditionally emits per-unit-CT `status_tick` actions before the auto-emitted `turn_end`. The order is `status_tick` actions first, then `turn_end` — so DoTs land before the turn formally closes.

**Why not move Charging to `onActionAttempted`:** Charging would need two registrations (one to gate the resolution, one to no-op the turn) — more surface area for the same effect. The skip query is the right place; we just needed it to express more.

### System actions for status side effects (ADR-0017 commit)

Four new system actions land in session 16:

- **`system_heal`** — applies HP healing to a target, capped at MaxHP. No-op on KO'd targets. Used by Regen's onTick emission.
- **`system_apply_status`** — applies a status without running the BMG application chance formula. Used by the reaction compiler's `apply_status` effect (Earth Resilience). The Brave roll on the originating reaction has already gated whether it fires; the application is deterministic.
- **`status_remove`** — removes a named status from a target. Idempotent. ADR-0017's commit; first content consumer ships in session 17 (Sleep wake-on-damage).
- **`status_decrement_stack`** — decrement an instance's stack count; remove if 0. ADR-0017's commit; first content consumer ships in session 19 (Burn).

All four bypass `validateAction` (system actions are engine-emitted; the engine is trusted to emit them only when state allows). Their reducers handle missing-target and KO'd-target cases as silent no-ops.

**Why two flavors of "apply a status":** the formula path lives in `resolveAbilityEffect` (ability-driven applications). `system_apply_status` is for "this status was earned by trigger" cases — the Brave roll already gated it; running the formula again would double-gate.

### Status application formula

Wired into `resolveAbilityEffect`'s status-effect loop, ahead of `applyStatus`:

```
hit_chance = base_chance × Faith_factor × MA_factor × (1 - target_resistance/100) × ∏modifiers
```

Per BMG (line 273) and ADR-0024's coefficients:

- `base_chance`: per-effect, expressed [0, 100], normalized to [0, 1].
- `Faith_factor`: symmetric, `(Faith_user / 100) × (Faith_target / 100)`. Same as damage / healing.
- `MA_factor`: `0.9 + MA_user / 10`. v1 starting point per BMG; revisitable after Earth Mage testing.
- `target_resistance`: signed-max across the status type's `resistanceTag` (single tag in v1; multi-tag composition is future).
- `∏modifiers`: multiplicative product of `modifyStatusApplicationChance` chain returns (Earth Communion × 1.25, etc.).

**Per-effect seed branching:** `rollStatusChance` accepts an `effectIndex` arg. Each status effect within an ability rolls on `seed XOR (STATUS_CHANCE_SUB_STREAM + index)`, so Earth Curse's Blind + Silence don't share a coin flip.

A failed roll emits a `'missed'` outcome (with `chance` and `roll` recorded) and skips the apply pipeline. Damage and status are independent — a magical attack can deal full damage and the status rider can still miss.

### Two new hooks: `modifyHitChance`, `modifyStatusApplicationChance`

Both fit the `modify*` pattern: pure-compute, multiplicative composition, no emission slot. Added to the closed `HookSignatures` surface as a deliberate engine change per CLAUDE rule 8.

- `modifyHitChance` — fires against the *target's* hooks. Blind (factor 0.5) is the v1 consumer; future Concentration (factor > 1.0 against the attacker) would parallel.
- `modifyStatusApplicationChance` — fires against the *caster's* hooks. Earth Communion (factor 1.25) is the v1 consumer.

`evasion_check` reads `runModifyHitChance`'s product; `rollStatusChance` reads `runModifyStatusApplicationChance`'s product.

### Reaction compiler

`compileReaction(fields: ReactionAbilityFields)` produces `PassiveHookRegistration[]`. v1 supports two effect kinds (`use_ability`, `apply_status`) and two trigger conditions (`damage_received`, `always`). Counter is refactored to use the compiler; Earth Resilience is the first new consumer.

`use_ability` effect emits a `use_ability` ProposedAction with the reactor as actor. `apply_status` effect emits a `system_apply_status` (bypassing the BMG formula since the Brave gate already ran).

Brave gating remains in `runOnActionTargeted` (per ADR-0021); the compiler doesn't handle it — the runner does.

**Reaction-cap accounting limitation:** the current cap check (`commit.ts`) keys on the ProposedAction's `actorId`. `system_apply_status` ProposedActions don't carry actorId, so an apply_status reaction is uncapped today. v1 has no AoE or repeatable triggers within a turn for Earth Resilience, so this is unhittable in session 16. Session 17's AoE work will exercise the case and need a fix (carry reactor-id on the queue entry independent of the action's own field).

### `onTick` runner filters by source

`runOnTick` collects all `onTick` handlers active on the unit but only fires those whose `sourceTypeId` matches the ticking status. A unit with both Regen (per_unit_ct) and a hypothetical Poison (per_unit_ct) would emit two `status_tick` actions per turn boundary (one per status); each fires only its own onTick handler.

The handler shape includes `state` and `catalog` in args so handlers can call `runModifyStatQuery` for stat reads (Regen needs Faith and MaxHP). This is the exception in the hook surface — most handlers don't see state/catalog directly. Justified by the inherent need: tick effects compute against current world state.

### Regen formula

`amount = floor((Faith_target / 100) × 0.10 × MaxHP_target)`

Faith here reads the *recipient's* faith (asymmetric). Caster's faith doesn't enter the per-tick formula — only the application formula. The intent: "as the recipient gets faithier, the buff sticks harder."

Numbers calibrated against expected Faith ranges (most v1 units 60-80) and MaxHP curves: at Faith 80 / MaxHP 50 → 4 HP/tick; Faith 80 / MaxHP 300 → 24 HP/tick. ~4-5 ticks during a 36-CT duration heal ~30-40% of the bar.

### Earth Resilience stacking

STACK_INDEPENDENT. Each trigger creates a new `movement_self_buff` instance with its own duration timer. Repeated triggers within the buff window stack additively (3 hits → +3 / +3 Move/Jump). Each instance ages out independently.

**Why not REFRESH:** REFRESH would cap the buff at +1/+1 and just refresh the timer, removing the "tanking growth" intent. STACK_INDEPENDENT preserves the design payoff while keeping the buff bounded by Brave probability × incoming hits × instance duration.

**Why not STACK_ADDITIVE:** would create one instance with a growing magnitude and a single shared timer. STACK_INDEPENDENT lets older buffs decay naturally while new ones come in — closer to the "each hit grants its own grounding" flavor.

### Earth Communion scope

Universal (factor 1.25 multiplies *every* status application from this caster, not just earth-tagged ones). Cost 1.

**Why universal:** the design intent is "a passive that any class going status-heavy wants to equip." Filtering to earth-only would limit it to Earth Mage's own kit, which already has earth-only status applications — the modifier becomes redundant. Universal lets the passive bridge across class lines.

**Cost 1 vs. 2:** dropping from 2 (initial proposal) to 1 makes it a cheap building block. Will be watched for degenerate stacking (e.g., Earth Communion + future "Mediator Lore" + a 70%-base-chance applier → effectively guaranteed). Tunable upward.

## Consequences

- **Hook surface grows by two `modify*` hooks** — `modifyHitChance` and `modifyStatusApplicationChance`. Both are pure-compute, no emission slot.
- **Hook surface grows in return shape for `onTick`** — `OnTickResult` wrapper. Other event hooks (`onApply` / `onRemove` / `onDamage*` / `onActionAttempted` / `onActionTargeted`) still use their pre-session-16 return shapes; they extend to `{ result, emittedActions? }` when their first emission consumer ships.
- **Action union grows by four** — `system_heal`, `system_apply_status`, `status_remove`, `status_decrement_stack`. All are system-emitted; validation is a pass-through.
- **Reaction compiler is the canonical author surface** — Counter is refactored; Earth Resilience flows through it. Future reactions (Water/Fire/Lightning in 18-20) extend `ReactionEffect` and `ReactionTriggerCondition` as needed.
- **Stop and Charging behave differently re: status ticks** — Stop suppresses, Charging doesn't. Other future skip-emitting statuses default to `suppressStatusTicks: true` (Stop's pattern) unless the design calls for the conscious-but-skipping shape.
- **The `'missed'` StatusApplicationOutcome variant** is now part of the union — UI / debug renderers will show it on missed status rolls.
- **Reaction cap accounting limitation for system_apply_status** — apply_status reactions don't currently count against the per-unit-per-turn reaction cap. Unhittable in session 16; session 17 fixes alongside AoE.

## References

- Battle Mechanics Guide — "Status application chance" (line 273), "Hit chance — physical attacks" (hit_modifiers term).
- ADR-0017 — system actions for status side effects (deferred to session 16; this ADR commits the implementation).
- ADR-0021 — Brave-gated reaction trigger; preserved unchanged here.
- ADR-0023 — charged action lifecycle; the charged-resolution status-rider regression test exercises the session 15 path.
- `src/engine/hooks/hooks.ts`, `src/engine/hooks/runners.ts` — new hook signatures and runners.
- `src/engine/status/chance.ts` — status application formula.
- `src/engine/abilities/reaction-compiler.ts` — reaction compiler.
- `src/engine/actions/reducers.ts` — new system-action reducers.
- `src/engine/types/action.ts` — new action variants.
- `src/content/abilities/counter.ts` — refactored to use the compiler.
- `src/content/abilities/earth-{strike,blessing,curse,resilience,communion}.ts` — Earth Mage abilities.
- `src/content/statuses/{regen,movement-debuff,movement-self-buff,blind,silence}.ts` — new statuses.
- `src/content/classes/earth-mage.ts` — Earth Mage class.
- `src/engine/actions/session-16-integration.test.ts` — test coverage.
