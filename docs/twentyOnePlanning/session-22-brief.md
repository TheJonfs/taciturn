# Session 22 Brief: Battle UI — Visualization Layer

## Context

This session opens the Phase A Battle UI work. Session 21 closed out post-reconciliation stabilization (test suite at 559/0; ADR-0034 for the crit clamp; ADR-0035 for controller pre-flight). The engine substrate is stable, content baselines match the spec, and the audit's Items 19-20 confirmed no engine gaps block UI work.

The MVP is now three sessions away. Session 22 establishes the visualization layer: React + PixiJS scaffolding, map and unit renderers, and camera controls. The user can watch a battle play out via the existing `DemoOrchestrator` in headless mode but cannot intervene. Session 23 layers on interaction; Session 24 adds forecast / projection / settings polish.

This is the first session in this arc with substantial architectural design surface. The plaintext-first review pattern from CLAUDE.md is invoked explicitly — see the "Pre-implementation plan" section below. Architecture choices made here propagate through Sessions 23-24.

## Inputs (read first)

In recommended order:

1. **`CLAUDE.md`** — project conventions, especially: ground rule that the engine knows nothing about rendering; module boundary discipline; ADR practice for design-affecting work.
2. **`docs/handoff.md`** — Session 21 handoff. Note the watch-for re: `canCommitAction` promotion; not relevant this session, but Session 23 will hit that trigger.
3. **`docs/twentyOnePlanning/roadmap-sessions-21-plus.md`** — Session 22 entry; the immediately following Sessions 23-24 entries for context on what's deferred.
4. **`docs/twentyOneDesign/battle-ui-architecture.md`** — primary design doc. Read closely. Treat as authoritative for architecture choices unless a deliberate deviation is proposed and justified in the plaintext plan.
5. **`docs/audits/post-20-engine-audit.md`** — Items 19 and 20 (UI prerequisites — forecast contract, action log shape). Both confirmed sufficient for the UI's needs; no engine gaps. Section E for general context.
6. **`docs/twentyOnePlanning/mage-war-content-spec.md`** — relevant for understanding what unit data the renderer will display (HP, MP, Brave/Faith ranges, status types).

## Goal

A browser-loadable battle scene that:

- Renders the Training Field map and the demo's units in their starting positions
- Allows camera pan and zoom
- Subscribes to engine state changes and re-renders as the headless `DemoOrchestrator` plays the battle
- Updates HP/MP bars and status badges as actions resolve

End state: someone opens the dev server, sees the battle render, watches it play out, can pan/zoom while it plays. No interaction yet — Session 23 territory.

## Pre-implementation plan (required)

Before writing any code, produce a plaintext plan covering the architectural decisions below. Discuss with Chris and confirm before implementation. This is the standing CLAUDE.md plaintext-first review pattern, invoked explicitly because the choices here propagate forward.

### Decisions to make in the plan

1. **React + PixiJS integration pattern.** The architecture doc may prescribe; if not, choose between (a) a community React-Pixi binding library, (b) vanilla PixiJS managed via React refs and a lifecycle hook, (c) a custom adapter. State the choice, justify it, and note implications (bundle size, declarative-vs-imperative authoring, community support, future maintenance burden).

2. **State subscription pattern.** How does the UI read engine state? Options: (a) UI polls / re-reads on every tick from the orchestrator; (b) UI subscribes to state-change events from the orchestrator; (c) UI reads the action log and updates incrementally per new action. Whichever path: the UI must not mutate engine state, and the engine must not import from `src/ui/` (CLAUDE.md ground rule).

3. **Module structure under `src/ui/`.** Top-level component hierarchy. Where does Pixi vs. React responsibility split? A typical separation: React owns layout, side panels, settings UI, the canvas wrapper element; PixiJS owns everything inside the canvas (map, units, animations). State this boundary explicitly.

4. **Map renderer data flow.** The renderer should be terrain-data-driven, not Training-Field-specific. State how it consumes a `Map` definition (tile types, elevation, dimensions) and produces visuals. River Ridge ships in Session 33 against the same renderer; design accordingly.

5. **Unit renderer data flow.** Same principle — class-keyed sprite lookup, position from grid coordinates, HP/MP/status data from the unit's current state. State how the renderer handles per-unit updates as state changes.

6. **Camera state management.** Pan offset, zoom level, target tile (for recentre). Where does this state live (React state? a Pixi-side controller? a separate camera module)? How are inputs (drag, wheel, keys) wired?

7. **Placeholder visuals.** Real art doesn't exist yet. State what the placeholders look like (solid colored rectangles per terrain type? simple icons per unit class? text labels?). Aim for "readable in dev, not committed art." The point is to get the rendering pipeline working; art polish is later.

8. **Test strategy.** UI components are harder to unit-test than engine code. State which pieces are pure logic and get unit tests (camera math, sprite positioning, data-to-visual transforms) and which are visual / behavioral and rely on manual verification. Snapshot tests for React component structure where useful. **Don't aim for the same coverage discipline as the engine.**

9. **Any deviation from battle-ui-architecture.md.** If the design doc says X and you propose Y, justify why.

The plaintext plan is reviewed before code lands. If something obvious in the doc isn't worth re-deriving, say "following the design doc's [section]" and skip; this isn't a busywork exercise.

## Implementation work

Following plaintext plan approval, the items below land in roughly this order. Items 6 and 7 are content / wiring rather than UI per se but are needed for the UI to have something to render.

### Item 1: React + PixiJS scaffolding

- New `src/ui/` directory with the component hierarchy decided in the plan.
- Pixi stage initialization with proper lifecycle (mount, resize, unmount).
- Top-level layout: canvas region plus side-panel slots (the slots stay empty for Session 22; populated in Session 24).
- Hot-reload dev server entry point. Browser-runnable.
- Bundle dependencies in `package.json` (React, Pixi, whatever integration library if used).

### Item 2: Map renderer

- Tile rendering by terrain type, data-driven from a `Map` definition.
- Elevation visualization. Approach is a plan-time decision (color-shade by elevation? small height offset? both?). Training Field is uniform elev 2, so elevation differentiation isn't tested visibly until River Ridge — but the path needs to be ready.
- Grid lines, tile borders, or whatever helps readability.
- Renders the full 14×14 Training Field cleanly at default zoom.

### Item 3: Unit renderer

- Per-class sprite lookup (5 classes: Knight, Earth Mage, Water Mage, Fire Mage, Lightning Mage). Placeholders fine.
- Position by tile coordinates; recompute on state change.
- Facing indicator (an arrow, a beveled edge, whatever — needs to update when the unit's facing changes).
- HP bar (decrements when damage taken).
- MP bar (decrements when MP spent).
- Status badges: small visual indicators for active statuses on the unit. Stack count visible where relevant (Burn especially). Placeholders fine — final iconography can come later.

### Item 4: Camera

- Pan via drag (mouse/touch) and arrow keys.
- Zoom via wheel and pinch.
- Recentre on a target tile (used internally for now; UI button comes later).
- Reasonable bounds — don't let the camera pan to infinity off-map.

### Item 5: Settings panel scaffold

- Empty layout component placed in the side-panel slot.
- Populated in Session 24 with animation speed, log verbosity, etc.
- This session: just the slot and an empty container. Don't build out controls.

### Item 6: Training Field map authoring

- New `src/content/maps/training-field.ts` (or wherever maps live in the current tree).
- 14×14 grid. Uniform terrain at elevation 2 — implicitly respects the water table rule (no water tiles below elev 2; no land tiles below elev 2 either, since the floor is 2). All tiles cost 1 to enter; all standard `canEnter` for any class.
- No deployment zones (Cluster 2's `deploymentZone` field hasn't shipped). Hard-coded starting positions encoded in the demo battle config consume this map.
- Spec details: 14×14, elev 2 everywhere, uniform terrain. Unit positions hard-coded in `demo.ts` (or a new `src/content/battles/training-field-demo.ts` if that's cleaner).

### Item 7: Headless orchestrator integration

- The UI loads a `BattleConfig` via `loadDemoBattle()` (or similar — name the function, keep the interface stable; team builder will replace this loader in Session 36-37 but the contract stays).
- The existing `DemoOrchestrator` runs the battle in headless mode. The UI subscribes to state updates per the chosen subscription pattern.
- No interaction this session: the orchestrator drives the battle to completion; the UI watches.
- HP/MP bars and status badges update as actions resolve. The visual fidelity is "the right values reach the screen," not "with smooth animations" — animation polish is Session 23/24.

## Acceptance criteria

- `npm run dev` (or equivalent) opens a browser tab; battle renders.
- Training Field visible 14×14 with units in their starting positions.
- Camera pans and zooms with mouse/touch and keyboard.
- Battle plays itself; HP/MP bars decrement; status badges appear/disappear as effects apply.
- All existing engine tests still pass; no engine regressions.
- New UI logic has unit-test coverage where the test strategy from the plaintext plan called for it.
- ADRs written for at least the three big architecture decisions (React-Pixi integration pattern; state subscription pattern; module boundary between React and Pixi). Other ADRs at implementer's discretion if a decision merits durable record.
- `handoff.md` updated.

## Out of scope

- **All interaction.** No action menu, no targeting, no commit handling. User can pan/zoom but cannot drive any unit's turn. Both teams resolve via headless orchestrator.
- **Forecast / projection column** (Session 24).
- **Animations.** State changes can render as immediate updates ("HP was 50, now 42"). Tweens, particle effects, hit reactions, KO animations all wait until Session 23 minimum.
- **Action log panel.** A streaming log display lands in Session 23 / 24. The action log itself is already structured (audit Item 20); rendering it is later work.
- **Settings panel contents** (Session 24).
- **Results / post-battle screen** (Session 24).
- **Real art assets.** Placeholders are fine. Sprite polish is post-MVP.
- **Sound.** Out of scope entirely for now.
- **Replay scrubbing** (Phase F).
- **The deployment phase, team builder, title screen, battle setup screen** — all later.

## Files likely touched

- New `src/ui/` directory with multiple files (exact structure decided in plaintext plan).
- New `src/content/maps/training-field.ts` (or wherever maps live in current tree).
- Possibly new battle config file or update to existing `src/content/battles/demo.ts`.
- `package.json` and `package-lock.json` for new dependencies.
- New ADRs in `docs/adr/`:
  - `ADR-XXXX-react-pixi-integration.md`
  - `ADR-XXXX-ui-state-subscription.md`
  - `ADR-XXXX-ui-module-boundary.md` (or fold the boundary into one of the above if cleaner)
- `docs/handoff.md` updated.

## Workflow notes

- **Plaintext-first review is required** for the architectural decisions enumerated above. Don't write code until the plan is reviewed.
- This is a medium-to-large session. If the plan reveals scope larger than one session can absorb cleanly, propose a split (e.g., 22a = scaffolding + map renderer + camera; 22b = unit renderer + settings scaffold + headless integration) and confirm before proceeding.
- If a mid-session design question surfaces — particularly around React-Pixi interaction edge cases — pause and write to `handoff.md` per the workflow rule. Architecture choices that propagate forward are the highest-priority pause-and-confirm category.
- New dependencies (React-Pixi binding, etc.) are deliberate additions; prefer minimum-dependency choices where the cost-benefit is close.

## Watch-fors carried forward from Session 21

These are noted in handoff.md and may surface during Session 22 work:

- **`canCommitAction` promotion trigger.** Session 23 (when the UI controller appears as a third commit-emitter) is the natural promotion point. Session 22 doesn't introduce a UI controller — orchestrator runs the show — so this isn't fired here. But while structuring the UI module, leave room for `src/engine/actions/can-commit.ts` (or wherever it lands) to be a clean import once promoted.
- **`runOnActionAttempted` purity is load-bearing for controllers.** Session 22 doesn't touch the hook runner; flag for awareness only.
- **`docs/content-snapshot.md` is drifted.** Refresh scheduled for Session 26. Not regressed in 22.

## Estimated size

Medium-to-large. The plaintext plan is half a session in itself if it's done with the rigor the architectural propagation deserves. The implementation work — scaffolding, two renderers, camera, settings stub, training field, orchestrator wiring — is the rest. ADRs round out. If scope balloons during planning, propose the 22a/22b split rather than overrunning.
