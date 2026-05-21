## ADR-0082: Unified team architecture — per-team control flag, sequential builder, heuristic AI deployment

**Status:** Accepted
**Date:** 2026-05-21
**Session:** 43

## Context

Three previously-distinct features were all approximations of the same missing abstraction: an AI team picker (Chris's original ask), a pass-and-play toggle (long-deferred carry), and AI-vs-AI (a new balance-testing capability). Each implied "let either team be driven by either a human or the AI."

A current-tree audit found the **engine was already team-agnostic**:

- `BattleConfig.teams` is a `Team[]` keyed by opaque `TeamId`; nothing marked one team as "the player."
- `DemoOrchestrator` already dispatches turns through a `ControllerMap = Map<TeamId, Controller>` — there was no `if (Blue) human else AI` conditional anywhere; the app just decided which controller sat in each slot.
- The deployment flow (`DeploymentState.currentTeam`) and `buildTeamBattleConfig(template, builtTeam, teamId)` were already team-parameterized.

All the "Team A is the player" hardcoding lived at three UI seams: `App.tsx` always folded the built team into `teams[0]`; `BattleView` built the controller map as `team[0]=UI, team[1]=AI` and set `uiTeam = teams[0]`; `DeploymentScreen` always deployed `teams[0]`. The work was therefore **additive, not a refactor** — which made the stretch goal (heuristic AI deployment) feasible in the same session, so it landed too.

## Decision

### 1. Per-team control flag

`Team` gains a required `control: 'human' | 'ai'` field (`TeamControl`). Chosen because it colocates with the team's other data and reads naturally (`config.teams[i].control`). The **pure engine never reads it** — it's battle-setup data the *app* consumes when wiring controllers and signaling. Made required (not optional-with-default) to fail loud rather than carry a shim; all `Team` construction sites (production `demo.ts`, test fixtures) were updated. Authored default: Team A `human`, Team B `ai` (backward-compatible single-player).

### 2. Battle-loop dispatch reads the flag

`BattleView` builds the `ControllerMap` by mapping each team to the shared UI controller (`human`) or a fresh AI controller (`ai`). Two human teams share one UI controller — only one unit acts at a time, even in pass-and-play. This single wiring yields all three modes with no handler changes.

### 3. Turn-flow keyed on a set of human teams

`useTurnFlow`'s `uiTeam: TeamId` became `humanTeams: ReadonlySet<TeamId>`; `isOurTurn` is now `humanTeams.has(activeUnit.team)`. Consecutive human turns (different teams, in pass-and-play) rebuild the menu via the existing `animationEnded → action-menu` path — every committed action passes through animation — so no extra reset machinery was needed.

### 4. Control chosen on the setup screen, not in the builder

The S43 brief's D7 first-guess put the Human/AI toggle inside the team builder. **Deviation:** it lives on `BattleSetupScreen` instead. Reason: the flow must know each team's control *before* building to branch deployment (which teams need a manual phase) and handoffs correctly — a toggle inside builder B can't inform the A→B handoff decision. The builder displays control read-only.

### 5. AI teams: full builder + always heuristic deploy (constraint dropped)

The brief framed v1 as "AI teams must be template-loaded," with the stretch *relaxing* it. Since the stretch landed, we **dropped the constraint outright** rather than build-then-relax it (Chris's call): AI teams get the same full builder as human teams, and **every** AI team auto-deploys via the heuristic. This removes the template-vs-custom branching entirely.

### 6. AI deployment heuristic (`src/ai/deployment.ts`, pure)

For an AI team: compute the opposing zone's centroid, find the own-zone tile nearest it ("front center"), sort units by descending `maxHP` (tie-broken by class id, deterministic), and assign each the nearest remaining own-zone tile to the front center, facing the opposing centroid. Returns `{ placements, unplaced }`; `unplaced` (zone smaller than team) is surfaced as a console warning by the **caller** (`computeAiDeploymentResult`) so the heuristic stays side-effect-free. It is "correct most of the time but not smart" — role-aware placement is a noted future refinement.

### 7. Pass-and-play UX

A minimal `HandoffScreen` (title + body + one button, accented in the incoming team's color) can interpose between two different human controllers' phases: between team builders, between deployments, and mid-battle when the active team changes to a different human team. No secret-mode — Taciturn has no hidden information. Gated behind the `passAndPlayHandoff` setting, which **defaults off** (post-implementation playtest call): the active-team signals already make turn ownership clear without a click-through interruption, so the full-screen prompt is opt-in for groups who want the explicit "device changes hands" beat.

All three active-team signals ship, each independently toggleable in settings (default on): (a) a persistent team-color banner below the terrain bar, (b) a team-color glow on the active-unit action menu, (c) a fading "<Team>'s turn" alert on each turn change.

The session-scoped `SettingsProvider` was lifted to the app root (`App` wraps `AppInner`) so the pre-battle phases read the same flags the in-battle pause menu writes — one source of truth for `passAndPlayHandoff` and the signal toggles.

### 8. Battle controls follow-ups

- **Builder back-navigation:** Team B's builder steps back to Team A's builder (draft preserved), not all the way to setup.
- **On-screen Pause button:** discoverable without the ESC shortcut, and the only pause affordance during AI-vs-AI (no action menu). Halts the existing pump.
- **Main Menu from pause:** enabled with a "Leave battle / Keep playing" confirmation so a single stray click can't abandon the battle.

## Consequences

- **Three modes from one architecture:** human-vs-AI (default), pass-and-play (both human), AI-vs-AI (both AI — new; balance testing without a human).
- **Schema change:** `Team.control` is required. Persisted battle configs / replays / fixtures must carry it. All in-repo sites updated; there is no migration path for external persisted configs (none exist in v1).
- **D7 deviation** (control on setup screen, not builder) documented above.
- **Behavior unchanged for the classic flow:** Team A human + Team B AI defaults reproduce prior single-player exactly (browser-verified).
- AI-vs-AI is expected to surface balance/AI-loop edge cases human-vs-AI didn't; the heuristic may produce occasionally-odd placements (e.g. a support class near the front). Both flagged in `playtest-watch.md`.
