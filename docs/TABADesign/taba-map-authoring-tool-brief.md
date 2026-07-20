# Brief — Battle-map authoring tool (Cartographer)

*Status: plaintext review by Chris before it ships to CC. The companion to Atlas: where Atlas authors the
campaign graph, this authors the **battle maps** (tiles) the nodes fight on — the tool the node-authoring
substrate doc always flagged as "a separate, bigger tool." Audit-first: one session audits the map data
format + renderer + enemy-kit framework, then builds. Same proven shape as Atlas (DEV-gated in-app,
codegen, byte-identical round-trip, live preview through the real renderer).*

---

## Context

Ch1 needs maps. Oskun and Alvera shipped from Chris's hand-specced elevation grids → implementer build;
that hand-spec loop doesn't scale to the ~8 remaining Ch1 battlefields (plus Ch2/3). A direct canvas — paint
elevation/terrain, mark deployment zones, preview on the real renderer, export the install-ready data — is
the same ergonomic win Atlas gave the graph, and it earns its keep most now while many maps are unbuilt.

## The enemy-party question (recommendation)

**Attach enemy-party authoring to this tool, keep its data separate, and tier it.**
- **Attach** — enemy placement is *spatial* (units go on *this* terrain, near *these* zones); the same
  canvas is the right workflow, and a story battle is "map + lineup + zones" authored together.
- **Separate data** — maps are *reused* (a node's skirmishes reuse the map with *generated* enemies; its
  story battle uses it with an *authored* lineup), so a map is a reusable template and a lineup is
  battle-specific: export them separately (map template; lineup referencing a map + positions).
- **Tier it** — the terrain+deployment core is the urgent, Atlas-scale need; enemy placement is a second
  mode on the same canvas. Build the core first; **the audit decides whether the enemy tier fits the same
  session or is a fast-follow.** (Mirrors Atlas: structural tier shipped, enemy-depth deferred.)

## Goal

A DEV-gated in-app map editor: a pan/zoom tile canvas where each tile carries elevation, terrain
(auto-from-elevation, overridable), properties, and deployment-zone membership (player/enemy); live-previewed
through the **real battle renderer**; exporting install-ready map data with a **byte-identical round-trip**
on the shipped maps. Enemy-party placement is a designed-in second mode (scope per audit).

---

## Tier 1 — Map canvas core (the priority)

**Canvas.** Pan/zoom grid (maps can be large — reuse Atlas's canvas patterns). Set map width/height.

**Per-tile editing:**
- **Elevation** — paint/set per tile (the primary authoring act; Chris authors in elevation grids today).
- **Terrain** — **auto-derived from elevation by a default rule** (elevation bands → terrain; the bands are
  content, Chris's call), **overridable per tile** (Chris's "if not auto-defined by its elevation"). Paint
  from the **existing registered terrain vocabulary only** — inventing a *new* terrain type is engine work
  (the `canEnter` + `AUTHORED_TERRAINS` gotcha across all 14 classes, per S97), out of tool scope.
- **Properties** — the `TileProperty` flags (blocks_los, hazard, slippery, …); lean is auto-from-terrain
  where sensible (water → its properties) + explicit per-tile overrides. Confirm the set with the audit.
- **Deployment zones** — mark tiles as player-zone / enemy-zone / neither (the "proposals" from Oskun/Alvera
  become first-class authored data).

**Live preview** — render the authored map through the **real battle map renderer** (elevation shading, the
deck-lift for any stacked cells, terrain art) so what you author is what ships — the anti-drift payoff Atlas
proved. 

**Export + round-trip** — codegen the install-ready map template; **import a shipped map (River Ridge /
Oskun / Alvera) → edit → export byte-identical** is the correctness spine (as with Atlas's M1 pin). The
shipped maps are the round-trip corpus.

**Validation** (reuse the map-validator; it already has multi-layer rules): terrain in-vocabulary; each
deployment zone ≥ its side's deployable count; map connectivity/reachability (units can path as intended);
the multi-layer rules for any stacked cells.

**Multi-layer / bridges (scoping — see below):** at minimum the tool must **round-trip Alvera's bridge
losslessly** even if v1 doesn't fully *edit* stacked cells (same content-coexistence pattern as Atlas
preserving enemy content). Full bridge-authoring may be a deferred tier.

## Tier 2 — Enemy-party placement (attached; scope per audit)

A second canvas mode: **place enemy units on the authored map** — per unit a **class + level + position +
facing**; **kits auto-assigned via the existing `enemy-kit.ts` framework** (level × JP budget), with kit/
equipment override **deferred** (the Atlas enemy-depth decision — v1 is class+level+position, the framework
fills the rest). Export as a **battle lineup** that references a map id + unit placements, separate from the
map template. Player-side guests (the WI4 guest allies) may want authoring here too — confirm in the audit.

---

## Scoping questions (settle in review or pose to the audit)

1. **Bridge/layer authoring in v1?** Lean: v1 authors single-layer freely, **round-trips** multi-layer maps
   losslessly, and defers full stacked-cell *editing* to a fast-follow tier (bridges are sparse; Alvera was
   hand-authored and the few bridge maps can stay hand-authored briefly). Confirm.
2. **Enemy tier same session or fast-follow?** The recommendation attaches it; the audit sizes whether the
   terrain core + enemy mode both fit one session. Terrain core is the priority if a split is needed.
3. **Property authoring depth** — full `TileProperty` editing vs auto-from-terrain + a few explicit
   overrides. Lean: the latter for v1.

---

## Acceptance criteria

- Round-trips the shipped maps byte-identical (incl. Alvera's bridge data, even if v1 can't edit it).
- Author a fresh single-layer map end to end: paint elevation, terrain auto-follows with overrides, mark
  player/enemy deployment zones, preview on the real renderer, export install-ready data, and **fight on it**
  (wire it to a node and enter the battle).
- Validation catches: out-of-vocabulary terrain, undersized deployment zones, disconnected/unreachable
  regions, multi-layer rule violations.
- (If enemy tier in scope) place a lineup on the map, kits auto-assigned, export a map-referencing lineup;
  the battle runs with it.
- DEV-gated out of production; suite green, `tsc -b` clean.

## Out of scope

- **New terrain *types*** (engine work: `canEnter` + `AUTHORED_TERRAINS` across all classes).
- **Full stacked-cell/bridge editing** (deferred tier; v1 round-trips but may not fully edit).
- **Enemy kit/equipment override** (deferred; the framework fills kits — Atlas enemy-depth parallel).
- **Victory/outcome conditions** — those live in `node-content.ts` (the ADR-0149 outcome system), authored
  separately; not map-tool data.
- **Map art/illustration backdrop** (future; the tool authors mechanical tile data).
- **Battle-template *registry* wiring** beyond export (how a node references a map is Atlas/node-content).

## Workflow notes

- **Audit-first**, specifically: the shipped **map data format** (what the export must match; where the
  round-trip corpus lives — `docs/maps/` specs vs the built data), the **real renderer** reuse surface, the
  **elevation→terrain** default rule (does one exist, or is it new), the **map-validator** reuse, and the
  **`enemy-kit.ts`** interface for Tier 2.
- File paths herein are inferences — audit to correct (my recurring miss; the "audit to confirm" is load-bearing).
- Mid-session design questions route through Chris to the planner.

## Watch-fors

- **Round-trip fidelity on the bridge** — Alvera's stacked-cell data is the fidelity trap (as the
  hand-authored enemy logic was for Atlas); losing it on export is the primary failure to guard.
- **Terrain-from-elevation surprising the author** — auto-derivation must be visible and easily overridden,
  or painting elevation silently rewrites terrain the author wanted kept.
- **Deployment zone vs party size** — an undersized zone is a battle that can't start; validate loudly.
- **Preview vs ship divergence** — the whole point is the preview *is* the real renderer; if it forks into a
  tool-specific renderer, the anti-drift value is lost.

## Estimated size

Tier 1 is a full session — Atlas-scale, front-loaded by the round-trip spine (import/export the shipped-map
format) and the real-renderer preview wiring; the canvas + per-tile editing is the bulk. Tier 2 attaches if
the audit says it fits, else fast-follows. The shipped maps give an immediate round-trip corpus, and Alvera
gives the bridge fidelity test.
