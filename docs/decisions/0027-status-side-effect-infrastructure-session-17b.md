## ADR-0027: Status side-effect infrastructure for session 17b — system_damage, permanent_per_unit_ct, onDamageReceived emission, isReaction

**Status:** Accepted
**Date:** 2026-05-06

## Context

Session 17b ships Earth Mage's AoE/Ultimate plus four new statuses (non-expiring Poison, Don't Act, Don't Move, plus formal content application of Stop). Each touches a small piece of engine infrastructure that ADR-0024 anticipated but didn't ship in session 16:

1. **Poison's per-tick damage** needs a `system_damage` action — the symmetric counterpart to ADR-0024's `system_heal`, used for emission-driven damage that bypasses the seven-stage pipeline (no variance, no Faith, no Counter).
2. **Poison's "non-expiring" duration** needs a representation that ticks at unit CT *but never decrements*. The five existing duration modes don't capture it (`per_unit_ct` requires a duration; `permanent` doesn't fan out to status_tick).
3. **`onDamageReceived` emission shape extension** — ADR-0024 deferred this until a v1 consumer ships; Sleep's wake-on-damage is the canonical worked example. v1 doesn't ship Sleep, but the shape extension lands here so 17b's content can opt in (and so future Sleep can plug in cleanly).
4. **Don't Act allowing reactions** — `onActionAttempted` fires for both volitional UseAbility actions and reactions. Don't Act blocks "the unit's volition" but reactions are reflexive — the runner needs to communicate the distinction.

## Decisions

### `system_damage` system action

Symmetric to `system_heal` (ADR-0024) but in the damage direction:

```typescript
SystemDamagePayload {
  targetId: UnitId;
  amount: number;                    // pre-computed by emitter
  tags: ReadonlyArray<DamageTag>;    // recorded for log/debug
  source: SystemDamageSource;        // provenance
}
SystemDamageOutcome {
  kind: 'system_damage';
  targetId: UnitId;
  amount: number;
  applied: number;                   // post-floor-at-0 delta
}
SystemDamageSource =
  | { kind: 'status_tick'; statusTypeId; unitId }    // Poison-style
  | { kind: 'falling'; unitId; dropDistance };       // ADR-0026 falling damage
```

The reducer applies damage to the target's vitals (floor at 0), KO'd targets are silent no-ops, missing targets are silent no-ops. Bypasses `validateAction` like other system actions.

**No reaction trigger:** `system_damage` does **not** fire `onActionTargeted`. Counter doesn't trigger from Poison ticks or falls. Reactions are deliberately scoped to use_ability incoming actions. Future consumers wanting "react to Poison damage" register on a different (yet to be added) hook.

**Why not route through the damage pipeline:** the pipeline is built around an attacker/ability/target triple — Poison has no attacker (the ticker isn't the source unit anymore), no ability (the source ability cast may be many turns ago), no Faith composition (the BMG-faithful behavior is "Poison damages flatly per tick"). Plumbing those through the pipeline as null/sentinel values would invite null-safety bugs and obscure the "this is a status side effect, not an attack" semantics. The dedicated reducer is one branch, ~30 lines, structurally honest.

### `permanent_per_unit_ct` duration mode

A new value joins the `DurationMode` union: a status that *ticks* at the unit's CT cadence (so its `onTick` fires at every CT-100 trigger of the unit) but **never expires** (its `remainingDuration` is `null`, so `reduceStatusTick`'s decrement branch is skipped).

The semantics are the orthogonal product of `per_unit_ct` (cadence) and `permanent` (no expiry). v1's first consumer is non-expiring Poison; future "perma-buff while equipped" passives can use the mode (though equipment integration in 17c will likely use a different mechanism).

**Touched code:**

- `src/engine/types/duration-mode.ts` — adds the new variant.
- `src/engine/status/apply.ts` `computeInitialDuration` — returns `null` for `permanent_per_unit_ct` regardless of the requested duration.
- `src/engine/actions/reducers.ts` `reduceTurnStart` — `permanent_per_unit_ct` joins `per_unit_ct` in the status_tick fan-out.
- `reduceStatusTick`'s null-duration branch already handles "don't decrement, don't expire" — no change.

**Why not a flag (`nonExpiring: boolean`) on the StatusEffectType:** would silently change the semantics of `per_unit_ct` based on a separate field. New duration mode keeps the contract on a single axis (the mode declaration), which is read by every site that branches on duration semantics.

**Why not just `permanent` mode + an extra emission rule:** would require `reduceTurnStart` to fan out status_tick for *every* status type with an onTick handler — coupling the apply pipeline's mode declaration to the runtime tick fanout in a non-obvious way. The new mode keeps the fanout rule local to "modes ending in _ct fan out at turn_start."

### `onDamageReceived` emission shape extension

`OnDamageReceivedResult = { ctx: DamageContext; emittedActions?: ReadonlyArray<ProposedAction> }`. The runner (`runOnDamageReceived`) collects emissions across all firing handlers and returns them alongside the final ctx.

**Backward compatibility:** the runner accepts both shapes — handlers returning a bare `DamageContext` are wrapped to `{ ctx, emittedActions: undefined }`. v1's existing handlers (none consume the emission slot today) stay unchanged.

**Caller integration:** the damage pipeline orchestrator threads the `emittedActions` upward to the reducer via the existing `generatedActions` wiring. `reduceUseAbility` appends the pipeline's emitted actions to its `generatedActions` field.

**Worked test fixture:** a `'sleep'`-typed status registered via `statusHook('onDamageReceived', ...)` whose handler emits a `status_remove` action against itself when the incoming damage > 0. v1 doesn't ship Sleep as content, but the test fixture proves the pattern end-to-end: Sleep on a unit + incoming damage → Sleep removed in the same chain.

**Why now and not when Sleep ships:** Sleep is on the design board for session 18+ but the shape is small (~15 LOC change to runner + pipeline) and lands cleanly without a content consumer. Waiting until Sleep ships forces session 18 to do this infrastructure inline; landing it in 17b decouples the content session from the engine extension.

### `isReaction` flag on `onActionAttempted` runner

The runner gains an additional arg: `isReaction: boolean`. The flag is forwarded to handler args (`HookSignatures.onActionAttempted.args`). Don't Act's handler reads it: when `isReaction === true`, the handler returns `{ kind: 'allowed' }` regardless of the action type.

Counter (and any future reaction) consequently fires on a Don't-Act-afflicted reactor. The narrative justification: "reactions are reflexive, not volitional."

**Touched code:**

- `src/engine/hooks/hooks.ts` — `onActionAttempted` args gain `isReaction: boolean`.
- `src/engine/hooks/runners.ts` `runOnActionAttempted` — accepts and forwards the flag.
- `src/engine/actions/commit.ts` `runPreHook` — passes `entry.isReaction` through.
- `src/content/statuses/dont-act.ts` — handler reads the flag.

Silence's existing handler ignores the flag (Silence still blocks magical/voice reactions). Stop's handler ignores the flag (Stopped units don't get turns to react in the first place — `queryTurnSkipped` short-circuits). Charging's handler ignores the flag (only relevant at charged-action resolution, where the flag is `false` because the charged-resolution proposal isn't a reaction).

**Why a flag, not a separate hook:** the existing hook is the right gate (pre-resolution, returns block/allow/replace). A separate "react gate" hook would duplicate Silence's tag-checking logic and create two parallel surfaces handlers must register on. The flag is one bit, threaded through the existing surface.

## Consequences

- **Action union grows by one** — `system_damage` joins the system-emitted set. `validateAction` passes through; reducer applies HP delta with floor-at-0; KO'd / missing targets are silent no-ops.
- **DurationMode union grows by one** — `permanent_per_unit_ct`. Apply pipeline returns null duration; turn_start fans out status_tick. `reduceStatusTick` already handles null-duration ticks.
- **`onDamageReceived` return shape changes to `OnDamageReceivedResult`** — backward-compatible (legacy handlers' bare-ctx return is wrapped). Pipeline routes emissions to `generatedActions`.
- **`onActionAttempted` args gain `isReaction: boolean`** — handlers that don't care ignore it; Don't Act gates on it.
- **No changes to the closed hook list count** — same 11 hooks. This ADR only extends existing hooks, not adds new ones.
- **Reactions on Don't Act-afflicted units fire** — Counter remains lethal even on a fully shut-down target, matching the "reflex vs. volition" design intent.
- **Falling damage shape (ADR-0026) plugs into `system_damage`** — same reducer handles Poison ticks and falls.

## Future work

- **Sleep status** — the worked test fixture validates the pattern. When Sleep ships as content (session 18+ tentative), the formal status type lives in `src/content/statuses/sleep.ts` and the test fixture is removed (or kept as a minimal regression).
- **System_damage variance** — flat formula today. If a future status (Burn?) needs random per-tick damage, the variance roll lands on the emitter side (handler computes the rolled amount and emits a final number), not in the reducer.
- **Reaction-cap accounting on system_damage** — N/A today (system_damage doesn't trigger reactions). If a future hook lets reactions trigger on system damage, the cap accounting follows the existing reactorId pattern (ADR-0024 fix from 17a).
- **Knockback as a hookable side effect** — ADR-0026's primitive is callable but not yet a hook. When a passive needs "modify knockback distance" or "soften falls," the engine extension lands then.

## References

- ADR-0024 — `system_heal`, `system_apply_status`, `status_remove`, `status_decrement_stack`. This ADR adds `system_damage` in the same family.
- ADR-0026 — falling damage uses `system_damage` as its delivery.
- BMG, "Status effects" — Poison damage formulation (per-tick fraction of MaxHP).
- BMG, "Status effects" — Don't Act / reaction interaction (reflexive vs. volitional).
- `src/engine/types/action.ts` — `system_damage` payload + outcome.
- `src/engine/actions/reducers.ts` — `reduceSystemDamage`, `reduceTurnStart` updates.
- `src/engine/types/duration-mode.ts` — `permanent_per_unit_ct` variant.
- `src/engine/status/apply.ts` — `computeInitialDuration` update.
- `src/engine/hooks/hooks.ts`, `src/engine/hooks/runners.ts` — emission shape and isReaction flag.
- `src/content/statuses/poison.ts`, `src/content/statuses/dont-act.ts`, `src/content/statuses/dont-move.ts` — content consumers.
- `src/engine/actions/session-17b-integration.test.ts` — worked tests including the Sleep-pattern fixture.
