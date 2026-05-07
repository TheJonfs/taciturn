# Action Resolution

*Design document — v0.2*

## Purpose

This document defines the lifecycle of an *Action* — from proposal through validation, resolution, hook firing, outcome computation, and commitment to the *Action Log*. It also defines the damage pipeline (a special case of resolution worth its own structure) and the cross-unit hook ordering that earlier docs deferred.

This is the busiest doc. It pulls together threads from CT, ability slots, map-and-battlefield, and status effects into a single coherent execution model.

## Action lifecycle

Every action — player or system — follows the same lifecycle:

1. **Propose.** Either a player commits a choice (Move to tile X, Use Ability Y on target Z) or the engine generates a system action (turn_start fires when a unit's CT reaches the trigger threshold).
2. **Validate.** A pure function `validateAction(state, action) → ValidationResult` checks legality. Invalid actions are rejected before any state change.
3. **Assign seed.** The action is given its sequence number (monotonic) and its per-action seed is derived from `(masterSeed, sequenceNumber)`.
4. **Pre-resolution hooks.** Hooks that can prevent or modify the action fire (`onActionAttempted` on the actor; e.g., Stop blocks, Berserk forces an attack).
5. **Resolve via reducer.** The reducer applies the action to state and produces an outcome. The outcome includes all randomized determinations (damage rolled, hit/miss, status applications) and any system actions generated as side effects.
6. **Resolution hooks.** During resolution, well-defined hook points fire (`onDamageDealt`, `onDamageReceived`, `onActionTargeted`). Each may generate further actions.
7. **Commit to log.** The action and its outcome are appended to the *Action Log*. New actions generated during resolution enter the action chain (see below).
8. **Process chain.** Any newly-generated actions go through the same lifecycle. The chain processes until empty.

The reducer is pure: `(state, action, seed) → (newState, outcome, generatedActions)`. Replays read the outcome from the log rather than re-rolling.

## Validation

Validation answers "is this action legal *as the next action* given current state?" It runs in two layers:

### Universal invariants

Hardcoded rules that maintain world consistency. Not overridable by abilities or statuses; if an effect needs to bypass one of these, that effect's design should be reconsidered or the rule moved to the contextual layer.

- Actor exists in state.
- Actor is not KO'd (unless action type explicitly works on KO'd units, e.g., Raise).
- Targets exist (units exist; tiles are within map bounds).
- Resources cannot go negative (MP, charges).
- Targets satisfy the ability's *Targeting Mode* and *Range* constraints.

### Contextual rules

Rules that can be modified by abilities, statuses, equipment, or class traits. Two mechanisms cover this:

**Per-turn budgets.** A unit's turn carries a `TurnBudget` consumed by actions. Default budget is `{ movesAvailable: 1, actsAvailable: 1 }`. Validation for turn-state legality checks the budget rather than checking against a rigid rulebook. The reducer decrements budgets as actions commit. Abilities and statuses modify budgets directly: a Support ability granting "+1 Move per turn" raises `movesAvailable` at turn start; a one-shot ability that grants an extra Move modifies the budget mid-turn. New action types simply declare which budget they consume.

This decouples "what a turn permits" from "how many of each action a turn allows," and means new action-economy mechanics (multi-strike abilities, sustained actions, etc.) extend the budget vocabulary without touching the validator.

**Pre-resolution hooks.** The `onActionAttempted` hook fires before resolution and can block or modify the action. Used for situational effects: Stop blocks all actions; Berserk forces an attack; Silence blocks magical actions; Don't Move blocks Move specifically. These are runtime modifications rather than budget changes.

Wait sets remaining budgets to 0, naturally ending the turn. Reactions (Counter, etc.) operate outside their unit's turn budget — they happen during another unit's turn and consume from a separate per-unit-per-turn reaction limit (see chain termination).

### API

```typescript
interface ValidationResult {
  valid: boolean;
  reason?: string;       // human-readable, for UI feedback
  blockingHooks?: HookResult[];  // if a hook returned blocked
}
```

Validation is pure (reads state, returns result; no side effects, no RNG) and exposed as a separate API so UI can preview legality (greying out invalid options) without proposing actions to the engine.

## RNG model (detail)

Already introduced in core types; expanding here:

**Per-action seed derivation.** `seed = hash(masterSeed, sequenceNumber)`. Stable, reproducible, independent across actions.

**Resolution as pure function.** `resolve(state, action, seed) → outcome`. Same inputs, same outcome, always. This means resolution can be re-run for verification, AI search, or debugging without affecting reality.

**Outcome is the source of truth.** Once an action is resolved and its outcome stored, the outcome is read on replay rather than re-derived. This insulates the log from any future changes to resolution code: a battle replayed with a different ruleset version still shows what *actually happened* the first time.

**Random determinations within an action.** A single action may need multiple random determinations (an AoE that hits 4 units rolls hit/damage 4 times). The pattern is:
- Action's seed seeds a deterministic stream-within-action.
- Sub-determinations draw from this stream in a defined order (e.g., targets sorted by stable ID, then per-target hit roll, then damage roll).
- Order is documented so resolution is reproducible.

## The reducer

The reducer is the single function that produces a new GameState from an action:

```typescript
function reducer(
  state: GameState,
  action: Action,
  seed: number
): { newState: GameState; outcome: ActionOutcome; generatedActions: Action[] }
```

Branches by `action.type`. Each branch is a focused function (`reduceMove`, `reduceUseAbility`, etc.) that knows that action type's specific resolution.

Implementation note: the reducer should produce the new state via structural updates to the immutable state tree. Tools like Immer let this be written ergonomically without sacrificing immutability.

The reducer does NOT directly modify the action log — that's the caller's responsibility. The reducer returns the outcome and any generated actions; the caller (action processing loop) commits them to the log.

## Outcome shape

Each action type defines its outcome shape. Common pattern:

```typescript
type ActionOutcome =
  | { kind: 'move'; pathTaken: Position[]; finalPosition: Position }
  | { kind: 'use_ability'; perTargetResults: AbilityTargetResult[]; mpSpent: number; ... }
  | { kind: 'wait'; ctRecovered: number }
  | { kind: 'set_facing'; from: Direction; to: Direction }
  | { kind: 'turn_start'; unitId: UnitId }
  | { kind: 'turn_end'; unitId: UnitId }
  | { kind: 'charged_action_resolve'; ... }
  | { kind: 'status_tick'; instanceId: ...; effectsApplied: ... }
  | ...

interface AbilityTargetResult {
  targetId: UnitId | TileRef;
  hit: boolean;
  damage?: number;
  healing?: number;
  statusesApplied?: StatusApplicationResult[];
  reactionsTriggered?: ActionRef[];   // pointers to reaction actions in the chain
  // ...
}
```

Outcomes are dense — they record *what happened* to enough resolution that any replay or analysis can reconstruct the moment.

## Cross-unit hook ordering

When an action involves multiple units, hooks fire on each unit in a defined order. For an attack from A on B:

1. **Pre-resolution.** A's `onActionAttempted` (can A act at all? does A's action change?).
2. **Resolution begins.** Reducer starts processing the action.
3. **Damage pipeline** runs (see next section). Within the pipeline:
   - A's `onDamageDealt` hooks fire (offensive modifiers, source-side damage shaping).
   - B's `onDamageReceived` hooks fire (defensive modifiers, target-side damage shaping).
4. **Damage applied** to B. State updated.
5. **Post-application hooks.** B's `onActionTargeted` fires (Counter, Reflect, Auto-Potion). Generated reactions enter the action chain.
6. **Resolution completes.** Outcome captured.

For AoE actions hitting multiple targets, steps 3–5 occur per target, in target order (by stable ID for determinism). Each target's hooks fire independently; reactions may differ per target.

For multi-step abilities (e.g., a chain attack that hits a primary then jumps to a secondary), each strike runs the full sub-pipeline before moving to the next target.

## Reactions and the action chain

Hooks may generate further actions (Counter, Auto-Potion, on-hit triggers). These enter the **action chain** as new actions with a `parentActionSeq` reference back to the action that caused them. They are processed FIFO after the parent action's resolution completes.

```typescript
interface Action {
  // ... earlier fields
  parentActionSeq?: number;   // set if this action was generated by another's resolution
  chainDepth: number;          // 0 for player/system root actions; +1 per chain step
}
```

**Chain termination.** Without rules, reactions could chain indefinitely (A counters, B counters the counter, etc.). v1 rules:

- **Type-based suppression.** A reaction action is flagged `isReaction: true`. Reactions cannot themselves trigger reactions of the same kind. (Counter triggered by an attack does not itself trigger Counter on the original attacker.)
- **Per-unit per-turn cap.** Each unit can react at most N times per turn (default N=1, parameterizable per ability or per unit).
- **Hard chain depth cap.** Chains exceeding depth K (default 8) terminate, with the engine emitting a `chain_truncated` system event for visibility. This is a safety rail; type-based and per-unit rules should make it unnecessary in practice.

## Damage pipeline

Damage computation is a sequence of well-defined stages. A `DamageContext` flows through:

```typescript
interface DamageContext {
  attacker: Unit;
  target: Unit;
  sourceAction: Action;
  sourceAbility: AbilityDefinition;
  damageTags: DamageTag[];     // physical, magical, elemental, holy, dark, etc.

  baseDamage: number;          // computed at first stage
  multipliers: Multiplier[];    // applied multiplicatively at finalize
  additives: Additive[];        // applied additively at finalize
  variance: { min: number; max: number };  // before variance roll

  finalDamage?: number;        // populated at last stage
}
```

### Stages

1. **base.** Compute baseline from ability formula. v1 default ability formulas are FFT-flavored:
   - Physical: `PA × WP` (with weapon-type variance).
   - Magical: `MA × spellMultiplier` (with optional squaring for some spells).
   Ability-specific formulas override; this is data, not engine.
2. **attacker.** Hooks on the attacker fire (`onDamageDealt`). Equipped offensive bonuses, status buffs (Strength Up), class traits.
3. **target.** Hooks on the target fire (`onDamageReceived`). Defenses (Shell, Protect), elemental resistances, terrain cover.
4. **environment.** Tile properties, *Elevation* differential modifiers, weather. Also fires hooks but tagged for environmental context.
5. **variance.** Random roll within the variance band, drawn from action seed.
6. **cap.** Apply minimum (typically 0 or 1) and maximum (per-unit max-HP-style caps if relevant) bounds.
7. **finalize.** `finalDamage` is set. Damage applied to target.

Each stage allows hook handlers to read the context and contribute multipliers, additives, or replacements. The pipeline order is fixed; ordering within a stage follows the standard hook ordering (Equipment → Class → Passive → Statuses).

### Healing

Healing follows the same pipeline structure with sign flipped — `onHealingDealt`, `onHealingReceived`, target's max HP cap. Worth modeling as the same pipeline with a tag (`damageTags: ['healing']`) rather than a parallel system, so that effects like "your healing is reduced when poisoned" are one hook handler rather than duplicated logic.

### Status application

Statuses applied by an action go through the *Status Effect Application Pipeline* (defined in status-effects.md): resistance check → stacking check → instantiate → onApply hooks → side effects. This runs after damage application (so a unit dying to the damage doesn't get the statuses applied; a unit surviving does).

## Specific action types

### Move

Payload: target position. Outcome: actual path taken, final position. Resolution: validate via move engine, walk the path applying tile triggers per step (hazards, traps, forced movement), set final position, fire any hooks.

### UseAbility

Payload: command set, ability id, target spec (single tile, multiple tiles for multi-target abilities). Outcome: per-target results. Resolution: validate, deduct resources, apply pre-action effects (charging if non-zero charge time), or run damage/effect pipeline if instant.

For abilities with non-zero charge time, the UseAbility action's resolution applies the *Charging* status to the caster and adds a *Charged Action* to the projection queue. The actual effect resolution happens later when the charged action triggers (a `charged_action_resolve` system action).

### Wait

Payload: none. Outcome: CT recovered above the standard partial-turn amount. Resolution: end turn, recover CT per ruleset.

### Set Facing

Payload: new direction. Outcome: previous and new direction. Resolution: trivial state update. Typically the last sub-step of a turn, before turn_end.

### turn_start, turn_end (system)

Fire `onTurnStart` / `onTurnEnd` hooks (statuses, passives). Tick per-unit-CT-mode statuses. Apply regen-style effects. Check end-of-turn conditions.

### charged_action_resolve (system)

Fired when a *Charged Action* in the projection queue reaches the trigger threshold. Resolves the held effect (the spell or ability that was charging). Removes the *Charging* status from the caster. Outcome includes the resolved effect's results. Generates appropriate hook calls.

### status_tick (system)

Fired for each status instance whose duration ticks at the current event. Decrements duration, fires `onTick` hooks (poison damage, regen healing). May remove the instance if duration expires.

## Charged Actions and the Charging status

The integration between the *Charged Action* entity in the CT projection queue and the *Charging* status on the casting unit:

- When a `use_ability` action is committed for an ability with non-zero charge time, the reducer:
  - Creates a *Charged Action* entity in the GameState's `chargedActions` list, with the caster's reference, target spec, and Action Speed.
  - Applies a *Charging* status to the caster, with `customState: { chargedActionId: ... }`.
- When a Charged Action resolves (or is canceled), the reducer:
  - Removes the corresponding Charging status from the caster.
  - Removes the Charged Action from the list.
- Abilities that target Charged Actions (counterspells, hasten/slow charge) target the Charged Action entity by ID. Abilities that target charging units (perfect-hit-on-Charging) hook the Charging status.

This keeps the two systems coordinated through a single reducer step.

## Decisions captured

- Action lifecycle has 8 stages: propose → validate → seed → pre-hooks → reduce → resolution-hooks → commit → process-chain.
- Validation runs in two layers: universal invariants (hardcoded, not overridable) and contextual rules (modifiable by budgets and hooks).
- Per-turn budgets (movesAvailable, actsAvailable, etc.) replace rigid turn-state rules. Abilities and statuses modify budgets directly to grant additional actions.
- Validation is pure and exposed as separate API for UI preview.
- Per-action seeds; resolution is pure given (state, action, seed); outcomes are stored on the log for replay.
- Reducer branches by action type; each type has its own reducer function and outcome shape.
- Cross-unit hook order: A's pre-action → A's onDamageDealt → B's onDamageReceived → damage applied → B's onActionTargeted (reactions).
- AoE: hook ordering applies per target, in stable ID order.
- Reactions are separate Actions with parent reference, processed in chain order after parent resolves.
- Chain termination: type-based suppression (reactions don't trigger same reactions), per-unit-per-turn cap, hard depth cap as safety net.
- Damage pipeline has 7 stages: base → attacker → target → environment → variance → cap → finalize.
- Healing uses the same pipeline with damage tags inverted.
- Status application runs after damage application within the same parent action's resolution.
- Charged Actions and the Charging status are coordinated in the same reducer step (apply on commit, remove on resolve/cancel).

## Open questions / deferred

- **Specific damage formulas per ability.** v1 default is FFT-flavored (PA×WP, MA×Mult), but per-ability formulas are data and need to be specified when we build the ability catalog.
- ~~**MP cost system.**~~ Resolved per BMG ("MP system") and ADR-0023: deduct on commit, no refund on fizzle.
- ~~**Cancellation of charged actions.**~~ Resolved by ADR-0023: caster KO and `onActionAttempted` block both fizzle silently with full cleanup (ChargedAction removed, Charging status removed). No dedicated `onChargeInterrupted` hook — `onActionAttempted` reused. MP not refunded.
- **AoE friendly fire.** Default — does an AoE hit allies in its footprint? FFT yes (and this was a major tactical consideration). Lean toward yes for v1 with per-ability override.
- **Critical hits and other special damage outcomes.** Where in the pipeline? Likely a multiplier added at the variance stage based on a separate roll.
- **Status applications that affect resolution mid-pipeline.** A status that says "next attack against me automatically misses" — when does it fire to prevent damage? Currently positioned at target stage; should review with concrete examples.
- **Action history limits.** For long battles, the action log can grow large. For replay we want it complete; for memory we may want compaction. Defer; not v1 concern.
- **Out-of-order action arrival in online play.** When we do online, players' commits may arrive at different times relative to system actions. The deterministic per-action seed model should handle this, but the application order needs to be authoritatively decided (likely by the server in client/server architecture). Defer.
- **Animation and pacing.** The action log produces a stream of resolved events; the renderer needs to pace them visually. This is a renderer concern but worth flagging that the action log structure supports it (each action has a timestamp; renderer can interpolate).
