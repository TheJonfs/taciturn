# Session Handoff

This is a transient note from one session to the next.

**Discipline:** This document is *overwritten* each session, not appended. When starting a session, read this file and process every item — act on it, promote it elsewhere (ADR, design-doc edit, GitHub issue), or explicitly drop it with a reason. Items do not accumulate. If there are no notes to leave, replace the contents with `_No handoff this session._` so the next session knows the file has been processed.

---

## From Session 43 close (2026-05-21) — Unified team architecture + KO'd-unit pathing + AI deployment heuristic

S43 shipped as a **monolith** (no 43a/43b split — the audit found the engine already team-agnostic, so the unified-team work was additive, which let the stretch goal land too). **1285 tests passing across 115 files** (up from 1264 / 114; +21). One ADR: **ADR-0082** (unified team architecture — control flag, sequential builder, heuristic deployment, pass-and-play UX). A post-implementation refinement round followed (see below).

### What shipped

**Engine:**
- `Team.control: 'human' | 'ai'` (required `TeamControl` field). The pure engine never reads it — it's battle-setup data the app consumes. All `Team` construction sites updated (production `demo.ts` → Blue human / Red ai; River Ridge inherits; ~10 test fixtures).
- **KO'd-unit pathing fix.** Canonical `isKO(unit)` exported from `engine/map/accessors.ts` (scheduler's private copy replaced). `canStep`/`canLeapTo` now treat KO'd occupants (any team) as passable for *traversal*; the post-Dijkstra settlement filter still rejects ending on them. `removed` units are free on both counts. (5 new pathfinding tests.)

**AI:**
- `src/ai/deployment.ts` — pure `planAiDeployment({ map, team, units })`: opposing-zone centroid → front-center tile → sort by descending maxHP (tie-break class id) → nearest-to-front assignment, facing opposing centroid. Returns `{ placements, unplaced }`. (8 tests.)
- `computeAiDeploymentResult` (app `deployment-config.ts`) bridges it into a `DeploymentResult`, reading maxHP from a fresh initial state; warns (console) on `unplaced`. (3 tests.)

**App / UI:**
- `BattleSetupScreen` now picks per-team control up front (Human/AI segmented toggles + a mode hint). **Deviation from brief D7** (which put the toggle in the builder): control must be known before building to branch deployment + handoffs — documented in ADR-0082. The builder shows control read-only.
- `App` runs the team builder once per team (A → B), then a manual deployment phase per *human* team in turn order; AI teams auto-deploy via the heuristic; both folded into the battle config before `BattleView`.
- `BattleView` builds the `ControllerMap` from each team's `control` (shared UI controller for human, fresh AI controller per AI team). `useTurnFlow`'s `uiTeam: TeamId` → `humanTeams: ReadonlySet<TeamId>`.
- Pass-and-play: minimal `HandoffScreen` between builders, between deployments, and mid-battle on human→different-human turn change — **gated behind `passAndPlayHandoff`, default OFF** (opt-in; see refinement round). Three active-team signals, each toggleable in pause→Settings (default on): (a) team-color banner below terrain bar, (b) team-color glow on the action menu, (c) fading "<Team>'s turn" alert.

### Post-implementation refinement round (same session, Chris's notes)

- **`SettingsProvider` lifted to the app root.** `App` now wraps `AppInner` in the provider (was battle-scoped in BattleView) so the pre-battle phases and the in-battle pause menu share one settings source. BattleView's own provider was removed.
- **Pass-and-play handoff defaults OFF.** New `passAndPlayHandoff` setting (default false), toggle in pause→Settings ("Handoff prompt"). All three handoff sites (builder/deployment in App, mid-battle in BattleView) gate on it. The active-team signals already convey turn ownership; the click-through prompt is opt-in.
- **Builder back-navigation.** Team B's builder steps back to Team A's builder (draft preserved) via "Back to Team A (Blue)", not to setup. `TeamBuilderScreen` gained a `backLabel` prop.
- **On-screen Pause/Play toggle** in BattleView (top-right). A `halted` state separate from the ESC modal (`paused`): it freezes the pump + animator with **no overlay**, leaving the HUD/log/details fully interactive for inspection (the only pause affordance in AI-vs-AI). Both `paused` and `halted` gate the pump.
- **Main Menu enabled in the pause overlay** with a "Leave battle / Keep playing" confirmation (`PauseOverlay` gained an `onMainMenu` prop + a `confirm-exit` view).

### Browser verification (what was / wasn't covered)

Verified in-browser, no real console errors (see watch-for below):
- **Human-vs-AI (classic):** full flow builder A (human) → builder B (AI, no handoff) → Blue manual deployment → battle. Human action menu activates on Blue's turn; "Blue's turn" banner + Blue menu glow render; Red AI deployed by heuristic. **No regression.**
- **AI-vs-AI:** both teams built + AI, heuristic deployment for both, battle runs (turns advance: Caedric cast Inner Warmth + moved, etc.); "Red's turn" banner shows; no human menu.
- Setup control toggles + mode hints; builder sequence + AI badges; A→B handoff correctly skipped when not both-human.
- Preview Pixi ticker is throttled when the tab isn't foregrounded — use `window.__taciturnDebug.pump(n)` to advance a battle, and `window.__taciturnDeployDebug` (selectTile/pickUnit/pickFacing) to drive deployment.

**NOT browser-verified:** full pass-and-play with two human teams deploying both sides via canvas (canvas clicks aren't scriptable; the builder→builder handoff and mid-battle handoff *logic* are unit-tested, and deployment is exercised via the deploy-debug surface). First manual pass-and-play playtest should confirm the mid-battle handoff feels right and the signaling combination is sufficient.

### Watch-fors (all logged in `docs/playtest-watch.md`)

- **AI-vs-AI balance / loop conditions** — new mode may surface AI stalls or non-terminating battles.
- **AI deployment positioning quality** — heuristic sorts by maxHP, not role; a tanky support lands forward. Lever is the sort key (→ role-aware).
- **Pass-and-play handoff ergonomics + which signal combo to keep** — Chris plans to playtest then disable redundant signals (all three on by default).
- **KO'd-unit traversal secondary interactions** — watch LoS / AoE / other occupancy-sensitive subsystems now that downed bodies are pathable.
- **Pre-existing border/borderColor React dev warnings** during battle — confirmed NOT from S43 (new signaling components use separate border props); a battle component mixes `border` shorthand with dynamic `borderColor`. Cosmetic; fix when located.

### Notes for next session

- **Schema change is live:** `Team.control` is required. Any new battle config / fixture must set it.
- The brief's v1 "AI must be template-loaded" constraint was **dropped entirely** (not built-then-relaxed) since the heuristic landed — AI teams get the full builder. (ADR-0082 §5.)
- **TS strict-mode pile** unchanged by S43 (verified: my new files add zero type errors; the ~279 remaining are the pre-existing carry).
- `assignAiTeamNames` (content/teams) is now unused by `App` (both teams are builder-named) but still exported + tested — left in place, not deleted.

### Carry-forward (longer-term, unchanged)

- Equipment expansion (Hi-Potion / Holy Water / Elixir + weapons/accessories) — S44 candidate.
- Second map design — S45 per roadmap.
- 5v5 unlock — later in roadmap.
- Charm/Seduction (team-override substrate, dedicated session).
- Knight base-PA recalibration (playtest-driven).
- Pyromancer R/S/M consolidation (future R/S/M review).
- Speed Save per-swing reaction cap (S42 D5 deviation).
- Renderer-side multi-swing animation polish (S42 carry).
- Permadeath badge first-playtest visual read (S41 carry).
- `content-id-registry.md` reconciliation (stale since pre-S39b).
- TS strict-mode pile (~279, S34 carry).
- ActionType-wiring smoke test (future CI; no new ActionTypes this session).
