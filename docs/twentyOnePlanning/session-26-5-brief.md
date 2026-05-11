# Session 26.5 Brief: Polish Pass

## Context

Phase B has produced two solid content/substrate sessions (25 and 26) plus accumulated playtest findings across Sessions 22-26 that didn't fit cleanly into substrate or content sessions. This is a dedicated polish session before Phase C engine work (Session 27 — Cluster 3 hook surfaces) begins.

Nine items in scope, ranging from quick UI completion fixes to a small forecast-pipeline accuracy fix to the demo loadout update so the new Movement passives are actually exercisable in playtest. The charged-action visibility items (timing accuracy, QueueTower slot-in, animation pacing) are connected and should land coherently. Other items are largely independent.

The implementer can propose a 26.5a/26.5b split if the audit reveals scope larger than one session carries cleanly. The connected charged-action cluster (#3, #4, #5 below) is the most likely natural split seam.

## Inputs (read first)

In recommended order:

1. **`CLAUDE.md`** — project conventions.
2. **`docs/handoff.md`** — Session 26 handoff. Two new polish items surfaced this session (demo loadout, `projectTurnEndCt` accuracy); seven carried from earlier sessions.
3. **`docs/twentyOnePlanning/roadmap-sessions-21-plus.md`** — Session 27 entry for context on what's downstream; this polish session is wedged between 26 and 27.
4. **`docs/twentyOneDesign/battle-ui-architecture.md`** — sections relevant: HUD shell layout (for the tile-info overlay), forecast panel (for Timing subsection mini-timeline), action menu (for WAIT-CONFIRM keyboard).
5. **`docs/decisions/0048-portrait-integration.md`** — pattern reference for portrait restructure work.
6. **`docs/decisions/0053-on-turn-end-emission-widening.md`** — context for the `projectTurnEndCt` accuracy fix (the `onTurnEnd` emissions that `projectTurnEndCt` needs to dry-run).

### Paths to survey before planning

Current-tree audit required. At minimum survey:

- `src/ui/battle-hud.tsx` — for the tile-info overlay placement and the existing HUD shell structure
- `src/ui/use-turn-flow.ts` — for the cursor-tile state that the overlay consumes
- `src/ui/queue-tower.tsx` — for charged-action slot-in work and any existing portrait-rendering structure
- `src/ui/forecast-panel.tsx`, `src/ui/forecast-compose.ts` — for the Timing subsection's mini-timeline
- `src/ui/action-menu.tsx` — for WAIT-CONFIRM keyboard input and the "CT after: N" annotation
- `src/engine/forecast/ct-preview.ts` — for `projectTurnEndCt` and how to dry-run `onTurnEnd`
- `src/engine/forecast/` — for `estimateChargedTiming` (timing accuracy improvement target)
- `src/ai/projection.ts` and any related forecast queries — for projection-pipeline integration
- `src/renderer/unit-layer.ts` — for the portrait restructure (body + ring → black-bg + outside-ring)
- `src/renderer/animator.ts` — for charged-action animation pacing
- `src/content/battles/demo.ts` — for the Movement-passive equipment swaps

The plan articulates what exists, what's being refit, what's being added.

## Goal

End state, in roughly the order items get touched:

- **Tile-info panel replaces the top bar**: The full top-bar footprint converts to a tile-info readout showing X/Y/Elevation/Terrain of the hovered tile (plus reserved space for future tile-effect icons). Turn number drops from the HUD — redundant with the action log's per-turn T-numbering since Session 25.
- **Portrait restructure**: Canvas unit tokens render as portrait on black square background with colored team ring as a frame *outside* the portrait (eliminates the inscribed-circle clipping issue from 24.5).
- **Charged-action timing projector accuracy**: `estimateChargedTiming` walks the projected CT schedule including other charged resolves, not just `ceil(actionSpeed / casterSpeed)`.
- **QueueTower charged-action slot-in**: Charged-action resolves appear as their own events in the QueueTower at their projected resolution time, alongside unit turns.
- **Charged-action animation pacing**: Charged resolves play with enough on-canvas duration to read as discrete events (currently very fast).
- **WAIT-CONFIRM keyboard support**: Arrow keys select facing direction in the WAIT-CONFIRM picker; Enter commits.
- **Mini-timeline for forecast Timing subsection**: Visual timeline of upcoming events around a charged action's resolve (data is already computed; render path missing).
- **Demo loadout — equip new Movement passives**: Earth Mage gets `bedrock_stride`, Fire Mage gets `hotfoot`, Lightning Mage gets `quickstep`, Water Mage gets `tidewalker`. Knight stays on `move_plus_1`.
- **`projectTurnEndCt` includes `onTurnEnd` emissions**: Dry-run the `onTurnEnd` chain in `projectTurnEndCt` and sum any `system_ct_push` deltas into the displayed leftover CT.

Tests at 715+, 0 failing. New pure-logic coverage where applicable.

## Pre-implementation plan (required)

Same discipline as Sessions 22-26. Current-tree audit first; architectural decisions surfaced before code.

### Required first step: current-tree audit

For each surface this session touches: what exists, what state it's in, what this session does to it. The charged-action cluster (#3, #4, #5 below) is the most architecturally connected subset — the audit should specifically address how those three items share or differ in their data flow.

### Architectural decisions

After the audit:

1. **Tile-info panel: replaces the top bar.** Per design call — the top bar's current Turn T#### display is redundant with the action log's per-turn T-numbering (live since Session 25). The full top-bar footprint reclaims for tile-info display: X coordinate, Y coordinate, elevation, terrain type, with reserved visual space for future tile-effect icons (Burn-trails, frozen tiles, etc.). Screen-space anchored to the top of the HUD shell; persistent across camera pan/zoom (the canvas changes, the HUD stays). Data source: existing cursor-tile state from `use-turn-flow.ts` (or equivalent).
   
   The turn number is dropped from the HUD entirely — still derivable from the action log. State the layout: how the X/Y/Elevation/Terrain fields are arranged across the bar's horizontal space, and where the tile-effect-icon area sits (probably right side, leaving the left-to-center area for the primary coordinate + terrain readout). State what happens when no tile is hovered (empty bar? "—" placeholders? hide the bar entirely until cursor enters the canvas?). Forward-compatible for the eventual tile-effect icon set — exact icon design and rendering can come later, but the slots should be present.

2. **Portrait restructure approach.** Current pattern: colored body underneath + portrait sprite + ring at body-edge (inscribed). Target pattern: black square background + portrait + colored team ring as a frame *outside* the portrait square. The corner-overflow issue flagged in 24.5's handoff resolves naturally with the ring outside instead of inscribed. State the rendering changes:
   - Body color becomes black (still drawn as a fallback backdrop)
   - Ring repositioning: from inscribed-at-body-edge to outside-the-portrait as a frame
   - Implementation likely an extra Graphics layer for the outer ring, drawn after the portrait
   - Hit-flash tint behavior preserved
   - Enemy horizontal flip preserved
   
   Settle the exact ring-frame shape (perfect square outline? rounded square? small inset?).

3. **Charged-action timing projector accuracy.** Replace `ceil(actionSpeed / casterSpeed)` with a CT-schedule-walking computation: starting from current state, advance CT ticks for all units (including their projected next-action ctCost), check at each tick whether the charged action has accumulated enough CT to resolve, account for other charged actions that would resolve first and affect the schedule. State the algorithm and where it composes against the existing projection module. The output remains `ChargedTiming { ticksToResolve, eventsBeforeResolve }` — same shape, more accurate computation.

4. **QueueTower charged-action slot-in.** Currently the QueueTower shows upcoming *unit turns*. Charged-action resolves are separate events that fire at specific projected ticks. State the integration:
   - `projectUpcoming` (or equivalent) emits a mixed stream of events: `unit_turn` and `charged_resolve`
   - QueueTower mini-card variant for `charged_resolve` (different from unit-turn mini-card — shows ability name, caster, target)
   - Sorted by projected resolution tick (already chronological)
   - Click on a `charged_resolve` mini-card opens the existing ChargedActionDetailPanel (from 24.5)
   
   This item depends on #3 for accurate ticks. State whether they need to land together or can ship sequentially with the timing fix shipping first.

5. **Charged-action animation pacing.** Charged resolves currently play very fast on canvas — flash through faster than the player can perceive as distinct events. Pacing tweaks: pause animation duration, optional camera focus on caster/target, optional brief highlight of affected tiles before damage resolution. State the changes; this is animator-side work in `src/renderer/animator.ts`. Audit reveals the existing pacing knobs.

6. **WAIT-CONFIRM keyboard support.** Arrow keys map to cardinal directions in the WAIT-CONFIRM facing picker; Enter commits. State the input handler integration (existing keyboard handlers in BattleView, or hook-side).

7. **Mini-timeline for forecast Timing subsection.** Data is already computed in `ChargedTiming.eventsBeforeResolve`; the visual rendering doesn't exist. State the visualization — small horizontal timeline strip in the forecast panel's Timing subsection, with markers for each upcoming event (color-coded by team), the charged action's resolution point highlighted, and the target's next-turn marker for the ✓/✗ pass-fail comparison.

8. **Demo loadout — Movement passive equipment swap.** Trivial content edit. Each Mage class's Movement bucket entry in `src/content/battles/demo.ts` changes from `move_plus_1` to its themed passive (Earth → `bedrock_stride`, Fire → `hotfoot`, Lightning → `quickstep`, Water → `tidewalker`). Knight stays on `move_plus_1`. State whether this also applies to `training-field-battle.ts` (probably yes, for parity).

9. **`projectTurnEndCt` includes `onTurnEnd` emissions.** Inside `projectTurnEndCt`, after computing the static ctCost deduction, dry-run the `onTurnEnd` chain against the unit's hooks with the projected post-turn state. Sum any `system_ct_push` deltas from the resulting emissions into the displayed leftover CT. State the dry-run mechanism (the runner from ADR-0053 is already pure / emission-only, so the dry-run is reading-the-emissions-without-committing). Forward-compatible: any future `onTurnEnd` emitter (regen-at-turn-end, end-of-turn procs) participates automatically.

10. **Test strategy.** Pure-logic items (#3, #9) get unit tests. Visual items (#1, #2, #5, #7) rely on manual verification. Behavioral items (#4, #6, #8) get small integration coverage where applicable. State coverage plan.

11. **26.5a/26.5b split allowance.** Surface area is meaningful but the items are individually small. If the audit reveals one item is genuinely larger than expected (most likely candidates: #3 timing accuracy if the schedule-walking algorithm gets complex, or #4 QueueTower slot-in if it needs significant data-flow refactoring), propose a split. Natural lines:
    - **26.5a:** charged-action cluster (#3, #4, #5) + the `projectTurnEndCt` fix (#9). All projection-pipeline-related.
    - **26.5b:** UI completion items (#1 tile-info, #2 portrait restructure, #6 WAIT-CONFIRM keyboard, #7 mini-timeline) + #8 demo loadout edit.
    
    Other splits possible if the audit suggests them. Settle in the plan; don't discover mid-implementation.

The plaintext plan is reviewed before code lands.

## Implementation work

Following plan approval, items land in roughly the order suggested by the split lines above — projection-pipeline cluster together, UI cluster together — but the audit may suggest different sequencing.

### Item 1: Tile-info panel (replaces the top bar)

Convert the top bar's footprint to a tile-info readout. React HUD component, screen-space anchored at the top of the HUD shell. Reads cursor-tile state from `use-turn-flow.ts` (or equivalent). Renders X / Y / Elevation / Terrain across the bar's horizontal space, with reserved area for future tile-effect icons. Turn number removed from the HUD (action log continues to provide per-turn T-numbering). Empty-state behavior settled in the plan.

### Item 2: Portrait restructure

Canvas unit tokens: black square body + portrait + colored team ring as outside frame. Resolves the inscribed-circle clipping issue from 24.5. Preserves hit-flash, enemy flip, and fallback rendering.

### Item 3: Charged-action timing projector accuracy

`estimateChargedTiming` replaced with CT-schedule-walking computation. Output shape unchanged; accuracy improved.

### Item 4: QueueTower charged-action slot-in

QueueTower's event stream gains `charged_resolve` mini-card variant. Sorted chronologically with unit-turn events. Click opens ChargedActionDetailPanel.

### Item 5: Charged-action animation pacing

Animator tweaks for charged resolves: longer dwell, optional camera focus, optional tile highlight. Per the plan's specific calls.

### Item 6: WAIT-CONFIRM keyboard support

Arrow keys → facing direction selection; Enter commits. Keyboard handler integrated into the existing input layer.

### Item 7: Mini-timeline for forecast Timing subsection

Small horizontal timeline strip in forecast Timing subsection. Markers for upcoming events (team-colored), charged-action resolution highlighted, target's next-turn marker for ✓/✗ comparison.

### Item 8: Demo loadout — Movement passive swap

Per-class swap in `demo.ts` (and `training-field-battle.ts` if parity desired):
- Earth Mage Movement: `move_plus_1` → `bedrock_stride`
- Fire Mage Movement: `move_plus_1` → `hotfoot`
- Lightning Mage Movement: `move_plus_1` → `quickstep`
- Water Mage Movement: `move_plus_1` → `tidewalker`
- Knight Movement: `move_plus_1` (no change)

### Item 9: `projectTurnEndCt` includes `onTurnEnd` emissions

`projectTurnEndCt` dry-runs the `onTurnEnd` chain and sums `system_ct_push` deltas. Forecast displays accurate post-turn CT including refunds from passives like Quickstep.

## Acceptance criteria

- Tile-info panel replaces the top bar; renders X / Y / Elevation / Terrain of hovered tile; persistent across camera pan/zoom; turn number removed from HUD.
- Portrait tokens use black-bg + outside-ring pattern; no corner clipping; hit-flash and enemy flip preserved.
- `estimateChargedTiming` produces more accurate `ticksToResolve` values (verified via unit tests covering scenarios with multiple in-flight charged actions).
- QueueTower shows charged-action resolves as their own mini-cards interleaved with unit turns.
- Charged resolves play with readable on-canvas pacing.
- Arrow keys + Enter work in WAIT-CONFIRM.
- Forecast Timing subsection shows mini-timeline visualization.
- Demo battle Mage units carry their themed Movement passives; Quickstep's CT refund is observable on Lightning Mage's Move-committed turns.
- Action menu's "CT after: N" annotation includes Quickstep's MA refund when Lightning Mage equips Quickstep and commits Move.
- Tests at 715+, 0 failing. New tests for timing-projector schedule walk; `projectTurnEndCt` dry-run.
- ADRs written for: `estimateChargedTiming` algorithm; possibly the QueueTower event-stream variant if substantial. Others at implementer's discretion.
- `docs/handoff.md` updated.

## Out of scope

- **Cluster 3 engine hook surfaces (Session 27)** — no equipment-effect plumbing, no new modify hooks beyond what's needed for #3 and #9.
- **All Phase C/D/E work** — equipment expansion, map mechanics, pre-battle UI.
- **`onTurnStart` symmetric widening** (Session 26 carry-forward) — defer until a future emitting consumer needs it.

Items deliberately not in this polish pass:

- **Reactions in projection column** — architectural design question, not just polish.
- **Permadeath timer + visual treatment** — design call.
- **Settings expansion** — design call.
- **MVP-unit smarter algorithm** — design call.

## Files likely touched

A non-exhaustive list. Audit confirms / corrects.

- `src/ui/tile-info-panel.tsx` — new (replaces the current top bar)
- `src/ui/battle-hud.tsx` — top-bar slot retargeted from turn-number to tile-info
- `src/ui/use-turn-flow.ts` — possibly extended for tile-info consumer
- `src/renderer/unit-layer.ts` — portrait restructure (black bg, outside ring)
- `src/renderer/constants.ts` — ring-frame dimensions
- `src/engine/forecast/charged-timing.ts` (or wherever `estimateChargedTiming` lives) — schedule walk
- `src/engine/forecast/ct-preview.ts` — `projectTurnEndCt` dry-run integration
- `src/engine/forecast/upcoming.ts` (or wherever `projectUpcoming` lives) — mixed event stream
- `src/ui/queue-tower.tsx` — charged-resolve mini-card variant
- `src/renderer/animator.ts` — charged-resolve pacing
- `src/ui/action-menu.tsx` — WAIT-CONFIRM keyboard handlers
- `src/ui/forecast-panel.tsx` — mini-timeline visualization
- `src/content/battles/demo.ts` — Movement passive swaps
- `src/content/battles/training-field-battle.ts` — parity swaps if applicable
- New tests for timing-projector schedule walk and `projectTurnEndCt` dry-run
- New ADRs in `docs/adr/` (or `docs/decisions/` per actual project location — note Session 26 handoff flagged stale path references in earlier briefs)
- `docs/handoff.md` — updated

## Workflow notes

- **Plaintext-first review required.** Same discipline as previous sessions.
- **Audit-first within the plan.** Particularly important for the charged-action cluster — items #3, #4, #5 share data flow and should be designed together even if implemented sequentially.
- **ADR path verification.** Session 26 surfaced that ADRs live at `docs/decisions/` not `docs/adr/`. Use the actual project path; check existing ADR references for consistency.
- **Mid-session design questions** route through Chris to the planner. Most likely surfaces: timing-projector algorithm complexity if the CT-schedule walk gets gnarly; ring-frame visual idiom for the portrait restructure.
- **The integration test calibrated to `demoBattle`'s 6×6 board** stays calibrated. Movement passive swaps change `demoBattle` content — verify the AI-vs-greedy integration test still passes after the swap (the test may need ruleset overrides similar to Session 25's initial-CT preservation).

## Watch-fors

**Addressed this session:**
- All 9 items in the goal section.

**Not addressed this session, longer-term carry-forward:**
- `onTurnStart` symmetric widening (Session 26 carry-forward)
- Top bar `Turn T####` is O(actionLog.length) (Session 22 carry)
- Renderer's MP "max" captured at mount (Session 22 carry; Session 28 lifts)
- Status-badge polarity convention (Session 22 carry)
- rAF vs setInterval for animation drain (Session 23 carry; possible interaction with #5 animation pacing — flag if it surfaces)
- AoE preview correctness across all shapes (Session 23 carry; Session 26 confirmed enlargeAoeShape is shape-agnostic)
- MP / status snapshot ahead-of-tween fix (Session 22 carry)
- Resistance composition cap at 100 (audit E2; Session 27)
- `pa_factor` NotYetImplementedError (audit E3)
- `equipmentContributionsFor` "branch per hook" (audit E4; Session 27)
- TS strict-mode test errors (audit E8)
- Surrender flow (Session 34 / ADR-0041)
- MVP-unit smarter algorithm (design call)
- Permadeath timer (design call)
- Settings expansion (design call)
- Reactions in projection column (design call)
- Bug 1 (Session 24.5 ADR-0046): mid-battle targeting failure; instrumentation in place, no recurrence in Sessions 25 or 26 playtest
- Portrait asset sizes (~4 MB each → ~20 MB initial load) — pre-release pipeline candidate; Session 26 established the compression discipline (sips + pngquant) that portraits should adopt
- Vite HMR cache invalidation occasional issue
- Hardcoded team color palette across three sites (Session 25 carry)
- Future "engine work: none" briefs should be "none anticipated" with audit-time confirmation (Session 26 framing fix)

## Estimated size

Medium-to-large. Item #3 (timing accuracy) is the highest-uncertainty piece — algorithm complexity depends on how clean the existing projection module is to extend. Items #1, #2, #6, #7, #8, #9 are individually small. Items #4 and #5 sit in the middle.

If the plan reveals the charged-action cluster (#3, #4, #5) is genuinely larger than expected, propose the 26.5a/26.5b split with projection-pipeline items on one side and UI completion items on the other. The audit's findings drive whether splitting is needed.
