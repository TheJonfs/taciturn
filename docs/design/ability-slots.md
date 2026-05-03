# Ability Slot System

*Design document — v0.3*

## Purpose

The ability slot system governs how a character's abilities are equipped and constrained. It sits between the (designer-defined) ability catalog and the (player-determined) per-character loadout. Design priorities:

- **Build identity.** A character's loadout meaningfully expresses choices about their role.
- **Customization depth.** Multiple viable loadouts for any given character.
- **Tradeoff legibility.** Player can see what they gain and lose by each choice.

## Abstract model

A character has a set of named **buckets**, each with a **capacity** (positive integer). Each ability has a **cost** (positive integer) against exactly one bucket — the bucket the ability lives in when equipped. A loadout is a mapping from buckets to lists of equipped abilities; it is valid iff for every bucket, the sum of equipped abilities' costs does not exceed that bucket's capacity.

An ability's *effects* when equipped are independent of its cost. Effects may include modifications to other buckets' capacities (see Capacity trading), stat modifications, conditional triggers, etc. Cost and effect occupy different parts of the ability definition.

Both capacity and cost are **computed per-character** from class, equipment, level, traits, and other character state. They are not raw stored values; the engine queries the current value at loadout-validation time. This is the same computed-from-state pattern used for unit Speed in the CT system.

## Bucket types

Buckets come in two architecturally distinct flavors:

**Active buckets** hold *command-set references*. A command set is a named action group (typically associated with a class — e.g., "Battle Skill" from Knight). When a character acts, they choose which equipped command set to draw from, then choose an action from within that command set's learned abilities.

**Passive buckets** hold *individual ability references*. Equipped passives apply automatically: Reaction triggers on appropriate events; Support and Movement modify rules continuously. Mechanically, passives register handlers against the engine's hook system — the same surface used by status effects, equipment, and class traits. See *status-effects.md* for the hook surface details.

Both flavors use the same capacity/cost validation surface. They differ only in what they reference and how they trigger during play.

## v1 bucket configuration

| Bucket | Type | Capacity | Cost convention | Notes |
|---|---|---|---|---|
| First Action | Active | 1 | 1 | Class-determined — no player choice for v1 |
| Second Action | Active | 1 | 1 | Player chooses from any command set the character has access to |
| Reaction | Passive | 3 | 1, 2, or 3 per ability | Abilities priced as the design balancing variable |
| Support | Passive | 3 | 1, 2, or 3 per ability | Same |
| Movement | Passive | 3 | 1, 2, or 3 per ability | Same |

All capacities and costs are parameters, modifiable in data. v1 ships with cost asymmetry already in play in the passive buckets.

## Class-inherent abilities

A class may grant some abilities for free while the character is in that class. These are modeled as **cost-0 modulations**: the abilities are equipped against the relevant bucket, but their cost-as-equipped-by-this-character computes to 0.

This is uniform with the rest of the cost system — class is just one input to the per-character cost computation. Edge cases handle naturally: an ability that's free in Class A and costs 2 in Class B simply has different computed costs in those contexts. No separate "free slot" mechanic required.

The First Action bucket being class-determined is an instance of the same idea, applied to active buckets: the bucket's contents are constrained by class rather than freely chosen by the player.

## Capacity trading

Some abilities or class traits may shift capacity between buckets (analogous to FFV's Mimic, which traded passive flexibility for command-set access). This is supported via per-bucket capacity modifiers attached to abilities or traits — e.g., a trait declares `+1 Active capacity, -2 Reaction capacity` as part of its effect. The engine resolves these into the per-character capacity vector at loadout-validation time.

No meta-budget abstraction is needed; the bucket-and-modifier primitives suffice.

## Within-command learning state

The abilities available within an equipped command set depend on the character's **learning state** — which actions within that command set has this character actually learned. This lives outside the bucket system proper and is part of the progression/JP-equivalent system to be designed later.

For v1 engine architecture, the assumption is: each character has a per-(character, command-set) learning record; when acting, the character can choose from any *learned* action in either the First or Second Action command set.

## Validation and modification

The engine exposes:

- `getCapacity(character, bucketId) → integer` — computes current capacity for a bucket on a given character.
- `getCost(character, ability) → integer` — computes current cost of an ability for a given character.
- `validate(character, loadout) → boolean | violations` — checks whether a loadout is legal.
- `equip(character, loadout, change) → newLoadout | error` — applies a proposed change if valid.

The validate and equip operations are pure functions of character state and loadout; they have no side effects on the rest of the engine.

## Decisions captured

- Buckets and capacities form the abstract; specific configuration is data, not code.
- Active and passive buckets are architecturally distinct (command-set references vs individual abilities) but share the capacity/cost validation surface.
- Costs and capacities are both computed per-character, not stored raw.
- Cost is scalar — one ability, one cost, one bucket.
- Source-class restrictions on abilities are not enforced at the engine level; abilities mix freely. Specific designs may add metadata-level restrictions.
- v1 ships with cost asymmetry in passive buckets (R/S/M: capacity 3, abilities cost 1, 2, or 3).
- Class-inherent free abilities are modeled as cost-0 contextual modulations, not as a parallel "free slot" mechanic.
- Capacity trading between buckets is supported via per-bucket capacity modifiers on abilities/traits.

## v1 starting parameters

- First Action: Capacity 1, contents class-determined.
- Second Action: Capacity 1, all command sets cost 1.
- Reaction / Support / Movement: Capacity 3 each; abilities cost 1, 2, or 3.
- All three passive bucket capacities are modifiable by future abilities/traits.
- Class may grant a subset of its R/S/M abilities at cost 0; specifics defined per-class.

## Open questions / deferred

- The actual list of classes and their command sets.
- Specific abilities, their bucket assignments, and their costs.
- Which specific R/S/M abilities each class grants for free.
- Whether to expand First Action (capacity > 1, premium command sets costing > 1) as a later design direction. Architecture supports it; v1 does not use it.
- Per-character learning system (JP-equivalent) — to be addressed in the progression doc.
- UI conventions for displaying free vs cost-paid passives in the equipment screen.
- Cascading invalidation policy: when capacity drops below currently-used cost (item unequipped that granted +1 capacity, class change reduces capacity, ability removed that traded capacity, etc.), how is the invalid loadout resolved? Candidates: auto-unequip most recently equipped overflowing ability; block the triggering action until player resolves manually; flag and require resolution before next action. Likely needs UX prototyping.
