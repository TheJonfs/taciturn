## ADR-0085: Vertical-axis targeting rules — uniform magic vertical-infinite, AoE vertical-tolerance default + new modifier hook

**Status:** Accepted
**Date:** 2026-05-23
**Session:** 47

## Context

Session 47 introduces Stonebridge, the second authored Mage War map — a 16×16 fortified river crossing whose defining feature is an elev-8 keep in the SE corner. The brief flagged the asymmetry between the existing `vertical: 2` cap on most magic spells and the rampart's 6+ elevation delta from the surrounding flat: from flat ground a Mage couldn't even *target* the rampart with magic, let alone splash an AoE onto it. That made one of the map's primary tactical interactions — "magic as the equalizer against Hunters on a high perch" — unreachable.

Pre-S47 the engine surfaced three layers that constrain vertical reach for magic:

1. **Targeting `range.vertical`** (per-ability data, on `ActiveAbilityDefinition.targeting.range.vertical`). The caster→target-tile elevation delta cap. Most magic ships at `vertical: 2`; Hunter bow attacks (ADR-0083, S45) ship at `vertical: 99`.
2. **AoE `verticalTolerance`** (per-ability data, on `AbilityEffects.aoe.verticalTolerance`, with ruleset default `rangeDefaults.aoeVerticalTolerance`). The elevation window from the anchor tile within which AoE splash actually hits. Pre-S47 the default was `1`. Only Flame Lance overrode (5).
3. **`modifyAoeShape` hook** (ADR-0025 / ADR-0031). Caster-side modifier of the AoE shape; Aether Bloom's `+1 step` is the only consumer.

The audit confirmed `verticalTolerance` was already a fully threaded concept (engine reducer, AI scoring, UI overlays, charged-action panel, forecast preview) — the substrate was complete. Only the *defaults and consumers* needed updating.

## Decision

### 1. Single-target AND AoE magic targeting goes vertical-infinite (`vertical: 99`)

Every magic-tagged active ability — single-target spells (Earth Strike, Fire Strike, Spark, Lightning Strike, Cure, …), status appliers (Earth Curse, Magnetic Mark, Brine, …), AoE casts (Earth Quake, Fire Storm, Tidal Wave, Chain Lightning, Earth Cataclysm, Maelstrom, Flame Lance), buffs (Earth's Blessing, Fire Embrace, Static Embrace), and CT manipulators (Tide Surge) — gets `range.vertical: 99`. Matches the bow precedent (ADR-0083): a high-perch defender is in range of any caster on the map, full stop.

23 magic-tagged abilities updated; the brief's "single-target only" framing was widened in plan-review (per S47 PR-Q1) to include AoE targeting too — the strict reading would have left "AoE on rampart splashes to ±verticalTolerance" unreachable from flat ground.

**Why per-ability data instead of engine-side gating on the `'magical'` tag:** mirrors the bow precedent. Per-ability authorship keeps the value local and tunable. Future content that wants a vertical-bounded magic spell (a hypothetical Quicksand-style ground-targeted spell) sets its own `vertical: N` without engine gymnastics. The `'magical'` tag stays orthogonal to vertical mechanics.

### 2. AoE vertical-tolerance ruleset default 1 → 3

`rangeDefaults.aoeVerticalTolerance` bumped from `1` to `3`. Affects the 6 magical AoE spells using the default (Earth Quake, Earth Cataclysm, Fire Storm, Maelstrom, Chain Lightning, Tidal Wave); Flame Lance retains its explicit `verticalTolerance: 5`.

Rationale: tolerance 1 means AoE splash is essentially restricted to the anchor tile's flat layer. On rampart elev 8, the AoE would clip a 7-9 elevation band — fine for one layer but pathetically short of "an AoE explosion crosses elevations." Tolerance 3 lets a rampart-anchored AoE reach 5-11, which includes the rampart itself (8), the keep's interior ground (2 — wait, that's elev 2, delta 6, still out), the bridge mid-span (5-6), and the ridge ledges (5-6) — the elevation-relevant terrain the map actually presents.

A future per-spell override (a low-elevation "ground hugger" spell with `verticalTolerance: 1`, or a "Tornado" with `verticalTolerance: 10`) remains author-data; the engine surface is unchanged. The default just rebalances "everything that didn't bother to override."

### 3. New closed-surface hook: `modifyAoeVerticalTolerance` (13 → 14)

Aether Bloom — the Fire-themed Support that already grows magical AoE *shape* by 1 step — gains a parallel `+1` to vertical tolerance. The audit found `modifyAoeShape` returns just an `AoeShape`; widening its return shape to `{ shape, verticalTolerance }` would compose two orthogonal concerns into one hook. A separate hook keeps each concern's chain independent (shape composes shape-modifiers; tolerance composes tolerance-modifiers) and mirrors the project's parallel-concern hook pattern (`modifyHitChance` / `modifyEvasion` / `modifyAbilityRange` are all single-concern). Closed surface grows 13 → 14.

```ts
modifyAoeVerticalTolerance: {
  args: { unit: Unit; ability: ActiveAbilityDefinition; baseValue: number };
  return: number;
};
```

Fires against the caster's hooks at the same site as `modifyAoeShape` (the AoE dispatcher's footprint-resolution point in `resolveAoeDispatch`). The runner threads through UI, AI, forecast, and the charged-action detail panel so the displayed preview matches the engine's actual footprint.

**Aether Bloom's new handler** (additive, sits alongside the existing `modifyAoeShape` handler in the same `hooks: [...]` array):

```ts
passiveHook('modifyAoeVerticalTolerance', (args) => {
  const tags = args.ability.tags ?? [];
  if (!tags.includes('magical')) return args.baseValue;
  return args.baseValue + 1;
}),
```

Symmetric to the shape grow — same gate (`'magical'` tag), same +1 step. A Fire Mage with Aether Bloom equipped projects a `diamond r2` (vs. base `diamond r1`) at `verticalTolerance 4` (vs. default 3). The horizontal AND vertical footprint both widen by one step, which is the design intent the brief surfaced: "more bloom" should be uniform in both axes.

## Consequences

**Wins:**

- A Mage on flat ground can target a Hunter on the rampart (or any other high-elevation position) with any single-target spell or AoE. Resolves the brief's acceptance criterion directly.
- AoE casts on or near the rampart cover the rampart + adjacent ridge ledges within tolerance 3, hitting the elevations the map actually uses.
- Aether Bloom's "more bloom" is now uniform in horizontal *and* vertical axes — the passive's identity becomes clearer.
- The closed hook surface grows for a separable concern (vertical tolerance), keeping parallel hook structure rather than overloading the shape hook with two return values.

**Costs:**

- 23 magic ability files mechanically touched (one line each). The bow precedent already established `vertical: 99` as the canonical "no elevation constraint" value; uniformity is the win.
- Default ruleset bump: 6 AoE specs see a tolerance change without their data files being touched. Most will read as intended (splash on the rampart now clears the wall), but any spell that *wanted* tight tolerance now has to declare it explicitly (none do today).
- The hook surface widens by one. Existing handler-author surface (the `passiveHook(name, fn)` factory) accepts the new name without other edits.

**Implications for future content:**

- Future "ground-hugger" spells set `aoe.verticalTolerance: 1` explicitly to keep splash strictly to the anchor's elevation tier (an icestorm that only affects same-elevation tiles, etc.).
- Future "huge AoE" spells (Meteor, Hurricane) override to higher tolerance values.
- Future "bounded magic" content (a "Earth Magic only lobs at elev ±2 from the caster" mechanic) declares `vertical: 2` explicitly in its targeting range, opting out of the universal infinite.
- Composition pattern: any future passive that wants to widen vertical tolerance registers `modifyAoeVerticalTolerance`; the additive chain handles multi-passive stacking automatically.

## Alternatives considered

- **Strict reading: single-target magic only goes vertical-infinite; AoE magic stays at vertical 2.** Rejected because it left the brief's "AoE on rampart" acceptance criterion unreachable from flat ground. Made the rampart a magic-immune fortress, not the design intent.
- **Engine-side gating on the `'magical'` tag instead of per-ability `vertical: 99`.** Rejected: locks behavior into a single rule that's harder to selectively override later. Per-ability data is the project's standing pattern (see ADR-0083 bow vertical) and tunability convention.
- **Widen `modifyAoeShape` to return `{ shape, verticalTolerance }`.** Rejected: combines two orthogonal concerns into one hook return shape. Tests that already use `modifyAoeShape` would have needed to update their return shape; new tests would need to consume both fields even when only modifying one. The parallel-concern hook is more compact at the registration site.
- **Per-class vertical defaults on `ClassDefinition`.** Rejected: complicates the data model with little gain. Per-ability declaration handles the variation that exists today (bow weapons, magic spells) and the variation that's likely to exist tomorrow (status-applier melee like Knight Taunt).

## References

- `src/engine/hooks/hooks.ts` — new `modifyAoeVerticalTolerance` entry on `HookSignatures`.
- `src/engine/hooks/runners.ts` — `runModifyAoeVerticalTolerance` runner.
- `src/engine/actions/reducers.ts` — `resolveAoeDispatch` consumes the new hook.
- `src/engine/forecast/aoe-preview.ts`, `src/ui/use-turn-flow.ts`, `src/ui/charged-action-detail-panel.tsx`, `src/ai/basic.ts` — preview / scoring threading.
- `src/content/rulesets/default.ts` — `aoeVerticalTolerance: 3`.
- `src/content/abilities/aether-bloom.ts` — second handler.
- 23 magic-ability files — `vertical: 99` per-ability.
- Related: ADR-0025 (AoE substrate), ADR-0031 (line AoE + `enlargeAoeShape`), ADR-0073 (terrain tags), ADR-0083 (bow vertical-infinite precedent).
