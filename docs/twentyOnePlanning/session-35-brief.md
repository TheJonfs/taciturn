# Session 35 Brief: Phase E — Deployment Phase UI

## Context

Phase E continues. Session 34 landed the title screen, battle setup, app-shell routing, and resolved the HMR/Pixi-init crash. Session 35 ships the **deployment phase UI** — the first concrete consumer of the per-map deployment zones authored in Session 33 (ADR-0049's `Tile.deploymentZone` field; River Ridge's Blue rows 0-2 cols 5-8 / Red rows 11-13 cols 5-8).

The deployment phase sits between battle setup and the battle proper: after clicking "Start River Ridge," the player enters deployment with their team's eligible tiles highlighted. They place units onto deployment tiles (tile-first → unit-picker → facing picker), iterating on placements as needed, then commit with a "Start Battle" affordance that locks the roster and transitions into the existing pre-battle phase (`runPreBattlePhase` per ADR-0071) and first turn.

**Vs-AI only this session.** Red team uses authored placements from `river-ridge-battle.ts`; AI deployment logic is punted. **Pass-and-play is deferred** to a future dedicated session, but the deployment design is team-parameterized this session so adding the future toggle is mechanical rather than a refactor.

End of session: launching River Ridge from battle setup opens deployment phase; player places five Blue units (Knight + four Mages) with chosen facings; "Start Battle" transitions cleanly through existing pre-battle phase into turn 1.

## Inputs (read first)

In recommended order:

1. **`CLAUDE.md`** — project conventions.
2. **`docs/handoff.md`** — Session 34 handoff. Particularly the HMR fix discipline (don't introduce class exports in Fast-Refreshable modules; load-once singletons go in `useRef` not `useMemo`).
3. **`docs/twentyOnePlanning/roadmap-sessions-21-plus.md`** — Session 35 entry; Sessions 36+ for context.
4. **`docs/decisions/0049-...`** — `Tile.deploymentZone` field (substrate this session consumes).
5. **`docs/decisions/0071-...`** — orchestrator pre-battle phase + `runPreBattlePhase`. This is the pipeline deployment hands off to.
6. **`src/engine/map/map-validator.ts`** — S33's per-team validation (`validateMap` with team requirements). The deployment phase invokes this to confirm the chosen team + map combination is valid before allowing commit.
7. **`src/content/battles/river-ridge-battle.ts`** — current authored placements for both teams; Blue's placement gets replaced by deployment output, Red's stays as authored fallback.
8. **`src/content/maps/river-ridge.ts`** — deployment-zone tile definitions.
9. **`src/app/BattleView.tsx`** — current mount surface; deployment mode lives here as a sub-mode if the audit confirms feasibility.
10. **`src/ui/turn-flow.ts`** — the existing player-interaction state machine. Deployment flow mirrors its shape (idle / selecting / confirming substates) with deployment semantics.

### Paths to survey before planning

Current-tree audit. Particularly:

- **Initial-state pipeline.** Trace the flow from "battle config selected" → `createInitialState` → `runPreBattlePhase` → first turn ready. Identify the seam where deployment output integrates: does deployment produce a complete battle config that flows into `createInitialState`, or does `createInitialState` run with empty unit placements that deployment populates? **Audit determines.** Default expectation: deployment produces a battle-config-equivalent record (units + positions + facings + team assignments) that flows into `createInitialState` unchanged from current behavior — the engine doesn't need to know deployment happened.

- **Battle config shape.** Confirm what `river-ridge-battle.ts` produces and what `createInitialState` consumes. Identify the minimal surface deployment needs to populate (per-unit position, facing, team).

- **BattleView lifecycle.** Per Chris's call: deployment-mode-within-BattleView is the primary plan. Audit confirms whether the existing mount path can host a "deployment mode" sub-state cleanly, or whether the lifecycle complications (catalog ref, renderer init, screen-state coupling) make a separate screen more tractable. Fallback is a dedicated `DeploymentScreen` that mounts its own renderer instance.

- **Existing renderer layers.** Identify how new visualization (deployment zone tint, placed-unit ghosts, facing arrows during pick) composes with existing layers. The zone tint reuses ADR-0049's `Tile.deploymentZone` field but is engine-blind (a static mount-time layer); facing arrows are dynamic (rendered only during facing-pick state).

- **Turn-flow state machine shape.** Confirm `turn-flow.ts`'s state structure and the deployment flow's parallel. Both are player-interaction state machines with similar patterns (current state, selection, confirmation, transition); the brief's intent is a sibling module, not an extension of turn-flow itself.

- **Map validator at deployment time.** S33's `validateMap` checks per-team zone capacity (does Blue's zone have enough tiles for Blue's roster?). Deployment phase invokes this at mount; failure routes back to battle setup with an error message.

### Architectural decisions

After the audit:

1. **Deployment-mode-within-BattleView vs separate screen.** Per Chris's call: mode-within-BattleView is the primary plan. Audit determines if a major lifecycle concern emerges; fallback to separate screen if so.
   - **Recommendation: mode-within-BattleView.** The renderer is already mounted, the map already rendered; adding a "deployment phase" gate to the existing flow is simpler than mounting a parallel Pixi instance. The screen-state lives in `App.tsx`'s router but the deployment-mode gate is inside `BattleView`.

2. **Deployment state machine — module shape.** New `src/ui/deployment-flow.ts`, sibling to `turn-flow.ts`. States:
   - `idle` — no tile selected; map shows deployment zone, placed units, available roster
   - `tile_selected` — eligible tile clicked; unit picker visible; previous selection (if any) can be cancelled
   - `unit_selected` — unit picked from roster; facing arrows now visible around the chosen tile
   - `placed` — facing confirmed; unit committed; return to `idle`
   - Cancelable transitions: tile_selected → idle (click elsewhere or Escape); unit_selected → tile_selected (back-arrow in picker)
   - Re-placement: clicking a placed unit transitions to `tile_selected` with that unit's current tile + the unit returned to the roster (lift-and-replace)

3. **Team parameterization for pass-and-play extensibility.** Deployment state takes a `currentTeam: TeamId` parameter rather than hardcoding to Blue.
   - Zone visualization tints the current team's deployment zone (the opponent's zone is visible but not interactive — see decision 7)
   - Roster panel shows current team's available units
   - Commit transitions either fall through to battle start (vs-AI, this session) or invoke deployment for the next team (future pass-and-play)
   - The "next team" routing logic isn't built this session but the parameterization makes adding it mechanical

4. **Sidebar roster panel.** Per Chris's "some detail for available units" — portraits + names + key stats. Recommendation:
   - Persistent sidebar (left or right edge — visual call at plan-review)
   - Each entry: portrait (small), name, class, key stats (HP / MP / PA / MA / Speed at level 25)
   - Placed units shown as dimmed / checked; click a placed entry to highlight where it's placed on the map (or to lift it via the re-placement flow)
   - When in `unit_selected` state, the picker is also the roster panel — clicking a roster entry IS the unit pick (no separate picker modal)

5. **Unit picker mechanism.** Two reasonable shapes:
   - **A — Roster panel doubles as picker.** When in `tile_selected` state, roster entries become clickable to commit a unit to the selected tile. No separate modal. Roster always visible.
   - **B — Modal popup on tile click.** Separate component appears near the clicked tile showing available units. Roster panel is informational only.
   
   **Recommendation: A.** Fewer components; roster's existing visibility carries weight; no positioning logic for popups; the picker affordance is already visible (player knows the roster panel is the source of units before they click anywhere). **Settle at plan-review.**

6. **Facing picker mechanism.** FFT-classic: four cardinal arrows appear around the placed unit's tile; clicking an arrow commits the facing. Keyboard parallel (arrow keys + Enter). Visual: arrows are renderer-drawn (new layer), not DOM elements, to align with the tile grid.

7. **Enemy team visibility during deployment.** Per my recommendation: enemy team's authored placements visible on the map, not interactive. Player can plan around opponent positioning. If you'd rather have fog-of-war, single flag at plan-review flips it. **Recommendation: visible.**

8. **Re-placement semantics.** Clicking a placed unit lifts it back to the roster and routes to `tile_selected` state with that unit's prior tile pre-selected (so the player can just re-place in the same spot with different facing, if that's the intent). Alternative: lift returns to `idle` with the unit available again. **Recommendation: lift-and-pre-select** — fewer clicks for the common "wait, I wanted them facing east" iteration.

9. **"Start Battle" affordance.** Activates only when all team units are placed. Visible state: button greyed until placement is complete, then active. Confirmation: single click; no confirm-dialog (re-placement is available; nothing's destructive). Optional escape: a "Back to Setup" button is always visible during deployment.

10. **Pipeline integration — deployment commit to battle start.** Per the audit, the cleanest flow is:
    - Deployment phase produces a `DeploymentResult` (units with positions, facings, team assignments)
    - The existing battle-config construction is parameterized to accept deployment-derived placements (replacing the authored Blue placements) while keeping authored Red placements
    - The resulting battle config flows into `createInitialState` unchanged
    - `runPreBattlePhase` runs as today (equipment auto-statuses, CT randomization)
    - Turn 1 begins
    
    **Audit confirms.** Default expectation: minimal engine surface changes; deployment is upstream of `createInitialState`.

11. **Visualization layers.**
    - **Deployment zone tint** — engine-blind, static at mount; new `DeploymentZoneLayer` in `src/renderer/`. Tints current team's deployment zone tiles distinctly from opponent's (e.g., Blue team's zone tinted blue; Red's tinted faintly red but non-interactive).
    - **Facing arrows during pick** — dynamic; new `DeploymentFacingLayer`. Renders only when in `unit_selected` state; cleared on transition out.
    - Existing layers (unit-layer, terrain, cliff-edge, elevation labels, etc.) compose unchanged.

12. **Validation.** S33's `validateMap` runs at deployment mount to confirm zone capacity. Failure routes back to battle setup with an error message ("This map's deployment zones don't support the current team size" or similar). Probably won't fire in v1 (River Ridge's zones are 12 tiles each, comfortably > 5 units), but the check is structural.

13. **Test strategy.**
    - **Deployment state machine:** unit tests for the state transitions (idle → tile_selected → unit_selected → placed; re-placement; cancel paths)
    - **Roster panel:** smoke test (renders; placed units dimmed; click commits)
    - **Tile-click handler:** integration test that an eligible tile click in deployment mode routes to the deployment flow (not the existing battle-mode click handler)
    - **Pipeline integration:** integration test that a complete deployment + Start Battle produces a valid initial state that proceeds to turn 1
    - **Validation:** test that a team-too-large-for-zone is caught and routes back to setup
    - **Renderer layers:** smoke tests per existing layer-test pattern

14. **Order of work.**
    - Audit (pipeline integration shape; BattleView lifecycle viability for deployment-mode)
    - Deployment state machine (`deployment-flow.ts`)
    - Roster panel + tile-click routing
    - Zone tint layer
    - Facing picker (interaction + render layer)
    - Pipeline integration (deployment → battle config → initial state)
    - "Start Battle" affordance + validation
    - End-to-end loop verification

15. **35a/35b split allowance.** The deployment phase has substantial UI surface (state machine + roster + picker + facing + zone tint + facing arrows + pipeline integration + validation). If audit reveals pipeline integration is more invasive than expected (e.g., the engine's initial-state construction is tightly coupled to authored placements), the split:
    - **35a:** Deployment UI + state machine + visualization (mounted in a static scenario that doesn't commit; verifies the interaction loop)
    - **35b:** Pipeline integration (deployment commit → battle proper) + validation + end-to-end
    
    Likely no split if the pipeline integration is the minimal-surface case (deployment produces battle config, engine unchanged). Audit determines.

The plaintext plan is reviewed before code lands.

## Implementation work

Following plan approval, items land in audit-then-build order: pipeline integration shape settled before UI shape commits.

### Item 1: Deployment state machine

- New `src/ui/deployment-flow.ts` (sibling to `turn-flow.ts`)
- States per decision 2; transitions per the same
- Team-parameterized (`currentTeam: TeamId`) per decision 3
- Pure-function transitions; no React state inside; consumed by a hook in `BattleView`
- Tests: state transitions, re-placement, cancel paths

### Item 2: Roster panel

- New `src/ui/deployment-roster-panel.tsx`
- Sidebar component; persistent during deployment
- Per-entry display per decision 4 (portrait, name, class, key stats)
- Visual states per placement status (available / placed / currently-selected)
- Roster doubles as unit picker per decision 5: in `tile_selected` state, clicking a roster entry commits the unit
- Tests: renders; states transition correctly; click delegates to deployment flow

### Item 3: Tile-click routing

- `BattleView`'s tile-click handler gates by mode (deployment vs battle)
- In deployment mode, eligible-tile clicks route to `deployment-flow.ts`; non-eligible clicks are ignored
- In battle mode, existing turn-flow handler runs unchanged
- Tests: deployment-mode click on eligible tile transitions state; non-eligible click no-ops

### Item 4: Deployment zone tint layer

- New `src/renderer/deployment-zone-layer.ts`
- Static at mount in deployment mode; cleared on transition to battle
- Tints current team's zone distinctly from opponent's per decision 11
- Tests: snapshot of expected tinting given a sample map + team

### Item 5: Facing picker

- New `src/ui/deployment-facing-picker.tsx` for interaction (keyboard parallel)
- New `src/renderer/deployment-facing-layer.ts` for the cardinal-arrow visual
- Renders only when in `unit_selected` state; cleared on transition
- Click an arrow or press an arrow key commits the facing; Enter confirms
- Tests: interaction commits correct facing; visual layer renders four arrows around the selected tile

### Item 6: Re-placement

- Clicking an already-placed unit transitions to `tile_selected` with that unit's tile pre-selected and the unit returned to the roster per decision 8
- Same flow re-runs for re-placement
- Tests: re-placement preserves all other placements; placed unit returns to roster

### Item 7: Pipeline integration

- Audit-confirmed shape (default: deployment produces battle config that flows into existing `createInitialState`)
- Deployment commit produces a `DeploymentResult` consumed by the battle-config construction
- Authored Red placements retained from `river-ridge-battle.ts`; Blue placements replaced by deployment output
- Existing `runPreBattlePhase` runs unchanged
- Tests: integration test that complete deployment + Start Battle reaches turn 1 with correct placements

### Item 8: "Start Battle" affordance + validation

- Button visible during deployment; greyed until all units placed
- "Back to Setup" affordance always visible
- `validateMap` runs at deployment mount; failure routes back to setup with error
- Tests: button activates at right time; back routes correctly; validation failure handled

### Item 9: End-to-end verification

- Manual playtest of the full loop: battle setup → deployment → place all 5 Blue units → Start Battle → first turn renders correctly
- Verifies pipeline integration, renderer cleanup, screen transitions, no Pixi state leaks
- Includes verification that the existing pre-battle entries (Tintinibar Regen, CT randomization) still appear correctly with deployment-supplied placements

## Acceptance criteria

**Deployment phase:**
- Selecting "Start River Ridge" from battle setup opens deployment phase (mode-within-BattleView per decision 1, or separate screen per audit fallback)
- Blue team's deployment zone (rows 0-2 cols 5-8) is visually distinct and interactive
- Red team's deployment zone (rows 11-13 cols 5-8) is visible but not interactive; Red's authored placements are visible on the map
- Roster panel shows all five Blue units (Knight + four Mages) with portrait, name, class, and key stats

**Interaction flow:**
- Click an eligible Blue zone tile → tile is highlighted; roster panel becomes pickable
- Click a roster entry → unit appears on the tile; facing arrows appear around it
- Click a facing arrow (or use arrow keys) → unit is placed with that facing; flow returns to idle
- Click an already-placed unit → unit returns to roster; flow returns to tile_selected with the tile pre-selected
- Escape key (or click outside zone) → cancel current selection
- "Back to Setup" returns to battle setup screen

**Commit and pipeline:**
- "Start Battle" button activates when all 5 Blue units are placed
- Clicking "Start Battle" transitions through the existing pre-battle phase (pre-battle init entries in action log) into turn 1
- Red team's authored placements are unchanged
- All existing battle behavior (CT spool-up, equipment auto-statuses, AI turns, etc.) works as before

**Team parameterization:**
- Deployment state takes a `currentTeam` parameter
- Roster, zone tint, validation, commit logic all key off `currentTeam`
- The future pass-and-play extension is mechanical: add a "next team" routing after commit

**Quality:**
- Tests at 1007+, 0 failing.
- No new ADR expected unless audit surfaces a pipeline architecture decision worth codifying.
- `docs/handoff.md` updated.

## Out of scope

- **AI deployment logic** — Red uses authored placements; AI deployment is a future content/tactics-layer pass.
- **Pass-and-play mode + toggle** — dedicated future session.
- **Team builder** — Sessions 36+.
- **Map selection** — Sessions 36+.
- **Settings expansion** (where the pass-and-play toggle would naturally live) — Phase E later.
- **Sample team templates** — Sessions 36+.
- **Multi-machine multiplayer** — long-term.
- **Deployment animations / polish beyond functional UI** — future polish.
- **Surrender flow** — ADR-0041; Phase E/F.
- **Charged-action tooltip browser verification** — S33.5 carry.
- **Pacing + cliff-thickness playtest read** — S33.5 carry, still unplaytested.
- **River Ridge balance tuning** — playtest-informed.
- **AI active absorption exploitation** — S27 carry.
- **AI projection forecast extension** — S30 carry.
- **Burn × Purifier playtest observation** — S33.5 setup ready; needs playtest.
- **Procced Lightning Strike / Rasp Pendant action-log attribution** — S30 carries.
- **TS strict-mode test errors** — S34 carry; pre-existing on main.
- **`map-and-battlefield.md` open questions** — Phase E doesn't surface these.

## Files likely touched

Non-exhaustive. Audit confirms / corrects.

**New UI:**
- `src/ui/deployment-flow.ts` (state machine, pure functions)
- `src/ui/use-deployment-flow.ts` (React hook consuming the state machine)
- `src/ui/deployment-roster-panel.tsx` (sidebar component)
- `src/ui/deployment-facing-picker.tsx` (facing-pick interaction)

**New renderer layers:**
- `src/renderer/deployment-zone-layer.ts` (zone tint)
- `src/renderer/deployment-facing-layer.ts` (cardinal arrows)

**BattleView integration:**
- `src/app/BattleView.tsx` — mode gating; deployment hook; layer composition
- `src/ui/turn-flow.ts` — unchanged; deployment is a parallel flow, not an extension
- `src/app/App.tsx` — possibly minor adjustments to the battle screen-state transition flow

**Engine:**
- `src/engine/state/initialization.ts` (or wherever `createInitialState` lives) — likely unchanged; audit confirms
- `src/content/battles/river-ridge-battle.ts` — Blue placements removed or made optional; Red placements retained

**Tests:**
- `src/ui/deployment-flow.test.ts` (state machine)
- `src/ui/deployment-roster-panel.test.tsx` (component)
- `src/renderer/deployment-zone-layer.test.ts` (snapshot)
- `src/renderer/deployment-facing-layer.test.ts` (snapshot)
- `src/app/deployment-integration.test.tsx` (end-to-end loop, if testable without live Pixi)

**ADRs:**
- Possibly one if the pipeline-integration audit surfaces an architecture decision worth codifying (e.g., deployment-time battle config construction as a typed protocol). Plan-review determines.

**Documentation:**
- `docs/handoff.md` — session handoff
- Possibly `docs/twentyOneDesign/...` — deployment phase design doc (small) if the architecture warrants

## Workflow notes

- **Plaintext-first review required.**
- **Audit-first.** Pipeline integration shape must settle before the UI commits to its commit-time contract.
- **Diagnostic-first on the BattleView lifecycle.** Confirm deployment-mode-within-BattleView is feasible; fallback to separate screen if it isn't. Don't pre-commit to the primary plan without audit support.
- **ADR path is `docs/decisions/`.**
- **Team parameterization is a design discipline, not a feature.** Even though this session ships Blue-only deployment, every component takes `currentTeam` as a parameter. The future pass-and-play session should not require rewriting these surfaces.
- **HMR / Fast Refresh conventions from S34 apply.** No class exports in Fast-Refreshable component modules; load-once singletons in `useRef` not `useMemo`; cleanup functions capture references before destroy.
- **Mid-session design questions** route through Chris to the planner. Most likely surfaces: roster-panel sidebar placement (left/right edge); unit-picker shape if A→B switch needed (decision 5); pipeline-integration depth if the audit reveals more coupling than expected; renderer-layer composition order.
- **Phase E continues.** Phase E foundation (title + setup + routing) holds; this session extends.

## Watch-fors

**Addressed this session:**
- Deployment phase UI (Phase E continuation)
- Team-parameterization substrate for future pass-and-play
- Pipeline integration from deployment to existing pre-battle phase
- Map validator at deployment time (S33 carry consumed)
- Renderer layers for deployment-specific visualization

**Not addressed this session, longer-term carry-forward:**

- **Pass-and-play toggle + dual deployment + battle-loop AI gating** — dedicated future session
- **AI deployment logic** — future tactics-layer pass
- **Team builder** — Sessions 36+
- **Map selection** — Sessions 36+
- **Settings expansion** — Phase E later (natural home for pass-and-play toggle)
- **Title screen layout eyeball at real window sizes** — S34 carry; quick visual check
- **Full battle → results → continuity-button loop manual playtest** — S34 carry; needs human-driven battle to surface
- **Pacing + cliff-thickness playtest read** — S33.5 carry, two sessions of carry; single-file constant tweaks once playtested
- **Charged-action tooltip browser verification** — S33.5 carry
- **Burn × Purifier playtest observation** — S33.5 setup ready
- **Walk-on-Water passive** — future content
- **River Ridge balance tuning** — playtest-informed
- **Procced Lightning Strike action-log attribution / Rasp Pendant drain attribution** — S30 carries
- **AI active absorption exploitation** — S27 carry
- **AI projection forecast extension via `computeOutgoingHitChance`** — S30 carry
- **Procced spell uses caster's MA / Magus Crown calibration / Tintinibar Regen / Sorcerer's Robe Move +1** — ongoing playtest reads
- **Suppress pre-battle init entries in release builds** — longer-term polish
- **`map-and-battlefield.md` open questions** — elevation hit-chance/cover, AoE multi-layer, LoS tie-breaking, etc.
- **`mapAllTerrainCosts` vs `defaultStepCost`** — no v1 case
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
- **TS strict-mode test errors** — S34 carry (~200 pre-existing on main)
- **Surrender flow** — ADR-0041; Phase E/F
- **MVP-unit smarter algorithm** — S24 Wave 1
- **Permadeath timer** — S24 Wave 1
- **Reactions in projection column** — S24 Wave 1
- **Forecast accuracy row visibility** — S30 reject
- **Hit-chance and cover modifiers from elevation differential** — `map-and-battlefield.md` open question
- **`fillVitalsFromComputedMaxes` ordering invariant** — S32 carry; holds for v1
- **Bedrock Stride ongoing playtest read** — integration-tested S33; real playtest still pending
- **`BattleView.test.tsx` benign canvas-context stderr** — S33.5A carry; jsdom canvas stub in setupFiles if more `.test.tsx` files added under `src/app/` — S35 may add more given the deployment UI surface area
- **HMR / Fast Refresh class-export rule** — S34 convention; code comments in place

## Estimated size

**Medium-large.** Substantial UI surface (state machine + roster panel + tile-click routing + zone tint layer + facing picker + facing render layer + pipeline integration + validation + Start Battle affordance). Each component is small individually; aggregate is meaningful.

**35a/35b split allowance** reserved if pipeline integration is more invasive than expected:
- **35a:** Deployment UI + state machine + visualization (in a static scenario)
- **35b:** Pipeline integration + validation + end-to-end

Likely no split if the pipeline integration is minimal-surface (deployment produces battle config; engine unchanged). Audit determines.

**End of session: deployment phase functional on River Ridge.** Sessions 36+ extend Phase E (team builder, map selection); pass-and-play gets its own dedicated session when ready.
