# Adding a new `ActionType` — five-sites wiring checklist

When you add a new variant to the `ActionType` discriminant, you must wire it through **five** sites in lockstep. The TypeScript `never`-typed exhaustive switches catch four of them at compile time — but the fifth (the animator) only fails at runtime, when the new action is actually committed in a live battle. A test suite that exercises the action's reducer and outcome will pass without ever hitting the animator, so the failure shows up only in browser playtest as `Animator.buildAnim: unhandled action type "..."`.

This was the bite that softlocked Chris's first Throw Item playtest in S39b: the engine and log accepted the action; the animator didn't, and the game black-screened. The same shape will happen for any future ActionType added without all five sites updated together.

## Checklist

When adding a new `ActionType` discriminant value, add a case at each of these sites:

1. **`src/engine/actions/validate.ts`** — add a `case` (typically a pass-through for system actions, or a real validator for player actions). The `default` is `never`-typed; TS catches the miss at compile time.

2. **`src/engine/actions/reduce.ts`** — dispatcher (the function that routes by `action.type` to its specific `reduce*` reducer). Same `never` exhaustiveness check.

3. **`src/engine/actions/commit.ts`** → `envelopeFor` — builds the action envelope by narrowing on `type`. Also `never`-typed.

4. **`src/ui/action-log-format.ts`** — formatter case. Return `[]` if the action shouldn't surface in the log (system bookkeeping); return formatted rows otherwise. `never`-typed default.

5. **`src/renderer/animator.ts`** → `buildAnim` — **this is the one that crashes the live game if missed.** The `assertNever` guards at compile time, but tests don't trip it unless they specifically run the animator through the new action. Most reducer tests don't.

When in doubt, search for an existing action that shares the same animation shape and add a parallel case (e.g. `use_throw_item` mirrors `use_ability`'s `buildFlashFromTargets` shape; the S39b polish commit added five animator cases at once — `use_compound`, `use_throw_item`, `system_mp_restore`, `system_ko_tick`, `system_unit_removed` — none requiring new animation primitives, just dispatch wiring).

## Why TypeScript doesn't fully catch it

Sites 1–4 are pure switch dispatchers: every code path that processes an action visits the switch, so an unhandled variant produces an immediate type error or a thrown `assertNever`. The animator is different — `buildAnim` is invoked only when an action is committed *and* the renderer is alive. Test coverage that drives `commitAction` against a state without instantiating a `BattleRenderer` never reaches it. The `assertNever` exists in `buildAnim`, but it fires at runtime, not at type-check time.

## A future smoke-test could close the gap

A possible future polish item: a renderer-side smoke test that drives every `ActionType` through `buildAnim` with mock state. Not in scope for any single session that *adds* an action, but a one-time investment that would convert this runtime gap into a CI failure.

## Related ADRs

- ADR-0064 (attack proc emission) — added `system_apply_status` consumer paths.
- ADR-0076 (permadeath timer) — added `system_ko_tick` and `system_unit_removed`.
- ADR-0077 (consumables) — added `use_compound`, `use_throw_item`, `system_mp_restore`.

Each of those sessions had to update all five sites. The S39b miss was on the renderer-side path for the consumables ADR; the polish commit closed the gap and the convention here was extracted from that experience.

## What this doc is for

This is a process checklist, not a system-design document. The list of `ActionType` discriminants and their semantics live in `src/engine/types/action.ts`. The five sites are *implementation discipline* — places that must stay in lockstep with the discriminant. Update this doc only if the set of lockstep sites changes (e.g., a sixth site emerges, or one of the existing five is restructured).
