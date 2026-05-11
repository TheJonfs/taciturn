# Session Handoff

This is a transient note from one session to the next.

**Discipline:** This document is *overwritten* each session, not appended. When starting a session, read this file and process every item — act on it, promote it elsewhere (ADR, design-doc edit, GitHub issue), or explicitly drop it with a reason. Items do not accumulate. If there are no notes to leave, replace the contents with `_No handoff this session._` so the next session knows the file has been processed.

What belongs here:

- Things noticed but not acted on.
- Implementation choices considered and rejected.
- Suggested scope or sequencing for the next session.
- Watch-for items and open questions that aren't ADR-worthy.

What does *not* belong here:

- Decisions (those are ADRs).
- What changed (that's the commit message).
- System design (that's the design docs).
- Long-running plan (that's `docs/roadmap.md`).
- Comprehensive progress / deferred-work review (`docs/progress.md` is the durable home for that — refreshed periodically, not session-by-session).

---

## From session 2026-05-11 (Session 26.5 — Polish pass: 9 items landed, ADR-0055)

Session 26.5 was the polish pass wedged between Phase B's content sessions (25/26) and Phase C's engine work (27). Nine items in scope, all landed in one session (no 26.5a/26.5b split needed). Tests: **725 passing across 63 files, 0 failing** (up from 715). +10 new tests: 6 charged-timing schedule-walk + 4 projectTurnEndCt onTurnEnd dry-run.

### Scope completed

**Pure-logic / engine surface (this session):**

1. **`projectTurnEndCt` dry-runs `onTurnEnd` (item #9).** The forecast helper now constructs a synthetic post-cost-decrement state and calls `runOnTurnEnd` against it; any `system_ct_push` emissions targeting the unit are summed into the displayed leftover CT. The runner is pure per ADR-0053, so the dry-run is emission-only with no side effects. Lightning Mage with Quickstep equipped now sees the correct "CT after: N" in the action menu (pre-26.5 showed pre-refund value, then the action log added +MA on top, visually disagreeing). 4 new tests cover Quickstep-pattern emit/skip cases + regression baseline for handler-less units.

2. **Charged-action timing schedule walk (item #3 / ADR-0055).** New `src/engine/forecast/charged-timing.ts` replaces the pre-26.5 naive `ceil(actionSpeed / casterSpeed)` with a hypothetical-state construction routed through `projectUpcoming`. Pre-26.5's formula doubly misinterpreted `actionSpeed` as a threshold AND ignored other in-flight charges; both errors resolve. The post-commit detail panel routes through `projectChargedResolution` for the same accuracy. `ChargedResolutionProjection` gains an `eventsBeforeResolve` field so the detail panel doesn't need to recount.

**UI completion (this session):**

3. **Tile-info panel replaces the top bar (item #1).** New `src/ui/tile-info-panel.tsx` renders X / Y / Elev / Terrain of the hovered tile across the top-bar footprint, with a reserved icon slot for future tile-effect chips (Burn-trails, frozen tiles). Turn number readout removed entirely — redundant with the action log's per-turn T-numbering since session 25. Cursor-tile signal lives on `useTurnFlow.cursorTile` (single hover handler now dispatches both tile-info updates AND state-specific events for target-select / move-select). Empty state: "—" placeholders, bar height stays constant.

4. **Portrait restructure (item #2).** Canvas unit tokens redrawn: black-square body backdrop + portrait sprite + rounded-square team-colored frame *outside* the portrait (corner radius 4). Resolves the inscribed-circle clipping issue from session 24.5's handoff. Body becomes black so the team identity reads from the outer frame instead of the body. Hit-flash overlay and enemy horizontal-flip preserved. New constants: `PORTRAIT_BG_COLOR`, `PORTRAIT_FRAME_WIDTH`, `PORTRAIT_FRAME_CORNER`. Active-ring + counterpart-ring stay as circles for now (cosmetic follow-up; rings sit outside the frame so they don't collide visually).

5. **Charged-action animation pacing (item #5).** Animator extended with a `tile_highlight` Anim variant + a `pendingAnims: Anim[]` follow-up queue so a single Action can produce multiple sequential anims. `charged_action_resolve` now chains `[tile_highlight (400ms), flash (720ms)]` — pre-26.5 the resolve fired at 360ms with no pre-cue. Tile positions derived from `outcome.perTargetResults`: tile-kind targets contribute their position directly, unit-kind targets contribute the unit's tile inferred from `snapshot.position`. The renderer's `tick()` syncs the highlight overlay via `setHighlightOverlay` on transitions only (cached `lastTileHighlightKey` avoids 60fps churn). Two new constants: `PRE_RESOLVE_HIGHLIGHT_MS = 400`, `CHARGED_RESOLVE_FLASH_DURATION_MS = 720`.

6. **WAIT-CONFIRM keyboard support (item #6).** Arrow keys preview a pending facing in the WAIT-CONFIRM picker (visual highlight follows the selection); Enter commits with the pending facing. Implementation: `WaitConfirm` component now has `useState<Direction>(pendingFacing)` + a capture-phase `keydown` handler. ESC continues to cancel via the existing top-level handler. Mouse click still commits immediately on the clicked direction (no separate confirm step).

7. **Forecast mini-timeline (item #7).** New `MiniTimeline` subcomponent in `forecast-panel.tsx` renders the `ChargedTiming.surroundingEvents` window (~7 events centered on the resolve) as team-colored chips. Resolve chip highlighted gold (`✦`); target's-next-turn chip outlined cyan; other unit chips use team color (red/blue). Tick labels under each chip. Data is pre-computed by the engine's `estimateChargedTiming` (item #3); the panel is pure render. The `ForecastPanel` now takes `state` as a prop so it can resolve unit team / class names.

**Content (this session):**

8. **Demo Movement passives equipped (item #8).** `src/content/battles/demo.ts` swapped per-Mage Movement bucket entries from `move_plus_1` to their themed passives: Earth → `bedrock_stride`, Water → `tidewalker`, Fire → `hotfoot`, Lightning → `quickstep`. Knight stays on `move_plus_1`. `training-field-battle.ts` inherits via spread — no separate edit needed. AI-vs-greedy integration test still passes (unperturbed by the passive swap).

**Verification scope:**

9. **QueueTower charged-resolve slot-in (item #4)** — was already wired pre-26.5 via `projectUpcoming` + `describeEvent`'s `entityKind === 'charged_action'` branch. Audit-confirmed; no changes needed. The mini-card variant for charged events (circular portrait crop + dashed border) was authored in earlier sessions and continues to work. Click-through to `ChargedActionDetailPanel` from charged mini-cards: also pre-existing.

### Architecture records

- **ADR-0055** — Charged-action timing forecast via CT schedule walk. Hypothetical-state construction + `projectUpcoming` reuse for accurate pre-commit + post-commit timing. Replaces two naive computations with one engine helper.

### Limitations + watch-fors

- **Item #5 final visual sign-off pending.** The dwell + tile-highlight + flash chain is wired and tests pass, but Chris should watch the dwell timing during a playtest and call out if 400ms highlight + 720ms flash needs tuning. The constants are in `src/renderer/constants.ts` for easy tweaking.

- **Active-ring + counterpart-ring remain circles** after the portrait restructure (item #2). They sit outside the rounded-square frame so no visual collision today. If Chris wants visual consistency, convert them to rounded squares — small follow-up.

- **`ChargedTiming` `resolutionIndex` is window-relative.** The mini-timeline correctly uses it for chip rendering, but if other consumers want the full-projection index they should use `eventsBeforeResolve` (new field on `ChargedResolutionProjection`). The two are deliberately parallel between the pre-commit and post-commit helpers.

- **Quickstep refund visibility in mid-turn forecast.** `projectTurnEndCt` dry-runs `onTurnEnd` correctly when called with a `plannedNext` that implies movesConsumed > 0. The forecast panel's `endOfTurnCt` uses `plannedNext: 'act'` (line 155 of `forecast-compose.ts`), which means it shows the leftover for "act after Quickstep-Move" — works correctly. The action menu's "CT after: N" annotation shows leftover under multiple plannedNext kinds; all paths route through the same dry-run.

- **WAIT-CONFIRM keyboard relies on capture-phase listener.** The listener is bound at the `window` level when the `WaitConfirm` component mounts. If a future modal opens above WAIT-CONFIRM, that modal's own keyboard handler must also use `capture: true` and `stopPropagation()` to avoid double-handling. Pattern is consistent with the `ChargedActionDetailPanel`'s ESC capture.

- **TypeScript strict-mode errors** continue to carry forward (audit E8). Session 26.5 introduced zero new typecheck errors; existing ~15 errors in `action-log-panel`, `action-menu`, `battle-hud`, `queue-tower`, `derived-events.test`, `turn-flow.test`, `use-turn-flow.ts` (the `AoeSpec` re-export + unused-params errors) persist. Same list as session 26.

- **The original `cursorScreen` channel is now bound only in `target-select`.** Other states clear it on enter. Move-select gets the cursorTile signal via the new global handler but doesn't track screen coords. If a future tooltip needs screen coords in another state, extend the cursorScreen tracking accordingly.

- **`computeSpeed` import removed from `charged-action-detail-panel.tsx`**. The bottom-of-file `void computeSpeed` suppression is also gone. If a future tuning needs caster MA / haste through `runModifyStatQuery` for ticksToResolve, that's already handled at the projection layer via `computeActionSpeed` — the panel doesn't need its own version.

### Considered and rejected this session

- **Adding a second hover-channel to the renderer for the tile-info panel.** Easier: unify the existing `setOnTileHover` handler in `useTurnFlow` to always update `cursorTile` AND dispatch state-specific events when in target-select / move-select. One handler, two consumers.

- **Animator-side direct call to `setHighlightOverlay`.** Crosses the animator → renderer boundary. The chosen pattern (animator exposes `getTileHighlightPositions()`, renderer reads on tick + repaints on transitions) keeps the boundary intact.

- **Computing the AoE footprint for the pre-resolve tile highlight.** Would require the animator to access catalog + state for `aoeFootprint`. Too much coupling for v1. Instead derived from `perTargetResults` — tile-kind targets contribute directly, unit-kind targets contribute the unit's tile inferred from `snapshot.position`. Works for the v1 charged-action set; if a future charged action has perTargetResults that miss the footprint (e.g., empty-tile center of an AoE), the highlight will under-paint. Acceptable; flag if visible.

- **Splitting 26.5 into 26.5a / 26.5b.** Brief permitted; audit revealed three items smaller than expected (#4 was largely already implemented; #8 is a one-file edit; #9 is mechanical given ADR-0053's purity). Single session was achievable.

- **Per-resolve camera focus during charged-action resolves.** Chris's call to skip camera-focus in favor of just dwell + tile-highlight. Cleaner; no camera-state interaction.

- **Moving the team-color palette to a shared module.** Three sites still duplicate it (renderer, queue-tower, forecast-panel — the new mini-timeline added the third). Carries forward to the existing watch-for from session 25.

### Empirical-questions checklist for Chris's next playtest

**Item #1 (tile-info panel):**
- [ ] Hover various tiles; X / Y / ELEV / Terrain update.
- [ ] Move cursor off canvas; fields revert to "—" placeholders, bar height constant.

**Item #2 (portrait restructure):**
- [ ] Canvas units render as portrait-in-rounded-square-frame, no corner clipping.
- [ ] Team color reads from the frame, not the body (body is now black).
- [ ] Hit-flash still visible during attacks.
- [ ] Enemy units still flip horizontally.

**Item #3 / #4 (charged timing accuracy):**
- [ ] Cast a single charged ability with no others in flight: ticks-to-resolve should match `100 / actionSpeed` (the baseline case).
- [ ] Cast a second charged ability while one's in flight: the second's resolve tick should reflect the schedule walk (not the naive `actionSpeed / casterSpeed`).
- [ ] Open the ChargedActionDetailPanel from a QueueTower charged mini-card — "resolves in" matches the QueueTower's tick label.

**Item #5 (animation pacing):**
- [ ] Cast a charged ability and watch the resolve: tiles flash gold/highlight ~400ms before the unit-flash, total resolve ~1100ms (was 360ms pre-26.5).
- [ ] Cast a unit-only charged target (e.g., single-unit charge); unit's tile lights up briefly before the flash.

**Item #6 (WAIT-CONFIRM keyboard):**
- [ ] Click End-turn → arrow keys cycle facing; the primary-variant highlight follows the pending direction.
- [ ] Enter commits with the pending facing.
- [ ] Click on a button still commits immediately (no requirement to also press Enter).

**Item #7 (mini-timeline):**
- [ ] Hover a charged ability target — Timing section shows ~7 chips with letters (first letters of unit names / ability) + tick labels.
- [ ] Resolve chip is gold (✦). Target's next-turn chip has a cyan outline.

**Item #8 (Movement passive swap):**
- [ ] Earth Mage takes a fall (Tidal Surge knockback off ledge) — Bedrock Stride zeroes the falling damage.
- [ ] Fire Mage's Speed reads as base+1, Move Range +1.
- [ ] Lightning Mage commits Move on her turn: action log shows the +MA `system_ct_push` after turn_end. The action menu's "CT after: N" annotation includes the refund (pre-26.5 didn't).

**Item #9 (`projectTurnEndCt` dry-run):**
- [ ] (Combined with #8) Lightning Mage's Move + End turn annotation reflects `currentCT − moveOnlyCost + MA`.

### Longer-term carry-forward

- `onTurnStart` symmetric widening (Session 26 carry; not addressed; defer until first emitting consumer)
- Top bar `Turn T####` O(n) cost — RESOLVED (top bar removed in #1)
- Renderer's MP "max" captured at mount (Session 22 carry; Session 28 lifts)
- Status-badge polarity convention (Session 22 carry)
- rAF vs setInterval for animation drain (Session 23 carry; may interact with #5 pacing — watch for any frame-budget issues)
- AoE preview correctness across all shapes (Session 23 carry; sessions 26 + 26.5 confirmed shape-agnostic)
- MP / status snapshot ahead-of-tween fix (Session 22 carry)
- Resistance composition cap at 100 (audit E2; Session 27)
- `pa_factor` NotYetImplementedError (audit E3)
- `equipmentContributionsFor` "branch per hook" (audit E4; Session 27)
- TS strict-mode test errors (audit E8) — pre-existing list carries forward; 26.5 added zero
- Surrender flow (Session 34 / ADR-0041)
- MVP-unit smarter algorithm (Session 24 Wave 1)
- Permadeath timer (Session 24 Wave 1)
- Settings expansion (Session 24 Wave 1)
- Reactions in projection column (Session 24 Wave 1)
- Bug 1 (Session 24.5 ADR-0046): mid-battle targeting failure; instrumentation in place, awaiting next occurrence
- Portrait asset sizes (~4 MB each → ~20 MB initial load) — pre-release pipeline candidate; sessions 26 + 26.5 didn't address compression
- Vite HMR cache invalidation occasional issue — encountered during 26.5 verification (hook-order false-positive after editing `useTurnFlow`); full dev-server restart cleared it
- Hardcoded team color palette across THREE sites now: renderer, queue-tower, forecast-panel (session 25 carry; 26.5 added the third)
- Active-ring + counterpart-ring still circles after portrait restructure — visual-consistency follow-up (low priority)
- Tile-info reserved icon slot is empty in v1 — future tile-effect chip pipeline can fill it without layout changes

### Suggested scope for Session 27

Per `docs/twentyOnePlanning/roadmap-sessions-21-plus.md`, Session 27 is Cluster 3: four new hook surfaces (`modifyMpCost`, `modifyActionSpeed`, `modifyResistance`, `modifyIncomingStatusApplicationChance`) + the equipment contributor refactor. Watch for audit E2 (resistance cap at 100) as item 10's resistance modification path lights up. The contributor-refactor cleanup (E4) is a good companion if time permits.

No carry-forward items from 26.5 block Session 27. The polish pass landed cleanly.
