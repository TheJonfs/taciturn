# Findings — Battle-map authoring tool (Cartographer) audit

*Companion to `taba-map-authoring-tool-brief.md`. Audit ran inline at the start of the build session
(Chris's call); these findings record what the audit established and the calls Chris made on the four
scoping questions before the build started.*

## Chris's calls (settled before the audit)

1. **Session shape:** audit inline, then build Tier 1 in the same session.
2. **Round-trip target:** migrate the shipped map files to a generated-shaped canonical format (the
   Atlas `node.ts` move) — one-time regeneration verified **data-identical** (deep-equal built
   `BattleMap`), byte-identical round-trip pinned thereafter. Prose geography notes live on in
   `docs/maps/*.md` (which already exist for every shipped map).
3. **Deployment zones:** the tool imports and codegens `src/content/deployment/registry.ts`
   **wholesale** (Atlas pattern). Sub-zones + caps are carried losslessly in the model even where v1
   UI edits only the simple cases.
4. **Tier 2 (enemy placement):** fast-follow. The mode switch is designed into the tool architecture
   now; only Tier 1 ships this session.

## The map data format (what the export must match)

All 7 maps in `src/content/maps/` share one pattern: an `ELEVATION_GRID` (row = y), a
`terrainFromElevation` function, and a build loop pushing layer-0 `Tile`s. The bespoke structures a
canonical format must carry:

| Map | Dims | Beyond the water-table rule |
|---|---|---|
| river_ridge | 14×14 | — |
| stonebridge | 16×16 | 9 **position-keyed** rampart overrides (`RAMPART_POSITIONS`), elevation-independent |
| marshmoor | 16×16 | — |
| mountain_pass | 16×16 | **Elevation bands**: ≥7 → rock, ≥5 → grass_rock (named exported thresholds) |
| oskun_fields | 16×16 | — |
| alvera_village | 16×16 +3 | elev 8 → rampart band; **layer-1 deck** (3 tiles, elev 3, `bridge`); `bridge_ramp` property at (2,10) |
| training_field | 14×14 | Gridless uniform fill; **not in any registry** (test probe) — stays hand-written, not migrated |

The universal elevation→terrain default **exists**: the water-table rule (0 → `water_deep`, 1 →
`water_shallow`, ≥2 → `ground`; ADR-0073). Everything else decomposes into **ordered bands**
(exact-match or threshold) plus **position overrides** — so the canonical `MapSpec` is:
elevation grid + ordered terrain bands + position-keyed terrain overrides + per-tile property tags +
layer-1 deck list. Every shipped map is expressible in it losslessly.

**Serialized shape** (`src/engine/types/tile.ts`): `Tile = {x, y, layer, elevation, terrain,
properties}` (`barrier` is runtime-only, never authored); `BattleMap = {width, height, tiles}`.
`TerrainType`/`TileProperty` are open strings.

**Migration-sensitive test pins:** map tests import named exports (`*_WIDTH`/`*_HEIGHT`,
`MOUNTAIN_PASS_*_ELEVATION` thresholds, which mountain-pass.test re-derives terrain from). The
generated format keeps `*_WIDTH`/`*_HEIGHT`; the threshold constants dissolve into band data and
that test is rewritten to pin the terrain *data* at the band boundaries instead. All other pins are
data pins (spot samples, tile counts, `validateMap`-clean) that survive regeneration unchanged.

## Vocabularies

- **Terrain (complete authored list, 7):** `ground`, `water_shallow`, `water_deep`, `rampart`,
  `rock`, `grass_rock`, `bridge`. Pinned three ways in lockstep: `AUTHORED_TERRAINS`
  (`bridge-walkability.test.ts`), ruleset `terrain.tags` (`rulesets/default.ts`), every class's
  `canEnter`. New terrain = engine work, out of tool scope (per brief) — the tool's picker offers
  exactly these seven.
- **TileProperty (complete used list, 2):** `bridge_ramp` (renderer-only bridge-kit dressing;
  authored on one Alvera tile) and `blocks_los` (consumed by `line-of-sight.ts:40`, authored on
  **zero** shipped tiles — the tool should still offer it). No hazard/slippery/etc. exist; the
  brief's larger property list was speculative. Property authoring depth: the lean option
  (explicit per-tile toggles for these two) is trivially sufficient.

## Renderer reuse (the live preview)

- `BattleRenderer` (`src/renderer/battle-renderer.ts`) mounts from a full `GameState` + `Catalog` —
  and **renders a bare map fine with an empty `units` Map** (unit loop just skips; terrain fills,
  cliff-edge elevation shading, elevation digits, deck lift/shadow, and async terrain/bridge art all
  draw from `state.map` + `rng.masterSeed` alone). `DeploymentScreen.tsx:157-230` is the proven
  reduced-units mount recipe (disposed-guard around async `app.init`, capture `app.canvas` before
  teardown, `fitMap()`, wheel-zoom via `applyZoomAt`, `ResizeObserver` → `setScreenSize`).
- Bridge art needs **zero tool-side config**: orientation/lift derive purely from map geometry
  (`bridge-variant.ts` reads span axis + bank elevations; `StackGeometry` reads stacked cells +
  `bridge_ramp`). A well-formed authored map renders correctly by construction.
- No public "swap map" method — the tool remounts per edit (AtlasPreview's remount-by-`key`
  pattern), which is cheap at 16×16 scale.

## Validators (reused as-is, both pure)

- `validateMap(map, registry)` (`src/engine/map/map-validator.ts:57`): bounds, duplicate positions,
  negative elevation, unknown terrain, plus the S96 multi-layer rules (`layer_too_deep`,
  `deck_without_ground`, `deck_clearance_too_low` vs `BRIDGE_MIN_CLEARANCE = 2`). **Deliberately no
  reachability check** (authored-unreachable is legitimate — Alvera's walls).
- `validateDeploymentZones(config, terrain, {requiredZonesPerTeam})`
  (`src/engine/map/deployment-zone.ts:130`): in-bounds/on-map/no-overlap plus
  `insufficient_deployment_zone` (zone tiles < side's deployable count). The tool supplies the count
  (default 5 — the v1 roster max).
- The brief's "disconnected/unreachable regions" check therefore lives **tool-side as an advisory
  warning** (BFS from the player zone with an elevation-step threshold), not as an engine validator
  change — walls-by-design must not block export.

## Atlas patterns copied

Runtime-value import (no text parsing; the generated modules export their `MapSpec`, so import is
lossless by construction — no reference-equality reconstruction needed). String-template codegen +
`?raw` byte-identical round-trip test + synthetic fixpoint test. SVG viewBox pan/zoom canvas with
element-level hit-testing. Live validation gating Preview/Export. Versioned localStorage draft.
`import.meta.env.DEV && params.has('cartographer')` + `lazy()` route in `main.tsx` (prod chunk
dead-code-eliminated).

## Fight-on-it wiring (acceptance chain)

A fresh map becomes fightable with: the generated map module; a battle template embedding it
(`BattleConfig.map` — configs inline the map object, no mapKey field); a
`DEPLOYMENT_ZONE_REGISTRY` entry; a `BATTLE_TEMPLATE_REGISTRY` entry (same key). That last entry
makes it selectable as an Atlas placeholder battle (campaign path) and one `MAP_OPTIONS` entry in
`App.tsx` makes it a quick battle (fastest proof path). Battle-template wiring beyond export stays
out of tool scope per the brief.

## Tier 2 interface (confirmed ready, fast-follow)

`enemyKitForLevel(cls, level, catalog)` + `enemyJpBudget(level)` (`src/campaign/enemy-kit.ts`) take
exactly the class+level the brief scopes; deterministic brave/faith and basic-weapon gear come with
the framework. Nothing blocks the enemy-placement mode from attaching later.
