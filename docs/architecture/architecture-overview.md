# Architecture Overview

*Reference document — v0.1*

This document describes how the design (in `../design/`) maps to the codebase. The design docs describe *what* and *why*; this doc covers *how*: directory structure, module boundaries, dependencies, and the general patterns code follows.

## Layers

The codebase has six layers, organized by directory under `src/`:

1. **Engine** (`src/engine/`) — Pure game logic. The reducer, state types, validation, all mechanical computation. Knows nothing about rendering or UI. Most testable, most stable.

2. **AI** (`src/ai/`) — Decision-making for non-player-controlled units. Reads engine state, produces Actions. Independent of rendering and UI.

3. **Renderer** (`src/renderer/`) — Visual presentation of the battle. PixiJS-based. Reads engine state and animates accordingly. Never modifies state.

4. **UI** (`src/ui/`) — React components for menus, character sheets, roster builder, HUD elements outside the battle map. Communicates with engine via Action commits.

5. **Content** (`src/content/`) — Static data: class definitions, ability definitions, status type definitions, map files. Loaded into the catalog at startup.

6. **App** (`src/app/`) — Top-level glue: entry point, state management at the application level (current screen, current battle, etc.), wiring between layers.

### Dependency rules

- Engine depends on nothing except types from itself.
- AI depends on Engine.
- Renderer depends on Engine (read-only).
- UI depends on Engine (Actions in, state out) and may depend on Renderer for the battle view component.
- Content is consumed by Engine via the Catalog.
- App orchestrates everything; everything else depends on App for nothing.

The dependency arrows point toward Engine. If you find yourself wanting Engine to import from Renderer or UI, the design is wrong.

## Engine module structure

Within `src/engine/`:

```
engine/
├── types/             # Unit, Tile, Map, Action, GameState, etc.
├── catalog/           # Static definition lookup (StatusType, AbilityDef, ...)
├── ct/                # Speed computation, projection queue, fast-forward
├── abilities/         # Slots, capacity, cost, loadout validation
├── map/               # Tile accessors, movement profile, pathfinding,
│                      #   range, line-of-sight, AoE shapes
├── status/            # Status types, instances, hook system
├── actions/           # Action types, validation, reducer
├── damage/            # Damage pipeline (separate because focused)
├── turn/              # Turn structure, battle flow, controller dispatch
└── index.ts           # Public API surface
```

Each subdirectory roughly mirrors a design doc. When working on a subdirectory, the design doc is the first thing to read.

### What goes in `types/`

Pure type definitions and small utility functions on those types. No business logic. The shapes everything else builds on.

### What goes in `catalog/`

Lookup infrastructure for static definitions. Loaded once at app start from `src/content/`. Other modules query by ID:
```typescript
catalog.getStatusType('haste') → StatusEffectType
catalog.getAbility('cure') → AbilityDefinition
catalog.getClass('knight') → ClassDefinition
```

The catalog is essentially a database of definitions. Game data files (`src/content/`) populate it. Engine code never sees raw content files; it sees catalog entries.

### What goes in subsystem modules

Each subsystem module (ct, abilities, map, status, actions, damage, turn) contains:
- The pure functions that implement the subsystem.
- Tests for those functions.
- A small index that exposes the subsystem's public API.

Internal helpers stay internal. The public API of each subsystem is what other Engine modules import; everything else is implementation detail.

### What `engine/index.ts` exposes

The Engine's public API to the rest of the application. Roughly:

- The reducer: `reduce(state, action, seed) → ReduceResult`.
- Validation: `validateAction(state, action) → ValidationResult`.
- Query functions: `getLegalMoves`, `getLegalTargets`, `projectTurns`, etc.
- Catalog access: read-only lookup for UI and renderer.
- State construction: `createInitialState(battleConfig) → GameState`.

UI and Renderer should be able to do their entire job using only what's exported from `engine/index.ts`. If they need something else, the question is whether to expose it (small change) or whether they're reaching past the API (probably wrong).

## State flow

Standard request flow during a battle:

```
User clicks UI                          → UI dispatches Action proposal
       ↓
Engine validates                        → ValidationResult returned to UI
       ↓ (if valid)
Engine reduces                          → new state, outcome, generated actions
       ↓
App updates global state                → triggers React re-render and Pixi update
       ↓
Renderer animates outcome               → reads action log entries to know what to show
UI updates HUD/state displays           → reads new state via React props
       ↓
Engine processes generated actions      → repeats until action chain empty
```

For AI-controlled turns, replace "User clicks UI" with "AI controller computes Action," but the rest is the same path.

## Hook system

The hook system (defined in `engine/status/hooks.ts`, used throughout) is how statuses, equipped passive abilities, equipment, and class traits modify engine behavior.

Hooks are named extension points with defined signatures. Handlers register against them; the engine fires hooks at well-defined moments and collects results.

Where handlers come from:
- **Status instances** register their type's hooks when applied; deregister on removal.
- **Equipped passives** (R/S/M abilities) register when equipped; deregister when unequipped.
- **Equipment** registers when worn.
- **Class traits** register when the unit is in that class.

Handler dispatch is keyed by `(unitId, hookName)`. When the engine fires a hook, it gathers all handlers registered for that unit on that hook, sorts them by source priority (Equipment → Class → Passive → Statuses), and calls them in order. Each handler can read and modify the in-flight context.

See `docs/design/status-effects.md` for the full hook list and ordering rules.

## Catalogs vs. instances

A persistent pattern: definitions and instances are different things.

- A `StatusEffectType` is a definition: tag list, hook handlers, default magnitude, duration mode. One per status kind in the catalog.
- A `StatusInstance` is an application of that type onto a unit: source, remaining duration, current magnitude. Many can exist across units.

Same pattern for abilities, classes, items. The instance carries per-context data; the type carries everything universal.

This means:
- Definitions are loaded once and treated as read-only thereafter.
- Instances are created and destroyed as gameplay proceeds.
- Designers tune the game by editing definitions in `src/content/`, not engine code.

## Testing patterns

### Engine unit tests

Most engine functions are pure. Test by setting up state, calling the function, asserting on the result.

```typescript
test('Move Range computation includes Move+1 ability', () => {
  const unit = makeUnit({
    class: 'knight',
    passives: { movement: ['move_plus_1'] }
  });
  expect(getMovementProfile(state, unit.id).moveRange).toBe(4);  // base 3 + 1
});
```

### Integration tests

Full action lifecycle. Set up state, commit an action, assert on the resulting state and outcome.

```typescript
test('Slow spell applies status to target', () => {
  const state = makeBattleState({ /* ... */ });
  const action = makeAction('use_ability', { ability: 'slow', target: 'enemy_1' });
  const result = reduce(state, action, seed=42);

  expect(getStatusInstance(result.newState, 'enemy_1', 'slow')).toBeDefined();
  expect(result.outcome).toMatchObject({ kind: 'use_ability', perTargetResults: [...] });
});
```

### Determinism tests

For the reducer specifically:

```typescript
test('reducer is deterministic given (state, action, seed)', () => {
  const r1 = reduce(state, action, seed=42);
  const r2 = reduce(state, action, seed=42);
  expect(r1).toEqual(r2);
});
```

### Replay tests

For longer flows, replay the action log and verify the same final state.

```typescript
test('replaying action log reproduces final state', () => {
  const finalState = playOutBattle(initialState, actionLog);
  const replayed = replayLog(initialState, actionLog);
  expect(replayed).toEqual(finalState);
});
```

## Performance posture

The engine is not performance-sensitive at typical scale (10s of units, 100s of tiles, hundreds of actions per battle). Premature optimization is actively harmful here — it tends to make code less correct and less testable for negligible benefit.

If a real hotspot emerges, profile first, then discuss before optimizing.

## Rulesets and content

A battle's behavior is determined by three composable inputs, each of which is data:

**Ruleset** — A bundle of configurable engine parameters. Captures the "rules of the game" as data, separate from content. Includes:
- CT costs (Move-only, Act-only, Move+Act, Wait, Defend)
- Speed floor and ceiling
- Default TurnBudget shape (movesAvailable, actsAvailable, etc.)
- Default ranges (melee horizontal/vertical, minimum range, default vertical tolerance for AoE)
- Pathfinding defaults (per-terrain costs, layer transition rules)
- Hook ordering tiers and tiebreaker rules
- Chain termination parameters (depth cap, per-unit reaction limit)
- Default behaviors (friendly fire on/off, friendly pass-through, units-block-LoS)
- Damage pipeline stage handler references (which named handlers run at each stage)
- Default initial CT formula

**Catalog** — Static content definitions. Loaded into the in-memory catalog at startup. Includes:
- Class definitions
- Ability definitions
- Status type definitions
- Item/equipment definitions
- Map definitions

**Battle configuration** — Per-battle setup. Includes:
- Reference to which Ruleset is active
- Initial unit placements and rosters (with their loadouts and progression state)
- Specific victory/defeat conditions for this battle
- Initial conditions (pre-applied statuses, pre-placed environmental effects)

### Composition

The architectural commitment is that swapping any of the three layers does not require engine code changes — only data changes:

- **Same Ruleset + same Catalog + different BattleConfig** → different battles in the same game.
- **Same Ruleset + different Catalog** → same rules, different content (alternate class/ability set).
- **Different Ruleset** → different game feel (e.g., a "hardcore" Ruleset with friendly fire and harsher CT costs).

GameState references the active Ruleset by ID and consumes Catalog data via lookup. The active Ruleset is captured in the action log header so replays are reproducible across Ruleset versions.

### Implementation

- Rulesets live in `src/content/rulesets/` typed as `RulesetDefinition`. A `default` Ruleset exists as the v1 baseline; alternate Rulesets specify only their overrides.
- The Catalog loader lives in `src/engine/catalog/`; content data lives in `src/content/{classes,abilities,statuses,items,maps}/`.
- BattleConfigs live in `src/content/battles/` and combine references to Ruleset, content, and battle-specific setup.

### Partial overrides

A Ruleset is conceptually a deep merge over the default. Authors specify only what differs:

```typescript
// Hypothetical hardcore-mode Ruleset
{
  id: 'hardcore',
  basedOn: 'default',
  overrides: {
    behaviors: { friendlyFire: true, friendlyPassThrough: false },
    ctCosts: { moveOnly: 50, actOnly: 70 },
  },
}
```

The engine resolves the full Ruleset by merging overrides onto its base. This keeps Ruleset files small, readable, and diff-friendly.

## Open architectural questions

These are architecture-level questions still open at the time of this writing; resolutions will land as ADRs.

- **Catalog hot-reload during development.** Whether to support reloading content files without restarting the dev server.
- **Save format.** Once we have campaign progression, what's the on-disk shape? (Probably the same shape as in-memory state, JSON-serialized.)
- **Online sync architecture.** When we add online: client/server with authoritative server, or peer-to-peer with shared seed? Likely the former, but the action-log model supports both.
- **Asset loading and lifecycle.** When PixiJS assets load, how they're managed across battles, when they unload. Renderer concern primarily but worth flagging.
