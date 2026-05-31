# Session 55 Brief: Terraformer Playtest Fixes + UI Polish + Tuning

## Context

S54 closed with the full Terraformer class landing on the S53 substrate. Chris playtested the result and surfaced several discrete items — bugs, UI polish, and tuning calls. AI Worldcraft scoring is explicitly deferred to a future session; S55 focuses on the playtest-surfaced items plus accumulated UI polish.

**Session character:** mixed tuning/bug-fix/UI-polish session. Comparable in shape to S46 (Hunter playtest tuning) or S50 (Calculator playtest tuning + content). Multiple discrete items, none requiring substrate; total scope bounded.

**Pieces shipping this session:**

1. **Barrier targeting bug (HIGH).** Clicking the first tile of a Barrier line returns to the Worldcraft menu instead of advancing to the second-tile pick. Core ability is non-functional.
2. **Terrain type visual not updating with elevation (HIGH).** Movement rules correctly follow elevation changes (Pillar deep water → land works mechanically), but tile sprites don't update to reflect the new terrain type. Player sees confusing visual state.
3. **Valley occasional failed cast (MEDIUM).** Chris saw one attempt that returned to menu without effect; later attempts worked. Intermittent — needs repro before fix.
4. **Hill/Valley AoE preview on hover.** Currently only the central tile highlights; player can't see the full 3×3 affected area without committing.
5. **Worldcraft ability tooltips.** Current tooltips unhelpful; need clear descriptions of effect, range, MP cost, queue interaction.
6. **Pillar/Pit magnitude 3 → 4 (tuning).** Playtest call from Chris; watch for easy-prison geometries.
7. **Staff of Power MP cost factor 1.2 → 1.5 (tuning).** Independent equipment tuning.
8. **Other UI polish** (Chris-specified at session start, plus stretch candidates listed below).

Scope: **Medium.** Bounded items; Barrier and terrain visual bugs are the substantive engineering work, rest is incremental polish.

## Inputs (read first)

In recommended order:

1. **`CLAUDE.md`** — project conventions.
2. **`docs/handoff.md`** — S54 close. Specifically: Worldcraft cast-resolution shape (`AbilityEffects.worldcraft`), `tile_set` AbilityTarget/TargetingSpec, three exhaustive switch additions for `tile_set` throw-cases.
3. **`docs/decisions/0088-terraformer-substrate.md`** + **`0089-barrier-ttl-global-tick.md`** — substrate ADRs for the engine surfaces this session composes on.
4. **`src/engine/effects/queue.ts`** — effect queue + LIFO eviction.
5. **`src/content/abilities/worldcraft/`** — five Worldcraft ability definitions.
6. **`src/engine/abilities/worldcraft-resolution.ts`** (or wherever `resolveWorldcraft` lives) — cast resolution path.
7. **`src/renderer/battle-renderer.ts`** — `redrawStaticLayers()` and terrain redraw path. Audit confirms whether terrain *type* (water/land) is regenerated on redraw or only elevation indicators.
8. **`src/content/equipment/staff-of-power.ts`** (or equivalent) — current 1.2 factor.

### Paths to survey before planning

Per audit-overturns-spec pattern (now 10 sessions running), substrate scope may be smaller than the brief assumes:

- **Barrier targeting FSM.** Where does the `tile_set` targeting state live in the turn-flow FSM? S54 added `tile_set` AbilityTarget but the picker may not have a corresponding multi-step state for anchor-pick → orientation/length pick → confirm. Survey the existing `target-select` and `math-skill-target-select` states; `tile_set` likely needs a parallel `tile-set-target-select` state with phase tracking (anchor → second-tile → confirm) or similar. Likely root cause of Chris's report: clicking the first tile commits the "tile" but the FSM has no state to advance to, so it falls back to the ability picker.
- **Terrain redraw scope.** `redrawStaticLayers()` re-paints the static terrain layers, but audit confirms whether this regenerates tile *textures* from elevation (e.g., elev 0 = deep water sprite, elev 1 = shallow water sprite, elev 2+ = land sprite) or whether tile textures are cached at mount and never refreshed. If the latter, terrain redraw needs to recompute tile-type-from-elevation per-tile and refresh sprites.
- **Valley intermittent failure.** Hard to repro from a single observation; survey the Worldcraft cast-resolution path for any conditional that could short-circuit. Likely candidates: validation timing, MP check race, queue-state inconsistency. May need to fail-pin via repro test rather than deduce.
- **AoE preview for Hill/Valley.** Existing AoE abilities (Pyromancer Fire Storm, etc.) show 3×3+ shapes on cursor hover. Survey the current AoE-preview hook and confirm whether Worldcraft abilities are wired into it. Hill/Valley don't use the standard `AoeShape` vocabulary (their per-tile delta kernel is content data feeding `tileChanges`), so preview rendering may need a small extension to display the Worldcraft tile_set shape.
- **Tooltip rendering for Worldcraft.** Audit confirms what fields the tooltip pipeline reads. Worldcraft abilities have unusual fields (kernel data, queue interaction); tooltip strings need to be authored per ability with the right detail.
- **Staff of Power MP factor.** Single-line equipment data change. Audit identifies tests pinning the 1.2 factor (regression updates needed).

## Goal

End state:

**Bug fixes:**

- **Barrier targeting works end-to-end.** Player clicks Barrier in command set → enters targeting mode → clicks first tile (anchor) → enters second-tile selection with valid-tile highlighting (must extend in straight line from anchor, length 3-5, all tiles unoccupied/barrier-free) → confirms → Barrier spawns. Cancel back-stack matches existing target-select routing.
- **Terrain type visual updates correctly with elevation changes.** When Pillar raises a deep-water tile to elevation 3, the sprite changes from deep-water to land. When Pit lowers a land tile to elevation 0, the sprite changes to deep-water. When elevation changes within the same terrain category (elev 5 → elev 3, both land), the sprite reflects the new elevation indicator. All visible state matches the engine state.
- **Valley intermittent failure repro and fixed.** If repro succeeds, fix the root cause; if not, document the symptom and add defensive tests around the Worldcraft cast path that most plausibly explain the failure.

**UI polish:**

- **Hill/Valley AoE preview on hover.** When player has Hill or Valley selected and hovers over a candidate tile, the 3×3 area paints with per-tile deltas visible (recommend: tinting + per-tile elevation-delta overlay, similar to existing AoE highlight but with the kernel pattern). For Hill: center tile tinted darker (+3), edges medium (+2), corners light (+1). For Valley: parallel with appropriate visual cue for "lower."
- **Worldcraft tooltips populated.** Each of the 5 Worldcraft abilities has a clear tooltip:
  - **Pillar** — "Raise a single tile by 4. Range 4. MP 8. Counts as 1 active effect."
  - **Pit** — "Lower a single tile by 4, dropping any unit on it. Range 4. MP 8. Counts as 1 active effect."
  - **Hill** — "Raise a 3×3 area with center +3, edges +2, corners +1. Range 4. MP 16. Counts as 1 active effect."
  - **Valley** — "Lower a 3×3 area with center -3, edges -2, corners -1, dealing fall damage. Range 4. MP 16. Counts as 1 active effect."
  - **Barrier** — "Spawn a line of 3-5 barrier tiles. Barriers block movement and line-of-sight, persist 50 turn-starts, take damage from attacks. Range 4. MP 12. Counts as 1 active effect."
- (Tooltip strings tunable; the above are starting points.)

**Tuning:**

- **Pillar/Pit magnitude 3 → 4.** Data change in ability definitions; effect-queue revert logic uses the same magnitude (still emerges from terrain-change reducer's drop detection).
- **Staff of Power MP cost factor 1.2 → 1.5.** Data change in equipment definition. Verify cost-modification pipeline applies correctly.

**Other UI polish (Chris-specified at session start; stretch candidates listed):**
- TBD per Chris's session-start direction.

**Quality:**

- Tests +25-40 (estimated).
- No new ADR anticipated; all changes compose on existing substrate.
- `docs/handoff.md` updated.
- `docs/playtest-watch.md` updated — Pillar/Pit magnitude 4 watch (easy-prison geometries); Staff of Power 1.5 factor watch (Pyromancer balance shift); Worldcraft UI feel post-tooltips.
- `docs/content-id-registry.md` — equipment/ability values updated.
- Vercel pre-flight discipline.
- **Browser verification critical this session.** Real-battle Worldcraft exercise: Barrier line targeting → spawn → take damage → expire; terrain type visual changes through Pillar/Pit/Hill/Valley; Hill/Valley AoE preview on hover; tooltips render on hover.

## Pre-implementation plan

Audit-first per project conventions. **Plan-review checkpoint after audit completion.** Substrate audit is the variable — Barrier FSM and terrain visual updates may surface different fix shapes depending on current state.

### Required first step: current-tree audit

Per "Paths to survey" above. Audit deliverables:

1. **Barrier FSM gap** — confirm root cause; identify the cleanest fix.
2. **Terrain redraw scope** — confirm what `redrawStaticLayers()` actually regenerates.
3. **Valley intermittent path** — survey for short-circuit conditions; build repro test scaffolding.
4. **AoE preview integration point** — identify where Worldcraft preview wires in.
5. **Tooltip data flow** — identify how Worldcraft ability text gets to tooltip.

### Architectural decisions

After audit:

1. **Barrier targeting state.** Recommend: new FSM state `tile-set-target-select` parallel to `target-select` and `math-skill-target-select` from S39b/S49. Phases: `pick-anchor` → `pick-extent` (second tile defining orientation/length) → optionally `confirm`. Routing into the state happens when `pickAbility` / `pickFreeAbility` lands on an ability with `targeting.kind === 'tile_set'`. Pattern from S49's Math Skill picker FSM is the reference.

2. **Terrain redraw to include sprite regeneration.** If audit confirms `redrawStaticLayers()` doesn't regenerate tile textures, extend the redraw path to recompute terrain type from new elevation and re-paint affected tiles. Performance cost should be low (only changed tiles need re-painting; full redraw acceptable for v1).

3. **Valley repro approach.** Build a test that drives the Worldcraft cast through multiple scenarios (different queue states, different terrain configurations, different validation states) and verify cast completes successfully each time. If a specific path short-circuits, the test will catch it.

4. **AoE preview for Worldcraft.** Extend the AoE preview hook to read Worldcraft tile_set spec instead of (or in addition to) AoeShape. For Hill/Valley specifically: preview shows 3×3 grid with per-tile delta values. Could be visualized as overlay color (darker = larger delta) or with numeric labels. Audit determines existing visualization patterns to match.

5. **Tooltip authoring.** Direct content authoring — populate ability description fields per the proposed text (or per Chris's revisions during plan-review).

6. **Pillar/Pit magnitude change.** Single value update in `pillar.ts` / `pit.ts` ability definitions. Tests verify new magnitude applies to terrain change + revert.

7. **Staff of Power factor change.** Single value update in equipment. Test fixture updates for pinned 1.2 value.

### Decision points

(Settled in plan-review.)

**D1 — Barrier FSM state name.** `tile-set-target-select` proposed. Alternatives: `barrier-target-select`, `line-target-select`. Recommend the generic `tile-set` form since the substrate is generic (future tile_set-targeted abilities reuse).

**D2 — Barrier second-tile pick UX.** Recommend: after anchor pick, valid extent tiles highlight (showing 3-5 tile straight-line options from anchor in each direction). Player clicks the far end of the desired line; engine computes the tile set. Alternative: pick anchor → pick orientation (4 buttons or hover-direction) → pick length. Recommend the click-far-end pattern as more direct.

**D3 — Terrain sprite regeneration scope.** Recommend: full tile-type recompute on redraw, but only redraw tiles affected by the terrain-change action (not the whole map). Audit may suggest full-map redraw is acceptable for v1.

**D4 — Hill/Valley AoE preview visualization.** Recommend: kernel overlay (tile coloring intensity matches per-tile delta magnitude) + optionally numeric overlay (+3 / +2 / +1 or -3 / -2 / -1) on each tile. Plan-review settles whether numeric overlay is too cluttered.

**D5 — Tooltip strings.** Recommend the proposed starting text; Chris confirms at plan-review.

**D6 — Pillar/Pit magnitude 4.** Confirmed by Chris ("test it out in that configuration first"). Easy-prison watch documented in playtest-watch.

**D7 — Staff of Power factor 1.5.** Confirmed by Chris. Pyromancer balance shift watch documented in playtest-watch.

**D8 — Valley intermittent.** If repro succeeds: fix and pin with regression test. If not: document symptom, add defensive tests covering the most plausible short-circuit paths, monitor in future playtest.

**D9 — Effect-queue display in UI.** S54 carry; Chris may include in "other UI polish." If included: visualizing the current active effects on the Terraformer (e.g., a list of icons or a panel showing "Pillar at (3,4), 2 turns ago"). Stretch candidate.

## Implementation work

Ordered by priority: bugs first, then UI polish, then tuning.

### 1. Barrier targeting (HIGH)

- Audit confirms FSM gap.
- Add `tile-set-target-select` state to turn-flow with phases.
- Routing: `pickAbility` / `pickFreeAbility` checks `targeting.kind === 'tile_set'` and enters the new state.
- Anchor pick: player clicks first tile (must be valid — unoccupied, barrier-free, within range from caster).
- Extent pick: player clicks second tile (must be in straight line from anchor, length 3-5 contiguous, all tiles unoccupied + barrier-free).
- Confirm: substrate emits `system_barrier_change` + `enqueueWorldcraftEffect`.
- Cancel back-stack: matches existing target-select routing.
- Tests: anchor pick succeeds for valid tiles; anchor pick rejects invalid; extent pick succeeds for valid orientation/length; extent pick rejects invalid; full cast spawns Barrier correctly. ~8-10 tests.

### 2. Terrain type visual update (HIGH)

- Audit confirms `redrawStaticLayers()` regeneration scope.
- If gap: extend redraw to recompute terrain type from elevation (per existing water-table convention: elev 0 = deep water, elev 1 = shallow water, elev 2+ = land).
- Re-paint affected tiles with appropriate sprites.
- Trigger on `system_terrain_change` action (renderer hook from S53).
- Tests: redraw integration test; manual browser verification of visual state matching engine state. ~3-5 tests.

### 3. Valley intermittent (MEDIUM)

- Audit surveys cast path for short-circuits.
- Build repro scaffolding (multi-cast scenarios).
- If repro: fix and regression-test.
- If not: defensive tests covering plausible paths. ~3-5 tests.

### 4. Hill/Valley AoE preview (UI polish)

- Audit identifies AoE preview hook integration.
- Extend preview to read Worldcraft tile_set spec.
- Render 3×3 grid with per-tile delta visualization (color intensity + optional numeric overlay).
- Tests: preview renders correctly on hover; preview updates on cursor move. ~3-5 tests.

### 5. Worldcraft tooltips (UI polish)

- Populate tooltip strings per the 5 abilities.
- Verify rendering in actual battle.
- Tests: tooltip text appears correctly. ~5 tests (one per ability).

### 6. Pillar/Pit magnitude 3 → 4 (tuning)

- Update `pillar.ts`, `pit.ts` magnitude values.
- Verify effect queue tracks correct magnitude (for revert fall damage).
- Verify fall damage on Pit-4 emits correctly (drop distance 4 = 40 damage per FALLING_DAMAGE_PER_LEVEL).
- Tests: new magnitude applies; revert restores original; fall damage on Pit-4 = 40. ~3-5 tests.

### 7. Staff of Power 1.2 → 1.5 (tuning)

- Update equipment definition.
- Update test fixtures with pinned 1.2 value.
- Tests: new factor applies; existing MA bonus preserved. ~2-3 tests.

### Other UI polish (TBD)

- Chris specifies at session start.
- Stretch candidates if budget allows:
  - **Effect-queue display** — visualize Terraformer's current active effects.
  - **Terrain-transition animation** — interpolated elevation change instead of instant redraw (renderer polish).
  - **Worldcraft secondary command-set listing in builder** — S54 carry (builder doesn't list command-set members by name).
  - **Barrier visualization polish** — distinct visual for barrier tiles (vs. terrain).

### Tests (total)

Estimated +25-40 tests across all items. Final count depends on bug-fix complexity and which "other UI polish" items land.

### UI surfaces

- Barrier targeting flow works in actual battle.
- Terrain type sprites update correctly on terrain change.
- Hill/Valley AoE preview shows 3×3 area with per-tile deltas on hover.
- Worldcraft tooltips render clear descriptions.
- Pillar/Pit creates +4/-4 elevation changes.
- Staff of Power applies 1.5× MP cost multiplier.

## Acceptance criteria

**Bug fixes:**
- Barrier targeting works end-to-end (browser-verified).
- Terrain type sprites update with elevation changes (browser-verified).
- Valley intermittent: fixed if repro'd, defensively covered otherwise.

**UI polish:**
- Hill/Valley AoE preview visible on cursor hover.
- All 5 Worldcraft tooltips populated and readable.

**Tuning:**
- Pillar/Pit magnitude is 4.
- Staff of Power MP cost factor is 1.5.

**Quality:**
- Tests at 1630-1645, 0 failing.
- Docs updated.
- Vercel pre-flight clean.
- Browser verification: full Terraformer Worldcraft loop including Barrier; tuning changes reflected in actual battle.

## Out of scope

- **AI Worldcraft scoring (Piece 6 in S52 audit).** Chris explicitly deferring. Future session.
- **Default team templates with Terraformer.** Content session.
- **Calculator team template revision** — long-running carry.
- **Marshmoor template-compliance tests** — S52 stretch carry.
- **Roster-wide Move pass.** S54 audit found the Move 2 split is emergent rather than designed (slow-caster tier vs. mobile tier). Worth eventual design discussion but not S55.
- **Terraformer's lightning-mage.ts stale header** — S54 carry; cosmetic cleanup.
- **`docs/decisions/draft-terraformer-substrate-audit.md` archival** — S54 carry; cosmetic.
- All other standing carries.

## Files likely touched

A non-exhaustive list. Audit confirms / corrects.

**Bug fixes:**
- `src/engine/turn-flow.ts` (or wherever FSM lives) — new `tile-set-target-select` state.
- `src/ui/action-menu.tsx` (or equivalent) — tile_set targeting UX.
- `src/renderer/battle-renderer.ts` — terrain sprite regeneration on redraw.
- `src/engine/abilities/worldcraft-resolution.ts` — Valley intermittent investigation.

**UI polish:**
- `src/ui/aoe-preview.tsx` (or equivalent) — Hill/Valley preview extension.
- `src/content/abilities/worldcraft/*.ts` — tooltip strings.

**Tuning:**
- `src/content/abilities/worldcraft/pillar.ts` — magnitude 4.
- `src/content/abilities/worldcraft/pit.ts` — magnitude 4.
- `src/content/equipment/staff-of-power.ts` — factor 1.5.

**Tests:**
- `src/test/session-55-playtest-fixes.test.ts` (or split per area).
- Existing test fixtures with pinned values may need updates.

**Docs:**
- `docs/handoff.md` — session close.
- `docs/playtest-watch.md` — Pillar/Pit magnitude 4 watch; Staff of Power 1.5 watch.
- `docs/content-id-registry.md` — updated equipment/ability values.

## Workflow notes

- **Plaintext-first review required.**
- **Audit-first with plan-review checkpoint.** Barrier FSM and terrain redraw are the audit-determined variables.
- **Bugs first.** Barrier targeting is highest priority — core ability is broken. Terrain visual is high. Valley intermittent is medium (needs repro).
- **Browser verification critical.** Most of this session's items are UX/visual; tests alone don't catch the symptoms Chris is reporting. After each item, manual playthrough confirms the fix.
- **Vercel pre-flight discipline.** Per S48–S54 carry.
- **Mid-session design questions** route through Chris. Most likely surfaces:
  - Barrier targeting UX detail (click-far-end vs. orientation-then-length).
  - AoE preview visualization style (color intensity vs. numeric overlay vs. both).
  - Tooltip string final wording.
  - Other UI polish list (Chris specifies at session start).
- **Easy-prison watch on Pillar/Pit-4.** Chris explicitly wants to test this. Watch playtest for: trapped non-Terraformer/non-Ignore-Height units; multi-Pit pit combinations; rescue mechanics needed?
- **Pyromancer balance watch on Staff of Power 1.5.** Major MP economy shift. Watch whether Pyromancer feels gated by MP in ways that change the class's identity.

## Watch-fors

**Addressed this session:**
- Barrier targeting bug.
- Terrain type visual update.
- Valley intermittent failure (investigation).
- Hill/Valley AoE preview.
- Worldcraft tooltips.
- Pillar/Pit magnitude 4.
- Staff of Power 1.5 factor.

**Not addressed this session, longer-term carry-forward:**
- **AI Worldcraft scoring** — explicitly deferred.
- All standing carries.
- Roster-wide Move tier design discussion (S54 finding).
- Cosmetic carries (lightning-mage.ts header, audit draft archival).

**Watch-fors specific to this session:**

- **Easy-prison geometries with Pillar/Pit-4.** A unit on a tile with adjacent elev delta > Jump becomes trapped. At Pit-4 with adjacent elev 0, a unit at the bottom (elev -4) faces a vertical change of 4 to adjacent elev 0. Jump-3 classes (Knight, Hunter, Hydrologist, Aethurge, Alchemist, Assassin) and Jump-2 classes (Calculator, Geosage, Pyromancer, Terraformer) are all trapped. Only Ignore-Height-equipped units (Terraformer by default, others via cross-class) escape. Watch playtest for whether this feels tactically interesting (positional vulnerability through smart play) or unfair (one-shot kill via geometry).
- **Pyromancer MP economy at Staff of Power 1.5.** Pyromancer is already MP-constrained at 28 base MP; with 1.5× cost on Staff of Power, spells like Fire Storm (likely 20+ MP base) become 30+ MP — a single cast drains nearly the entire pool. Watch whether this makes Staff of Power a niche pick (only for nuke-once builds) or whether the +4 MA justifies the economy hit.
- **Hill/Valley AoE preview clarity.** Per-tile delta visualization is novel territory. Watch whether the visualization reads clearly in play or feels cluttered. May need iteration.
- **Barrier targeting feel.** Click-far-end UX (recommended) vs. orientation-then-length. Watch whether the chosen pattern feels intuitive or surprising.
- **Tooltip information density.** Worldcraft tooltips carry more information than standard abilities (kernel data, queue interaction, range, MP cost). Watch whether tooltips feel overloaded.
- **Valley intermittent if it recurs.** If Chris observes it again, the symptom + repro steps become a high-priority fix.
- **Terrain visual after multi-stage changes.** Pillar followed by Pit on the same tile, or Hill followed by Pit on the center — confirm the sprite reflects the final state, not stale intermediate.

## Estimated size

**Medium.** Comparable to S46 or S50. Multiple discrete items; bug-fix complexity dominates over UI polish over tuning.

**No split contingency anticipated.** Items independent; if budget tightens:
- Bug fixes first (Barrier targeting, terrain visual).
- UI polish second (AoE preview, tooltips).
- Tuning third (small data changes).
- "Other UI polish" candidates filter at plan-review.

**Stretch indicators** (opportunistic):
- Effect-queue display in UI (S54 carry).
- Terrain-transition animation (S53/S54 deferred polish).
- Worldcraft secondary command-set listing in builder (S54 carry).
- Roster Move tier design discussion (or just documentation in playtest-watch).
- Cosmetic: lightning-mage.ts header, audit-draft archival.

These are pure housekeeping or stretch-only; not core scope.
