# Session 34 Brief: Phase E Kickoff — Title Screen + Minimal Battle Setup + App-Shell Routing + HMR Root-Cause Fix

## Context

Phase D content complete (S33 = River Ridge runtime; S33.5 = bug-fix lap; S33.5A = post-state absolutes generalization). Tests at 996/0 across 83 files. Equipment-complete and Phase D content milestones hold. Session 34 begins **Phase E** — the pre-battle UI surfaces — starting with the lightest possible scaffolding: title screen, minimal battle setup (single "Start River Ridge" button), and the app-shell routing that connects them. Plus the HMR/Pixi-init crash root-cause fix carried forward from S33.5, since the work is naturally adjacent to the mount-useEffect / Pixi cleanup concerns the crash implicates. Plus the long-deferred (Session 24) "next battle" / "back to title" buttons on the results screen, which now have destinations.

End of session: title screen renders with Chris's splash image; "Start" routes to battle setup; battle setup's single "Start River Ridge" button launches BattleView with fresh state; results screen offers "Next Battle" and "Back to Title"; content-file HMR no longer black-screens. Phase E's foundation in place for Sessions 35-37 to extend (team-builder, map selection, deployment phase UI).

## Inputs (read first)

In recommended order:

1. **`CLAUDE.md`** — project conventions.
2. **`docs/handoff.md`** — Session 33.5A handoff. Particularly the "Limitations + watch-fors" section (HMR/Pixi-init crash root cause, the `BattleErrorBoundary` from B4 as defensive backstop).
3. **`docs/twentyOnePlanning/roadmap-sessions-21-plus.md`** — Session 34 entry; Sessions 35-37 for context on what this session prepares for.
4. **`docs/handoff.md`** for S33.5 — the original HMR/Pixi-init crash diagnostic notes (content-file edit black-screens `BattleViewInner`; reproduces with all S33.5 HMR changes reverted, so pre-existing; suspected causes: big mount `useEffect` not surviving Fast Refresh re-run, or Pixi `Application` double-init race).
5. **`src/app/BattleView.tsx`** — the existing mount + `BattleErrorBoundary` (S33.5A) + the mount `useEffect` deps that may be implicated.

### Paths to survey before planning

Current-tree audit. Particularly:

- **Existing app entry / root component.** Confirm what currently mounts `BattleView` directly (the entry point routes straight into the demo battle). Identify where the screen-selector machinery lands.
- **Existing results screen.** Confirm structure and current state. The "next battle" / "back to title" buttons were deferred from Session 24 — likely they're stubbed or placeholders today.
- **`BattleViewInner` mount useEffect.** The handoff names `[catalog, uiController]` as the deps. Audit identifies what the effect does on mount, what it returns as cleanup, and whether the cleanup path actually fires on Fast Refresh re-render. Likely candidates for the HMR root cause:
  - The cleanup function doesn't destroy the Pixi `Application` instance fully, so re-running the effect creates a second Pixi instance attached to the same canvas
  - The `uiController` dep changes identity on each render of an outer component during Fast Refresh, retriggering the effect when it shouldn't
  - A subscriber/listener registered in mount never gets removed
- **Pixi `Application` lifecycle.** Where the instance is created, attached, and destroyed. The double-init race the handoff mentions hinges on this.
- **`BattleErrorBoundary` (S33.5A).** Already wraps `BattleViewInner`; stays in place as defensive backstop after the root-cause fix lands. Confirm the boundary's reset path works correctly when the wrapped component unmounts.

### Architectural decisions

After the audit:

1. **Routing approach.** Two reasonable shapes:
   - **A — Simple state-based routing.** A top-level App component holds a `screen: 'title' | 'setup' | 'battle' | 'results'` state; the appropriate component renders for the current screen. No router library; minimal dependency footprint.
   - **B — React Router (or equivalent).** Standard library; URL-aware; future-extensible to deep-linking, etc.
   
   **Recommendation: A.** v1 has three screens (title, setup, battle/results); the navigation graph is small and known. React Router adds a dependency and a learning surface for negligible win. If the screen graph grows substantially (deep-linking to specific battles, settings sub-pages, etc.), introducing React Router later is a small migration. **Settle at plan-review.**

2. **App-shell structure.** Where does the screen-selector live?
   - **A — In `App.tsx`** directly (state + switch on screen).
   - **B — A dedicated `AppShell` component** that wraps the screen tree.
   
   **Recommendation: A.** For three screens, a dedicated shell is over-architected. `App.tsx` holding the screen state + switch is the minimum viable. If shell-level concerns surface (persistent header, global settings panel, etc.), extract later.

3. **Title screen interaction.** Splash image + what?
   - **A — A "Start" button** centered or positioned over the splash. Discoverable; standard pattern.
   - **B — Press-any-key.** Old-school; less discoverable on touch devices (if those are ever supported).
   - **C — Both.** Button as primary, Enter/Space key as parallel input.
   
   **Recommendation: C.** Button is the primary affordance; keyboard input is a quality-of-life add that's trivial to wire. Future controllers/touch can compose from the button without rework.

4. **Battle setup screen content.** Per Chris's call: ultra-minimal — single "Start River Ridge" button.
   - Layout: a simple centered card or panel with the battle name and a Start button. Future iterations (Sessions 35-37) add team-builder + map selection.
   - **Recommendation: leave placeholders unstyled / absent in v1.** No "future feature" stubs — the screen reads as "this battle, click to start," not "more stuff coming later." Adding visible placeholders before they're functional invites confusion.

5. **"Next battle" / "Back to title" results screen wiring.** Two reasonable shapes:
   - **A — "Next battle" routes through battle setup.** Player sees the setup screen briefly; clicks Start; fresh battle launches. Consistent with the player's mental model of "I'm choosing a battle."
   - **B — "Next battle" remounts BattleView with fresh state directly.** Skips the setup screen for speed.
   
   **Recommendation: A.** Single navigation pattern; setup screen becomes the canonical "choose what to do next" surface. When team-builder ships (S35+), this is where it lives, so going through it now bakes the right pattern in.

6. **HMR/Pixi-init crash diagnostic approach.** Audit-first. The handoff names two likely candidates; the audit determines which (or both). Once identified:
   - **If cleanup-doesn't-destroy-Pixi:** Pixi `Application.destroy()` in the cleanup function; ensure the canvas DOM element is cleared so the next mount has a clean attachment point.
   - **If useEffect-retriggering-on-Fast-Refresh:** stabilize the `uiController` (or whichever dep) identity across renders, or restructure the effect to use refs for one-shot init.
   - **If both:** fix both; they may have compounded the symptom.
   
   **Recommendation: diagnostic-first; don't pre-commit to a fix shape.** The S33.5 attempt at a fix was reverted because the framing was wrong; audit is the way through.

7. **Pixi resource cleanup on screen transitions.** When the player navigates battle → title (via the new button), the Pixi `Application` should fully tear down so memory doesn't leak across battles. The HMR crash fix likely addresses the same cleanup path; verify both work via this surface.

8. **Title screen splash image source.** `src/assets/title/splash.png` per the conversation. Imported as a static asset via Vite's standard `import splashUrl from '@/assets/title/splash.png'` (or relative) and rendered as a background image or `<img>` element. Audit confirms the asset import convention used elsewhere (terrain textures likely use a different pattern since they're Pixi `Texture`s; title screen is React/DOM).

9. **Test strategy.**
   - **Title screen:** smoke test (renders without throwing); button click routes to setup.
   - **Battle setup screen:** smoke test; Start button routes to battle.
   - **App-shell routing:** integration test that screen transitions update the rendered tree correctly.
   - **Results screen buttons:** integration test that "Next battle" routes to setup; "Back to title" routes to title; battle state from prior battle doesn't leak.
   - **HMR root-cause fix:** primarily manual verification (dev-loop change). Type-check + existing test suite passes; no regressions in the demo-launch path.
   - **Pixi cleanup:** if testable, an integration test that mounting → unmounting BattleView doesn't leave a Pixi instance attached.

10. **Order of work.**
    - Audit + diagnostic (HMR root cause identification)
    - App-shell + routing scaffolding
    - Title screen (with splash image)
    - Battle setup screen (minimal)
    - HMR root-cause fix (informed by audit)
    - Results screen "Next battle" / "Back to title" wire-up
    - Verification (manual HMR test; demo battle launch; full navigation loop)

11. **34a/34b split allowance.** The HMR root-cause is the largest scope-uncertainty item. If audit reveals it's substantial (e.g., Pixi `Application` lifecycle needs a structural rework, not a one-line cleanup add), the split:
    - **34a:** App-shell + title + battle setup + results screen buttons (pure UI scaffolding; doesn't depend on HMR fix)
    - **34b:** HMR root-cause fix (focused dev-loop session)
    
    If audit reveals the HMR fix is small (cleanup function adjustment, dep stabilization), no split.

The plaintext plan is reviewed before code lands.

## Implementation work

Following plan approval, items land roughly in this order: diagnostic first, then UI scaffolding, then HMR fix, then continuity wiring.

### Item 1: HMR root-cause audit + diagnostic

- Survey `BattleView.tsx`'s mount `useEffect`; identify cleanup behavior
- Survey Pixi `Application` instantiation, attachment, destruction
- Reproduce the content-file-edit black-screen; capture the throw location and stack
- Identify which of the candidate causes (cleanup miss, dep instability, double-init) is the actual root cause
- Plan-review document captures the diagnostic finding before the fix lands

### Item 2: App-shell + routing scaffolding

- Top-level App component with screen state (per decision 1: simple state-based routing)
- Screen-component switch in `App.tsx` (per decision 2)
- Navigation helpers (`goToTitle`, `goToSetup`, `goToBattle`, `goToResults`) — simple state setters
- Existing `BattleErrorBoundary` from S33.5A remains around `BattleViewInner`

### Item 3: Title screen

- New `src/app/TitleScreen.tsx`
- Splash image from `src/assets/title/splash.png` rendered as background or hero image
- "Start" button positioned over splash (per decision 3 = C: button + keyboard parallel)
- Enter/Space key handler routes to setup screen
- Minimal styling consistent with existing UI tone (dark palette per S31.5 hardcoded-team-color centralization; neutral typography)

### Item 4: Battle setup screen (minimal)

- New `src/app/BattleSetupScreen.tsx`
- Single "Start River Ridge" button (per Chris's call; no placeholder UI per decision 4)
- Button routes to `BattleView` with the River Ridge battle config
- "Back" affordance routing to title screen

### Item 5: HMR root-cause fix

- Implementation per the diagnostic finding from Item 1
- Manual verification: edit a content file (e.g., `flametongue.ts`); save; observe Fast Refresh re-renders `BattleViewInner` without black-screening
- `BattleErrorBoundary` from S33.5A stays as defensive backstop

### Item 6: Results screen "Next battle" / "Back to title" wire-up

- Locate the results screen (deferred from Session 24)
- "Next Battle" button routes to battle setup screen (per decision 5 = A)
- "Back to Title" button routes to title screen
- Battle state from prior battle properly disposed on navigation away (Pixi cleanup verified)

### Item 7: Verification

- Full navigation loop: title → setup → battle → results → next-battle → setup → battle → ... → back-to-title
- No Pixi instance leaks across transitions
- Demo battle launches identically to pre-S34 (no regression)
- HMR works on content file edits without black-screen

## Acceptance criteria

**Routing:**

- Application boots into title screen by default (not directly into BattleView).
- Title screen "Start" button (or Enter/Space) routes to battle setup screen.
- Battle setup screen "Start River Ridge" button routes to BattleView with River Ridge battle config.
- Battle setup screen has a "Back" affordance routing to title.
- Results screen "Next Battle" routes to battle setup; "Back to Title" routes to title.
- Navigation transitions properly dispose prior screen state (Pixi cleanup on battle exit).

**Title screen:**

- Splash image renders from `src/assets/title/splash.png`.
- Start button visible, clickable, and keyboard-actionable.

**Battle setup screen:**

- Single "Start River Ridge" button visible and functional.
- No placeholder UI for future team-builder / map-selection features.

**HMR root-cause fix:**

- Editing a content file (e.g., a class baseline, an equipment item, an ability) and saving no longer black-screens `BattleViewInner`.
- The fix addresses the diagnosed root cause (not a defensive add over a still-broken substrate).
- `BattleErrorBoundary` from S33.5A remains in place as backstop.

**Continuity:**

- "Next Battle" from results screen successfully restarts a fresh battle (no leaked state from prior battle).
- "Back to Title" from results screen returns to title; subsequent navigation back through setup launches a fresh battle correctly.

**Quality:**

- Tests at 996+, 0 failing. New tests proportional to scaffolding.
- No new ADR expected (routing is implementation detail; HMR fix may warrant a small ADR if it surfaces a Pixi-lifecycle invariant worth codifying — settle in plan).
- `docs/handoff.md` updated.

## Out of scope

- **Team builder** — Sessions 35-37.
- **Map selection** — Sessions 35-37.
- **Deployment phase UI** — Sessions 35-37.
- **Sample team templates** — Sessions 35-37.
- **Settings expansion** — Phase E later.
- **Surrender flow** — Phase E / S34 carry (ADR-0041); not included this session unless audit reveals it's a small adjacent add.
- **Title screen polish** — animation, music, branding decoration. Future polish.
- **Battle setup polish** — battle previews, difficulty selection. Future Phase E.
- **Splash image variants** — multi-resolution, theme variants. Future polish.
- **Results screen polish beyond the new buttons** — existing screen stays as-is.
- **HMR/Pixi lifecycle deep refactor** beyond the root-cause fix — additional Pixi cleanup hardening defers to future polish.
- **Procced Lightning Strike action-log attribution / Rasp Pendant drain attribution** — S30 carries.
- **AI active absorption exploitation** — S27 carry.
- **AI projection forecast extension** — S30 carry.
- **Burn × Purifier playtest observation** — S33.5 setup ready; needs playtest.
- **River Ridge balance tuning** — playtest-informed.
- **`map-and-battlefield.md` open questions** — Phase E doesn't surface these.

## Files likely touched

Non-exhaustive. Audit confirms / corrects.

**App-shell + routing:**

- `src/App.tsx` (or main entry) — screen state + selector
- `src/app/BattleView.tsx` — entry-point becomes a screen, not the app root

**New screens:**

- `src/app/TitleScreen.tsx` (new)
- `src/app/BattleSetupScreen.tsx` (new)
- (Existing) `src/app/ResultsScreen.tsx` (or equivalent) — Next Battle / Back to Title wire-up

**HMR fix:**

- `src/app/BattleView.tsx`'s mount useEffect — cleanup adjustment per audit
- (Potentially) Pixi `Application` lifecycle wrapper if the fix surfaces structural concerns

**Assets:**

- `src/assets/title/splash.png` (Chris provides)

**Tests:**

- `src/app/TitleScreen.test.tsx` (new)
- `src/app/BattleSetupScreen.test.tsx` (new)
- `src/app/App.test.tsx` (new — routing transitions)
- `src/app/ResultsScreen.test.tsx` (or equivalent — new buttons)

**ADRs:**

- Possibly one if the HMR fix surfaces a Pixi-lifecycle invariant worth codifying. Plan-review determines.

**Documentation:**

- `docs/handoff.md` — session handoff

## Workflow notes

- **Plaintext-first review required.**
- **Diagnostic-first for HMR.** Don't pre-commit to a fix shape; audit identifies the root cause before code lands. The S33.5 attempt failed because the proposed fix didn't address the actual cause.
- **ADR path is `docs/decisions/`.**
- **Order of work matters:** HMR audit first (in case it reveals scope-balloon and informs split decision); UI scaffolding after; HMR fix after audit; continuity wiring last.
- **Mid-session design questions** route through Chris to the planner. Most likely surfaces: HMR root-cause diagnostic outcome (informs whether to fold the fix in S34 or split to 34b); routing approach call if Chris prefers React Router over simple state-based; title screen layout decisions (centering, button positioning) if the splash image has specific aspect ratio constraints.
- **Pre-flight verification:** existing demo battle still launches via the route; `BattleErrorBoundary` from S33.5A intact; no regression in CT spool-up / animation pacing / cliff-edge rendering.
- **Phase E milestone:** title + setup + continuity buttons in place by end of session. Sessions 35-37 extend (team-builder, map selection, deployment phase).

## Watch-fors

**Addressed this session:**

- Title screen scaffolding (Phase E kickoff)
- Battle setup screen minimal (Phase E kickoff)
- App-shell + routing (Phase E foundation)
- HMR/Pixi-init crash root-cause fix (S33.5 → 33.5A carry-forward)
- Results screen "Next Battle" / "Back to Title" wire-up (Session 24 deferral with destinations now in place)

**Not addressed this session, longer-term carry-forward:**

- **Team builder + map selection + deployment phase + sample team templates** — Sessions 35-37
- **Title screen polish** — animation, music, branding decoration
- **Battle setup polish** — battle previews, difficulty selection
- **Surrender flow** — ADR-0041; Phase E/F
- **Settings expansion** — Phase E later
- **Pacing constants** — initial reads good per Chris; ongoing observation
- **Cliff-edge thickness** — same
- **Charged-action tooltip browser verification** — S33.5 carry; needs charged action in flight
- **Burn × Purifier playtest observation** — S33.5 setup ready; needs playtest
- **River Ridge balance tuning** — open considerations from `river-ridge.md`; playtest-informed
- **Walk-on-Water passive** — future content
- **Procced Lightning Strike action-log attribution / Rasp Pendant drain attribution** — S30 carries
- **AI active absorption exploitation** — S27 carry
- **AI projection forecast extension via `computeOutgoingHitChance`** — S30 carry
- **Procced spell uses caster's MA / Magus Crown calibration / Tintinibar Regen / Sorcerer's Robe Move +1** — ongoing playtest reads
- **Suppress pre-battle init entries in release builds** — S33.5 carry; longer-term polish
- **`map-and-battlefield.md` open questions** — elevation hit-chance/cover, AoE multi-layer, LoS tie-breaking, etc.
- **`mapAllTerrainCosts` vs `defaultStepCost`** — S33.5 carry; no v1 case
- **Centralized `canApplyHeal` helper** — explicitly rejected (ADR-0074); revisit at third heal-site
- **`isWaterTile` predicate keys on elevation, not registry** — S33 carry
- **`buildBattle` test-fixture extraction** — triggers at fourth duplication
- **Wand swing ally-targetability** — S31 carry
- **Status-badge polarity convention extension** — chip pre-icons if status lists grow
- **Team color palette → engine `Team` shape** — long-term
- **Tooltip Option B authored-description pass** — post-current-roadmap
- **`onTurnStart` symmetric widening** — S26 carry
- **Multiplicative tick-amount stacking** — S28 carry
- **`onFinalDamage` fires on absorbed hits but handlers gate** — design pattern
- **Forecast facing uses actual attacker→target geometry** — S30 carry
- **Unit detail panel's per-facing evasion uses `unit` as attacker stand-in** — S30 carry
- **Constant-map labels don't carry icons today** — S28 polish
- **`pa_factor` NotYetImplementedError** — audit E3
- **TS strict-mode test errors** — audit E8
- **MVP-unit smarter algorithm** — S24 Wave 1
- **Permadeath timer** — S24 Wave 1
- **Reactions in projection column** — S24 Wave 1
- **Forecast accuracy row visibility** — S30 reject
- **Hit-chance and cover modifiers from elevation differential** — `map-and-battlefield.md` open question
- **`fillVitalsFromComputedMaxes` ordering invariant** — S32 carry; holds for v1
- **Bedrock Stride ongoing playtest read** — integration-tested S33; real playtest still pending
- **`BattleView.test.tsx` benign canvas-context stderr** — S33.5A carry; jsdom canvas stub in setupFiles if more `.test.tsx` files added under `src/app/`

## Estimated size

**Medium.** UI scaffolding (title screen, battle setup, app-shell routing, continuity buttons) is bounded and mostly mechanical. The HMR root-cause fix is the scope unknown — could be small (one-line cleanup adjustment) or moderate (Pixi-lifecycle restructure). Diagnostic-first framing lets the audit set the scope.

**34a/34b split allowance** reserved if HMR audit reveals substantial scope:

- **34a:** App-shell + title + battle setup + results screen buttons (pure UI scaffolding)
- **34b:** HMR root-cause fix (focused dev-loop session)

Likely no split needed. The HMR crash has a specific symptom (content-file edit black-screens) and two named candidate causes; the fix is probably a cleanup-function adjustment or a dep-stabilization, both small.

**End of session: Phase E foundation in place.** Sessions 35-37 extend (team builder, map selection, deployment phase UI, sample team templates).
