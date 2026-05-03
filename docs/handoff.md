# Session Handoff

This is a transient note from one session to the next.

**Discipline:** This document is *overwritten* each session, not appended. When starting a session, read this file and process every item — act on it, promote it elsewhere (ADR, design-doc edit, GitHub issue), or explicitly drop it with a reason. Items do not accumulate. If there are no notes to leave, replace the contents with `_No handoff this session._` so the next session knows the file has been processed.

What belongs here:

- Things noticed but not acted on.
- Implementation choices considered and rejected.
- Suggested scope or sequencing for the next session.
- Watch-for items and open questions that aren't ADR-worthy.

What does *not* belong here:

- Decisions (those are ADRs).
- What changed (that's the commit message).
- System design (that's the design docs).
- Long-running plan (that's `docs/roadmap.md`, if/when it exists).

---

## From session 2026-05-03 (hook system + minimal status)

### Suggested next-session scope

Roadmap session 4: **map and movement.** Concrete deliverables per the design doc:

- `tilesAt(map, x, y)`, `tileAt(map, x, y, layer)`, `unitAt(state, x, y, layer)` accessors per ADR-0002 — `OutOfBoundsError` lands here (ADR-0002 names it; spatial accessors are its first consumers). Move it next to `UnknownEntityError` in `engine/types/errors.ts`.
- `MovementProfile` computation — at this point a class baseline plus passive-bucket modifiers. Equipped passives don't exist yet (session 5); the profile reads only from the class until then. Eventually also a `modifyStatQuery` consumer for `'moveRange'` and `'jump'` — extend `StatName` then.
- Dijkstra pathfinding, range/LoS/AoE shape resolution. Pure functions, no reducer dependency.
- `onMoveStep` runner if movement-modifying statuses (Don't Move, Float, etc.) need to participate. May be deferred to the corresponding status content pass; the hook's signature is already in `HookSignatures`.

The catalog gets one stub class addition (already minimal `{ id: 'knight', name: 'Knight' }` — extend with movement-profile baseline so the movement code has something to read).

### Things noticed during the status session

- **`as` casts in `collector.ts` and `statusHook`.** Two `as` assertions live here, both gated by runtime discriminants the type system can't follow:
  - `collector.ts`: `reg.name === hookName` narrows the union, but TS can't prove K-relative typing through the array iteration. The cast is hidden inside one helper; call sites stay clean.
  - `hooks.ts` `statusHook`: maps `K extends HookName` through to the union member. Cast is at construction.
  Both are safe by construction; the casts trade type-system gymnastics for readability. If this becomes a maintenance issue (e.g., new source kind adds analogous helpers and the casts proliferate), revisit by introducing a generic builder utility.
- **`OutOfBoundsError` is named in ADR-0002 but not yet implemented.** Session 4 (map accessors) is its natural home. When you add it, put it in `engine/types/errors.ts` next to `UnknownEntityError`.
- **`StatusInstance.customState` field exists but no consumer uses it yet.** Charging will (session 7-ish — paired with the Charged Action lifecycle in the reducer). Tests exercise the apply-pipeline acceptance of customState through `applyStatus`'s `customState?` parameter; no read-side test until a consumer arrives.
- **`computeActionSpeed` does not take a `catalog` parameter** while `computeSpeed` does. Asymmetry intentional: `ChargedAction.speed` is canonical (per ADR-0003), modified by abilities at write time, not via a hook chain at read time. If a real use case for "battlefield-wide modifier on Action Speed" lands, revisit — but not now.
- **The `void otherTypes;` line in `apply.ts`** is a deliberate "unused but documented" — `otherTypes` makes the partition phase readable, even though the splice helper that follows recomputes the partition implicitly. With `noUnusedLocals` on we'd otherwise have to delete the line. Refactor candidate if the function gets touched again.
- **`fireOnApply` / `fireOnRemove` take a `StatusEffectType` directly** (not a catalog + typeId pair). Symmetric with `applyStackingRule`. The caller looks the type up once and threads it.

### Things considered but did not do

- **Per-source-kind hook registration unions today** (`EquipmentHookRegistration`, `PassiveHookRegistration`, `ClassHookRegistration`). Considered defining them all now to lock in the shape. Skipped — the per-source `ctx` shape is the only thing that varies, and inventing it without a consumer would be premature. Each lands with its source-kind session.
- **Storing collected handlers as state.** Considered a `(unitId, hookName) → HandlerRef[]` index maintained on apply/remove. Rejected (per ADR-0005's Consequences) — the source-of-truth is `unit.statuses + catalog`; recompute on read is correct by construction at v1 scale.
- **Implementing the `onTick` runner this session.** Tempting since the signature exists. Skipped — no consumer until session 9 (turn loop), and "implement runners with no consumers" violates the same anti-pattern that warns against unused params.
- **Resistance check stub that consumes a seed.** Threading the seed for an empty pipeline step would force an unused-param underscore everywhere. Cleaner to add the parameter when the check actually rolls dice.
- **Splitting `apply.ts` further** (e.g., separate `splice-statuses.ts`). Considered for testability but the splice helper is small enough that inlining keeps the apply pipeline readable in one file. Refactor candidate when more pipeline steps land.

### Open questions for later sessions (not blocking)

- **Status removal granularity.** Today `removeStatus(state, { targetId, typeId })` removes every instance of the type. STACK_INDEPENDENT is the only rule that produces multiple same-type instances; if a future ability needs to dispel "the weakest of the stacked Poisons" or "only the source-X instances," we'll need a richer matcher (predicate? instance-id?). Revisit when a use case exists.
- **`onApply` semantics for STACK_ADDITIVE.** Decided NOT to fire (treated as in-place mutation). Tests verify this. The opposite call (fire onApply because the merged instance is a "new" object) is defensible — flag if a real status's behavior contradicts this choice.
- **Hook context for state access.** Handlers currently get `{ instance }` only. When a handler needs to query state (e.g., "if also poisoned, double damage"), expand the context. Keep changes additive — existing handlers shouldn't see signature changes.
- **`StatName` is closed and currently `'spd'` only.** Session 4 will likely add `'moveRange'` and `'jump'`; session 8 adds `'pa'` / `'ma'` / `'accuracy'` / `'evasion'`. Each addition is one edit; no migration burden for existing handlers.
- **Status durations are stored but never decrement.** Session 9 (turn flow) will own the duration scheduler. Until then, `removeStatus` is the only removal path; tests are written assuming explicit removal.
