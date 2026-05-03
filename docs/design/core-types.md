# Core Data Types

*Design document — v0.3*

## Purpose

This document defines the shape of the central data structures that the engine operates on: Unit, Tile, Map, Action, and the GameState container that holds them. These types are the foundation that every other system — CT, abilities, status effects, AI, rendering, networking — reads from and writes to. Getting their shape right early prevents the kind of refactor pressure that derailed the prior attempt.

The TypeScript sketches throughout are illustrative, not authoritative. They communicate shape and relationships; specific field names and structural details will evolve.

## Design principles

These principles apply across all core types:

1. **Stored vs. computed.** State that mutates during play is stored. State derived from other state is computed on demand (or memoized). Examples: HP is stored, maxHP is computed from class + level + equipment. CT is stored, Speed is computed from class + level + equipment + active statuses.
2. **Immutable state, action-driven transitions.** A new GameState is produced by applying an Action to the current state via a pure reducer function. Mutation in place is avoided. This makes replay, undo, debugging, and online sync tractable.
3. **Engine knows nothing about rendering.** No sprite references, no animation timings, no UI hints in core types. Rendering subscribes to state and derives what it needs.
4. **Identity by ID, not reference.** Units, abilities, classes, items reference each other by stable IDs. The catalog of definitions lives separately from the per-battle state.
5. **Separation of definition and instance.** A Class is defined once in the catalog; a Unit references it by ID. A StatusEffect type is defined once; a StatusInstance on a Unit references the type and carries instance-specific state (remaining duration, source caster, etc.).

## Unit

A Unit is a participant in combat. The shape:

```typescript
interface Unit {
  id: UnitId;
  team: TeamId;
  name: string;

  // Class state — current class plus per-class progression history
  classState: {
    currentClass: ClassId;
    classProgress: Map<ClassId, ClassProgressionState>;
  };

  // Vitals — stored, mutate during combat
  vitals: { hp: number; mp: number };

  // Base stats — stored, change at progression boundaries
  baseStats: {
    pa: number;   // physical attack
    ma: number;   // magical attack
    spd: number;  // base speed
    // ... etc
  };

  // Position and facing — stored
  position: { x: number; y: number; layer: number };
  facing: Direction;  // N | E | S | W

  // CT — stored
  ct: number;

  // Active status effects
  statuses: StatusInstance[];

  // Equipment — references by ID
  equipment: {
    weapon?: ItemId;
    headgear?: ItemId;
    armor?: ItemId;
    accessory?: ItemId;
    // ... slot count TBD
  };

  // Loadout (per ability slot system)
  loadout: {
    actionBuckets: Record<BucketId, CommandSetId | null>;
    passiveBuckets: Record<BucketId, AbilityId[]>;
  };

  // Per-(unit, command-set) learning state
  learning: Map<CommandSetId, LearnedActionsState>;
}
```

Notes:

- **maxHP, maxMP, current Speed, current capacity per bucket** are all *computed*, not stored. They derive from baseStats + class + equipment + statuses + active loadout.
- **Facing** is a stored field. End-of-turn facing choice (FFT convention) is a design detail to support; the engine treats facing as a property the player or AI sets during the turn-end action.
- **classProgress** holds whatever per-class progression a unit has accumulated (JP-equivalent, learned actions per class, levels in that class). The shape of `ClassProgressionState` is part of the deferred progression doc.
- **statuses** carries instances; the StatusEffect *type* (with its tick rules, resistance interactions, etc.) lives in the catalog.

## Tile and Map

Tiles are fixed structural data; the Map is the collection of tiles plus battlefield-scope state.

The map supports **multiple tiles at the same (x,y) position** via a layer field. Layers are a general "discrete vertical position" concept: layer 0 is ground, layer 1+ might be a bridge, an elevated platform, a hover/flight position, an upper floor of a structure. Most tiles in most maps will be layer 0 only.

```typescript
interface Tile {
  x: number;
  y: number;
  layer: number;           // 0 = ground; higher = bridges, hover, upper floors, etc.
  elevation: number;       // height value used in mechanics
  terrain: TerrainType;    // grass, water, sand, stone, etc.
  properties: TileProperty[];  // blocks_los, hazardous, slippery, etc.
}

interface Map {
  width: number;
  height: number;
  tiles: Tile[];           // flat list; multiple tiles may share (x,y) at different layers
}

// Accessors that hide storage details
function tilesAt(map: Map, x: number, y: number): Tile[];
function tileAt(map: Map, x: number, y: number, layer: number): Tile | undefined;
function unitAt(state: GameState, x: number, y: number, layer: number): Unit | undefined;
```

Notes:

- **Layers are about position, not visibility.** A layer-1 tile that exists only as "this is where a flying unit can be" is still a real tile in the data; abilities/UI may render it differently or not at all.
- **Elevation and layer are different.** Layer is which discrete vertical slot a tile occupies at (x,y); elevation is the height value used in damage/jump/LoS calculations. A bridge might be layer 1 with elevation 5; the ground beneath it is layer 0 with elevation 1. A hover position 2 squares up from ground might be layer 1 with elevation = ground_elevation + 2. Mechanics read `elevation`; spatial occupancy uses `layer`.
- **Tiles do not store occupancy.** The single source of truth for "where is unit X?" is `unit.position` (which now includes layer). Tile occupancy is computed via index when needed.
- **TileProperty and TerrainType are open enums** populated as design progresses.
- **v1 constraint: maps are validated to use only layer 0.** All accessors and movement logic handle layers from day one, but no v1 map will exercise the multi-layer paths. This means we get the data shape right without paying full design cost; bridges, flight, and multi-floor maps become content additions later, not refactors.
- **Depth as a tile property** (water depth, pit depth) is a separate concept from layer and is flagged for later if needed; it modifies how units interact with a single tile rather than adding tiles at that position.

## Action

An Action is the unit of state transition. Every change to GameState happens by applying an Action via a reducer. Actions are what get logged, replayed, and shipped over the network.

```typescript
interface Action {
  // Identity
  sequenceNumber: number;     // monotonic, assigned by engine on commit
  type: ActionType;           // discriminated union below
  source: ActionSource;       // 'player' | 'system'

  // Common fields
  actorId?: UnitId;           // null for some system actions
  timestamp: { tick: number; ct: number };  // engine time at commit

  // Per-type payload (discriminated)
  payload: ActionPayload;

  // RNG seed for resolution. Derived from master seed + sequenceNumber.
  // Stored so resolution is reproducible from the action alone.
  seed: number;

  // Resolution outcome — populated by reducer, stored for replay/UI/log
  outcome?: ActionOutcome;
}

type ActionType =
  | 'move'
  | 'use_ability'
  | 'wait'
  | 'set_facing'
  | 'turn_start'
  | 'turn_end'
  | 'charged_action_resolve'
  | 'status_tick'
  | ...;
```

Notes on action design:

- **Granularity: each player decision is its own Action.** A turn that includes a Move and an Ability use produces two Actions, not one. This makes "I moved but want to change my mind about the attack" a coherent before-RNG-is-consumed undo target without affecting the move.
- **System actions are first-class.** Turn boundaries, charged action resolution, status ticks — all are Actions in the log, alongside player choices. This keeps the reducer's input set uniform and makes the log a complete record.
- **Outcome is stored on the action.** When `use_ability` resolves, the resulting damage, hit/miss, status applications, etc. are recorded in `action.outcome`. Replay then doesn't need to re-roll RNG; it just re-applies stored outcomes. (Simulation-from-actions still works because the reducer is pure given seed.)
- **Validation is separate from resolution.** A `validateAction(state, action) → boolean | reason` function determines whether an action is legal. The reducer assumes valid input and applies. Invalid actions are rejected at commit time.

## GameState

The container holding everything for a single battle.

```typescript
interface GameState {
  // Battle identity
  battleId: string;

  // Static for the battle
  map: Map;
  teams: Team[];
  ruleset: RulesetRef;     // CT params, validation rules, etc.

  // Dynamic
  units: Map<UnitId, Unit>;
  chargedActions: ChargedAction[];   // first-class CT entities for in-progress charges
  globalEffects: GlobalEffect[];     // weather, battlefield-wide effects

  // Time
  tick: number;             // global tick counter
  turnState: TurnState;     // whose turn, what's been done this turn

  // RNG
  rng: { masterSeed: number; nextSeq: number };

  // Log
  actionLog: Action[];

  // Meta
  outcome?: BattleOutcome;  // null while ongoing; set when win/loss condition met
}
```

Notes:

- The **ruleset reference** is what makes CT parameters, validation, and similar configurable. Two battles with different rulesets can coexist without engine code changes.
- **chargedActions** holds the first-class CT entities for spells/abilities in their cast window (per CT system doc). They project alongside units in the upcoming-turns view.
- **actionLog** is the complete record. Combined with the initial state and ruleset, it fully reconstructs any moment of the battle.

## RNG model

Determinism plus replayability requires care. The model:

1. The battle has a **master seed**, set at battle start.
2. Each Action that needs randomness gets a **per-action seed**, derived from `(masterSeed, sequenceNumber)` via a stable hash function.
3. The reducer's resolution of an action is a **pure function** of `(state, action, action.seed)`. Given the same inputs, identical outputs. Always.
4. The action's **outcome** is computed on first resolution and stored on the action. Replays read the outcome rather than re-deriving it; this is belt-and-suspenders against any non-determinism in resolution code (and helps keep replays cheap).

Why per-action seeds rather than a master RNG stream:

- A stream is fragile. Any unintended consumer (a UI that draws randomness, a debug log) corrupts every subsequent action.
- Per-action seeds let actions be resolved out of order or in isolation — useful for AI search ("what if I did X?"), for testing individual abilities, and for online sync where actions may arrive in unexpected orders.
- Cost: a hash per action. Negligible.

## Decisions captured

- Stored vs. computed split: mutating state stored, derived state computed.
- GameState is immutable; transitions via pure reducer applied to Actions.
- Engine has zero knowledge of rendering. Renderer subscribes to state.
- Identity-by-ID throughout. Catalog of definitions separate from per-battle state.
- Elevation is a first-class field on every Tile, feeding mechanics directly.
- Tiles support a layer field for multiple tiles at the same (x,y); enables bridges, flight positions, multi-floor structures. v1 maps constrained to layer 0 only; data shape and accessors handle layers from day one.
- Layer (discrete vertical slot) and elevation (height value used in mechanics) are distinct concepts; both stored on tiles.
- Tiles do not store occupancy; unit position (x, y, layer) is the single source of truth.
- Action granularity: each player decision is its own Action. Move and Act are separate actions in a turn.
- System events (turn boundaries, charged resolutions, status ticks) are also Actions, logged alongside player actions.
- Action outcomes are stored on the action after first resolution.
- Per-action RNG seeds derived from master seed + sequence number; resolution pure given (state, action, seed).
- Validation separate from resolution. Reducer assumes valid input.

## Open questions / deferred

- **Hidden information for online play.** In hot-seat (v1) full visibility is fine. For online PvP: do players see opposing CT, loadouts, ability uses, ability outcomes? Affects state-shape and view-derivation decisions but not the core types.
- **Equipment slot count and structure.** Listed weapon/headgear/armor/accessory; actual slot list will be tuning. Architecture treats it as an open record.
- **Shape of `ClassProgressionState`** — JP analog, learned actions per class, class level. Part of the progression doc.
- **Shape of `StatusInstance`** — duration, timing reference (global tick or per-unit CT, per CT doc), source caster, stack rules. Worth its own short doc when we do statuses.
- **Tile property and terrain enums** — populated as design progresses.
- **End-of-turn facing choice convention.** FFT lets player rotate at turn end; whether this is its own action (`set_facing`) or a sub-step of `turn_end` is a small UX decision.
- **Battlefield-scope effects (`globalEffects`)** — exact shape and how they interact with the action log (do they tick as system actions? do they affect tiles or units? both?).
- **Win/loss condition representation.** Likely a function over GameState declared on the ruleset; details TBD.
- **Persistence and serialization.** GameState should serialize cleanly for save-game and online sync; need to ensure nothing in the type is non-serializable (no functions stored on instances, etc.).
