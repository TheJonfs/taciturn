# ADR-0155: Bridges — the multi-layer mechanical substrate

**Status:** Accepted (2026-07-18, Session 96 — same session as the audit)

**Context:** Chris wants bridge tiles that pass over others (walk over OR
under, target either layer) — the feature the day-one `layer` field was
reserved for. The S96 audit (`docs/bridge-overpass-audit.md`) found the
engine's spatial core already layer-aware (pathfinding, occupancy,
knockback bridge-falls, arc cover, multi-layer AoE) with four correctness
gaps, no validation rules, and a greenfield renderer/UX surface. This ADR
covers the MECHANICAL pass — Chris's design rulings and their
implementation. The over/under UI/visualization pass is deferred (and an
FFT-style isometric view was explicitly parked as a future project; the
world transform's no-op layer pass-through is where it would land).

## Chris's rulings

1. **LoS — the deck band.** A deck (layer ≥ 1 tile) has a 1-tile solid
   body hanging below its surface, mirroring the Barrier's height-1
   convention pointed downward: it occludes rays in the open band
   `(elevation − 1, elevation)`. Rays pass over the top (strict `<`, the
   ground convention), graze the underside (strict `>`, the blocks_los
   column convention), and travel clean beneath. `BRIDGE_DECK_THICKNESS = 1`
   (`src/engine/map/bridges.ts`). This closes the documented
   buried-under-bridge limit (map-and-battlefield.md; ADR-0117 caveat).

2. **AoE — vertical tolerance decides, per the existing rule.** The shipped
   `aoeFootprint` behavior (hit every layer within tolerance of the anchor,
   measured on true elevations) IS the ruling: a tolerance-2 blast under a
   deck 4 above leaves the bridge-standers safe, and vice versa; a low span
   catches both. No code change. A per-ability `layerScope` override
   ('all' | 'highest' | 'lowest') is noted as the natural extension and
   deliberately NOT built until an ability wants it.

3. **Worldcraft — decks are destroyable, and destruction is PERMANENT.**
   - A lowering cast (Pit/Valley) whose kernel lands on deck cells destroys
     those spans. Occupants fall the FULL true-elevation drop to the
     layer-0 tile below (a 7-high bridge Pit'd = a 7-tile fall).
   - Destruction never enters the Worldcraft effect queue and no revert
     restores it — the queue is the home of *revertible* effects; the
     earth remembers, carpentry doesn't. A destroy-only cast consumes no
     queue slot.
   - A raising cast (Pillar/Hill) cannot target a deck ("no earth to
     shape"); kernel raises skip deck cells.
   - **RAM (Chris: "Worldcraft is a violent act"):** a ground raise that
     would leave less than `BRIDGE_MIN_CLEARANCE = 2` under a deck
     destroys the deck, chained from the terrain-change reducer. The
     occupant lands on the freshly-risen ground (usually a soft landing —
     coherent: the pillar erupts through the span). Reverts can't ram
     (they restore validated authored elevations).
   - Supporting exemption: elevation Worldcraft bypasses the arc cover
     gate — it shapes the earth from below, not a projectile from above;
     without this, no cast could ever aim beneath a span and the ram
     would be unreachable. Everything else keeps cover (a bridge still
     shields from lobs).

## Implementation notes

- **`system_bridge_destroy`** — new ActionType (all five lockstep sites
  per `docs/conventions/action-types.md`). Payload: deck tile coords;
  outcome: appliedCount + `fallen` (unitId, landing, drop). Fallers land
  on the layer-0 tile at their (x,y), else the first free cardinal
  neighbor (N/E/S/W, deterministic); validation rejects the pathological
  no-landing cast ("No landing below the collapsing bridge"); barriers on
  a destroyed span die with the tile. Falls emit the shared falling
  `system_damage`. Renderer: static-layer redraw + a flash settling
  fallen sprites (`positionAfter`).
- **Map validation** (the audit's missing rails): a deck requires a
  layer-0 tile beneath, must clear it by ≥ 2, and v1 caps the stack at
  one deck layer. `createInitialState` placement validation remains open
  (pre-existing; unchanged scope).
- **Audit gap fixes:** `cover.ts` vertical gate now reads tile elevations
  (was layer indices — its tests faked height via `layer: 9`, the exact
  conflation); AI and UI tile-target enumeration offer the whole stack
  (both hardcoded layer 0 — decks were unproposable/unofferable).
- **AI:** the Pit/Valley fall scorer values deck destroys through the
  shared fall gate — Pit-the-bridge weighs like shove-off-a-cliff. No
  dedicated bridge tactics beyond that (floor, not ceiling).
- **Interim picking** (pending the UX pass): the hit test still resolves
  topmost-first, but an occupied lower layer wins when the top tile is
  empty — under-bridge units stay clickable. Deliberately NOT the final
  affordance; the over/under toggle replaces it.
- **Content:** `bridge` terrain (land-tagged; rampart plank art as
  placeholder) + the Alvera western bridge — three elev-3 deck tiles at
  x=2 over the river band y=7-9 (clearance exactly 2 over the shallows,
  3 over the channel). The game's first shipped multi-layer feature.

## Known deferred edges (for the UX pass or later)

- Stacked cells render as topmost-overdraw; elevation labels overprint;
  both layers' highlights merge — the visual vocabulary is the next pass.
- A charged tile-anchored cast whose anchor deck is destroyed mid-charge
  is unexercised (no v1 content combination); flagged, not guarded.
- Deployment zones exclude stacked cells by authoring convention in v1.
- No unit-height concept: walking under any-clearance span is legal
  (the ≥ 2 validation rule keeps it from ever looking silly).
