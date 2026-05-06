// Per-action-kind reducer branches.
// See docs/design/action-resolution.md ("The reducer", "Specific action
// types") and ADR-0009.
//
// Each branch is a pure function: `(state, action, catalog) → ReduceResult`.
// The dispatcher in `reduce.ts` narrows by `action.type` and calls the
// matching branch. State updates are structural (Immer-style spread of
// the units Map plus the touched fields); no in-place mutation.
//
// Generated actions enter the action chain via the `commitAction`
// wrapper — branches return them by reference; they are *not* applied
// here.

import type { Catalog } from '../catalog/index.ts';
import { defaultDamageHandlers } from '../damage/default-handlers.ts';
import { runDamagePipeline } from '../damage/pipeline.ts';
import { runOnActionTargeted } from '../hooks/runners.ts';
import { runQueryTurnSkipped } from '../hooks/runners.ts';
import { getLegalMoves, positionKey } from '../map/pathfinding.ts';
import { applyStatus } from '../status/apply.ts';
import { evaluateBattleOutcome } from '../turn/evaluate-battle-outcome.ts';
import {
  getUnit,
  type Action,
  type AbilityTarget,
  type AbilityTargetResult,
  type BattleEndOutcome,
  type ChargedAction,
  type ChargedActionResolveOutcome,
  type DamageContext,
  type Direction,
  type GameState,
  type MoveOutcome,
  type Position,
  type ProposedAction,
  type SetFacingOutcome,
  type StatusApplicationOutcome,
  type StatusInstance,
  type StatusTickOutcome,
  type TurnEndOutcome,
  type TurnStartOutcome,
  type Unit,
  type UnitId,
  type UseAbilityOutcome,
  type WaitOutcome,
} from '../types/index.ts';
import { expectActiveAbility } from './validate.ts';

export interface ReduceResult<O> {
  readonly newState: GameState;
  readonly outcome: O;
  readonly generatedActions: ReadonlyArray<ProposedAction>;
  // Reactions emitted by this reducer. Same shape as `generatedActions`
  // but `commitAction` enqueues them with `isReaction: true` so they
  // count against the per-unit-per-turn reaction cap. Today only the
  // damage-bearing UseAbility branch produces these (Counter et al. via
  // onActionTargeted); reducers that don't emit reactions simply omit
  // the field. See docs/design/action-resolution.md ("Reactions and
  // the action chain").
  readonly generatedReactions?: ReadonlyArray<ProposedAction>;
}

// --- Helpers ---

// Replace one unit in the state with an updated copy. Returns a fresh
// GameState whose `units` Map has the new entry. Other fields untouched.
function withUnit(state: GameState, unit: Unit): GameState {
  const units = new Map(state.units);
  units.set(unit.id, unit);
  return { ...state, units };
}

// Direction inferred from a single step (a → b on adjacent tiles). When
// the step is non-adjacent or zero-distance, returns the unit's existing
// facing — sensible no-op for path[0] = path[0] cases.
function inferFacing(from: Position, to: Position, fallback: Direction): Direction {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (dx === 1 && dy === 0) return 'E';
  if (dx === -1 && dy === 0) return 'W';
  if (dx === 0 && dy === 1) return 'S';
  if (dx === 0 && dy === -1) return 'N';
  return fallback;
}

// --- Move ---

export function reduceMove(
  state: GameState,
  action: Extract<Action, { type: 'move' }>,
  catalog: Catalog,
): ReduceResult<MoveOutcome> {
  if (action.actorId === undefined) {
    throw new Error('reduceMove: action has no actorId');
  }
  if (state.turnState === null) {
    throw new Error('reduceMove: no turn in progress');
  }
  const actor = getUnit(state, action.actorId);
  const dest = action.payload.destination;

  const moves = getLegalMoves(state, actor.id, catalog);
  const path = moves.reachable.get(positionKey(dest));
  if (path === undefined) {
    throw new Error(
      `reduceMove: destination (${dest.x},${dest.y},${dest.layer}) is not reachable — validation should have caught this`,
    );
  }

  // Final facing: from the last step. If path is single-tile (no move),
  // facing is unchanged.
  let facingAfter: Direction = actor.facing;
  if (path.path.length >= 2) {
    const last = path.path[path.path.length - 1]!;
    const prev = path.path[path.path.length - 2]!;
    facingAfter = inferFacing(prev, last, actor.facing);
  }

  const newActor: Unit = {
    ...actor,
    position: { x: dest.x, y: dest.y, layer: dest.layer },
    facing: facingAfter,
  };

  // Decrement movesAvailable; bump consumed counter.
  const newTurn = {
    ...state.turnState,
    budget: {
      ...state.turnState.budget,
      movesAvailable: state.turnState.budget.movesAvailable - 1,
    },
    consumed: {
      ...state.turnState.consumed,
      movesConsumed: state.turnState.consumed.movesConsumed + 1,
    },
  };

  const newState: GameState = {
    ...withUnit(state, newActor),
    turnState: newTurn,
  };

  const outcome: MoveOutcome = {
    kind: 'move',
    pathTaken: path.path,
    finalPosition: dest,
    facingAfter,
  };
  return { newState, outcome, generatedActions: [] };
}

// --- Wait ---

export function reduceWait(
  state: GameState,
  action: Extract<Action, { type: 'wait' }>,
): ReduceResult<WaitOutcome> {
  if (action.actorId === undefined) throw new Error('reduceWait: action has no actorId');
  if (state.turnState === null) throw new Error('reduceWait: no turn in progress');

  const newTurn = {
    ...state.turnState,
    budget: { movesAvailable: 0, actsAvailable: 0 },
    consumed: { ...state.turnState.consumed, waited: true },
  };

  const newState: GameState = { ...state, turnState: newTurn };
  return { newState, outcome: { kind: 'wait' }, generatedActions: [] };
}

// --- SetFacing ---

export function reduceSetFacing(
  state: GameState,
  action: Extract<Action, { type: 'set_facing' }>,
): ReduceResult<SetFacingOutcome> {
  if (action.actorId === undefined) throw new Error('reduceSetFacing: action has no actorId');
  const actor = getUnit(state, action.actorId);
  const from = actor.facing;
  const to = action.payload.facing;
  const newActor: Unit = { ...actor, facing: to };
  return {
    newState: withUnit(state, newActor),
    outcome: { kind: 'set_facing', from, to },
    generatedActions: [],
  };
}

// --- UseAbility ---

export function reduceUseAbility(
  state: GameState,
  action: Extract<Action, { type: 'use_ability' }>,
  catalog: Catalog,
): ReduceResult<UseAbilityOutcome> {
  if (action.actorId === undefined) {
    throw new Error('reduceUseAbility: action has no actorId');
  }
  if (state.turnState === null) {
    throw new Error('reduceUseAbility: no turn in progress');
  }

  const ability = expectActiveAbility(catalog, action.payload.abilityId);
  const actor = getUnit(state, action.actorId);

  // Action Speed gate: actionSpeed > 0 spawns a ChargedAction with
  // `ct: 0, speed: actionSpeed` and applies the Charging status. Effect
  // resolution happens later when the charged action triggers
  // (charged_action_resolve). Session 7 ships the actionSpeed: 0 path
  // and the actionSpeed > 0 hookup arrives in session 15 when the
  // first content consumer ships.
  if (ability.actionSpeed > 0) {
    throw new Error(
      `reduceUseAbility: actionSpeed > 0 not implemented yet (ability ${JSON.stringify(ability.id)})`,
    );
  }

  // Deduct MP.
  let workingState: GameState = withUnit(state, {
    ...actor,
    vitals: { ...actor.vitals, mp: actor.vitals.mp - ability.mpCost },
  });

  // Resolve the primary target unit (if any).
  const targetUnit = resolveUnitTarget(workingState, action.payload.target);

  // Damage / healing pipeline. Runs before status application so a unit
  // that dies to the damage doesn't get the statuses (per the design's
  // "Status application runs after damage application" rule). v1 only
  // runs the pipeline when the ability declares damage *and* has a unit
  // target — self-target healing lands when its content consumer ships.
  let damageContext: DamageContext | null = null;
  let damageDealt: number | undefined;
  let healingDealt: number | undefined;
  if (ability.effects.damage !== undefined && targetUnit !== null) {
    damageContext = runDamagePipeline({
      state: workingState,
      catalog,
      attacker: actor,
      target: targetUnit,
      ability,
      sourceActionSeq: action.sequenceNumber,
      seed: action.seed,
      registry: defaultDamageHandlers,
    });
    workingState = applyDamageToTarget(workingState, damageContext);
    if (damageContext.damageTags.has('healing')) {
      healingDealt = damageContext.finalDamage ?? 0;
    } else {
      damageDealt = damageContext.finalDamage ?? 0;
    }
  }

  // Apply status effects (the v1 effect path). Skipped if damage KO'd
  // the target — the post-damage HP read gates the status path.
  const targetKO =
    targetUnit !== null && workingState.units.get(targetUnit.id)?.vitals.hp === 0;
  const statusOutcomes: StatusApplicationOutcome[] = [];

  if (ability.effects.statusEffects && !targetKO) {
    for (const spec of ability.effects.statusEffects) {
      const targetStatusUnitId = spec.target === 'caster'
        ? actor.id
        : targetUnit !== null
          ? targetUnit.id
          : null;
      if (targetStatusUnitId === null) {
        // Spec wants a primary_target but the action is self-targeted —
        // author bug; surface it.
        throw new Error(
          `reduceUseAbility: status effect ${JSON.stringify(spec.typeId)} targets primary_target but ability ${JSON.stringify(ability.id)} has no unit target`,
        );
      }
      const applied = applyStatus(
        workingState,
        {
          targetId: targetStatusUnitId,
          typeId: spec.typeId,
          sourceUnitId: actor.id,
          sourceActionSeq: action.sequenceNumber,
          ...(spec.magnitude !== undefined ? { magnitude: spec.magnitude } : {}),
          ...(spec.duration !== undefined ? { duration: spec.duration } : {}),
          ...(spec.customState !== undefined ? { customState: spec.customState } : {}),
        },
        catalog,
      );
      workingState = applied.newState;
      statusOutcomes.push(applied.result);
    }
  }

  // Decrement actsAvailable; bump consumed.
  const turn = workingState.turnState;
  if (turn === null) throw new Error('reduceUseAbility: turnState was null mid-flight');
  const newTurn = {
    ...turn,
    budget: { ...turn.budget, actsAvailable: turn.budget.actsAvailable - 1 },
    consumed: { ...turn.consumed, actsConsumed: turn.consumed.actsConsumed + 1 },
  };
  workingState = { ...workingState, turnState: newTurn };

  // Post-application reactions: fire onActionTargeted on the *target*'s
  // hooks (Counter, Reflect, Auto-Potion). Only applies when there's a
  // unit target. The runner is enriched with the final damage amount
  // and tag set so reaction handlers can gate without a catalog lookup.
  const reactions: ProposedAction[] = [];
  if (targetUnit !== null && damageContext !== null) {
    const postTarget = workingState.units.get(targetUnit.id) ?? targetUnit;
    const targetedReactions = runOnActionTargeted(workingState, catalog, {
      unit: postTarget,
      incomingAction: {
        type: 'use_ability',
        source: action.source,
        actorId: actor.id,
        payload: action.payload,
      },
      damageDealt: damageContext.damageTags.has('healing')
        ? -(damageContext.finalDamage ?? 0)
        : damageContext.finalDamage ?? 0,
      damageTags: damageContext.damageTags,
    });
    for (const r of targetedReactions) reactions.push(r);
  }

  const finalResult: AbilityTargetResult = {
    target: action.payload.target,
    hit: damageContext !== null ? damageContext.hit : true,
    ...(damageDealt !== undefined ? { damage: damageDealt } : {}),
    ...(healingDealt !== undefined ? { healing: healingDealt } : {}),
    ...(statusOutcomes.length > 0 ? { statusesApplied: statusOutcomes } : {}),
  };

  const outcome: UseAbilityOutcome = {
    kind: 'use_ability',
    abilityId: ability.id,
    perTargetResults: [finalResult],
    mpSpent: ability.mpCost,
  };

  return {
    newState: workingState,
    outcome,
    generatedActions: [],
    ...(reactions.length > 0 ? { generatedReactions: reactions } : {}),
  };
}

// Resolve a unit ref for an UseAbility's target. `self` returns null so
// callers can branch — `self` actions don't drive the damage pipeline
// or onActionTargeted reactions in v1.
function resolveUnitTarget(state: GameState, target: AbilityTarget): Unit | null {
  if (target.kind === 'self') return null;
  return getUnit(state, target.unitId);
}

// Apply finalDamage to the target's vitals. Damage lowers HP (floor 0
// already enforced by the cap stage); healing raises HP (max-HP cap
// already enforced by the cap stage).
function applyDamageToTarget(state: GameState, ctx: DamageContext): GameState {
  if (!ctx.hit) return state;
  const finalDamage = ctx.finalDamage ?? 0;
  if (finalDamage === 0) return state;
  const currentTarget = state.units.get(ctx.target.id);
  if (currentTarget === undefined) return state;
  const isHealing = ctx.damageTags.has('healing');
  const nextHp = isHealing
    ? currentTarget.vitals.hp + finalDamage
    : Math.max(0, currentTarget.vitals.hp - finalDamage);
  const updated: Unit = {
    ...currentTarget,
    vitals: { ...currentTarget.vitals, hp: nextHp },
  };
  return withUnit(state, updated);
}

// --- turn_start ---

export function reduceTurnStart(
  state: GameState,
  action: Extract<Action, { type: 'turn_start' }>,
  catalog: Catalog,
): ReduceResult<TurnStartOutcome> {
  const unitId = action.payload.unitId;
  // The actor must exist; it's the engine's contract that turn_start is
  // only emitted when the projection queue lifts a unit.
  const unit = getUnit(state, unitId);
  if (state.turnState !== null) {
    throw new Error(
      `reduceTurnStart: a turn is already in progress for ${JSON.stringify(state.turnState.unitId)}`,
    );
  }

  const ruleset = catalog.getRuleset(state.ruleset.id);

  // Turn-skip query: if any active hook (status, passive, equipment,
  // class trait) decides this unit can't act this turn, set up a
  // minimal turnState (so turn_end has the structure to read), record
  // the skip on the outcome, and emit a turn_end as a generated
  // action. No status_tick fan-out — the unit's per-unit-CT statuses
  // skip their tick this turn (Stop's design intent). The skip status
  // itself ticks via its own duration mode (turn-based or per-unit-CT
  // — author's call); a Stop with `turn_based` duration would expire
  // on the (skipped) turn's end.
  const skip = runQueryTurnSkipped(state, catalog, { unit });

  const newTurn = {
    unitId,
    budget: skip !== null ? { movesAvailable: 0, actsAvailable: 0 } : { ...ruleset.defaultTurnBudget },
    consumed: { movesConsumed: 0, actsConsumed: 0, waited: false },
    reactionsUsedThisTurn: new Map<UnitId, number>(),
  };

  if (skip !== null) {
    const turnEnd: ProposedAction = {
      type: 'turn_end',
      source: 'system',
      payload: { unitId },
    };
    return {
      newState: { ...state, turnState: newTurn },
      outcome: { kind: 'turn_start', unitId, skipped: true, skipReason: skip.reason },
      generatedActions: [turnEnd],
    };
  }

  // Generate status_tick actions for per-unit-CT-mode statuses on this
  // unit. The chain processor runs them after this action commits.
  const generated: ProposedAction[] = [];
  for (const status of unit.statuses) {
    const type = catalog.getStatusType(status.typeId);
    if (type.durationMode === 'per_unit_ct') {
      generated.push({
        type: 'status_tick',
        source: 'system',
        payload: { unitId, statusTypeId: status.typeId },
      });
    }
  }

  const newState: GameState = { ...state, turnState: newTurn };
  return {
    newState,
    outcome: { kind: 'turn_start', unitId, skipped: false },
    generatedActions: generated,
  };
}

// --- turn_end ---

export function reduceTurnEnd(
  state: GameState,
  action: Extract<Action, { type: 'turn_end' }>,
  catalog: Catalog,
): ReduceResult<TurnEndOutcome> {
  const unitId = action.payload.unitId;
  const unit = getUnit(state, unitId);
  if (state.turnState === null) {
    throw new Error('reduceTurnEnd: no turn in progress');
  }
  if (state.turnState.unitId !== unitId) {
    throw new Error(
      `reduceTurnEnd: turn_end for ${JSON.stringify(unitId)} but active turn is ${JSON.stringify(state.turnState.unitId)}`,
    );
  }

  // Determine CT cost based on what was consumed.
  const ruleset = catalog.getRuleset(state.ruleset.id);
  const consumed = state.turnState.consumed;
  let ctCost: number;
  if (consumed.waited) ctCost = ruleset.ctCosts.wait;
  else if (consumed.movesConsumed > 0 && consumed.actsConsumed > 0) ctCost = ruleset.ctCosts.moveAndAct;
  else if (consumed.actsConsumed > 0) ctCost = ruleset.ctCosts.actOnly;
  else if (consumed.movesConsumed > 0) ctCost = ruleset.ctCosts.moveOnly;
  else ctCost = ruleset.ctCosts.wait; // nothing consumed → equivalent to wait

  // Subtract from actual CT, floor at 0 — same shape as projection.
  const newCT = Math.max(0, unit.ct - ctCost);
  const newUnit: Unit = { ...unit, ct: newCT };

  // Generate status_tick for turn-based statuses on this unit (their
  // duration ticks at turn end per turn-structure.md). Per-unit-CT
  // statuses have already ticked at turn_start.
  const generated: ProposedAction[] = [];
  for (const status of unit.statuses) {
    const type = catalog.getStatusType(status.typeId);
    if (type.durationMode === 'turn_based') {
      generated.push({
        type: 'status_tick',
        source: 'system',
        payload: { unitId, statusTypeId: status.typeId },
      });
    }
  }

  const newState: GameState = {
    ...withUnit(state, newUnit),
    turnState: null,
  };

  // Battle-outcome evaluation. Per turn-structure.md, turn_end is the
  // standard checkpoint. When a condition fires, emit a `battle_end`
  // action — the chain processor commits it next, sets state.outcome,
  // and refuses further commits. Generated `status_tick` for turn-based
  // statuses runs *first* (FIFO), but the design says the duration
  // decrement is part of turn_end's resolution; in practice the chain
  // order is status_tick → battle_end, which means a Poison-tick KO at
  // the end of the unit's own turn correctly triggers battle_end on
  // the same turn boundary.
  const evaluated = evaluateBattleOutcome(newState);
  if (evaluated.kind === 'decided') {
    generated.push({
      type: 'battle_end',
      source: 'system',
      payload: {
        winner: evaluated.decided.winner,
        conditionIndex: evaluated.decided.conditionIndex,
      },
    });
  }

  return {
    newState,
    outcome: { kind: 'turn_end', unitId, ctSpent: ctCost },
    generatedActions: generated,
  };
}

// --- battle_end ---

export function reduceBattleEnd(
  state: GameState,
  action: Extract<Action, { type: 'battle_end' }>,
): ReduceResult<BattleEndOutcome> {
  if (state.outcome !== undefined) {
    // Defensive: a second battle_end shouldn't happen — commitAction
    // refuses commits past the first — but if it does, the outcome
    // already on state wins.
    return {
      newState: state,
      outcome: {
        kind: 'battle_end',
        winner: state.outcome.winner,
        conditionIndex: state.outcome.conditionIndex,
        description: state.outcome.description,
      },
      generatedActions: [],
    };
  }

  const condIndex = action.payload.conditionIndex;
  const cond = state.victoryConditions[condIndex];
  if (cond === undefined) {
    throw new Error(
      `reduceBattleEnd: payload.conditionIndex ${condIndex} is out of range (state has ${state.victoryConditions.length} conditions)`,
    );
  }
  const decided = {
    winner: action.payload.winner,
    conditionIndex: condIndex,
    description: cond.description,
  };
  const newState: GameState = {
    ...state,
    outcome: decided,
    // Clear any stray turn state — battle ends mid-chain after turn_end
    // already nulled turnState, but a victory condition that fires from
    // a non-turn-end checkpoint (future) would land on this guard.
    turnState: null,
  };
  return {
    newState,
    outcome: {
      kind: 'battle_end',
      winner: decided.winner,
      conditionIndex: decided.conditionIndex,
      description: decided.description,
    },
    generatedActions: [],
  };
}

// --- status_tick ---

export function reduceStatusTick(
  state: GameState,
  action: Extract<Action, { type: 'status_tick' }>,
  _catalog: Catalog,
): ReduceResult<StatusTickOutcome> {
  const { unitId, statusTypeId } = action.payload;
  const unit = getUnit(state, unitId);

  // Find the (first) instance of this type on the unit. Multiple
  // STACK_INDEPENDENT instances all tick — but session 7 ticks one per
  // emitted action. turn_start emits as many actions as instances, so
  // this is fine. (Each emission decrements one slot.)
  const idx = unit.statuses.findIndex((s) => s.typeId === statusTypeId);
  if (idx < 0) {
    // Already removed (turn_start emitted it but a prior tick removed
    // it). Outcome reports `removed: false`; no state change.
    return {
      newState: state,
      outcome: { kind: 'status_tick', unitId, statusTypeId, removed: false },
      generatedActions: [],
    };
  }
  const instance = unit.statuses[idx]!;
  // Decrement remaining duration. null durations (permanent / conditional)
  // never tick down and never expire here.
  if (instance.remainingDuration === null) {
    return {
      newState: state,
      outcome: { kind: 'status_tick', unitId, statusTypeId, removed: false },
      generatedActions: [],
    };
  }
  const nextDuration = instance.remainingDuration - 1;

  if (nextDuration > 0) {
    const newInstance: StatusInstance = { ...instance, remainingDuration: nextDuration };
    const newStatuses = unit.statuses.map((s, i) => (i === idx ? newInstance : s));
    const newUnit: Unit = { ...unit, statuses: newStatuses };
    return {
      newState: withUnit(state, newUnit),
      outcome: { kind: 'status_tick', unitId, statusTypeId, removed: false },
      generatedActions: [],
    };
  }

  // Expired — remove the instance. (Calling fireOnRemove here would
  // require duplicating the status-pipeline glue; for v1 we let
  // applyStatus / removeStatus own that path. Once a status with a
  // duration-expiry hook ships, this branch routes through
  // engine/status/remove.ts.)
  const newStatuses = unit.statuses.filter((_, i) => i !== idx);
  const newUnit: Unit = { ...unit, statuses: newStatuses };
  return {
    newState: withUnit(state, newUnit),
    outcome: { kind: 'status_tick', unitId, statusTypeId, removed: true },
    generatedActions: [],
  };
}

// --- charged_action_resolve ---

export function reduceChargedActionResolve(
  state: GameState,
  action: Extract<Action, { type: 'charged_action_resolve' }>,
  _catalog: Catalog,
): ReduceResult<ChargedActionResolveOutcome> {
  const id = action.payload.chargedActionId;
  const ca = state.chargedActions.find((c: ChargedAction) => c.id === id);
  if (ca === undefined) {
    throw new Error(`reduceChargedActionResolve: no ChargedAction with id ${JSON.stringify(id)}`);
  }
  // Session 7 ships the skeleton: remove the ChargedAction from the
  // queue, return an empty result list. The actual effect resolution
  // and the paired Charging-status removal land alongside damage
  // pipeline (session 8) and the first content consumer.
  const newChargedActions = state.chargedActions.filter((c) => c.id !== id);
  const newState: GameState = { ...state, chargedActions: newChargedActions };
  return {
    newState,
    outcome: {
      kind: 'charged_action_resolve',
      chargedActionId: id,
      perTargetResults: [],
    },
    generatedActions: [],
  };
}
