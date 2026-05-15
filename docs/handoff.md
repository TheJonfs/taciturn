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

## From session 2026-05-14 (Session 35 — Phase E: deployment phase UI)

Deployment phase landed. **Tests: 1048 passing across 93 files, 0 failing** (up from 1007/90 — +41 tests, +6 files). No new ADR (the pipeline-integration audit confirmed the minimal-surface case the brief predicted — deployment is strictly upstream of `createInitialState`, no engine change).

### Scope completed

- **River Ridge → 4v4.** Blue gained a Fire Mage, Red a Water Mage (Chris's call). The two extra units live in `river-ridge-battle.ts` only; `demoBattle` stays 3v3 — it's the engine smoke-test fixture (`orchestrator.test.ts`, `ai-controller.integration.test.ts`) and was deliberately left untouched. Reusable loadout/stat/equipment constants are now exported from `demo.ts`.
- **Deployment state machine** — `src/ui/deployment-flow.ts`, pure reducer, sibling to `turn-flow.ts`. `idle → tile_selected → unit_selected → (commit) → idle`; cancel back-paths; lift-and-replace re-placement. Team-parameterized (`currentTeam`).
- **`useDeploymentFlow` hook** — wires renderer tile-click → events, drives the zone/facing layers and placed-unit sprites.
- **UI** — `deployment-roster-panel.tsx` (left-edge sidebar, doubles as the unit picker per decision 5/shape A), `deployment-facing-picker.tsx` (keyboard parallel + hint; the renderer owns the on-canvas arrows).
- **Renderer layers** — `deployment-zone-layer.ts` (zone tint, current team bright / opponent faint), `deployment-facing-layer.ts` (four interactive cardinal arrows). Both composed into `BattleRenderer`, which gained a deployment-sprite API (`setDeploymentUnit` / `removeDeploymentUnit`, bypassing the animator).
- **`DeploymentScreen`** — a separate App-shell screen (`'deployment'`), not a sub-mode of `BattleView`. Audit-driven: `BattleRenderer.destroy()` is lifecycle-coupled to `app.destroy()`, so "mode-within-BattleView" couldn't simply gate an already-mounted renderer — it would need a parallel Pixi-app lifecycle anyway. The separate screen gives a clean prop contract (`DeploymentResult` in, battle config out) and keeps `BattleView` untouched. **This was the brief's fallback; Chris approved the switch at plan-review.**
- **Pipeline** — `deployment-config.ts`: `buildDeployedBattleConfig(template, result)` folds the deployment's placements into the authored config (Blue replaced, Red authored retained). Flows into `createInitialState` → `enumeratePreBattleActions` unchanged. `BattleView` takes an optional `deploymentResult` prop; `App` threads it through.
- **Validation** — `validateMap` runs at `DeploymentScreen` mount; failure renders an inline error card with "Back to Setup" (rather than threading an error string up to `App` — functionally equivalent, self-contained).

### Limitations + watch-fors

- **`DeploymentScreen` has a DEV-only `__taciturnDeployDebug` surface** (mirrors `BattleView`'s `__taciturnDebug`). Synthetic Pixi pointer events don't reach the renderer's federated event system in a headless preview, so the canvas tile-click can't be driven there. The full loop *was* verified in-browser via that debug surface: place all 4 Blue units → Start Battle → pre-battle phase (`system_apply_status` ×3 + `system_set_ct` ×8 in the log, `[init]`-tagged) → turn 1 → AI turn. Blue units land at the exact deployed positions. Stripped from production builds.
- **`BattleRenderer` gained a `destroyed` guard on its deployment methods.** Found in browser verification: `useDeploymentFlow`'s effect cleanups call into the renderer (`clearDeploymentZone` etc.) in the *same* unmount pass as `DeploymentScreen`'s mount-effect cleanup that runs `destroy()` — and the ordering isn't controllable from the hook (the mount effect is declared before the hook, so its cleanup runs first). A destroyed-renderer call would hit `Graphics.clear()` on a null context and throw. The guard is scoped to the deployment methods only — *not* the blanket post-destroy guards S34 explicitly rejected.
- **Opponent (Red) sprites during deployment aren't portrait-flipped to face the player.** The deployment renderer mounts with an opponent-only state, so `mount()`'s "first unit's team is the player" heuristic treats Red as the player team → no flip. Purely cosmetic. If it bothers, pass `currentTeam` into `mount()` instead of inferring it.
- **Roster panel stats** show base PA/MA/Speed + effective HP/MP (the latter from `createInitialState`'s `fillVitalsFromComputedMaxes`). Not per-frame `runModifyStatQuery` values — fine for a roster glance, but if a future reader expects equipment-modified PA/MA there, it isn't shown.
- **`docs/roadmap.md` is stale past Session 20b** — the 21+ plan lives in `docs/twentyOnePlanning/roadmap-sessions-21-plus.md`, which is a forward-plan doc with no per-session completion markers. Nothing to update there; noting so the next session doesn't go hunting.
- **`tsc -b --noEmit` reports 201 errors** — all pre-existing `.test.ts` strict-mode errors (the long-standing S34 carry). Session 35's files (source + tests) add zero. `vitest` is fully green.

### Considered and rejected this session

- **Mode-within-`BattleView`** (the brief's primary plan) — see above; the `destroy()`↔`app.destroy()` coupling made it no simpler than a separate screen while bloating an HMR-delicate component. Switched to the separate-screen fallback with Chris's sign-off.
- **Expanding `demoBattle` to 4v4** — rejected to avoid perturbing `orchestrator.test.ts` / `ai-controller.integration.test.ts`, which run `demoBattle` on the 6×6 map. The two new units live on `riverRidgeBattle` only.
- **Blanket post-destroy guards on all `BattleRenderer` methods** — rejected (S34's stance). The `destroyed` flag guards only the deployment surface, which is uniquely exposed to the hook-cleanup ordering problem.

### Suggested scope for Session 36

Per the roadmap: **team builder UI** (`roadmap-sessions-21-plus.md` Session 36). Note the deferred wiring — the team builder's output (the assembled team) becomes the deployment phase's input, replacing `DeploymentScreen`'s current hardcoded `riverRidgeBattle` template + `team_a` currentTeam.

### Longer-term carry-forward (unchanged from S34 unless noted)

- **Pass-and-play toggle + dual deployment + battle-loop AI gating** — dedicated future session. The deployment surfaces are all team-parameterized (`currentTeam`), so adding it is the routing change the brief intended, not a refactor.
- **AI deployment logic** — Red uses authored placements; future tactics-layer pass.
- **Title screen layout eyeball at real window sizes** — S34 carry; quick visual check still pending.
- **Full battle → results → continuity-button loop manual playtest** — S34 carry; the deployment → battle → turn-1 stretch is now browser-verified, but a human-driven battle to the results screen still hasn't been run.
- **Pacing + cliff-thickness playtest read** — S33.5 carry, still unplaytested.
- **Charged-action tooltip browser verification** — S33.5 carry.
- **Burn × Purifier playtest** — exercisable via the Red Lightning Mage loadout.
- **Walk-on-Water passive** — future content.
- **River Ridge balance tuning** — playtest-informed; now 4v4, so prior 3v3 balance notes need re-reading.
- **Procced Lightning Strike action-log attribution / Rasp Pendant drain attribution** — S30 carries.
- **AI active absorption exploitation** — S27 carry. **AI projection forecast extension via `computeOutgoingHitChance`** — S30 carry.
- **`isWaterTile` predicate keys on elevation, not registry** — S33 carry; no v1 case.
- **`buildBattle` test-fixture extraction** — triggers at fourth duplication.
- **Procced spell uses caster's MA / Magus Crown calibration / Tintinibar Regen / Sorcerer's Robe Move +1** — ongoing playtest reads.
- **Suppress pre-battle init entries in release builds** — longer-term polish.
- **`map-and-battlefield.md` open questions** — elevation hit-chance/cover, AoE multi-layer, LoS tie-breaking.
- **`mapAllTerrainCosts` vs. `defaultStepCost`** — no v1 case.
- **Centralized `canApplyHeal` helper** — explicitly rejected (ADR-0074); revisit at a third heal-application site.
- **TS strict-mode test errors (~201)** — S34 carry; pre-existing on `main`.
- **Surrender flow / MVP-unit algorithm / permadeath timer / settings expansion / reactions in projection column** — Phase E/F.

---
