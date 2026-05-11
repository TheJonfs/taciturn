# ADR-0055 — Charged-action timing forecast via CT schedule walk

**Status:** Accepted (Session 26.5, 2026-05-11)

**Context.** Pre-26.5 the forecast surface for charged abilities computed `ticksToResolve` with a naive formula:

```typescript
// src/ui/forecast-compose.ts (pre-26.5)
const speed = Math.max(1, computeSpeed(state, caster.id, catalog));
const ticksToResolve = Math.ceil(ability.actionSpeed / speed);
```

Two errors live in that formula:

1. **Misinterprets `actionSpeed`.** The engine's reducer creates charged actions with `chargedAction.speed = ability.actionSpeed` ([reducers.ts:351](src/engine/actions/reducers.ts:351)) — `actionSpeed` is the climb-rate, not a threshold. The naive formula divides actionSpeed by caster speed as though it were a tick count.
2. **Ignores other in-flight charges.** A faster charge in flight will resolve first, reshape the CT schedule (its speed-tick advances all entities), and shift the hypothetical's resolve later. The formula never looks at `state.chargedActions` at all.

A parallel naive computation existed in [charged-action-detail-panel.tsx:106](src/ui/charged-action-detail-panel.tsx:106) using `Math.ceil((100 - charged.ct) / charged.speed)`. Less wrong (interprets speed correctly) but still ignores other in-flight charges.

Both surfaces feed the same "✦ resolves in N ticks" / "✓ resolves before target's next turn" line in the forecast UI. Player-facing accuracy here matters: a wrong tick count moves the ✓/✗ indicator into wrong-answer territory and undermines the projection-column's promise.

**Decision.** Replace both naive computations with a single engine-side helper that drives the existing CT schedule walker.

**1. New engine module.** `src/engine/forecast/charged-timing.ts` exports `estimateChargedTiming({ state, catalog, caster, ability, anchor, concernedUnitId?, horizon? }): ChargedTimingResult | null`. The function:

- Synthesizes a hypothetical `ChargedAction` with `ct: 0, speed: ability.actionSpeed` matching what `reduceUseAbility` would commit. Sentinel id `__forecast_preview__` so it's findable in the projection output.
- Spreads it into a hypothetical state: `{ ...state, chargedActions: [...state.chargedActions, hypothetical] }`. Engine state is immutable; a shallow spread suffices.
- Calls `projectUpcoming(hypotheticalState, horizon, catalog)` — the existing walker (ADR-0003) advances all entities (units + charges) tick-by-tick, resolves trigger ties per the documented order, and outputs a chronological event list.
- Finds the sentinel by id; its `ticksFromNow` is the accurate `ticksToResolve`, its index is `eventsBeforeResolve`.
- Trims a ~7-event window around the resolve for the forecast mini-timeline (item #7 / surrounding-events feature).
- Walks for the concerned unit's next turn (typically the target) and emits the `resolvesBeforeTargetTurn` flag.

Returns `null` when the action's speed is 0 (paused / actionSpeed=0) — callers render a "stalled" state rather than a misleading tick count.

**2. Symmetric post-commit lookup.** `projectChargedResolution` ([ct-preview.ts](src/engine/forecast/ct-preview.ts)) — already-existing from Session 24.5 — does the same walk for an already-in-flight charged action. Session 26.5 extends its return shape with `eventsBeforeResolve: number` (the full-projection index, not the trimmed window-relative one) so the detail panel (`charged-action-detail-panel.tsx`) gets the same accurate count via the same walker. The detail panel now uses `projectChargedResolution`; the naive `(100 - charged.ct) / charged.speed` remains only as a fallback for the (rare) case where the action falls outside the projection horizon.

**3. UI as a thin caller.** `forecast-compose.ts:estimateChargedTiming` reduces to a wrapper that picks the concerned target from the AoE preview and delegates to the engine helper. The `ChargedTiming` shape grows two fields — `surroundingEvents` + `resolutionIndex` — so item #7's mini-timeline render reads pre-computed data without recomputing the walk.

**Consequences.**

- **Timing forecast becomes correct under multi-charge contention.** A second-cast Maelstrom-after-Tide-Surge now reflects that Tide Surge would resolve first and shift the schedule. Pre-26.5 both reported the same naive ticks.
- **The forecast Timing line and the detail-panel Timing section agree** — they call into the same walker. Pre-26.5 they computed independently and could disagree if the action was mid-flight (one used commit-time prediction, the other used in-flight prediction).
- **Stop-status charged actions are now non-projectable.** `actionSpeed ≤ 0` returns `null`. Forecast suppresses the Timing section in that case. Pre-26.5 the naive formula would have returned `Infinity` or `0` — both misleading.
- **`ChargedResolutionProjection` gains `eventsBeforeResolve`.** Backward-compat for callers that read only `resolutionEvent` + `surroundingEvents` + `resolutionIndex`; the new field is additive.
- **Walker cost.** `projectUpcoming` is O(horizon × entities) per call. For a 20-event horizon and a typical 6-unit / 1-charge state, this is ~140 simple compare/advance operations per forecast composition — well under one frame. Forecast composition already runs on each hover-change; no new perf pressure.

**Alternatives considered.**

- **Add a parameter to `projectUpcoming`** like `additionalEntities: SimEntry[]` so callers can ask "project as if X were also in the queue" without state cloning. Rejected — shallow-spreading `chargedActions` is one allocation and a cleaner caller story. The walker's internals stay focused on real state.
- **Compute the timing fully in the UI.** `forecast-compose.ts` could keep doing the math directly. Rejected — duplicates the walker's tie-break logic, and ADR-0042 puts forecast computations at the engine boundary so AI tier-3 (Phase B) can read the same answers.
- **Skip the post-commit detail-panel rewrite** (only fix the pre-commit forecast). Rejected — the two surfaces disagreeing on tick counts is exactly the kind of "polished surface, broken substrate" gap that produces playtest confusion. One algorithm, two callers.
- **Use `projectChargedResolution` for both surfaces.** It already finds a charged action in the projection. Doesn't work pre-commit because the action isn't in state yet. The two helpers are symmetric: `estimateChargedTiming` for pre-commit (constructs hypothetical), `projectChargedResolution` for post-commit (reads real). Both terminate in the same walker output shape.

**Notes for next sessions.**

- The same hypothetical-state pattern could power "what if I waited a turn before casting?" forecasts. Not needed v1 but a clean extension.
- A future absorption-or-amplification mechanic ("charges climb at variable rate per stack") would adjust the hypothetical's `.speed` on construction; the walker is unchanged.
- The `eventsBeforeResolve` field on `ChargedResolutionProjection` is the same number that `estimateChargedTiming` returns — the two functions are deliberately parallel.

**References.**

- Session 26.5 brief: `docs/twentyOnePlanning/session-26-5-brief.md` (item #3).
- New module: [`src/engine/forecast/charged-timing.ts`](../../src/engine/forecast/charged-timing.ts).
- Tests: [`src/engine/forecast/charged-timing.test.ts`](../../src/engine/forecast/charged-timing.test.ts) (6 cases including multi-charge contention + before/after target's turn).
- Consumers updated: [`src/ui/forecast-compose.ts`](../../src/ui/forecast-compose.ts) (pre-commit), [`src/ui/charged-action-detail-panel.tsx`](../../src/ui/charged-action-detail-panel.tsx) (post-commit).
- Related: ADR-0003 (charged-action shape + projection), ADR-0023 (charged-action lifecycle), ADR-0042 (forecast pipeline at engine boundary), ADR-0047 (charged-action detail panel).
