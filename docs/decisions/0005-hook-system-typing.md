## ADR-0005: Hook system typing pattern

**Status:** Accepted
**Date:** 2026-05-03

## Context

`docs/design/status-effects.md` defines a shared hook surface used by statuses, equipped passive abilities, equipment, and class traits. Each hook is "a named extension point with a defined signature" — `modifyStatQuery` returns a number, `onApply` returns void, `onDamageReceived` modifies a damage object, etc.

Session 3 lands the hook system. Statuses are the first source kind to register handlers, and `modifyStatQuery` (driving Haste's effect on Speed) is the first runner. Sessions 4–9 add the rest of the consumers: `onTurnStart` / `onTurnEnd` for turn flow, `onDamageReceived` / `onDamageDealt` for the damage pipeline, `onActionAttempted` / `onActionTargeted` for action validation and reactions, `onMoveStep` for movement, etc.

The shape of how handlers are *typed* propagates everywhere a hook is registered or invoked. Every status definition in `src/content/statuses/` will use it; every future runner site will use it; AI / UI code that introspects hooks will read it. Picking the wrong representation now means visiting every consumer to fix it later.

The plausible options:

1. **A single hook signature.** `(name: string, args: unknown) => unknown`. All handlers conform; runners cast at call sites. Fewest types, most casts.
2. **A discriminated union over `name`, with each arm carrying its own typed handler.** Compile-time exhaustiveness; per-hook signatures live in one map.
3. **A polymorphic class hierarchy** — `Hook<TArgs, TReturn>` with subclasses per kind. OO-flavored; fits poorly with TypeScript's structural model and the data-first style elsewhere in the engine.
4. **Decoupled per-hook handler types with no central registry.** Each hook's signature is its own type, registered by the status as one of N possible shapes. Easy to add new hooks; harder to enumerate them and verify exhaustiveness.

## Decision

**Option 2: a `HookSignatures` map plus a discriminated registration union.**

```typescript
// engine/status/hooks.ts
interface HookSignatures {
  modifyStatQuery: {
    args: { unit: Unit; statName: StatName; baseValue: number };
    return: number;
  };
  onApply: { args: { unit: Unit }; return: void };
  onRemove: { args: { unit: Unit }; return: void };
  // ... one entry per hook listed in status-effects.md
}

type HookName = keyof HookSignatures;

type StatusHookRegistration = {
  [K in HookName]: {
    readonly name: K;
    readonly priority?: number;
    readonly handler: (
      args: HookSignatures[K]['args'],
      ctx: { instance: StatusInstance },
    ) => HookSignatures[K]['return'];
  };
}[HookName];
```

A `StatusEffectType` carries `hooks: ReadonlyArray<StatusHookRegistration>`. When the runner for hook `K` collects handlers, it filters by `reg.name === K`, which narrows TypeScript's view of `reg.handler` to the right signature.

For other hook source kinds (Equipment, Class, Passive ability), each gets its own analogous registration union (`EquipmentHookRegistration`, etc.). The shapes differ in the second `ctx` argument (status passes `{ instance }`, equipment will pass `{ item }`, etc.) but the per-hook signatures live in the same shared `HookSignatures` map. Adding a hook is one edit; adding a source kind is one new registration union.

## Rationale

- **One source of truth for what hooks exist.** `HookSignatures` enumerates them. New hooks add an entry; nothing else changes structurally. Existing handlers and runners stay correct.
- **Statically exhaustive.** TypeScript's "if you switch on `reg.name` you must handle every branch" catches missing-runner mistakes at the type level. Add `onTurnStart` to `HookSignatures` and any code that exhaustively dispatches over hooks gets a compile error until updated.
- **Per-source second-arg shape is clean.** The `ctx` parameter changes per source kind (status vs equipment vs passive), but the `args` parameter is shared with the runner. The discriminated union makes both halves type-checked.
- **Cost is bounded.** Each new hook is ~5 lines in `HookSignatures`. The single-signature alternative would force a cast at every runner; the polymorphic-class alternative would force ~3 files per hook.
- **No runtime apparatus.** Registrations are plain objects in the catalog. No registration-time decorators, no class hierarchy, no runtime-mode switching. The collector is a pure filter over `unit.statuses → catalog → type.hooks`.

## Consequences

- **Adding a hook touches `HookSignatures`, plus its runner if there is one.** No source-kind file edits needed. New hooks can be defined before they have runners — the type surface for future sessions is in place from day one.
- **Adding a source kind (Equipment, Class, Passive) is a per-kind registration union plus a per-kind branch in the collector.** The `HookSignatures` map is shared.
- **`ctx` is intentionally per-source.** A status handler reading `ctx.instance.magnitude` is type-safe; an equipment handler reading `ctx.item.id` is type-safe; neither sees the other's fields. Cross-source handlers don't exist (handlers are owned by exactly one source kind).
- **The runner for each hook is its own function.** `runModifyStatQuery`, `fireOnApply`, `fireOnRemove`, etc. They share a collector helper but have per-hook semantics (chain vs event, single-source vs all-active). Generic "run any hook" runners are not provided — too many sub-cases to be useful.
- **Handler return types are exact.** A `modifyStatQuery` handler that forgets to return a number won't compile. Void-returning hooks can't accidentally return modified data and have it silently ignored.

## Alternatives considered

- **Single `(name, args) => unknown` signature.** Rejected: every runner needs an `as` cast; every handler is one typo away from runtime breakage. Optimizes for "easy to add new hooks" at the cost of every consumer.
- **Polymorphic `Hook<TArgs, TReturn>` class.** Rejected: turns each hook into a class definition + subclass per concrete usage. Heavier than a record, and the "instance method on a hook object" mental model doesn't match the engine's pure-function-over-state default.
- **Decoupled per-hook handler types.** Rejected: no central enumeration means runners can drift (a runner might exist for a hook nobody registers handlers against, or vice versa). The exhaustiveness check is the main thing the discriminated union buys, and giving it up leaves nothing in its place.
- **`Map<HookName, Handler[]>` precomputed and stored on `GameState` or similar.** Rejected as a *storage* representation because storing the index couples it to apply/remove invariants and creates a stale-cache risk. The collector recomputes on read; per CLAUDE.md performance posture, that's fine at v1 scale and remains correct by construction. Reconsider only if a profiler points here.
