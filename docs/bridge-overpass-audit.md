# Bridge / Overpass Infrastructure Audit (S96)

*An audit of existing multi-layer groundwork ahead of the bridge feature (Chris's
Alvera intent: bridge tiles over other tiles — passage under, over/under choice in
movement and targeting). No implementation in this pass; this document is the
scoping input. Three parallel code audits (engine spatial / combat+targeting+AI /
renderer+UI) plus a docs-and-ADR sweep.*

## Headline

**The groundwork is real, deliberate, and deep.** `layer` was designed into the
data model from day one (`core-types.md`: "layer 0 is ground, layer 1+ might be a
bridge"; the spec text in `map-and-battlefield.md` §movement/§LoS/§AoE describes
layer-aware behavior, not single-layer behavior), and — more than the docs
promise — most of the ENGINE actually implements it. The engine's mechanical
core would *function* today on a map with a bridge tile (layer 1, elev 5) over
ground (layer 0, elev 1). The concentrated work is in (a) four known correctness
gaps, (b) absent validation rules, and (c) the renderer/UX, which has no visual
or interaction vocabulary for two tiles at one (x,y) — that is the majority of
the feature.

## What already works (verified layer-aware, file:line)

| Surface | State | Evidence |
|---|---|---|
| Tile/unit accessors | `tileAt`/`unitAt` keyed (x,y,layer); `tilesAt` returns the full stack | `engine/map/accessors.ts:26-68` |
| Pathfinding & adjacency | Neighbor expansion iterates ALL layers at each adjacent (x,y); step legality = elevation delta vs Jump — bridge ends are climbable exactly per spec, no "transition tile" needed | `pathfinding.ts:249-251, 149-155` |
| Occupancy | `positionKey` = `x,y,layer` everywhere (reachability, occupancy, AI maps) | `pathfinding.ts:52-54` |
| Knockback | **Correct bridge-fall already**: landing scan picks the highest tile ≤ current elevation at the next cell — knocked off a bridge, you land on the ground below and take elevation-true fall damage | `knockback.ts:98-150` |
| Worldcraft reducers | Terrain/barrier changes are layer-anchored; a cast against ground under a bridge touches only layer 0 and drops only layer-0 occupants | `worldcraft-resolution.ts:85-97`, `reducers.ts` terrain/barrier reducers |
| Move / selfMove / grapple throw | Full-position destinations, layer-aware legality; ledge-throws off a bridge already legal + fall-damaging | `reducers.ts` + `validate.ts:173, 420-447` |
| **Arc cover** | `isCovered` (any tile at higher layer over source/target blocks the lob) is **fully implemented**, not just spec'd — bridges already provide cover from arcs | `arc.ts:39-52` |
| **AoE multi-layer** | `aoeFootprint` enumerates the whole stack and hits every layer within vertical tolerance — the spec's "fireball under the bridge hits both" is live code | `aoe.ts:168-189` |
| Targeting validation | Payloads carry layer end-to-end; a layer-1 tile target validates on its merits | `validate.ts:602, 745` |
| Damage height reads | height-delta variance, elevation hit-chance read true `tile.elevation` through per-layer tiles | `damage/handlers.ts:609-621` |
| Math Skill `height` | Per-layer tile elevation | `targeting/math-skill.ts:86-89` |
| AI (most of it) | Coverage map keys (x,y,layer); unit-targeted attacks/reach layer-aware; a unit ON a bridge is targetable | `ai/threat/coverage-map.ts:143, 286-322`; `ai/basic.ts` reach sites |
| Deployment zone machinery | Structurally layer-keyed (content just authors layer-0 literals) | `engine/map/deployment-zone.ts:17-19, 162-176` |

## The gaps

### Correctness (all currently masked by single-layer content)

1. **Straight-line LoS — the documented "buried under a bridge" limit is real.**
   `hasLineOfSight` checks the ray against EVERY tile in the stack at each
   crossed cell, so a ground-level ray under a bridge reads as buried in the
   deck and blocks (`line-of-sight.ts:83-93`; limit acknowledged at `:29-32`
   and in `map-and-battlefield.md` + ADR-0117). Needs a layer-aware ray — and a
   DESIGN DECISION about what a bridge blocks (see decisions below).
2. **Cover primitive conflates layer with elevation.** `cover.ts:64` passes
   `position.layer` where it means tile *elevation* — a bridge coverer (layer 1,
   elev 5) shielding a ground ally would gate on |1−0| instead of |5−1|. The
   only combat site that confuses the two; a small fix.
3. **AI tile-target enumeration hardcodes layer 0.** `basic.ts:1479-1481` — the
   AI would never aim a tile-targeted cast / AoE anchor / barrier at a layer-1
   tile (unit-targeting on bridge units still works).
4. **UI tile-target enumeration hardcodes layer 0** — the same bug's twin at
   `use-turn-flow.ts:1324-1326`. The picker would never OFFER a bridge tile even
   though validation would accept it. (The AoE *preview* is layer-aware.)

### Validation (safety rails that don't exist)

5. **The documented v1 "maps validated to layer 0 only" rule is NOT enforced**
   (`map-validator.ts:23-24` defers it explicitly; the duplicate-position check
   is already layer-keyed, so a stacked map passes silently today). Good news
   for the feature — the door is open — but it also means NO multi-layer
   consistency rules exist: nothing requires a bridge tile to sit above the
   under-tile's elevation, no clearance rule, nothing prevents interpenetration.
6. **`createInitialState` validates no positions at all** (`create-initial-state.ts:340`)
   — placements are trusted verbatim, layer included.

### Renderer / UX (the majority of the feature)

7. **Everything pixel-space is flat; there is no vocabulary for a stack.**
   - Tile draw z-orders by layer (that part exists) but draws stacked tiles at
     the identical rect — the bridge fully overdraws the ground
     (`tile-layer.ts:61-76`).
   - Units ignore `position.layer` for placement — on-bridge and under-bridge
     units render at the same pixel (`unit-layer.ts` / `world.ts:20-30`; the
     world transform's layer math is an explicit no-op pass-through, i.e. the
     seam was left ready).
   - Elevation labels overprint per stacked tile; highlights/deployment
     tints/cliff strips draw per (x,y) with no layer distinction.
   - **The hit test resolves topmost-layer-wins** (`battle-renderer.ts:627-633`)
     — the under-tile is unclickable, full stop. Notably, dev instrumentation
     ALREADY logs the "occupant on a different layer than the picked tile"
     hazard (`battle-renderer.ts:634-657`) — this failure mode was anticipated.
   - Elevation currently reads through corner digits + cliff-edge strips only —
     a genuinely new affordance is needed for over/under (per-layer lift in
     `world.tileCenter`, a stack-disambiguation control, layer-keyed overlays).

## Answers to the stated decision questions (from the audit)

- **What does Worldcraft do to a bridged tile?** The reducers are already
  layer-anchored: a cast mutates exactly one layer, and lowering ground under a
  bridge drops only ground occupants — arguably correct as-is. The decisions
  are: (1) may raised ground *reach* the bridge underside (a clearance/collision
  rule — today nothing would stop a Pillar from raising ground THROUGH the
  deck's elevation, producing interpenetrating tiles); (2) can Worldcraft target
  a bridge deck itself (raise/lower a bridge? probably forbidden — needs a rule,
  e.g. bridges are not terraformable, mirroring how barriers are objects);
  (3) the targeting UI must say which layer a tile-cast anchors (same problem
  as gap 4/7).
- **How does LoS work?** Arcs are already right (bridge = cover from lobs, per
  spec and code). Straight-line needs the layer-aware ray plus one model
  decision: what vertical band does a bridge deck occlude? Simplest coherent
  rule: a tile occludes rays passing at elevations (underside..deck-top] of that
  tile, where "underside" needs either a declared thickness or a convention
  (e.g. deck occludes only rays at exactly its elevation band ±ε; rays strictly
  below the underside pass). That constant/field is the actual decision.
- **How does the UI toggle between two elevations at one (x,y)?** Nothing
  exists; the pick path yields one (x,y) and hard-selects the top layer. The
  affordance is greenfield — candidates: click-cycles-the-stack, a modifier/hover
  toggle, or a small stack chip near the cursor; plus per-layer visual lift so
  the two reads differ at all. This interacts with move overlays (both layers
  can be legal destinations at one cell) and tile-cast anchoring.

## Decisions the docs already flag (inherited open questions)

- **AoE hits all qualifying layers** is implemented per spec; the doc flags a
  possible per-ability constraint ("highest layer only") as an open question —
  confirm the default is wanted before bridge maps make it observable.
- **Authoring format**: the elevation-grid map format authors exactly one tile
  per (x,y). Bridge tiles need an authoring extension — most likely a small
  explicit overlay list (positions + elevation + terrain, layer 1) on top of the
  base grid, rather than a second full grid.
- Minor inherited edges: the jump-over-water leap check scans all layers for
  water (`pathfinding.ts:277-281`, noted in code); bounded-arc apex scans the
  whole stack at intermediate cells (a bridge over the flight path can block a
  lob — plausibly desirable).

## Scope read

- **Engine correctness** (gaps 1-4): small-to-medium. 2/3/4 are localized fixes;
  1 is medium and carries the one real LoS design decision.
- **Validation rules** (gaps 5-6): small — author the multi-layer consistency
  rules (bridge above under-tile + clearance) into `validateMap`, add placement
  checks.
- **Authoring + content**: small — overlay-list format, then the Alvera bridge
  itself is content.
- **Renderer + UX** (gap 7): the real work — new visual vocabulary (per-layer
  lift seam already stubbed in `world.ts`), stack-aware picking + toggle
  affordance, layer-keyed overlays/labels. Likely a session of its own.

A workable sequencing: engine fixes + validation + authoring format with
placeholder visuals (bridge renders as its own tile, topmost-wins picking kept)
in one pass; the over/under UX pass second, once the interaction design is
chosen.
