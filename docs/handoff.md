# Session Handoff

This is a transient note from one session to the next.

**Discipline:** This document is *overwritten* each session, not appended. When
starting a session, read this file and process every item — act on it, promote it
elsewhere (ADR, design-doc edit, GitHub issue), or explicitly drop it with a
reason. Items do not accumulate. If there are no notes to leave, replace the
contents with `_No handoff this session._` so the next session knows the file has
been processed.

---

## S97 — bridge over/under UI shipped (2026-07-19)

The whole S97 brief landed (ADR-0156): diagonal deck lift + shadow with the
ground peeking in an L-sliver (per-layer digits and highlights), geometric
hit-test + UI-side context-first layer resolution (the under-span move wart
is fixed), and the tap-safe stack chip for the both-valid case. WI4
accelerators deferred per Chris. Plus a real catch: **S96 had left decks
unwalkable** — `'bridge'` was in the ruleset but no class `canEnter`; fixed
across all 14 classes with a regression test. Suite **2997**, `tsc -b`
clean. Browser-verified on Alvera end-to-end: sliver click under the span,
deck-art click, chip tap committing the deck layer, sprite riding the lift.

### For Chris — playtest with eyes on

- **The lift is DIAGONAL (up-left), not the straight-up shift you approved
  trying first** — straight-up self-occludes on the live N–S bridge
  (each deck's overhang lands exactly on the next cell's sliver; interior
  under-cells would never peek). Reasoning in ADR-0156; the vector +
  clamps are constants (`DECK_LIFT_*` in renderer/constants.ts) if the
  look needs tuning. Judge in playtest.
- **Unit-over-unit reading:** both stacked occupants draw above all tile
  art (deck occupant z-sorted above ground occupant, ground occupant
  overlaps the lifted deck art). Chris pre-accepted pending a look.
- **AoE both-layers dual highlight** (the brief's most-confusing-case
  watch-for) and **cross-layer targeting feel** were NOT browser-exercised
  — the drawing/resolution code is shared with the verified move flows and
  unit-tested, but nobody has *seen* a Fireball light deck + river slivers
  together yet. First Worldcraft/AoE playtest over the bridge should look.
- **Chip lingering on stale hover:** the chip stays visible if the pointer
  never re-hovers after a state change (e.g. keyboard-driven turns). Clears
  on the next mouse move; cosmetic. Flag if it annoys.

### Noticed, not acted on

- Three classes (Enchanter, Templar, Thief) also lack `'rampart'` in
  `canEnter` (every other class has it). Looks like a template drift from
  when they were authored, not a design choice — they can't stand on
  Stonebridge/Alvera rampart tiles (elev-8 walls are unreachable anyway,
  but Stonebridge has walkable ramparts). Surfacing rather than fixing:
  Chris should rule if it's intentional flavor.
- Browser-preview tooling note: the tile-info readout updates one
  `javascript_exec` call behind a synthetic pointer dispatch (React flush
  timing), and the camera lerp advances only on pumped frames in the
  hidden pane — both bit this session's verification. `pump(400)` then
  dispatch-then-read-in-separate-calls is the reliable pattern.

### Carried from earlier (still open, low-priority)

- ADR-0155 deferred edges: `layerScope` (needs a consumer), deployment
  zones exclude stacked cells by convention, charged tile-cast on a
  mid-charge-destroyed deck (no v1 content combo).
- Playtest hooks from S96: Pit-the-bridge vs enemy Terraformers; ramming
  your own span from below is legal — watch for feel.
- Economy content remaining: cost TUNING pass (D-econ-6) + Tailored
  Outfit; then M4 authoring proper (real maps, lineups via
  `generateSkirmishParty`, dialogue — M4/M5).
- Enemy-kit dial (ENEMY_JP_PER_LEVEL = 100) — measure in playtest
  alongside the offset curve; Theo kit tuning placeholder.
- Latent (ADR-0152): joint planner fail-hard-null path unreachable now.
- `WorldMapBeatView` march-state reset rider; win-edge dedupe in
  `addEdge`; engagement-queue shipped-content pin when a camp lands (Ch2);
  Atlas beat-editor tier before M5 volume.
- S85/S87 gear watch list; kit-seeding tier-threshold watch; JP spillover
  seam; "Level Up!" banner polish; "99 cap" guide fiction.
- Pre-S95 saves badge-once self-heal (documented, accepted).
