# Glossary

*Reference document — v0.1*

Proper nouns and key technical terms used across the architecture documents. Where a term has its own design doc, the reference is noted. Generic words used in everyday senses (e.g., "function," "object") are not included.

## Conventions

- **Capitalized terms** (e.g., Action, Tile, Speed) refer to architectural concepts — types, systems, named stats, named bucket categories.
- **Lowercase terms** in running text refer to generic concepts (e.g., a status, a hook, a bucket as a generic structural element).
- A term in one definition that appears here as its own entry is *italicized* on first occurrence in that definition.

## Terms

**Act** — A player decision on a turn that uses an ability, item, or other ability-bucket-derived action. One of the granularity points where an *Action* is logged. Distinguished from *Move* (the spatial action) and *Wait* (turn ended without acting). Acting consumes a per-turn CT cost set by the *Ruleset*. *See: ct-system.md.*

**Action** — A discrete state-transition event in the engine. Every change to *GameState* happens by applying an Action via the reducer. Player decisions and system events (turn boundaries, status ticks, charged action resolution) are both Actions. *See: core-types.md.*

**Action Source** — A flag on every Action distinguishing player choices from system-generated events. `'player' | 'system'`. *See: core-types.md.*

**Action Speed** — The Speed stat of a *Charged Action* in the *CT* system, distinct from the casting *Unit*'s Speed. Modifiable independently. *See: ct-system.md.*

**Active Bucket** — An *Ability Bucket* whose contents are *Command Set* references rather than individual abilities. v1 has First Action and Second Action active buckets. *See: ability-slots.md.*

**Adjacency** — The relation between two *Tiles* used by the *Move Engine*. Defined as: tile A is adjacent to tile B iff their (x, y) differ by exactly one cardinal step, regardless of *Layer*. *See: map-and-battlefield.md.*

**Anchor** — In *AoE* targeting, the position around which the AoE shape is laid out. May be the target tile, source tile, or a derived position (e.g., the line from source to target). *See: map-and-battlefield.md.*

**AoE (Area of Effect)** — An *Action* that affects multiple tiles. Specified by a *Shape*, an *Anchor*, and a *Vertical Tolerance*. *See: map-and-battlefield.md.*

**Arc** — One of the three *Targeting Modes*. Ranged, ignores intermediate obstacles, but requires both source and target tiles to be uncovered (no tile at higher *Layer* at their (x, y)). Used by lobbed projectiles, mortars, rain-of-arrows. *See: map-and-battlefield.md.*

**Battle** — A single instance of combat. Has its own *GameState*, *Action Log*, and *Master Seed*.

**Bucket** — A named container in a *Unit*'s loadout, with a *Capacity*. Holds either *Command Set* references (*Active Bucket*) or individual *Ability* references (*Passive Bucket*). *See: ability-slots.md.*

**Capacity** — The maximum total *Cost* of abilities equipped in a *Bucket*. Computed per-character from class, level, equipment, and other state. *See: ability-slots.md.*

**Charged Action** — An action with non-zero charge time, tracked as a first-class entity in the *CT* projection alongside *Units*. Has its own CT counter and *Action Speed*. *See: ct-system.md.*

**Charging** — The *Status Effect* applied to a *Unit* with an outstanding *Charged Action*. Used by abilities that interact with charging units (e.g., guaranteed-hit attacks against Charging targets). *See: status-effects.md.*

**Class** — A categorical descriptor of a *Unit* that determines base stats, available *Command Sets*, default *Bucket* capacities, and class-inherent abilities. *Units* may change class subject to progression rules.

**Command Set** — A named action group, typically associated with a class. When a Unit *Acts*, they choose which equipped Command Set to draw from, then choose an action from within that set's learned actions. Lives in *Active Buckets* in a Unit's loadout. *See: ability-slots.md.*

**Cost** — The amount an *Ability* consumes from its assigned *Bucket*'s *Capacity*. Computed per-character. An ability has cost in exactly one bucket; its *effects* (e.g., capacity modifiers on other buckets) are independent of cost. *See: ability-slots.md.*

**CT (Combat Time)** — The fundamental currency of turn order. Every active entity (*Unit*, *Charged Action*, persistent effect with duration) accumulates CT each *Tick* at its *Speed*. Reaching 100 triggers the entity. *See: ct-system.md.*

**CT Push** — A discrete addition or subtraction to an entity's current CT, distinct from *Speed* multiplication. Used by abilities like Quick (+CT) and Slow Action (-CT). *See: ct-system.md.*

**Direction** — A *Unit*'s facing: N, E, S, or W. Stored on the unit; affects damage modifiers (back/side attacks) and ability cones cast relative to the unit. *See: core-types.md.*

**Duration Mode** — Per-status declaration of how a *Status Instance*'s duration is measured: *Global Tick*, *Per-Unit CT*, *Turn-Based*, *Conditional*, or *Permanent*. *See: status-effects.md.*

**Elevation** — A height value on every *Tile*, used in mechanical calculations (damage modifiers, range checks, *Jump* legality, *LoS*). Distinct from *Layer*. *See: core-types.md, map-and-battlefield.md.*

**Engine** — The deterministic core of the game logic. Reads *GameState* and *Action*, produces new GameState. Contains no rendering or UI code.

**Equipment** — Items a *Unit* has equipped (weapon, armor, accessories). Contributes to stat computation, may register *Hook* handlers while worn, and may modify *Bucket* capacities.

**Facing** — See *Direction*.

**First Action** — The class-determined *Active Bucket* in v1. Capacity 1; contents fixed by the unit's current class.

**GameState** — The container holding the state of a single battle: *Map*, *Units*, *Charged Actions*, *Global Effects*, *Tick* counter, *Action Log*, RNG state, and ruleset reference. Immutable; new states are produced by applying *Actions* through the reducer. *See: core-types.md.*

**Global Tick** — The engine-wide tick counter. Used as a duration reference for effects not bound to any specific unit. *See: ct-system.md, status-effects.md.*

**Hook** — A named extension point in the engine with a defined signature. *Statuses*, *Passive Abilities*, *Equipment*, and *Class* traits register handlers against hooks; the engine fires hooks at well-defined moments. *See: status-effects.md.*

**Hook Handler** — A function registered against a *Hook* by a status, passive, equipment effect, or class trait. Fires when the hook fires.

**Hook Ordering** — The deterministic sequence in which multiple *Hook Handlers* on the same hook fire. v1 default: Equipment → Class → Passive → Statuses (by application order); per-handler priority overrides allowed. *See: status-effects.md.*

**Horizontal Range** — Manhattan distance over (x, y) within which an action's target must lie. Layer is not part of horizontal distance. Combined with *Vertical Range* to determine target validity. *See: map-and-battlefield.md.*

**Jump** — A *Unit* stat governing the maximum *Elevation* differential the unit can traverse in a single tile step. *See: map-and-battlefield.md.*

**Layer** — The discrete vertical position of a *Tile* at a given (x, y). Layer 0 is ground; layer ≥ 1 is a **Deck** (bridge span / platform — S96, first shipped on Alvera Village). Distinct from *Elevation*. Decks sit ≥ 2 above their under-tile, occlude LoS only in their 1-thick band, and are permanently destroyable by Worldcraft. *See: core-types.md, ADR-0155.*

**Learning State** — Per-(unit, command-set) record of which actions within a *Command Set* the unit has learned. *See: ability-slots.md.*

**LoS (Line of Sight)** — The requirement, for *Straight-line* targeting, that an unobstructed line exist from source to target. *See: map-and-battlefield.md.*

**Loadout** — A *Unit*'s assignment of *Command Sets* to *Active Buckets* and *Abilities* to *Passive Buckets*. Validated against per-bucket capacity. *See: ability-slots.md.*

**Magnitude** — Optional per-instance numeric strength of a *Status Instance*. Status types declare whether magnitude is meaningful. *See: status-effects.md.*

**Map** — The collection of *Tiles* plus battlefield-scope state for a single *Battle*. *See: core-types.md.*

**Master Seed** — The root RNG seed for a *Battle*. Per-action seeds are derived from this seed and the *Sequence Number*. *See: core-types.md.*

**Melee** — One of the three *Targeting Modes*. Short range (typically 1) with no LoS requirement; vertical range constrains attacks across height differentials. *See: map-and-battlefield.md.*

**Move** — A player decision on a turn that relocates the *Unit* spatially. Distinguished from *Act* (use ability). One of the granularity points where an *Action* is logged. Note disambiguation: Move (action) ≠ Move (stat, see *Move Range*) ≠ Movement (bucket, see *Movement Bucket*). *See: ct-system.md, map-and-battlefield.md.*

**Move Engine** — The pure function that computes legal destinations for a given *Unit* in a given *GameState*, given the unit's *Movement Profile*. *See: map-and-battlefield.md.*

**Move Range** — The stat governing how many movement points a *Unit* has per turn. Often called "Move" in tactics game conventions; written here as Move Range to disambiguate from the Move action. *See: map-and-battlefield.md.*

**Movement Bucket** — One of the three *Passive Buckets*. Holds movement-modifying abilities (Move+1, Jump+2, Float, Fly, etc.). v1 capacity 3. *See: ability-slots.md.*

**Movement Profile** — A *Unit*'s computed spatial-capability descriptor: move range, jump height, terrain costs, terrain entry rules, special movement type. Consumed by the *Move Engine*. *See: map-and-battlefield.md.*

**Outcome** — The resolution data attached to an *Action* after the reducer applies it. Includes randomized results (damage, hit/miss, status applications). Stored on the action for replay. *See: core-types.md.*

**Passive Ability** — An ability equipped in a *Passive Bucket* (*Reaction*, *Support*, or *Movement*). Applies automatically while equipped, registering *Hook* handlers. *See: ability-slots.md.*

**Passive Bucket** — A *Bucket* that holds individual *Ability* references rather than command sets. Reaction, Support, and Movement are the v1 passive buckets. *See: ability-slots.md.*

**Path** — In a *Move Engine* result, the sequence of tiles a *Unit* would traverse to reach a destination. Stored on the *Move* action's outcome.

**Per-Unit CT** — A *Duration Mode* where status duration scales with the affected unit's CT cadence. Default for v1. *See: status-effects.md.*

**Position** — A *Unit*'s location: (x, y, layer). Single source of truth for occupancy. *See: core-types.md.*

**Reaction Bucket** — One of the three *Passive Buckets*. Holds abilities that fire in response to events targeting the unit (Counter, Auto-Potion, etc.). v1 capacity 3. *See: ability-slots.md.*

**Reducer** — The pure function `(GameState, Action) → GameState` that applies *Actions* to produce new states. The single entry point for state transitions. *See: core-types.md.*

**Ruleset** — A bundle of configurable parameters governing a *Battle*: CT parameters, validation rules, win conditions. Referenced by GameState. *See: core-types.md.*

**Second Action** — The player-chosen *Active Bucket* in v1. Capacity 1; player chooses any *Command Set* the unit has access to.

**Sequence Number** — A monotonically increasing integer assigned by the engine to each *Action* on commit. Used for ordering and for deriving per-action RNG seeds. *See: core-types.md.*

**Shape** — In *AoE* targeting, the 2D footprint relative to the *Anchor*: single tile, line, cross, diamond, square, cone, custom. *See: map-and-battlefield.md.*

**Source** (of a Status Instance) — Reference to the *Unit* and *Action* that applied a *Status Instance*. Used for attribution, source-on-death cleanup, and replay. *See: status-effects.md.*

**Speed** — A *Unit* stat governing CT accumulation rate. Computed from base + class + equipment + statuses + passives. Each tick: `CT += Speed`. *See: ct-system.md.*

**Special Movement** — A *Movement Profile* flag indicating a movement type that replaces standard pathfinding: Fly, Teleport, Phase. *See: map-and-battlefield.md.*

**Stacking Rule** — Per-status declaration of what happens when a *Status* is applied to a unit that already has an instance of that type: REFRESH, REPLACE_IF_STRONGER, REPLACE, STACK_INDEPENDENT, STACK_ADDITIVE, REJECT. *See: status-effects.md.*

**Status (Effect)** — A bounded modification to a *Unit*'s behavior. Refers generically to the concept; specific statuses are named (Haste, Poison, etc.). *See: status-effects.md.*

**Status Instance** — A specific application of a *Status Effect* on a *Unit*. Carries source, remaining duration, magnitude, stacks. *See: status-effects.md.*

**Status Type** — The catalog definition of a kind of status. Carries hooks, default magnitude, duration mode, stacking rule, tags. *See: status-effects.md.*

**Straight-line (Targeting Mode)** — One of the three *Targeting Modes*. Ranged, requires unobstructed *LoS* from source to target. *See: map-and-battlefield.md.*

**Support Bucket** — One of the three *Passive Buckets*. Holds abilities that modify rules continuously (stat boosts, weapon proficiencies, etc.). v1 capacity 3. *See: ability-slots.md.*

**Tag** (on a Status) — A categorical label on a *Status Type* used by category-based interactions: positive, negative, mental, physical, time, dispellable, etc. *See: status-effects.md.*

**Targeting Mode** — One of three modes that govern how an action's target is validated: *Melee*, *Straight-line*, *Arc*. Per-ability declaration. *See: map-and-battlefield.md.*

**Team** — The side a *Unit* belongs to. *Battles* have two or more teams; victory conditions evaluated per-ruleset.

**Tick** — Either *Global Tick* (engine-wide) or *Per-Unit CT* (unit-specific cadence) — context determines which. The engine fast-forwards ticks rather than simulating each one. *See: ct-system.md.*

**Tile** — The unit cell of the *Map*. Has (x, y, layer), elevation, terrain type, and properties. Does not store occupancy. *See: core-types.md.*

**Tile Property** — A flag or parameter on a *Tile* read by hooks at well-defined moments: blocks_los, hazardous, slippery, blocks_movement, etc. *See: map-and-battlefield.md.*

**Trigger Threshold** — The fixed CT value (100) at which an entity acts. Rigid; modifiable design space comes from *Speed* and *CT Push* operations. *See: ct-system.md.*

**Turn** — The period during which a single *Unit* takes its decisions after reaching the trigger threshold. May contain *Move* and *Act* in either order, plus *Wait* and *Set Facing*. Bracketed by `turn_start` and `turn_end` system actions.

**Turn-Based** — A *Duration Mode* where status duration is measured in turns of the affected unit. *See: status-effects.md.*

**Unit** — A participant in *Battle*. Has class, stats, position, status, equipment, loadout, and learning state. *See: core-types.md.*

**Vertical Range** — The maximum *Elevation* differential between source and target for which an action is valid. Combined with *Horizontal Range* to determine target validity. *See: map-and-battlefield.md.*

**Vertical Tolerance** — In *AoE* targeting, the maximum elevation differential from the *Anchor* at which a tile is considered affected. Allows positional avoidance of AoE through height. *See: map-and-battlefield.md.*

**Wait** — A *Turn* decision to end the turn without *Acting* or *Moving* (or with reduced commitment), recovering more *CT* than a full turn. *See: ct-system.md.*

## Terminology notes

- **The "Move" disambiguation** — Move (action), Move Range (stat, sometimes called just "Move" in casual use), and Movement Bucket (passive bucket category) are three distinct concepts that share a lexical root. Documents should use the disambiguated forms when context is ambiguous.
- **Tick is overloaded** — In CT context, "tick" is the underlying time advance; in status context, "tick" can also mean "the duration-decrement event for a status." Both usages are in scope; the latter is a kind of event triggered by the former.
- **Status vs Passive** — Both modify behavior through hooks; the difference is provenance (statuses are applied during play; passives are equipped beforehand). The hook surface is shared.
- **Charged Action vs Charging** — A Charged Action is the engine entity (the spell waiting to fire); Charging is the status applied to its caster. They're paired but distinct: hooks may target either.
