# Roadmap

*Current as of 2026-05-03. This is an evolving plan. See git history for prior states.*

## How to read this

Each entry below is a session-sized scope of work. Sessions complete one entry at a time; each entry produces a working, tested, committed slice. Order reflects dependencies: each entry assumes the entries above it are in place.

This is *intended to evolve.* Sessions can:

- Mark items completed and add a one-line summary of what landed.
- Reorder remaining items if implementation reveals a different dependency order.
- Insert new items if a subsystem turns out to need a precursor.
- Drop items that turn out to be unnecessary, with a reason in the commit message.

Significant changes (reordering, dropping, inserting) should be obvious in the commit diff and explained in the commit message. The roadmap is reference, not contract — when it diverges from reality, fix the roadmap.

## Methodology

**Horizontal progression with MVP-first passes.** Each subsystem is built fully before the next starts (horizontal), but the first pass on a subsystem is an MVP — just enough to verify the mechanism works end-to-end with one or two concrete examples. Real breadth (a full status catalog, a full set of classes, a full ability list) comes in later content-expansion passes scheduled separately.

This means the roadmap below is the *mechanism* track. Content expansion is interleaved as separate passes once the relevant mechanisms exist.

**Engine-first.** The first playable battle is a milestone, not the goal of any single early session. Sessions 1–9 build the engine; sessions 10–13 build the rendering, UI, AI, and integration layers needed to drive it.

## Sessions

### 1. Core types + CT system ✅

*Completed 2026-05-03.* Branded IDs, spatial primitives, `Unit`, `ChargedAction`, `Action` skeleton, and `GameState` landed in `src/engine/types/`. CT system in `src/engine/ct/`: `computeSpeed` / `computeActionSpeed` (single floor at 0; hook chain pending session 3), `ticksUntilTrigger`, `nextEvent`, `projectUpcoming` with the actual-CT > Speed > stable-ID tiebreaker. Two ADRs: 0002 (accessor return-type pattern: throw on programmer error, `T | undefined` on meaningful absence) and 0003 (ChargedAction shape + the "assumed full Move + Act turn" projection-after-trigger constant pending session 6's Ruleset).

References: `docs/design/core-types.md`, `docs/design/ct-system.md`.

### 2. Catalog infrastructure + minimal type definitions ✅

*Completed 2026-05-03.* Generic `Registry<TId, TDef>` and a `Catalog` class with per-kind getters / `has*` / listing methods (`StatusEffectType`, `AbilityDefinition`, `ClassDefinition`, `ItemDefinition`) — minimal `{ id, name }` shapes that grow in their owning sessions. `createCatalog` validates duplicate-id at construction; `getX` throws `UnknownDefinitionError` on miss. One stub per kind in `src/content/{statuses,abilities,classes,items}/`, combined by `loadDefaultCatalog()`. ADR-0004 fixes the catalog-injection pattern (alongside `state`, never on `GameState`, never a singleton).

References: `docs/design/core-types.md` ("Catalogs vs. instances"), `docs/architecture/architecture-overview.md` ("What goes in `catalog/`").

### 3. Hook system + minimal status apply/remove ✅

*Completed 2026-05-03.* Hook system in `src/engine/status/`: typed `HookSignatures` map enumerating every design-doc hook, discriminated `StatusHookRegistration` per hook name, `statusHook(name, handler, priority?)` author helper, lazy `collectActiveHandlers` ordered by source tier (Equipment → Class → Passive → Statuses) and per-handler priority, runners for `modifyStatQuery` / `fireOnApply` / `fireOnRemove`. Status application pipeline: resistance (no-op until `Unit.resistances` lands) → all six stacking rules (REFRESH / REPLACE / REPLACE_IF_STRONGER / STACK_INDEPENDENT / STACK_ADDITIVE / REJECT, each with explicit lifecycle decisions) → instantiate → onApply. `removeStatus` symmetric. `computeSpeed(state, unitId, catalog)` now dispatches `modifyStatQuery`; `nextEvent` / `projectUpcoming` thread the catalog through. Haste content rewritten with the canonical `modifyStatQuery` handler — end-to-end demo: apply → Speed scales 1.5× → remove → Speed returns to base. ADR-0005 fixes the typing pattern.

References: `docs/design/status-effects.md`.

### 4. Map and movement

Tile/map accessors with the chosen `noUncheckedIndexedAccess` pattern (resolve early — see handoff notes if relevant), `MovementProfile` computation, Dijkstra pathfinding, range calculations, line-of-sight, and AoE shape resolution. Pure computation, well-tested, no dependencies on the action reducer.

References: `docs/design/map-and-battlefield.md`.

### 5. Ability slots

Bucket capacity, per-character cost computation, loadout validation, equip operation. Pure functions; no integration with the reducer yet.

References: `docs/design/ability-slots.md`.

### 6. Ruleset + BattleConfig + initial state construction

`RulesetDefinition` (CT costs, Speed bounds, default `TurnBudget`, hook ordering tiers, etc.), `BattleConfig` (initial unit placements, victory conditions, ruleset reference), and `createInitialState(battleConfig) → GameState`. The reducer in the next session needs all of this; isolating it as its own session keeps reducer work focused on action logic rather than configuration plumbing.

References: `docs/architecture/architecture-overview.md` ("Rulesets and content").

### 7. Action types and reducer

The full action lifecycle (propose → validate → seed → pre-hooks → reduce → resolution-hooks → commit → process-chain), `validateAction` as a pure separate function, the reducer for Move, UseAbility, Wait, SetFacing, and the system actions (turn_start, turn_end, status_tick, charged_action_resolve). Damage pipeline lands in the next session; UseAbility here covers non-damage paths.

References: `docs/design/action-resolution.md`.

### 8. Damage pipeline

Seven-stage damage pipeline (base → attacker → target → environment → variance → cap → finalize), healing as the same pipeline with tag inversion, integration with the UseAbility reducer.

References: `docs/design/action-resolution.md` ("Damage pipeline").

### 9. Turn flow

Turn start/end semantics, `TurnBudget` reset and consumption, turn-skip handling (Stop, Sleep), facing choice handling, battle outcome evaluation. Wraps the engine into a complete turn cycle.

References: `docs/design/turn-structure.md`.

### 10. Renderer skeleton

PixiJS application setup, basic tile rendering, unit sprites, camera/viewport. Reads engine state read-only; never writes. MVP only — one demo battle visible, no animation polish.

References: `docs/architecture/architecture-overview.md` ("Renderer").

### 11. UI skeleton

React components for battle screen, action menu, current-unit panel, projection-queue display. Communicates with the engine via Action commits. MVP — enough to drive the Renderer's demo battle from clicks.

### 12. AI

Basic enemy controller. Reads engine state, produces Actions through the same path the UI uses. MVP — heuristic decisions sufficient to make a battle playable to completion, not a real opponent.

### 13. First playable end-to-end battle

Integration milestone. One unit per side, one map, a small but real ability set drawn from prior content-expansion passes. Goal: the engine, renderer, UI, and AI together produce a battle that someone can sit down and play through to a win/loss conclusion. Bugs and gaps surfaced here drive the next round of session priorities.

## Content-expansion passes (interleaved)

These are not numbered in the main sequence because their timing depends on what mechanisms exist. The general pattern: once a mechanism's MVP is in place, an expansion pass adds the breadth of content that uses it.

- **Status catalog expansion** — after session 3 (hook system + minimal status). Adds the breadth of v1 statuses defined in `docs/design/status-effects.md`.
- **Class/ability/equipment catalog expansion** — after session 5 (ability slots) and partly after session 8 (damage pipeline). Adds enough classes and abilities to populate session 13's first playable battle.
- **Map content expansion** — after session 4 (map and movement). Adds maps beyond the test fixtures.
- **Ruleset variants** — after session 6, only if needed; the default ruleset suffices for most early work.

## Out of scope for v1

These are noted to make their absence intentional rather than accidental:

- Online play (the action-log model supports it; no implementation in v1).
- Isometric rendering (orthographic top-down for v1).
- Campaign / between-battle progression (single battles only in v1).
- Save/load (single-session play only).

The architecture has been built to allow these later without rework.
