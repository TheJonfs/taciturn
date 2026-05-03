## ADR-0008: RulesetDefinition shape and BattleConfig surface

**Status:** Accepted
**Date:** 2026-05-03

## Context

`docs/architecture/architecture-overview.md` ("Rulesets and content") commits to a three-layer composition: a Ruleset bundles configurable engine parameters, a Catalog holds static content definitions, and a BattleConfig describes a specific battle. Session 6 lands the first two of those data shapes plus `createInitialState(battleConfig, catalog) → GameState`.

The decisions in scope:

1. **Where the ruleset lives.** Either as another catalog kind (`Catalog.getRuleset(id)`), as a separate registry alongside the catalog, or stored fully resolved on `GameState`.
2. **Ruleset shape — required vs. optional fields.** Either ship a fully-required resolved shape (every field set on the v1 default), or ship the authoring shape with `basedOn` + optional override fields (so alternate rulesets can specify only differences from the default).
3. **Damage pipeline stage refs.** Session 8 owns the actual handlers. The shape question for session 6 is whether to ship the field with empty arrays now or defer the field until session 8.
4. **Initial-CT formula.** The design doc (`turn-structure.md`) describes a speed-based + variance formula but flags specifics as tuning. Either ship that formula partially, or ship a simpler placeholder shape that tolerates extension.
5. **Map placement in BattleConfig.** Either reference maps from a `Catalog.getMap(id)` lookup or inline the BattleMap on the BattleConfig.
6. **Where source-tier ordering lives.** Currently `HOOK_SOURCE_TIER_ORDER` is a constant in `engine/hooks/hooks.ts`. The architecture doc names hook ordering as a ruleset parameter. Either keep the constant authoritative and let the ruleset reference it, or move ownership onto the ruleset and treat the constant as a default.

The plumbing decisions for migrating existing constants (`BASELINE_BUCKET_CAPACITIES`, `ASSUMED_TURN_CT_COST`, `SPEED_FLOOR`) into the ruleset are mechanical once #1 and #2 are settled — every consumer already takes `catalog`, so it can resolve the active ruleset by `state.ruleset.id`.

## Decision

**Where the ruleset lives: catalog kind.** Adds `Catalog.getRuleset(id)` / `hasRuleset` / `rulesets()` matching every other definition kind. `GameState.ruleset` keeps its session-1 shape (`{ id: RulesetId }`); engine code resolves to the full definition by lookup at use time. Storing the resolved ruleset on state was rejected — it duplicates information already in the catalog and re-raises the "what if the ruleset changes mid-battle" question that we don't want raised.

**Ruleset shape: fully required for v1.** Every field on `RulesetDefinition` is required. The v1 default ruleset specifies all of them. The `basedOn` + optional-overrides authoring shape lands when a second ruleset ships, since that's when partial-overrides actually pay rent. The underlying type system supports later extension (a `RulesetAuthoringInput` that resolves into a `RulesetDefinition` is purely additive); session 6 doesn't pay the complexity tax for a feature with no consumer.

**Damage pipeline: ship the field with empty arrays.** `damagePipeline.stages` is a `Record<DamageStage, ReadonlyArray<DamageHandlerRef>>` where every stage key is present and every array is empty in the v1 default. The shape stabilizes early; session 8 fills the arrays. Deferring the field entirely was rejected — it would force a ruleset shape change in session 8, which would touch every test fixture.

**Initial CT: discriminated union with one v1 variant.** `RulesetInitialCT = { kind: 'fixed'; value: number }`. The v1 default is `{ kind: 'fixed', value: 0 }`. The speed-based + variance formula lands as another discriminant when the tuning settles; the exhaustive switch in `createInitialState` will trip on the new variant so it can't be silently missed. Per-unit `initialCT` overrides on `UnitPlacement` allow scripted openings (a boss pre-charged at CT 80) without requiring a ruleset variant.

**Map placement: inline on BattleConfig.** `BattleConfig.map: BattleMap` rather than a `mapId: MapId` reference. Maps aren't in the catalog yet; promoting them is its own session (the "Map content expansion" pass in the roadmap). Inline keeps session 6 focused; the indirection lands when real map content does. Same reasoning as session 5's loadout-on-Unit decision: defer the indirection until a consumer needs it.

**Source-tier ordering: ruleset-owned, with a re-exported default.** `HookSourceTier` and `DEFAULT_HOOK_SOURCE_TIER_ORDER` move to `engine/types/` (so the ruleset can reference them without a layering violation; types/ doesn't depend on hooks/). `engine/hooks/` re-exports both names. The collector reads `ruleset.hookOrdering.sourceTiers` per call instead of using a hardcoded `TIER_ORDER` map, and derives a tier-rank map from the array. The hardcoded map is gone.

## Consequences

- **Engine consumers reach the ruleset through the catalog.** Functions that already took a `Catalog` parameter (`computeSpeed`, `computeActionSpeed`, `getCapacity`, `projectUpcoming`, `getLegalMoves`, `collectActiveHandlers`) gain one more lookup and read their ruleset-sourced value from there. No new signatures need passing the ruleset around explicitly.
- **`engine/abilities/constants.ts` and `engine/ct/constants.ts` shrink.** `BASELINE_BUCKET_CAPACITIES`, `ASSUMED_TURN_CT_COST`, and `SPEED_FLOOR` are gone — those values live on the active ruleset. Bucket *identity* (the closed five-bucket set) and `TRIGGER_THRESHOLD` (rigid by design) stay as engine constants.
- **`computeActionSpeed` gained a `catalog` parameter.** Aligns its shape with `computeSpeed`. The single existing call site in `projectUpcoming` already had the catalog handy, so the signature change costs nothing.
- **Friendly pass-through is real.** `getLegalMoves` reads `behaviors.friendlyPassThrough` from the active ruleset and threads it into `canStep`: when on (the v1 default), the moving unit can route through allied tiles but cannot settle on them; enemies always block. Pathfinding tests split into "enemy blocks" / "ally pass-through on" / "ally pass-through off" cases.
- **Hook tier ordering is data, not code.** A ruleset that reorders the four tiers (e.g., a "raw effects dominate gear" variant that fires Status before Equipment) is a one-line authoring change. The collector picks it up automatically.
- **Test fixtures gained one field.** Every test that calls `createCatalog` now passes a `rulesets` array; the fixture helper `defaultTestRulesets` from `engine/catalog/test-fixtures.ts` provides a v1-shaped default that engine tests use without depending on `src/content/rulesets/default.ts`. Engine tests stay isolated from content tuning.
- **`createInitialState` enforces battle-config invariants at setup time.** Duplicate unit ids, references to undeclared teams, references to classes not in the catalog, and invalid loadouts all throw `BattleConfigError` before the state is returned. Loadout validation runs against the constructed state via the canonical `validateLoadout` (no second copy of validation logic).
- **`HookSourceTier` moved to `engine/types/`.** Required so `RulesetDefinition` (in `engine/types/`) can name it; otherwise types/ would import from hooks/, reversing the dependency arrow. `engine/hooks/` re-exports the type and the default-order constant; existing imports through `engine/hooks/index.ts` continue to work.
- **Damage-handler refs are strings.** Rulesets are authorable / serializable; embedding actual handler functions would block both. Session 8 introduces the registry that resolves these strings to handlers at pipeline time.
- **Per-unit `initialCT` defeats determinism in scripted openings.** A BattleConfig that pre-charges one unit changes turn order. This is intentional — narrative battles want it. Where it's not wanted, omitting `initialCT` falls back to the ruleset formula, which stays deterministic.

## Alternatives considered

- **Storing the resolved ruleset on `GameState` directly.** Rejected. Duplicates information held by the catalog; re-raises the "ruleset changes mid-battle" question (which we don't want to answer because we don't allow that). The action log header still references the ruleset by ID for replay, per the architecture doc.
- **Authoring-shape ruleset (with `basedOn` + optional fields) for v1.** Rejected. No second ruleset exists yet, so the partial-override machinery would be code without a consumer. Promoting the shape later is purely additive: introduce a `RulesetAuthoringInput` type, write a resolver, point content at the new authoring path. Today's content stays unchanged.
- **Defer `damagePipeline` until session 8.** Rejected. Adding a required field mid-stream would touch every ruleset and every test that constructs one. Empty arrays now stabilize the shape.
- **Speed-based + variance initial CT formula in v1.** Rejected. The design doc flags specifics as tuning; baking in a guess now would be tuning by accident. The discriminated union is the right shape for adding the variant later without touching call sites that currently handle `'fixed'`.
- **Inline rulesets per battle (ruleset-on-BattleConfig).** Rejected. Two battles using the same ruleset would duplicate it; the action log identifying "which ruleset was active" becomes ambiguous. Catalog lookup gives one-source-of-truth identity.
- **Map-as-catalog-kind in this session.** Rejected. Mission creep — session 6's scope is the ruleset and the construction surface. Maps move to the catalog when real map content lands; today's flat ASCII-grid test maps stay inline on BattleConfig.
- **Loadout validation duplicated in `createInitialState`.** Rejected. Two copies of the rules drift. The setup function constructs the state, then runs the canonical validator against it. The cost is one validate-loop after construction; the benefit is one source of truth for what a valid loadout is.
- **Keep `HOOK_SOURCE_TIER_ORDER` as the authoritative ordering with the ruleset just naming a reference.** Rejected. The architecture doc explicitly lists hook ordering as a ruleset parameter; having the ruleset depend on a constant inverts the intended source-of-truth direction. The constant becomes the *default* (`DEFAULT_HOOK_SOURCE_TIER_ORDER`), and the ruleset is authoritative.
