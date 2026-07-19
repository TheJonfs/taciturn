# ADR-0156: Bridge over/under UI — deck lift, context-first picking, the stack chip

**Status:** Accepted (2026-07-19, Session 97)

**Context:** ADR-0155 shipped the bridge *mechanical* substrate and flagged
the visualization + interaction half as open: stacked cells overdrew (deck
only), elevation digits overprinted, both layers' highlights merged, and
picking was an interim occupant-priority-topmost rule — you could not click
a move destination UNDER the span. The S97 brief
(`docs/TABADesign/taba-bridge-over-under-ui-brief.md`) scoped the pass:
see-both via a local deck lift + shadow, pick-which via context-first
resolution, a stack chip for the genuinely-ambiguous case. The global
multi-floor layer-focus mode stays deferred until a dense multi-floor map
exists; isometric stays parked.

## Decisions

1. **See-both = a diagonal (up-left) deck lift + drop shadow.** The top
   tile of a stacked cell draws shifted `(−lift, −lift)` from its true
   footprint, with a translucent shadow rect left at the footprint; the
   ground tile "peeks" in the L-shaped strip (right + bottom edges) the
   lift uncovers. **The diagonal is load-bearing, not styling:** Chris
   approved trying a straight-up shift first, but implementation proved it
   self-occluding on the live content — Alvera's bridge runs north–south,
   and a straight-up lift drops each deck's overhang exactly onto the
   sliver of the stacked cell north of it, so interior under-cells of a
   vertical span would never peek. The diagonal keeps one sliver edge open
   on any straight run (right strip on N–S spans, bottom strip on E–W).
   Flagged for Chris's playtest; the lift vector is centralized if the look
   needs rework.

2. **Visual lift is clamped, decoupled from mechanical elevation.**
   `lift = clamp(Δelev × DECK_LIFT_PX_PER_ELEVATION, DECK_LIFT_MIN_PX,
   DECK_LIFT_MAX_PX)` (5px/elev, floor 14, ceiling 22 — constants.ts). The
   floor keeps the sliver wide enough for the ground tile's elevation digit
   and a tap; the ceiling keeps tall spans from overrunning neighbors (the
   brief's lift-vs-readability watch-for).

3. **One geometry source.** `StackGeometry` (renderer/world.ts) is built
   from the map at mount and rebuilt on every map mutation (terrain change,
   bridge destruction). Every consumer — tile art, cliff strips, elevation
   digits, highlights, kernel previews, unit sprites (via `positionCenter`),
   the animator's tweens, the hit-test, and the chip — reads the same lift,
   so art and picking cannot disagree. Covered-ground visuals confine
   themselves to `visibleGroundRects` (the sliver strips minus neighboring
   deck overhangs), so nothing paints on top of deck art; that same region
   is what the hit-test resolves as a ground click — WYSIWYG picking.

4. **Pick-which = geometric hit-test + UI-side context resolution.** The
   renderer's hit-test is purely geometric (the layer whose art is under
   the pixel: lifted deck rects first — they overhang up-left — else the
   nominal cell's ground). The click/hover contract now carries the FULL
   stack (`TileStackEntry[]`, topmost first) and the UI resolves per state
   (`src/ui/stack-click-resolution.ts`): a clicked layer that is itself
   valid stands; a single valid other layer wins (the under-span move fix);
   ambiguous falls back to the click. Applied uniformly to move-select,
   move-await-confirm (same-cell layer re-pin), target-select, tile-set,
   and grapple-throw — each mode's validity is its existing legal-position
   list, so resolution and highlights can never disagree. Hover applies the
   SAME resolution, so the hover accent / AoE preview / forecast anchor
   always show the layer a click would commit. The S96 occupant-priority
   rule survives only as the idle-inspection tiebreak
   (`resolveInspectionEntry`), no longer as a front-line rule.

5. **The stack chip (WI3) is renderer-drawn, tap-first, and appears only
   when disambiguation is warranted.** A two-segment picker (deck digit
   over ground digit, gold accent on the active layer) drawn in world space
   beside the stacked cell, flipping to the left edge on the last column.
   Shown when: hovering a stacked cell whose layers are BOTH valid for the
   current pick; the pinned stacked destination while its confirm row is up
   (the touch path — tap the other segment to re-pin); or idle/action-menu
   hover (inspection switch). The chip owns no Pixi events: the stage
   hit-test consults `segmentAt` first, so a chip tap arrives as a
   layer-EXPLICIT tile click through the same handler as clicking the
   layer's art — one code path for mouse and touch. `containsPoint`
   (inflated by the cell→chip gap) freezes hover while the pointer crosses
   to the chip. WI4 (click-cycles-stack / modifier accelerators) was
   deferred entirely per Chris — the chip + directly-clickable sliver cover
   the need without muddying click-to-confirm.

6. **Fix (pre-existing S96 gap): `'bridge'` joins every class's
   `canEnter`.** The ruleset registered the terrain as "walkable by every
   class, like rampart" but no class whitelist included it — no unit could
   step onto a deck at all (S96 verified under-span pathing and rendering,
   never walking on). All 14 class files updated;
   `src/content/bridge-walkability.test.ts` pins both the content rule and
   the live-map behavior (Alvera deck reachable from the (2,6) bank).

## Consequences

- Stacked cells render legibly with zero cost to the ~all single-layer
  cells (absent from the stack index; all lift reads early-out).
- The renderer's engine-blindness holds: it resolves geometry only; state-
  dependent meaning lives in the UI hook, fed by the stack it already gets.
- `playActions` now redraws static layers BEFORE enqueueing the animator so
  bridge-destroy fall targets compute against post-mutation geometry.
- Unit sprites z-sort by position layer on stacked cells
  (`unitLayer.sortableChildren`); deck occupant draws over ground occupant.
- Browser-verified on Alvera (S97): under-span move via sliver click +
  context resolution; deck move via deck-art click AND via chip tap; chip
  appearing only in ambiguous cases; sprite riding the lift on the deck.
  Left to playtest: the AoE both-layers dual-highlight read (the brief's
  most-visually-confusing watch-for) and cross-layer targeting feel — the
  drawing/resolution code paths are shared with the verified move flows and
  unit-tested.

## Deferred / watch

- Global layer-focus mode: still deferred until a dense multi-floor map.
- Chip lingering on a stale hover (the pointer leaves the canvas without a
  new hover event, e.g. driving the UI by keyboard): cosmetic; clears on
  the next pointer move. Revisit if playtest notices.
- 3+-layer stacks: only the top tile lifts (no v1 content).
- The kernel preview label centers on the first visible rect of a covered
  ground cell — fine for strips; revisit if a dense-deck map ever shows
  kernel labels on slivers everywhere.
