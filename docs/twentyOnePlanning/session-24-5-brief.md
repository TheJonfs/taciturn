# Session 24.5 Brief: MVP Playtest Iteration — Bugs, UI Polish, Portraits

## Context

Session 24 landed the MVP UI surfaces (forecast, projection, results, derived events) plus a same-session Wave-2 fix pass addressing 12 playtest observations. The MVP is now playable. Chris's second playtest pass produced 19 observations, of which 7 are "feels right / no action," 3 are real bugs, and 9 are UI polish / completion items.

This session is a focused iteration pass to address bugs and tighten the playable surface before Session 25 starts Phase B (Cluster 2 substrate work, content authoring). Session 25's plate carries a small UI revision (Attack-in-Act repositioning, settled in conversation) and three carry-forward items from this session's deferrals — kept separate to preserve 25's substrate-work focus.

This is a smaller brief than 22-24, but the bug investigation work in particular needs latitude for hypothesis-and-instrument rather than guess-and-fix.

## Inputs (read first)

In recommended order:

1. **`CLAUDE.md`** — project conventions.
2. **`docs/handoff.md`** — Session 24 handoff (wave 1 + wave 2). Note especially: empirical-questions checklist Chris worked through in the second playtest, the wait-cost / Universal Attack architecture from Wave 2, and existing limitations flagged for later.
3. **`docs/twentyOnePlanning/roadmap-sessions-21-plus.md`** — Session 25 entry for context on what's downstream and not in scope here.
4. **`docs/twentyOneDesign/battle-ui-architecture.md`** — relevant sections: forecast panel, projection column / QueueTower, action log, move-select interaction, inspection model (Tier 1.5 / 3 hierarchy).

### Paths to survey before planning

Current-tree audit required. At minimum survey:

- `src/ui/turn-flow.ts`, `src/ui/use-turn-flow.ts` — for the targeting bug investigation and move-confirm work
- `src/ui/action-menu.tsx` — move-select state, confirm-step setting
- `src/ui/action-log-format.ts`, `src/ui/action-log-panel.tsx` — for charged-action T-numbering and burn-status-failure log entry
- `src/ui/queue-tower.tsx` — for active-turn entry suppress and click-charged-action-detail
- `src/ui/forecast-panel.tsx`, `src/ui/forecast-compose.ts` — for target-HP addition
- `src/renderer/unit-layer.ts` — for HP-bar color coding and portrait integration
- `src/renderer/battle-renderer.ts`, `src/renderer/tile-layer.ts`, `src/renderer/highlight-layer.ts` — for move-hover and AoE preview
- `src/engine/abilities/` or wherever content lives — for AoE-shape bug investigation (Tidal Wave, Chain Lightning)
- `src/engine/status/` and the status-apply path — for burn log false-failure investigation
- `src/ai/basic.ts` — for the targeting bug (if it's controller-side legal-target filtering)
- `src/engine/actions/can-commit.ts` (ADR-0039 location) — also for targeting bug

## Goal

End state:

- Three real bugs investigated and resolved (or, where root cause requires more data than this session can gather, instrumented with logging hypotheses).
- Forecast panel shows target HP alongside damage range.
- HP bars on canvas color-code by current percentage.
- QueueTower suppresses the redundant active-turn entry.
- Action log entries for charged-action resolves get their own T-number.
- Move-select shows pointer-hover highlight and requires confirm-before-commit (parity with action commits).
- QueueTower click on a charged-action mini-card opens detail showing target, projected AoE on canvas, and timing info.
- Class portraits integrated as unit tokens on map and in detail panel (assuming asset delivery).

Tests at 651+, 0 failing. New pure-logic surfaces (color-coding thresholds, portrait integration, etc.) covered where applicable.

## Pre-implementation plan (required)

Same discipline as Sessions 22-24. Current-tree audit first; architectural decisions surfaced before code.

### Required first step: current-tree audit

For each surface this session touches: what exists, what state it's in, what this session does to it.

### Architectural decisions

After the audit:

1. **Bug 1: targeting failure on enemy unit mid-battle.** This is the highest-uncertainty item in the session. Reproducibility is unknown; the symptom recovered on the next turn. The plan articulates a hypothesis tree (state-bound: stale memoization in targeting-overlay; status-bound: target has a status affecting eligibility from this caster specifically; controller-bound: `canCommitAction` returning false for a path not exercised in test fixtures; AI-bound: something specific to Lightning-Mage-vs-Lightning-Mage scenarios) and a debugging strategy. Acceptable outcomes:
   - **Root cause found and fixed.** Preferred.
   - **Repro found, root cause narrowed, instrumented for next surface.** Acceptable if the bug is genuinely tricky — add logging in the targeting-overlay or `runOnActionAttempted` dry-run path that will produce diagnostic output on next playtest occurrence, and document the hypothesis tree in handoff.
   - **Cannot repro with reasonable effort.** Acceptable as last resort. Document the failed-repro paths tried, add instrumentation anyway, and explicitly flag for handoff.
   
   What's *not* acceptable: silently fixing something adjacent and hoping it covers the case. If the fix is speculative, say so.

2. **Bug 7: Tidal Wave and Chain Lightning showing Cross-r1 AoE instead of diamond-r1.** Per the post-reconciliation content spec, both should be diamond-r1. Audit reveals whether the bug is content-side (definition shape wrong) or rendering-side (AoE preview shape dispatch wrong). Both are valid root causes; the fix follows. Likely small.

3. **Bug 13: burn application reported as failure in log when it actually lands.** Engine-vs-formatter mismatch. The status applies (verified by status badge appearing on target, by ongoing tick damage); the log entry misrepresents this. Audit the apply path and the formatter; identify the mismatch. Likely small.

4. **Forecast panel target HP addition.** Add a "Target: HP X/Y" row to the forecast panel for the currently-hovered target. State data flow (read from state.units, snapshot at hover time vs. live).

5. **HP bar color coding by percentage.** Thresholds per the spec from Chris: green >75%, yellow 33-75%, red <33%. State where the threshold logic lives (renderer constant, exposed config, or settings-controlled). My default would be renderer constants; tunable later if needed.

6. **QueueTower active-turn entry suppression.** Currently the first entry in the tower mirrors the active unit's anchor (which is also shown in the unit detail at the bottom). Suppress it so the tower shows "next turn after active" upward. Mechanically: skip the first event in the projection's upcoming list when rendering tower mini-cards.

7. **Charged-action T-number in action log.** Per Chris's observation, charged-action resolves currently bin under the *previous* unit's turn number, producing long noisy entries. Each charged-action resolve should get its own T-number. State the reorg: is it formatter-only (split log entries by turn-start markers but assign a new T-number when a charged-resolve fires regardless of context), or does it need engine support (a turn-counter on charged-action-resolve actions)? Lean formatter-only if possible — fewer engine touchpoints. The fix is purely about display sequencing.

8. **Move-select pointer-hover highlight.** During move-select, the tile under the pointer gets a distinct highlight (overlay channel of the highlight layer? new ephemeral marker?) so the player sees the *target* of their click before committing. State the visual idiom.

9. **Move-select confirm-before-commit.** Currently move commits on click. Add a confirm step that parallels the action-commit confirm step. State whether move-confirm respects the existing `settings.confirmStep` setting (so the user can opt into Skip) or is always-confirm in v1. My lean: respect the same setting for parity; if Chris explicitly wants always-confirm for move, that's a settings tweak rather than a separate path.

10. **QueueTower charged-action click → detail panel.** Currently click on a charged-action mini-card opens the caster's detail. Should open the *charged action's* detail: target, AoE projection rendered on canvas (overlay channel), timing info (the existing Timing subsection's ticksToResolve etc.). State the surface: a new panel variant, an extension of the unit detail panel showing charged-action context, or a separate component. Canvas AoE preview reuses the existing highlight-layer overlay channel (the same one target-select uses). Note: the existing canvas-click-on-unit → unit detail is preserved; this is a separate click target (mini-card vs. canvas).

11. **Portrait integration.** Assuming Chris drops PNG assets into the project (likely `src/assets/portraits/`, naming convention `<class-id>.png` or similar). The plan addresses:
    - **Asset loading**: when (mount-time vs. lazy), where (renderer init vs. a separate asset module)
    - **Map token rendering**: portraits replace the existing circle. Team-color ring overlay preserved (encircles the portrait). Enemy team flipped horizontally.
    - **Detail panel rendering**: portrait displayed prominently in the unit detail panel's stats section.
    - **Sizing**: source assets at 512×512 (per Chris's prep work) downscaled to map-token render size by Pixi; detail panel uses native size or larger.
    - **Fallback**: graceful behavior if asset is missing — fall back to existing circle render with class-color so the game doesn't crash.
    
    State the integration approach. If assets aren't yet delivered when the session starts, this item can ship with placeholder colored rectangles named per-class (so the integration path is built and the assets just slot in when Chris delivers them), or be deferred.

12. **Test strategy.** Bug investigations need targeted tests reproducing the bug condition before fixing (where repro is achievable). UI completion items are pure-logic where applicable (thresholds, formatter changes) and unit-tested. Visual changes (portraits, color-coding) rely on manual verification.

13. **24.5a/24.5b split allowance.** Surface area is smaller than 22-24 but the bug investigation is open-ended. If item 1 (targeting bug) consumes more than expected and threatens the rest, propose a split:
    - **24.5a:** bugs (1, 7, 13) + small UI completion items (forecast HP, HP color, tower suppress, charged-action T-number)
    - **24.5b:** move hover + confirm, tower charged-action click → detail, portraits
    
    Or whatever lines the audit suggests. Settle in the plan, not mid-implementation.

## Implementation work

Following plan approval, items land roughly in priority order: bugs first, then UI completion polish, then portraits.

### Item 1: Bug — targeting failure on enemy mid-battle

Investigate per the hypothesis tree. Outcomes acceptable: fix, instrument, or document. See section 1 of the plan.

### Item 2: Bug — Tidal Wave and Chain Lightning AoE shape

Per the spec: both diamond-r1. Audit reveals content-side or rendering-side; fix accordingly.

### Item 3: Bug — burn application false-failure in log

Audit the status apply path and the action-log formatter. Find the mismatch; fix.

### Item 4: Forecast panel — target HP display

Add a "Target: HP X/Y" row (or equivalent placement per the design doc and the existing panel layout). HP value read from current state for the hovered target; updates live as the player moves the cursor among targets.

### Item 5: HP bar color coding by percentage

Thresholds: green >75%, yellow 33-75%, red <33%. Renderer-side. Constants in `src/renderer/constants.ts`.

### Item 6: QueueTower active-turn entry suppression

Skip the first projected event when rendering tower mini-cards, since it duplicates the active-unit anchor.

### Item 7: Charged-action T-number in action log

Reorg the formatter to assign a new T-number when a charged-action resolves, regardless of the surrounding turn context. Likely formatter-only; verify in plan.

### Item 8: Move-select pointer-hover highlight

Tile under the pointer during move-select gets a distinct highlight. Likely uses the highlight layer's overlay channel.

### Item 9: Move-select confirm-before-commit

Confirm step for move commits, parallel to ability commits. Respects `settings.confirmStep`.

### Item 10: QueueTower charged-action click → detail panel

Click on a charged-action mini-card opens detail for the charged action itself (target, AoE projection on canvas, timing). The existing click-on-caster behavior was either replaced or preserved as a secondary affordance per the plan's choice.

### Item 11: Class portraits

Asset loading + map-token rendering + detail-panel rendering + team-color ring + enemy-flip + fallback. If assets aren't ready, ship the integration with named placeholders that swap in cleanly when assets arrive.

## Acceptance criteria

- Bug 1 resolved, instrumented with documented hypothesis, or explicitly flagged for follow-up.
- Tidal Wave and Chain Lightning render diamond-r1 AoE previews correctly.
- Burn application logs reflect actual apply outcome (success on success, failure on failure).
- Forecast panel shows target HP during target-select hover.
- HP bars color-code by percentage per the threshold spec.
- QueueTower's first entry no longer mirrors the active-unit anchor.
- Charged-action log entries have their own T-numbers.
- Move-select shows a hover highlight on the target tile and requires confirm before committing.
- QueueTower mini-card click on a charged-action opens detail with target / canvas AoE preview / timing.
- Class portraits render on map tokens and in detail panel (or integration is in place with placeholder fallback).
- Tests at 651+ passing, 0 failing.
- ADRs written for substantive architectural choices that emerge from this session — at minimum the targeting bug's root cause (if found) or hypothesis (if not), plus any non-obvious calls in the charged-action detail panel or portrait integration. Other ADRs at implementer's discretion.
- `handoff.md` updated.

## Out of scope

These three carry-forward to Session 25 or later, deliberately not addressed here. They form a coherent later pass:

- **Timing projector accuracy improvement** (Chris's playtest item 3a). `estimateChargedTiming` does `ceil(actionSpeed / casterSpeed)` but engine uses `computeActionSpeed` at commit which factors caster MA. Improving accuracy requires walking the projected CT schedule including other charged resolves. Engine projection work, non-trivial.
- **Tower slot-in for charged-action resolves** (Chris's playtest item 3b). Charged-action resolves should appear in QueueTower as their own events at their projected resolution time. Requires the same projection improvement as the timing accuracy work.
- **Charged-action animation pacing** (Chris's playtest item 18 final part). Currently charged resolves play very fast on canvas. Pacing tweaks; design-doc-driven tuning.

These three together want a coherent pass when charged-action visibility becomes the bottleneck. Could fold into Session 25 as a small additional cluster sub-item if there's room, or schedule a post-25 polish session.

Also out of scope:

- **Attack-in-Act repositioning.** Settled in conversation; carries to Session 25 as an explicit early item.
- **All Phase B/C/D/E work**: substrate prep, equipment expansion, map mechanics, pre-battle UI, results screen polish (MVP-unit nuance, permadeath timer). These all wait for their planned sessions.
- **Settings expansion beyond what's already in place.**
- **Anything in Session 24's "Items deferred to designer or future session" list** — those carry forward unchanged.

## Files likely touched

A non-exhaustive list. The audit confirms / corrects.

- `src/ui/forecast-panel.tsx`, `src/ui/forecast-compose.ts` — target HP
- `src/renderer/constants.ts`, `src/renderer/unit-layer.ts` — HP color coding, portrait integration
- `src/ui/queue-tower.tsx` — active-turn suppress, charged-action click detail
- `src/ui/action-log-format.ts` — charged-action T-number, burn-status-failure
- `src/ui/turn-flow.ts`, `src/ui/use-turn-flow.ts`, `src/ui/action-menu.tsx` — move hover + confirm
- `src/ui/charged-action-detail-panel.tsx` (new) or extension of `src/ui/unit-detail-panel.tsx` — depending on plan
- `src/renderer/battle-renderer.ts` — portrait integration entry points, possibly move-hover wiring
- `src/renderer/highlight-layer.ts` — move-hover (possibly), AoE preview reuse for charged-action detail
- Content files for `tidal_wave` and `chain_lightning` — if the AoE bug is content-side
- `src/engine/status/` or wherever burn-status-apply emits log records — if the burn log bug is engine-side
- `src/ai/basic.ts`, `src/engine/actions/can-commit.ts`, or targeting overlay — depending on where the targeting bug lives
- `src/assets/portraits/` — new asset directory
- New tests for any bug repros, formatter changes, color thresholds, etc.
- New ADRs as needed (see acceptance criteria).
- `docs/handoff.md` — updated.

## Workflow notes

- **Plaintext-first review required.** Same discipline as 22-24.
- **Audit-first within the plan.** Particularly important for the bug items — the audit informs the hypothesis tree for item 1 specifically.
- **Bug 1 latitude.** As stated, hypothesis-and-instrument is an acceptable outcome if the bug is genuinely hard to repro. The session shouldn't get stuck on one bug at the cost of everything else. If item 1 hits a wall, instrument and move on; the next playtest produces more data.
- **Mid-session design questions** route through Chris back to the planner. Especially relevant for the charged-action detail panel design (separate component vs. extension of unit detail) and portrait integration approach (asset loading pattern, fallback shape).
- **The integration test calibrated to `demoBattle`'s 6×6 board** stays calibrated. Bug fixes affecting the AI's targeting logic should be checked against the integration test's win-rate balance.
- **Portrait assets** may or may not be in place when the session starts. If yes, integrate live. If no, build the integration with placeholder fallback so assets slot in when delivered. State which path is taken.

## Watch-fors carried forward

**Addressed this session:**
- All 9 playtest items in scope per the goal section.

**Not addressed this session, carried forward to Session 25 or later:**
- Timing projector accuracy improvement (Chris's playtest item 3a)
- Tower slot-in for charged-action resolves (Chris's playtest item 3b)
- Charged-action animation pacing (Chris's playtest item 18 final part)
- Attack-in-Act repositioning (settled in conversation; Session 25)
- Top bar `Turn T####` is O(actionLog.length) (Session 22)
- Renderer MP "max" captured at mount (Session 22; Session 28 lifts)
- Status-badge polarity convention (Session 22)
- rAF vs setInterval (Session 23)
- AoE preview correctness across all shapes (Session 23 — partially addressed by bug 7's fix)
- MP/status snapshot ahead-of-tween (Session 22)
- `docs/content-snapshot.md` drift (Session 21; Session 26 refresh)
- Resistance composition cap at 100 (audit E2; Session 27)
- `pa_factor` (audit E3)
- `equipmentContributionsFor` "branch per hook" (audit E4; Session 27)
- TS strict-mode test errors (audit E8)
- Surrender flow (Session 34)
- MVP-unit smarter algorithm (Session 24 wave 1)
- Permadeath timer (Session 24 wave 1)
- Settings expansion (Session 24 wave 1)
- Reactions in projection column (Session 24 wave 1)
- Mini-timeline for forecast Timing subsection (Session 24 wave 1)
- Lightning Mage's `quickstep` refund visibility (waits for Session 26)
- `consumed.waited` flag is now decorative (Session 24 wave 2; cleanup candidate)
- WAIT-CONFIRM keyboard support (Session 24 wave 2; polish)

## Estimated size

Medium. Bug investigations are the time-uncertain component; if item 1 turns out hard, the 24.5a/24.5b split is the appropriate response. Most of the UI items are small (forecast HP row, color coding thresholds, suppress one entry, formatter T-number). The charged-action detail panel and portrait integration are the larger items. Portraits depend on asset delivery timing — if assets land mid-session, integration is straightforward; if not, placeholder fallback works.
