## ADR-0073: Terrain-tag abstraction + ruleset-level default terrain costs + map validator

**Status:** Accepted
**Date:** 2026-05-13

## Context

The Session 33 brief authors **River Ridge** — the first playable Mage War map — and introduces two distinct water terrain types per Chris's call at plan time: `water_shallow` (elev 1, ruleset cost 2) and `water_deep` (elev 0, ruleset cost 3). The pre-S33 engine had a single `'water'` terrain string referenced by:

- **Tidewalker** (`src/content/abilities/tidewalker.ts`) — Water Mage's class-free Movement passive. `modifyTerrainCosts` handler keyed on the literal `'water'`.
- **Float** (`src/content/abilities/float.ts`) — Movement passive. `modifyCanEnter` handler added the literal `'water'` to canEnter.

Direct enumeration (Decision 2 option A in the brief): each handler enumerates both new terrains explicitly. Maintenance dependency: every new water-variant (frozen, current, swamp) requires hand-updating both Tidewalker and Float (and any future sibling consumer) to stay correct.

Tag-set abstraction (Decision 2 option B): each terrain type carries a set of tags. Handlers register against a tag (`'water'`). Mirrors the existing `damageTags` pattern (damage instances carry tags; resistance / amplification keys on tags). Forward-compatible: a future `water_frozen` registered with `tags: ['water', 'frozen']` works for both Tidewalker AND a hypothetical Frost-Stride without touching either ability.

Plus two related substrate fixes that landed alongside the abstraction:

- **`RulesetPathfinding.defaultTerrainCosts`** was declared and documented in the ruleset shape but never consumed. The docstring claimed it would merge with class baselines before the hook chain ran; the implementation skipped it entirely.
- **Map validation** — no validator existed pre-S33. River Ridge introduces the first content with deployment-zone tiles + multiple terrain types; a load-time sanity check protects against authoring slips (typo'd terrain string, missing zone tiles for a team).

## Decision

**(1) Tag-set abstraction (option B).** A new `TerrainRegistry` shape ships in `src/engine/map/terrain-registry.ts`:

```ts
export type TerrainTag = string;
export type TerrainRegistry = ReadonlyMap<TerrainType, ReadonlySet<TerrainTag>>;
```

Lives on the ruleset as `ruleset.terrain.tags` (a new top-level field on `RulesetDefinition`). The default ruleset registers:

```ts
ground         → ['land']
water_shallow  → ['water', 'shallow']
water_deep     → ['water', 'deep']
```

Three helpers expose tag-based composition:

- `terrainHasTag(registry, terrain, tag)` — predicate.
- `mapTerrainCostsByTag(baseValue, registry, tag, transform, defaultCost)` — apply a cost transform to every terrain carrying `tag`. Tidewalker's primary consumer.
- `addTerrainsWithTag(baseValue, registry, tag)` — add every terrain carrying `tag` to a canEnter set. Float's primary consumer.

Plus `terrainsWithTag(registry, tag)` for tooling / future consumers.

The hooks themselves widen to pass `terrainRegistry` to handlers:

```ts
modifyCanEnter: {
  args: { unit; baseValue; terrainRegistry };  // new field
  return: ReadonlySet<TerrainType>;
};
modifyTerrainCosts: {
  args: { unit; baseValue; terrainRegistry };  // new field
  return: ReadonlyMap<TerrainType, number>;
};
```

Runner signature stays unchanged (`runModifyCanEnter(state, catalog, { unit, baseValue })`). The runner sources `terrainRegistry` from `catalog.getRuleset(state.ruleset.id).terrain.tags` and threads it into each handler. Callers don't need to plumb the registry through their call sites.

**Tidewalker rework:**
```ts
passiveHook('modifyTerrainCosts', (args) =>
  mapTerrainCostsByTag(args.baseValue, args.terrainRegistry, 'water', (c) =>
    Math.max(1, c - 1),
  ),
),
```

**Float rework:**
```ts
passiveHook('modifyCanEnter', (args) =>
  addTerrainsWithTag(args.baseValue, args.terrainRegistry, 'water'),
),
```

**(2) `defaultTerrainCosts` honored.** `computeMovementProfile` now merges the active ruleset's `defaultTerrainCosts` with the class baseline (class entries override ruleset entries for the same terrain) before invoking `runModifyTerrainCosts`:

```ts
const mergedBaseline = new Map<TerrainType, number>(rulesetDefaults);
for (const [terrain, cost] of baseline.terrainCosts) {
  mergedBaseline.set(terrain, cost);
}
const terrainCosts = runModifyTerrainCosts(state, catalog, {
  unit, baseValue: mergedBaseline,
});
```

Default ruleset's `defaultTerrainCosts` now populates `{ water_shallow: 2, water_deep: 3 }`. `ground` stays implicit at `defaultStepCost`.

**(3) Water Mage canEnter extension.** Per the brief's decision 3, Water Mage's class baseline `canEnter` adds `water_shallow` (Mage wades through shallow water; deep water requires Float / future Walk-on-Water). Float, via the tag abstraction, adds both `water_shallow` and `water_deep`.

**(4) Map validator.** `src/engine/map/map-validator.ts` ships a minimal load-time validator. Checks:

- Every tile's terrain resolves in the registry.
- Every tile's elevation is non-negative.
- Every tile is in bounds.
- No two tiles share `(x, y, layer)`.
- Each required team has at least the minimum deployment-zone tiles.

Returns a structured error list; `assertMapValid(...)` throws with all errors bundled (so authors see every problem at once, not one-per-fix). Called from `river-ridge.test.ts` to gate the new content; future map-authoring CLI / catalog-load gate can reuse the same surface.

## Rationale

**Why tag-set abstraction over direct enumeration:**

The substrate sweep is small (one new field on `RulesetDefinition.terrain.tags`, the runners thread the registry internally, two abilities migrate). The forward compatibility is meaningful: every future water-tagged terrain composes with Tidewalker and Float without authoring touches. The same pattern naturally extends to future tags (`'organic'` for Decompose, `'frozen'` for Frost-Stride, `'cover'` for Hide); the abstraction earns its keep at the second tag, not the second water variant.

The runner-internal registry sourcing (vs. plumbing it through every caller's args) was the late substrate adjustment: it avoids cascading the new arg through every existing test call site that already passes `{ unit, baseValue }`. Handlers always receive a valid registry; callers stay unchanged.

**Why honor `defaultTerrainCosts`:**

The ruleset shape promised this in its docstring since session 8; only on River Ridge do we have a real need (water costs declared once at the ruleset rather than duplicated across every class). Honoring the contract is cheaper than re-explaining why it's there.

**Why Water Mage adds `water_shallow` to canEnter:**

Per `river-ridge.md`'s spec ("Water Mage M ability reduces water-tile move cost by 1") — the reduction is meaningless unless the class can enter the water. Adding `water_shallow` (not `water_deep`) matches FFT precedent: even water-themed casters wade ankle-deep but don't swim by default. Deep water requires Float or future Walk-on-Water.

**Why a small map validator now:**

River Ridge is the first map with deployment zones consumed by future content (Phase E's deployment phase UI). A silent authoring slip ("Blue zone has 3 tiles but the team requires 4") wouldn't surface until the deployment UI ships — far too late. The validator costs ~80 LOC + tests and prevents a class of authoring bugs.

## Consequences

**Wins:**

- Adding a new terrain variant is content-only — no handler authoring required to compose with existing tag-based handlers.
- Tidewalker / Float remain trivial 1-2 line handlers; the tag helpers carry the iteration logic.
- The ruleset shape's documented contract on `defaultTerrainCosts` is finally true.
- River Ridge has a load-time validation gate that catches deployment-zone authoring slips before battle start.

**Costs:**

- One new field on `RulesetDefinition` (`terrain`). Tests that build rulesets via `makeTestRuleset` inherit the production water-tag registry; bespoke ruleset construction (the few places that build `RulesetDefinition` by hand) needed the new field added.
- The `modifyTerrainCosts` and `modifyCanEnter` hook surfaces widen by one arg (`terrainRegistry`). Existing handlers — only Tidewalker and Float in v1 — read the new arg directly; future handlers can ignore it if they're not tag-aware.
- Runner-internal registry sourcing means tests that call `runModifyTerrainCosts`/`runModifyCanEnter` directly inherit the ruleset's tag registry by default. The minor surprise: a test using `makeTestRuleset()` now sees pre-populated water tag entries; if a test needs an empty registry, it has to override.

**Implications for future content:**

- Future water variants (`water_frozen`, `water_swamp`, `water_current`) just need a registry entry plus an `elevation` tier; Tidewalker and Float compose automatically.
- Future "land-only" passives (Bedrock Stride is already such a passive but doesn't currently key on the `'land'` tag) could key on the tag if extending to multiple ground variants becomes meaningful.
- Future ruleset variants can ship alternative tag sets ("hardcore mode: swamp is hostile to non-aquatic life" → `swamp` doesn't carry `'land'`).

## Alternatives considered

**A — Direct enumeration in each handler.** Rejected: maintenance dependency grows with every water variant. The forward-compat win of B at the first sibling consumer (Float, which has the same widening problem) justifies the substrate.

**C — Family/parent field (single-membership).** A `family?: TerrainFamily` field per terrain type. Simpler than tags but single-membership: `water_swamp` with `family: 'water'` can't also be in family `'organic'` for a Decompose ability. The damage-tag pattern (set of tags, not single family) is already familiar; mirror it.

**Passing the registry through hook handler args at the runner-caller boundary.** Considered then rejected. Forces every caller of `runModifyTerrainCosts`/`runModifyCanEnter` to plumb the registry through their args. The runner already has the catalog (it threads through to `collectActiveHandlers`); sourcing the registry internally is a smaller seam.

**Per-call helper closure capturing the registry.** Each ability declares its handler at module load, before any ruleset is known. A closure can't capture the registry — passives are data, not factory functions. Tag access has to flow through hook args.

**Continuous elevation costs (replace `defaultTerrainCosts` with a function).** Rejected: keeps the cost surface authorable as data and consistent with the existing `terrainCosts` map shape.

**Map validator at catalog-load time.** Rejected for v1: catalog-load doesn't know which battles will use which maps with which team configurations. River Ridge's "12 zone tiles per team" is meaningful only for the demo battle's team count; a 6-unit-per-side variant would have a different minimum. Validator is per-battle, called at battle load (or in tests directly).

**Implementing corner stack markers as part of the cliff-edge layer (one layer, two visual concepts).** Rejected: cliff edges show *relationships* (this tile is higher than its neighbor); stack markers show *absolute tier* (this tile is at elevation tier 4). Different invariants, different update paths if a future ability mutates elevation. Two layers keep the responsibilities clean and unit-testable in isolation.

## Related

- ADR-0006 — Movement profile composition rules.
- ADR-0049 — `deploymentZone` tile property (substrate shipped Cluster 2, S25).
- ADR-0050 — Uniform-int initial CT (`makeTestRuleset` ergonomics).
- ADR-0071 — Pre-battle action-source pattern (River Ridge's battle bootstraps through this).
- ADR-0072 — Cliff-edge rendering convention (corner stack markers companion to it; both ship for River Ridge).
- `docs/twentyOneDesign/river-ridge.md` — content spec for the first playable Mage War map.
