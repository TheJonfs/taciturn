## ADR-0117: Terrain-mass occlusion for straight-line LoS + bounded arc apex

**Status:** Accepted
**Date:** 2026-06-17

## Context

A geometry-realism follow-up that surfaced from the S69 Vantage/LoS investigation
(see the S69 handoff). Two related gaps in the v1 sight/lob model:

1. **Straight-line LoS ignored terrain mass.** `hasLineOfSight` only occluded a
   ray inside a barrier's or `blocks_los` column's 1-tall band; a tile's own
   ground elevation never occluded. Since no v1 map uses `blocks_los`, the *only*
   thing blocking a straight-line spell was a Terraformer barrier — you could
   shoot a Lightning Bolt straight through a 50-tall mountain of plain ground.
2. **Arc lobs were unbounded.** `arcTargetable` checked only that the source and
   target tiles weren't covered by a higher layer; intermediate obstructions were
   ignored entirely (the projectile modeled as infinitely high), so a bow could
   lob over a 50-tall peak just as easily as a garden wall.

Chris's calls (from the design discussion):
- Terrain occlusion applies to **straight-line abilities only** (the spells and
  anything flagged `straight_line`). **Bows keep arcing** ("shoot up and over",
  FFT-style) — but a true mountain should still block them.
- The arc gets a **bounded apex**: a lob clears cover up to a height cap, not
  infinitely. Cap = **5**, chosen to mirror the bow's height-delta damage falloff
  (`falloffPerHeight: 0.2` → a bow already deals 0 at a +5 height delta), so a bow
  lobs over cover up to exactly the height where its shot would be worthless.

The rangeMode split makes the scoping fall out for free: `straight_line` →
`hasLineOfSight`, `arc` → `arcTargetable`. They're separate functions, so the LoS
change is automatically spell-only and the arc change automatically bow/lob-only.

## Decisions

### Straight-line: terrain-mass occlusion (`line-of-sight.ts`)

`tileBlocksAt` gains a leading rule: **block when `rayElevation < tile.elevation`
(strict).** The ray is below the tile's ground surface → buried in the terrain
mass → occluded. Strictness is load-bearing:
- A level shot across flat ground rides at exactly `tile.elevation` (ray ==
  surface) → not `<` → **passes**.
- A shot riding a smooth up/down slope grazes the surface → **passes**.
- Only ground that rises *above* the interpolated sightline occludes.

This composes with the existing barrier (`>=` floor) and `blocks_los` column
(strict-both-ends) band checks, which still handle at-grade walls. Endpoints are
excluded by the caller's loop, so standing on a cliff doesn't block your own shot.
Vantage's +2 source elevation (ADR-0115) raises the whole ray, so a perched/Vantage
attacker can see over a ridge a flat one can't — and there's now a real height
threshold to do so (e.g. seeing over a +0 hump into a −3 pit needs the crest in
the sightline).

### Arc: bounded apex (`arc.ts`)

`arcTargetable` keeps the source/target cover checks and adds: walk the Bresenham
cells and **block when any intermediate tile's surface exceeds
`max(sourceElev, targetElev) + ARC_LOB_CLEARANCE` (5).** A flat ceiling above the
higher endpoint — deliberately *not* a parabola, so it stays generous near the
endpoints (you can still lob over an adjacent wall), which is the intended feel.
Vantage is **not** folded into the apex (it already boosts a bow's
reach-from-height; the lob apex is a property of the projectile). The function
reads endpoint elevations from the map itself, so the two call sites in
`validate.ts` are unchanged.

This applies to **all `arc` abilities**, not just bows — the lobbed/area attacks
(Rock Toss, Earthquake, Cataclysm, Tidal Wave, Maelstrom, Discharge Strike) and
arc-targeted riders now respect a mountain too. Coherent ("even a catapult can't
clear a peak") and the cap only bites on extreme height gaps, so the practical
blast radius is small.

### Shared rasterizer

`bresenhamCells` (+ `Cell`) extracted from `line-of-sight.ts` to
`src/engine/map/bresenham.ts` so LoS and arc sample the same cells (one concept
per file; no behavior change to the walker).

## Consequences

- Straight-line spells now respect terrain mass; bows lob over cover but not
  mountains. Both ride the same functions the AI threat/coverage model and the UI
  forecast already read, so AI targeting and player previews update consistently
  with no extra wiring.
- `ARC_LOB_CLEARANCE` and the implicit "below surface blocks" rule are the dials.
  `ARC_LOB_CLEARANCE` is a single retunable constant; logged in playtest-watch.
- **Multi-layer caveat:** terrain occlusion applies across all layers at an (x,y),
  so a ray under a bridge would read as buried in the upper tile. v1 maps are
  single-layer; flagged for a layer-aware refinement if stacked maps land.
- **Player-facing** (a real game-rule change): documented in guide-changelog. The
  straight-line occlusion is the balance-significant half (it changes spell play
  on elevation-rich maps); the arc cap is balance-light (extreme heights only).
  Both want Chris's in-battle feel pass — especially the interaction with the
  freshly-tuned S68 bow/Vantage content.
- No test regressions (1935 → 1943). Geometry unit tests added in
  `line-of-sight.test.ts` (+5) and `arc.test.ts` (+3); `tsc` + `vite build` clean.

## Alternatives considered

- **Scope occlusion to straight-line via a flag instead of the rangeMode split:**
  unnecessary — bows already use `arc`, a different function.
- **`rayElevation <= tile.elevation` (inclusive):** rejected — it would block every
  flat-ground shot (ray == surface at each tile). Strict `<` is required.
- **True parabolic arc apex:** rejected as over-engineering; the flat ceiling
  matches the discrete FFT feel and is one tunable constant.
- **Vantage raises the arc apex:** rejected — avoids double-dipping with the bow's
  reach-from-height bonus; keeps the lob apex a projectile property.
