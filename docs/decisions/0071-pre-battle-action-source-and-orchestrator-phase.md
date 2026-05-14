## ADR-0071: Pre-battle action-source pattern + orchestrator pre-battle phase

**Status:** Accepted
**Date:** 2026-05-13

## Context

Pre-Session-32, the construction of a battle's initial state did two things outside the action-log:

1. **Equipment auto-status grants.** `createInitialState` called `applyEquipmentStatusGrants` (a private helper in `src/engine/setup/create-initial-state.ts`) which iterated each unit's equipped items and invoked `applyStatus` directly for any `item.statusGrants` entries. Tintinibar's Auto-Regen and Sorcerer's Robe's Auto-Shell (Session 29, ADR-0028) both landed this way. The status instances carry `sourceKind: 'equipment'` so the existing remove-resistance invariant held, but the apply itself never produced a logged action.

2. **Initial-CT randomization.** `placementToUnit` (also in `create-initial-state.ts`) called `resolveInitialCT(ruleset, placement, masterSeed)` to compute per-unit CT and stored the value directly on `unit.ct`. The default ruleset's `uniform_int { 0, 20 }` (ADR-0050) produced per-unit variance from sequence 0, but the variance came from a function applied at setup time — not a reducer pass that the action log could replay.

Both violate CLAUDE.md ground rule 3 ("State changes flow through reducers; never mutate state in place"). The pragmatic shape worked because:
- `createInitialState` is a one-shot constructor, not a runtime path.
- The variance is deterministic given `(masterSeed, unitId)`, so reading the constructed state gives the same answer across runs.

But two consequences accumulated over sessions:

- **The action log lacks the pre-battle initial state.** A replay-from-log reader sees the post-grants state at sequence 0 with no breadcrumbs for *why* a unit has Regen / Shell or *what CT it started at*. For a player UI that surfaces "Tintinibar grants Regen to Blue Knight" as a setup-phase event (alongside other action-log entries), the framing was missing.
- **River Ridge's content authoring will exercise both the auto-status path (more equipment, more grants) and the initial-CT randomization (4v4 makes the wobble more visible).** Folding both onto the reducer surface before River Ridge ships keeps the substrate uniform — no "this came from setup, that came from the reducer" branching at the read sites.

Two further pressures landed alongside:

- **Roadmap S32 entry (Cluster 6 Item 17):** "Reroute `applyEquipmentStatusGrants` to enqueue `system_apply_status` actions through `commitAction` rather than direct state mutation."
- **Brief decision D4:** "Initial CT randomization fold-in: A — fold in as `system_set_ct`. Symmetric with Item 17's grants-as-actions pattern. Replay-deterministic from sequence 0."

This ADR captures the three coupled changes: a new optional `context` discriminator on `SystemApplyStatusPayload` for attribution, a new `system_set_ct` action type for absolute CT setting, and an orchestrator pre-battle phase that commits these actions through `commitAction` before turn 0 fires.

## Decision

**Three structural changes; all engine-internal, plus one orchestrator change:**

**(1) New optional `context` field on `SystemApplyStatusPayload`.** A discriminated union for action-envelope provenance, distinct from the existing `(sourceUnitId, sourceActionSeq)` pair that still flows through `applyStatus`:

```ts
export type SystemApplyStatusContext = {
  readonly kind: 'pre_battle_equipment';
  readonly itemId: ItemId;
};
```

When the reducer (`reduceSystemApplyStatus`) sees `context.kind === 'pre_battle_equipment'`, it threads `sourceKind: 'equipment'` + `sourceEquipmentId: context.itemId` into the `applyStatus` call. The resulting status instance carries `source.kind === 'equipment'` so the ADR-0028 in-battle-remove gate stays load-bearing.

The action-log formatter reads `context` to render attribution: "Tintinibar grants Regen to Blue Knight" with an `[init]` tag, distinct from the in-battle `[tick]` tag used by reaction-emitted applies.

**(2) New `system_set_ct` action type.** Absolute-CT setting, distinct from the delta-based `system_ct_push` (Water Strike, Tidal Pull, etc.):

```ts
export interface SystemSetCtPayload {
  readonly targetId: UnitId;
  readonly ct: number;       // absolute; clamped to [0, TRIGGER_THRESHOLD - 1]
  readonly source: SystemSetCtSource;
}
export type SystemSetCtSource = { readonly kind: 'initial_ct' };
```

The `source` sub-discriminant is open to extension — future content / debug surfaces that want absolute-CT manipulation extend the union without inventing a parallel action type. v1 producer is the orchestrator's pre-battle phase emitting `kind: 'initial_ct'`.

The reducer (`reduceSystemSetCt`) clamps the requested value to `[0, TRIGGER_THRESHOLD - 1]` (no unit can start pre-triggered; the scheduler is the only path that lifts CT to ≥ 100). Outcome records the post-clamp value and the previous CT; the action-log formatter renders "Blue Knight enters battle at CT 18" with the same `[init]` tag.

**(3) `enumeratePreBattleActions(state, battleConfig, catalog) → ReadonlyArray<ProposedAction>`.** A new pure helper in `src/engine/setup/create-initial-state.ts`. Returns the deterministic action queue:

- First: `system_apply_status` actions, one per equipped item × `item.statusGrants` entry, in iteration order of `state.units.values() × iterateEquippedItems(unit, catalog) × statusGrants`. Each carries `context: { kind: 'pre_battle_equipment', itemId: item.id }`.
- Second: `system_set_ct` actions, one per unit lacking an explicit `placement.initialCT` (the explicit override wins; authoring choices are immutable). Each carries `source: { kind: 'initial_ct' }` with the value resolved via `resolveInitialCT(ruleset, placement, masterSeed)`.

`resolveInitialCT` moves to its own file (`src/engine/setup/initial-ct.ts`) so the helper can call it without pulling the full setup module's surface; the implementation is unchanged.

The setup index also exports a one-shot `runPreBattlePhase(state, battleConfig, catalog) → newState` convenience that commits each enumerated action through `commitAction` and returns the post-pre-battle state. Tests bypassing the orchestrator use this; the orchestrator drives the queue one-action-per-step for animation pacing.

**(4) `DemoOrchestrator` constructor takes an optional `preBattleActions` argument.** Default `[]`. On `step()`, the orchestrator drains the queue one action per step before the existing scheduler-advance branch fires. Pre-battle commits go through the same `commitAction` path as scheduler-emitted commits — failures throw (programmer error). The pump's existing per-step animation cycle works unchanged; pre-battle entries appear in `step.committed` like any other action.

`createInitialState` no longer applies equipment grants and no longer computes ruleset-derived CT in `placementToUnit`. Bare `createInitialState` returns a state with `unit.ct = 0` for units without explicit `placement.initialCT` and no equipment-granted statuses. Callers compose the pre-battle phase via `enumeratePreBattleActions` (orchestrator) or `runPreBattlePhase` (one-shot).

## Rationale

**Sub-discriminant on `SystemApplyStatusPayload` over a new top-level `source` variant.** The brief's D2 surfaced two shapes: (A) extend `ActionSource` to `'player' | 'system' | 'pre_battle_equipment'`, vs. (B) keep `source: 'system'` and add a `context` payload field. Option B wins: pre-battle equipment grants are conceptually system-issued (the engine emits them at setup, not a player click), so widening the top-level source surface for attribution would inflate the action shape for every consumer that switches on `source`. The payload-level `context` field carries the same information, omitted in the existing reaction-emit paths (where the unit-id pair is sufficient), and the action-log formatter is the only consumer that branches on it.

**`system_set_ct` as a new action type over reusing `system_ct_push` with `delta = ct - 0`.** A delta from a known zero baseline would work mathematically — the engine state's `unit.ct` is 0 before the pre-battle phase fires — but the framing is wrong. "Set initial CT to 18" is what's happening; "push CT by +18" reads as a runtime nudge, conflating the setup-phase event with Water Strike's damage-rider push or Tidal Pull's reaction emission. The new type is small (one payload + outcome interface, one reducer, the dispatch wiring). The cost of authoring it once is lower than the cost of every future reader inferring "this `+N` push at sequence 0 is actually the initial-CT randomization."

**Separate orchestrator phase over inline-in-`createInitialState`.** The brief's D3 surfaced two shapes: (A) `createInitialState` runs the pre-battle action queue synchronously and returns a post-pre-battle state, vs. (B) `createInitialState` returns a raw state and the orchestrator runs the queue. Option B wins for two reasons:

- CLAUDE ground rule 3 alignment: state changes flow through the reducer. `createInitialState`'s job is *constructing the BattleConfig-derived state*, not *applying side effects*. The pre-battle phase is side-effecting (action-log entries, status instances landing) and belongs on the orchestrator's surface.
- Animation pacing: the orchestrator pumps actions one-per-step so the renderer can animate. A pre-battle equipment grant should appear in the action log + status badges should pop on the units in the same per-step rhythm as any other action. Bundling them into a synchronous initialization would skip that visual cadence.

**Explicit `placement.initialCT` short-circuits the queue.** Authoring explicit CT (test fixtures, scripted scenarios) shouldn't produce a redundant log entry. `placementToUnit` continues to honor the explicit value, and `enumeratePreBattleActions` skips units whose placement set an explicit value. The action log for a battle with all-explicit-CT placements contains zero `system_set_ct` entries; for a battle with the production ruleset's `uniform_int { 0, 20 }` it contains one per unit. Both replay deterministically.

**Equipment-source threading in `reduceSystemApplyStatus`.** Without it, the rerouted apply would produce a status instance with `source.kind: 'reaction'` (or similar default) instead of `'equipment'`, and the ADR-0028 in-battle-remove gate would no longer fire — playtest would notice a regression on Auto-Haste / Auto-Regen / Auto-Shell. The reducer reads `context.kind === 'pre_battle_equipment'` and threads `sourceKind: 'equipment'` + `sourceEquipmentId: context.itemId` to `applyStatus`. The two paths (direct-`applyStatus` from a reaction; rerouted-via-action from pre-battle) end at the same final status-instance shape.

**One-shot `runPreBattlePhase` helper.** Bypassing the orchestrator entirely is a real use case: integration tests that build state by hand, run a scenario, and inspect the result. Those tests don't want to drive the orchestrator's full step loop just to settle the pre-battle phase. The helper takes `(state, battleConfig, catalog)` and returns `newState` after committing each enumerated action.

## Consequences

- **Action log captures the pre-battle phase from sequence 0.** A replay reader sees `system_apply_status` (Tintinibar → Regen, Sorcerer's Robe → Shell, etc.) and `system_set_ct` (per-unit initial CT) before the first `turn_start`. The action-log UI renders these with `[init]` tags so the setup events are visually distinct from in-battle effects.
- **Test fixtures that bypass the orchestrator must opt into the pre-battle phase.** `initial-ct-variance.test.ts` shadows `createInitialState` with a wrapper that calls `runPreBattlePhase`. `session-17c-integration.test.ts`'s `buildBattle` helper does the same. `create-initial-state.test.ts`'s "ruleset CT" test asserts the two-step shape (ct = 0 at construction; ct = N after `runPreBattlePhase`). Other tests don't depend on equipment statuses or ruleset CT and are unchanged.
- **`DemoOrchestrator` constructor signature widens with an optional fourth argument.** Existing callers pass `[]` (or nothing); the orchestrator's behavior is byte-identical pre-S32 when the queue is empty. The demo's `BattleView.tsx` (and the AI integration test) compute the queue via `enumeratePreBattleActions` and pass it in.
- **Action-log formatter has new cases.** `system_apply_status` branches on the optional `context` field for pre-battle attribution; the existing reaction-emit path is unchanged (no `context` → render with `[tick]` tag like before). New `system_set_ct` case renders "X enters battle at CT N" with the `[init]` tag. Exhaustiveness `never` cast catches the next action type that ships without a formatter.
- **`createInitialState` is now smaller.** ~50 lines of equipment-grant + CT-resolve code moved to the orchestrator/helper paths. The construction step is purer (no pipeline calls, no status applies).
- **Replay determinism preserved.** `resolveInitialCT` is unchanged; the per-unit-stable variance produces the same draws given the same `(masterSeed, unitId)`. The action log is now a longer initial segment (N grants + M `system_set_ct` entries before the first scheduler emission), but each entry is deterministic.
- **`fillVitalsFromComputedMaxes` continues to run inside `createInitialState`.** Equipment contributors that adjust `maxHp` / `maxMp` (Wizard's Robe +40 maxMp, Staff of Abundance × 1.5 maxMp, etc.) are registered by equipment slot, not by status, so they fire correctly against the post-construction state even though the equipment-granted statuses haven't applied yet. Vitals lifted to per-frame `runModifyStatQuery` in the renderer (per ADR-0058 maxMp + Session 31.5 maxHp) compose the same way.
- **Tests at 859 pre-32 → 887 post-32.** +28 new tests across pathfinding (10 leap-edge tests), knockback (1 ridge-into-water primitive test), session-32-integration (1 end-to-end knockback test), default-ruleset (1 structural-equivalence + 1 postFinalize assertion), orchestrator (3 pre-battle drain / replay-determinism / empty-queue tests), and cliff-edge-layer (12 thickness/darken/edge unit tests). 0 failing.

## Alternatives considered

**Carry the pre-battle phase inside `createInitialState`.** Considered (brief D3 option A). Rejected: violates CLAUDE ground rule 3 (state changes flow through reducers) and bundles the orchestrator's per-step animation pacing into a synchronous initialization step.

**Skip the `context` field; let action-log formatter infer equipment provenance from the status instance's `source.kind === 'equipment'`.** Considered. Rejected: the action-log formatter reads action payloads, not the resulting status instances on the unit. Reading from the unit at format-time would require a state snapshot per row — over-engineered for the framing benefit.

**Reuse `system_ct_push` for initial CT with `delta = ct - 0`.** Considered. Rejected as semantic noise — see Rationale.

**Make `applyEquipmentStatusGrants` synchronous + log a marker action.** Considered (a synthetic action that records "applied N equipment grants" without each individual apply going through the reducer). Rejected: half-measure that doesn't actually solve "state changes flow through reducers" and loses per-grant attribution in the log.

**Pass `BattleConfig` into the orchestrator constructor.** Considered (orchestrator computes `enumeratePreBattleActions` lazily on first step). Rejected: orchestrator's job is to drive the engine forward; the BattleConfig is a construction-time concern. Stashing it for one lazy use bloats the orchestrator's surface.

**Stash the pre-battle queue on `GameState`.** Considered (`state.pendingPreBattleActions`). Rejected: state describes "what is true now," not "what's queued." Per-orchestrator pending state belongs on the orchestrator.

## References

- `src/engine/types/action.ts` — `SystemApplyStatusContext`, `SystemSetCtPayload`, `SystemSetCtOutcome`, `SystemSetCtSource`; `ActionType`, `ActionOutcome`, `Action`, `ProposedAction` extensions.
- `src/engine/actions/reducers.ts` — `reduceSystemApplyStatus` threads equipment source from `context`; new `reduceSystemSetCt`.
- `src/engine/actions/reduce.ts` — dispatch for `system_set_ct`.
- `src/engine/actions/validate.ts` — passthrough validation for `system_set_ct`.
- `src/engine/actions/commit.ts` — envelope construction + actor-id suppression for `system_set_ct`.
- `src/engine/setup/create-initial-state.ts` — `enumeratePreBattleActions`, `runPreBattlePhase`; `placementToUnit` defers ruleset CT; `applyEquipmentStatusGrants` removed.
- `src/engine/setup/initial-ct.ts` — `resolveInitialCT` lifted out for the orchestrator's use.
- `src/app/demo/orchestrator.ts` — pre-battle queue drain in `step()`; constructor takes optional `preBattleActions`.
- `src/app/BattleView.tsx` — computes queue at mount, passes into orchestrator.
- `src/ui/action-log-format.ts` — `[init]` tag for `system_apply_status` (when `context.kind === 'pre_battle_equipment'`) + `system_set_ct`; `safeItemName` helper.
- `src/app/demo/orchestrator.test.ts` — pre-battle drain + replay determinism + empty-queue regression tests.
- `src/engine/setup/initial-ct-variance.test.ts` — wraps `createInitialState` with `runPreBattlePhase`.
- `src/engine/setup/create-initial-state.test.ts` — ruleset-CT assertion split: ct=0 at construction; ct=N after pre-battle.
- `src/engine/actions/session-17c-integration.test.ts` — `buildBattle` helper threads `runPreBattlePhase`.
- ADR-0028 — equipment status grants + remove-resistance invariant (preserved).
- ADR-0050 — `uniform_int { 0, 20 }` initial-CT formula (preserved; emission moves to pre-battle phase).
- ADR-0058 — `maxMp` first-class stat + per-frame stat-query read (preserved; vitals fill still runs at construction).
- ADR-0064 — `attackProcContributor` + `UseAbilityRiderSource` (preserved; rider provenance unchanged).
- ADR-0065 — `onFinalDamage` + `system_mp_drain` (preserved).
- ADR-0069 — pipeline stage re-ordering (preserved; orchestrator step shape unchanged otherwise).
- ADR-0070 — orchestrator rejection over throw (preserved; pre-battle commit failures still throw because they're engine-internal and indicate programmer error).
