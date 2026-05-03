# Status Effects

*Design document — v0.2*

## Purpose

Status effects are bounded modifications to a unit's behavior. They cover positive effects (Haste, Regen, Shell, Protect), negative effects (Poison, Slow, Stop, Don't Move), and neutral conditions (Charging, Performing). They have a duration, may have a magnitude, and modify the unit's behavior through a defined hook surface.

This document also defines the **hook system** — the shared infrastructure that statuses, equipped passive abilities, equipment effects, and class traits all use to influence engine behavior. Statuses are the first system to need it, but the hook system is general.

## Status type and instance

Following the pattern from core types: status *types* are defined once in a catalog; status *instances* live on units and reference a type by ID.

```typescript
interface StatusEffectType {
  id: StatusTypeId;
  displayName: string;
  tags: StatusTag[];           // positive, negative, mental, physical, time, etc.
  durationMode: DurationMode;
  stackingRule: StackingRule;
  defaultMagnitude?: number;
  hooks: HookHandler[];        // what this status does, see Hook system below
  // resistance interactions, dispel rules, immunity tags, etc.
}

interface StatusInstance {
  typeId: StatusTypeId;
  source: { unitId: UnitId | null; actionSeq: number | null };
  remainingDuration: number | null;  // null = permanent
  magnitude?: number;          // status-specific; e.g., Haste's Speed multiplier
  stacks?: number;             // for stacking statuses
  customState?: Record<string, unknown>;  // status-specific instance data
}
```

The instance carries everything that's per-application: who applied it, how long it has left, what its strength is, any per-instance scratch data. The type carries everything that's universal to that kind of effect.

`source` enables attribution (who poisoned me?), source-on-death cleanup (some statuses end when the source dies or leaves), and replay.

`customState` is an escape hatch for status types that need instance-level data not captured by the standard fields. We avoid it where possible — most statuses fit into duration/magnitude/stacks — but it's there for the unusual cases (e.g., a Charm status tracking who the charmed unit's new "owner" is).

## Duration modes

Each status type declares which duration mode it uses. Mixing modes is possible (e.g., a status that lasts X turns OR until Y happens, whichever first), declared per-type.

- **Global ticks** — duration in engine ticks. Decrements as global tick advances. Used for environmental or external effects (e.g., a battlefield curse).
- **Per-unit CT** — duration scales with affected unit's CT cadence. A Slowed unit's Poison ticks slower along with everything else about them. FFT default; this is the right mode for most unit-targeted statuses.
- **Turn-based** — duration in N turns of the affected unit. Decrements on the affected unit's turn-start (or turn-end). Conceptually similar to per-unit CT but quantized to turn boundaries.
- **Conditional** — duration is "until X happens." X might be: until next time the unit acts, until end of battle, until source dies, until cleared, until specific event. The condition is a predicate the engine checks at appropriate hook points.
- **Permanent** — `remainingDuration: null`. Not removed by time; only by explicit cleanup (e.g., from equipment unequip, dispel, death).

Per-unit CT is the v1 default for almost everything. Other modes are available when the design demands them.

## Magnitude

Optional per-instance numeric strength. Examples:

- Haste: Speed multiplier (1.5x, 2x).
- Poison: damage per tick (flat or % of max HP, declared by the status type).
- Regen: healing per tick.
- Strength buff: stat multiplier or additive bonus.

Statuses without a notion of strength (Stop, Don't Move, Silence) omit magnitude.

The status type declares whether magnitude is meaningful, and how it's interpreted by its hooks. The application pipeline reads `defaultMagnitude` from the type when no value is supplied.

## Stacking rules

When a status is applied to a unit that already has an instance of the same type, the type's `stackingRule` determines what happens. Per-type declaration; common rules:

- **REFRESH** — existing instance's duration resets to the new duration; magnitude unchanged. (Most common.)
- **REPLACE_IF_STRONGER** — new instance replaces existing iff its magnitude is greater. Otherwise rejected.
- **REPLACE** — new instance unconditionally replaces existing.
- **STACK_INDEPENDENT** — multiple instances coexist, each with own duration and magnitude. Hooks may sum, max, or otherwise combine effects at query time.
- **STACK_ADDITIVE** — magnitudes add; durations resolved by rule (refresh, take max).
- **REJECT** — new instance rejected if existing present.

The stacking rule is consulted at application time, after resistance checks. Adding new rule kinds is a small engine change; the existing list covers ~95% of common cases.

## Tags

Status types carry tags used for category-based interactions:

- **Polarity:** positive, negative, neutral.
- **Class:** mental (Confuse, Charm, Berserk), physical (Poison, Stop), time (Haste, Slow, Stop, Quick), elemental (Burn, Freeze).
- **Removability:** dispellable, resistable, undispellable.

Abilities that "clear all negative statuses" or "dispel all time effects" query by tag. Resistance and immunity systems also operate at the tag level (e.g., "immune to mental statuses" rather than enumerating each).

## Hook system

The hook system is the extension surface through which statuses, equipped passive abilities, equipment effects, and class traits influence engine behavior.

A **hook** is a named extension point with a defined signature. The engine fires hooks at well-defined moments and collects results from all registered handlers.

### Initial hook list

These are sufficient for most designs we've discussed; new hooks are added as needs arise.

- `modifyStatQuery(unit, statName, baseValue) → modifiedValue` — for any computed stat (Speed, Move, Jump, PA, MA, capacities, accuracy, evasion, etc.).
- `onApply(unit, instance) → void` — when status applied; runs cleanup setup if any.
- `onRemove(unit, instance) → void` — when status removed.
- `onTick(unit, instance) → Action[]` — fired at duration ticks; can produce damage, healing, other effects as system actions.
- `onTurnStart(unit) → Action[]` — at the affected unit's turn start.
- `onTurnEnd(unit) → Action[]` — at the affected unit's turn end.
- `onDamageReceived(unit, damage) → modifiedDamage` — incoming damage modification.
- `onDamageDealt(unit, damage) → modifiedDamage` — outgoing damage modification.
- `onActionAttempted(unit, action) → ActionFilter` — can prevent or modify the unit's actions (e.g., Stop returns "blocked"; Berserk forces attack).
- `onActionTargeted(unit, incomingAction) → ActionFilter` — can intercept or react to incoming actions (Counter, Reflect).
- `onMoveStep(unit, fromTile, toTile) → MoveResult` — during pathfinding execution; can interrupt, redirect.

Each hook has a precise signature; handlers conform to it. The engine's reducer fires hooks at known points; nothing fires hooks ad hoc.

### Registration

Different sources register handlers in different ways:

- **Statuses** register their type's hooks when an instance is added to a unit; deregister on removal.
- **Equipped passive abilities** (R/S/M bucket abilities) register when equipped; deregister when unequipped.
- **Equipment** registers when worn.
- **Class traits** register when the unit is in that class.

The engine collects active handlers at hook fire time by querying all sources on the unit. (Implementation detail: an index keyed by `(unitId, hookName)` is built and maintained.)

### Ordering

Hook order matters when handlers modify in-flight values (e.g., damage modifiers compose differently if applied in different orders). Default order is by **source priority**, declared per-handler:

1. Equipment effects.
2. Class traits.
3. Equipped passive abilities.
4. Statuses, ordered by application time (earliest first).

Within a tier, deterministic by stable ID. Specific abilities or statuses can declare an explicit priority override if needed.

This is a v1 default; if status interactions get gnarly, we revisit.

### Why not just "events"?

Hooks are bidirectional — they take a context and may return a modified context. A pure event system (fire-and-forget) is insufficient for things like damage modification, action filtering, or stat queries. Hooks subsume events (a void-returning hook is an event) while supporting modification.

## Application pipeline

When an action attempts to apply a status, the pipeline runs:

1. **Resistance check** — does the target's resistance/immunity tags reject the status? Hits are stochastic for resistance; immunity is hard rejection.
2. **Stacking check** — does an instance of this type already exist? If yes, apply the stacking rule (which may reject, refresh, replace, or stack the new application).
3. **Instantiation** — create the StatusInstance with type ref, source, duration, magnitude.
4. **onApply hooks** — fire onApply hooks for the new instance.
5. **Side-effect actions** — any system actions resulting from application (e.g., the status type may declare an immediate first tick) are emitted.

The pipeline produces a status application *result* (applied / resisted / stacked / replaced / rejected) which becomes part of the originating action's outcome for log/replay.

## Removal

Statuses are removed in several ways:

- **Duration expiry** — when remaining duration reaches 0 (handled by the duration-mode-specific tick handler).
- **Conditional satisfaction** — the condition fires, status removed.
- **Dispel** — explicit removal action targeting by ID or tag.
- **Source loss** — for statuses configured to expire when source unit is KO'd or removed.
- **Cleanup on death** — KO'd unit may retain or lose statuses per status-type config.

Each removal path fires `onRemove` hooks before the instance is dropped from the unit.

## The Charging status

A Unit with an outstanding *Charged Action* has the *Charging* status applied. The reducer creates the status when committing a charged ability and removes it when the Charged Action resolves or is canceled.

```typescript
// Charging status, customState shape
{ chargedActionId: ChargedActionId }
```

This consolidation means:

- **Hook-based interactions** with charging units (perfect-hit attacks against Charging targets, abilities that "wake" charging units, etc.) use the standard status hook surface. No special casing.
- **Queue-based interactions** with the Charged Action itself (counterspells, hasten/slow charge) target the Charged Action entity in the CT projection queue.
- **The Charging status's duration** is conditional — tied to the Charged Action's resolution or cancellation, not a duration tick. The duration mode is `Conditional`.

See *ct-system.md* for the Charged Action entity and *action-resolution.md* for the reducer-level coordination.

## Relationship to passive abilities

Equipped passive abilities (Reaction, Support, Movement bucket abilities from the ability slot system) hook the same surface as statuses. A Counter reaction ability registers an `onActionTargeted` handler that fires when its owner is hit. A Move+1 support ability registers a `modifyStatQuery` handler that bumps the Move stat. Auto-Potion registers `onDamageReceived`.

The data is different (passives are equipped, statuses are applied) but the engine surface is the same. This is why the hook system is general and not "status hooks specifically."

Equipment effects work the same way: a sword that grants +20% damage registers an `onDamageDealt` handler while equipped.

## Interaction with the action log

- **Status application** is part of the originating action's outcome (the Slow spell's outcome includes "applied Slow status to target X with magnitude 0.7 for 4 turns").
- **Status ticks** are system actions in the log: `status_tick` actions referencing the instance, with their effects (damage dealt, healing applied) as outcome.
- **Status removal** is also a system action when it occurs outside an originating action context (duration expiry, conditional removal). Removal as part of an originating action (dispel) is captured in that action's outcome.

This keeps the log as a complete record while not double-recording effects that are clearly attributable to a parent action.

## Decisions captured

- StatusInstance/StatusEffectType split mirrors core types pattern.
- Per-status declared duration mode, stacking rule, magnitude semantics, tags.
- Per-unit CT is the v1 default duration mode; other modes available.
- Hook system is general infrastructure; statuses, passives, equipment, class traits all use it.
- Initial hook list is fixed; adding hooks is a deliberate engine change, not ad hoc.
- Hook ordering by source-tier priority, then deterministic ID; per-handler overrides allowed.
- Application pipeline: resistance → stacking → instantiate → onApply → side effects.
- Tags drive category-based interactions (clear, dispel, immunity).
- Status applications are outcomes on parent actions; ticks and external removals are system actions in the log.
- Passive abilities (R/S/M) are not statuses but share the hook surface.
- The Charging status couples the *Charged Action* entity in the CT queue to a status on the casting unit, applied/removed as part of the Charged Action lifecycle. Enables hook-based interactions with charging units alongside queue-based interactions with the Charged Action itself.

## Open questions / deferred

- **Specific status types and their magnitudes/durations.** Design work that follows.
- **Resistance/immunity stat shape on units.** Probably a tag-keyed map of per-tag resistance values and immunity flags. Specifics deferred.
- **Stacking rules for mixed sources.** If Haste from a spell (magnitude 1.5) coexists with Haste from a class trait (magnitude 1.2), do they share an instance with stacking rules, or are they architecturally separate (since one is a status and one is a class trait registering on the same hook)? Lean toward "different sources don't stack as same status; they both register hooks and the hook system composes their effects" — but worth confirming with a concrete example when we get to specific designs.
- **Hidden statuses (asymmetric information).** Some game designs include statuses where the affected player doesn't know they're applied. Out of scope for v1, easy to add as a visibility flag later.
- **Status durations and the upcoming-turns UI.** Whether and how status durations appear in the projection view is a UI question; data is available.
- **Performance with many active statuses.** Hook handler dispatch should be efficient even with N statuses across M units; specific indexing strategies are implementation, not architecture.
