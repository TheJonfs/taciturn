## ADR-0072: Cliff-edge overlay rendering — categorical thickness + upper-left-lit shading

**Status:** Accepted
**Date:** 2026-05-13

## Context

The Session 32 brief includes a rendering substrate for maps with elevation variance. River Ridge (S33) introduces the first elevation-rich map: a 14×14 grid with a central ridge climbing from elev 2 at the western foot to elev 9 at the eastern perch, a river running along the western flank at elev 0 / 1, and intermittent islands at elev 2. Without a visual hint at *where* elevation changes happen, the player has to consult the tile-info panel for every tile to plan around the ridge — a poor tactical read.

The pre-S32 renderer paints tiles as flat colored rects (or texture sprites per ADR-0054), with no edge treatment. Two tiles at elev 0 and elev 9 read identically except for the texture variance. Two side-by-side tiles at elev 2 and elev 7 give no signal that one is a 5-elev step above its neighbor.

The brief's design call: ship a cliff-edge overlay this session as a rendering substrate (engine-blind, reads `BattleMap` only). Pair it with corner stack markers in a sibling pass. Per Chris's call at plan-review, **cliff edges ship in S32; corner stack markers defer to S33** so the rendering substrate doesn't snowball alongside the engine work.

Three tuning knobs to settle:

1. **Thickness scaling.** A 5-elev drop should read very differently from a 1-elev rise. Three reasonable shapes: continuous (1px per delta, no cap), linear-with-cap, and categorical tiers.
2. **Color derivation.** Two options: a darker shade of the tile's terrain palette color (cohesive — cliff reads as part of the same material), or a generic neutral dark gray (consistent across terrains; less material identity).
3. **Lighting convention.** Two options: full-darken on all four edges (every cliff strip the same color); or directional darken — N + W edges receive a lighter darken (the lit side) while S + E edges receive a heavier darken (the shadowed side). The second option suggests volume via shading and is conventional for top-down tactical RPGs (FFT, FFTA).

## Decision

**Three coupled choices; all rendering-only, no engine surface:**

**(1) Categorical thickness tiers.** Strip thickness derives from elevation delta via:

```
Δ = 0     → no strip
Δ = 1     → 2px
Δ = 2-3   → 3px
Δ ≥ 4     → 5px
```

The categorical binning lets the gentle 1-step rises along River Ridge's west foot (cols 3-5 at elev 2 → 3 → 4) read with a thin hint, while the dramatic 5-7 step drops off the eastern perch (cols 10-13 at elev 9 surrounded by elev 2 flat) get the full treatment. The bins keep the cliff strips visually distinct from tile content (sprites, badges, highlights) without dominating the frame.

Constants live in `src/renderer/constants.ts`:
- `CLIFF_EDGE_THICKNESS_PX_DELTA_1 = 2`
- `CLIFF_EDGE_THICKNESS_PX_DELTA_2_3 = 3`
- `CLIFF_EDGE_THICKNESS_PX_DELTA_4_PLUS = 5`

> **Amendment (Session 33.5, 2026-05-14).** The bins were bumped from the original `1 / 2 / 3px` to `2 / 3 / 5px`. Chris's first River Ridge playtest read the cliff strips as too subtle at the default 48px tile size — the Δ=1 1px strips disappeared into tile outlines and grass-texture variance, and the elevation-label layer (S33) was carrying most of the elevation read. The exaggerated bins restore the cliff edge as a reliable secondary cue. The categorical-tier *structure* and every other choice in this ADR are unchanged; only the three thickness constants moved.

The categorization helper `cliffEdgeThicknessFor(delta)` is exported from `src/renderer/cliff-edge-layer.ts` for unit testability.

**(2) Color from tile palette × multiplicative darken.** The cliff strip's color derives from the *higher* tile's `TERRAIN_COLORS` entry, multiplied per channel by a darken factor < 1.0. Grass cliffs read as part of grass; future rock cliffs (a rock terrain type) read as rock. `darkenColor(color: number, factor: number)` clamps each channel to `[0, 255]` after the multiply.

**(3) Lit-from-upper-left directional shading.** Each tile's four cardinal cliffs receive different darken factors based on the edge they sit on:

- **N + W edges** (lit side): `CLIFF_EDGE_DARKEN_HIGHLIGHT = 0.78` — lighter darken. The cliff catches the upper-left light source.
- **S + E edges** (shadowed side): `CLIFF_EDGE_DARKEN_SHADOW = 0.55` — heavier darken. The cliff sits in shadow.

The two-tier directional shading suggests volume — a tile rising above its neighbors reads as a 3D-ish block, not a flat 2D stamp. Conventional for top-down tactical RPGs.

`cliffEdgeDarkenFactorFor(side)` returns the factor based on the side enum.

**(4) Layer placement.** The new `CliffEdgeLayer` sits between the `TileLayer` and the `HighlightLayer` in the renderer's world container:

```
world
├── tiles
├── cliff-edges   ← new
├── highlights
└── units
```

Cliff strips appear *on* the tile but *under* any move-range / attack-range / AoE-preview highlighting. Unit sprites still draw over both — a unit standing on a tile is fully visible; the cliff strip occupies only the outer 1-3px of the tile's edge facing the lower neighbor.

**(5) Draw timing.** `CliffEdgeLayer.draw(map)` is called once at `BattleRenderer.mount()`, the same point that `TileLayer.draw(map)` is called. The cliff strips are static for the lifetime of the map — there's no elevation-mutation ability in v1. A future ability that changes a tile's elevation mid-battle would call `cliffEdgeLayer.draw(state.map)` again to repaint (cheap — single Graphics clear + rect re-issue).

## Rationale

**Categorical tiers over continuous scaling.** Continuous (1px per delta) would produce 9px-thick cliffs at the eastern perch — visually disruptive, occupies a quarter of the tile's footprint. Linear-with-cap at 3px would lose discrimination between Δ=2 and Δ=4 (both 3px). Categorical binning preserves three distinct visual tiers (gentle / moderate / sharp) that map cleanly to the River Ridge tactical zones (western foot, central ridge, eastern perch). Future maps with even more extreme variance still cap at 3px, keeping the cliff a hint rather than a wall.

**Palette-derived color over generic neutral.** A neutral dark gray cliff would look the same on grass, rock, sand, and any future terrain — visually inconsistent with the cohesive-material aesthetic of the rest of the renderer. The palette derivation costs one multiply per channel and produces results that read as "the same material as the tile, shadowed where the cliff face is." When future terrains ship (rock, sand, swamp), their cliffs automatically follow.

**Upper-left lighting over full-darken-all-four.** Full-darken treats every cliff identically — flat. The directional shading gives the cliff a sense of volume; a tile rising above its neighbors reads as a block with a lit top edge and a shadowed bottom edge. The light direction (upper-left) matches the convention in FFT / FFTA / most isometric tactical RPGs. The renderer is 2D top-down today, but the future isometric stretch goal will pair naturally with this lighting choice (already in the right hemisphere).

**Reading the higher tile's palette, not the neighbor's.** A cliff edge sits on the higher tile and faces the lower neighbor. Visually, the cliff face is part of the higher tile (the part you'd see if you tilted the view 30°). Reading the higher tile's palette gives "grass tile → green cliff face"; reading the lower neighbor's would give "grass tile → blue cliff face if the neighbor is water" — wrong material identity.

**Static draw at mount over per-frame repaint.** v1 has no elevation-mutation content. A per-frame repaint of the same static strips is wasted work (60 fps × hundreds of tiles × four cardinal edges each = thousands of no-op rect calls per frame). The renderer's other static layers (tile fills, terrain texture overlays) follow the same pattern. Future elevation-mutation calls `draw` once on the elevation change, not per frame.

**Cliff strips draw inward from the tile's edge, not outward.** A cliff strip on a tile's south edge occupies the bottom `thickness` pixels of *that tile's* footprint. The alternative — drawing outward onto the lower neighbor's space — would put cliff visuals on a tile that doesn't "own" the cliff, and would conflict with that tile's own cliff strips if it has any. Inward draws keep each tile's cliff strips self-contained.

**Corner stack markers deferred to S33.** Per Chris's plan-review call. Cliff edges are the *primary* visual cue for elevation change ("rises here"); stack markers are *secondary* ("this tile is at level N"). The cliff edges land alone in S32 with React Ridge waiting in S33; if the cliff-edges-alone read proves insufficient against the real content, markers ship in S33 in the same overlay pass.

## Consequences

- **Training Field renders unchanged.** Uniform elevation = no cliff strips drawn. Verified visually in the browser preview at S32 close.
- **River Ridge (S33) will read its three tactical zones at a glance.** The western foot's 1-step rises produce thin hint-strips; the central ridge's sharp jumps produce medium strips; the eastern perch's 5-7 drops produce full 3px strips. The directional shading gives each tile-block a 3D-ish read.
- **No engine surface change.** The cliff-edge layer reads `BattleMap` (engine type) but does not consume `GameState` or `Catalog`. The architecture's engine-blind-renderer rule is preserved.
- **Tests at 875 pre-cliff → 887 post-cliff.** 12 new unit tests in `src/renderer/cliff-edge-layer.test.ts` cover thickness scaling (5 cases against the categorical tiers), darken-factor edge categorization (3 cases), and the multiplicative-darken helper (5 cases including channel clamping). No snapshot tests against rendered Graphics output — the renderer's other layers don't have snapshot tests either; the helper functions are the load-bearing units.
- **Layer hierarchy widens by one container.** Existing layer references (`tileLayer`, `highlightLayer`, `unitLayer`) are unchanged; the new `cliffEdgeLayer` slots between tile and highlight. No call-site changes outside `BattleRenderer.constructor` + `BattleRenderer.mount`.
- **Constants centralized.** Five new constants in `src/renderer/constants.ts` (thickness × 3 categorical tiers, darken factors × 2 lighting tiers). A future re-tuning happens in one file.
- **Future re-paint hook is present but unused in v1.** `cliffEdgeLayer.draw(map)` is idempotent; calling it again with the same map produces the same strips. If a future ability changes a tile's elevation, the renderer can re-call `draw` to repaint. No state needs to flow into the layer beyond the map itself.

## Alternatives considered

**Continuous thickness scaling (1px per delta, no cap).** Considered. Rejected: 7-9px cliffs at the eastern perch would dominate the tile and conflict with sprite + status-badge content.

**Linear-with-cap at 3px (1px / 2px / 3px for Δ = 1 / 2 / ≥3).** Considered. Rejected: loses discrimination between Δ=2 (moderate climb) and Δ=4 (sharp drop). Categorical binning preserves three tiers without an even more granular range.

**Numerical glyph in the tile corner showing the actual elevation.** Considered (a 3-5px digit per tile reading "9" on the perch, "0" on deep water). Rejected for v1: reads as text rather than visual, denser than the player needs for tactical planning, and the tile-info panel already covers precise readout. Deferred to S33 as the "corner stack markers" option — which itself defers per the plan-review.

**Cliff strips on all four edges in the same color (no directional shading).** Considered. Rejected: flatter; no volume read.

**Reading the lower neighbor's palette for the cliff color.** Considered. Rejected: material-identity mismatch (a grass tile's "cliff face" reading as the lower neighbor's blue water color is wrong).

**Drawing cliff strips outward into the lower neighbor's space.** Considered. Rejected: tile-ownership conflict + visual overlap with that neighbor's own cliff strips.

**Per-frame repaint of cliff strips.** Considered. Rejected: wasted work; cliff strips are static.

**Cliff edge as a tile-info-panel hint only (no rendering).** Considered. Rejected: defeats the design intent — the cliff edge should communicate elevation *spatially*, not through a separate text panel.

**Stack markers shipped alongside cliff edges in S32.** Considered (brief decision D7 / D10). Rejected per plan-review: corner stack markers are secondary information (precise elevation) where cliff edges are primary (rises here). Ship the primary substrate in S32; layer markers in S33 alongside River Ridge content if cliff edges alone prove insufficient.

## References

- `src/renderer/cliff-edge-layer.ts` — `CliffEdgeLayer` class; `cliffEdgeThicknessFor`, `cliffEdgeDarkenFactorFor`, `darkenColor` helpers.
- `src/renderer/cliff-edge-layer.test.ts` — categorical tiers, darken-factor, color-darken unit tests.
- `src/renderer/constants.ts` — `CLIFF_EDGE_THICKNESS_PX_DELTA_*`, `CLIFF_EDGE_DARKEN_*` constants.
- `src/renderer/battle-renderer.ts` — layer instantiation + `draw` call at mount.
- `docs/twentyOneDesign/river-ridge.md` — elevation grid + tactical zones.
- `docs/design/map-and-battlefield.md` — elevation + traversal model.
- ADR-0054 — terrain texture infrastructure (preserved; cliff edges layer on top).
