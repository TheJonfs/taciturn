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

import type { ActiveAbilityDefinition, AoeSpec, Catalog } from '../catalog/index.ts';
import { defaultDamageHandlers } from '../damage/default-handlers.ts';
import { runDamagePipeline } from '../damage/pipeline.ts';
import {
  runModifyAoeShape,
  runModifyStatQuery,
  runOnActionAttempted,
  runOnActionTargeted,
  runOnTick,
  runQueryTurnSkipped,
} from '../hooks/runners.ts';
import { tileAt, unitAt } from '../map/accessors.ts';
import { aoeFootprint } from '../map/aoe.ts';
import { getLegalMoves, positionKey } from '../map/pathfinding.ts';
import { applyStatus } from '../status/apply.ts';
import { rollStatusChance } from '../status/chance.ts';
import { removeStatus } from '../status/remove.ts';
import { evaluateBattleOutcome } from '../turn/evaluate-battle-outcome.ts';
import { perTargetSeed } from './seed.ts';
import {
  chargedActionId,
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
  type GeneratedReaction,
  type MoveOutcome,
  type Position,
  type ProposedAction,
  type SetFacingOutcome,
  type StatusApplicationOutcome,
  type StatusDecrementStackOutcome,
  type StatusInstance,
  type StatusRemoveOutcome,
  type StatusTickOutcome,
  type SystemApplyStatusOutcome,
  type SystemDamageOutcome,
  type SystemHealOutcome,
  type TargetRef,
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
  // Reactions emitted by this reducer. `commitAction` enqueues them
  // with `isReaction: true` and uses `.reactorId` (the unit whose hook
  // fired the reaction) for the per-unit-per-turn reaction cap —
  // independent of whether the emitted action carries `actorId`.
  // Today only the damage-bearing UseAbility branch (Counter et al. via
  // onActionTargeted) produces these; reducers that don't emit reactions
  // simply omit the field. See docs/design/action-resolution.md
  // ("Reactions and the action chain") and the session 17 fix to
  // ADR-0024's noted reaction-cap limitation.
  readonly generatedReactions?: ReadonlyArray<GeneratedReaction>;
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

  // Deduct MP up front. Per BMG ("MP system"): MP is committed at
  // commit time and not refunded on fizzle — applies to both instant
  // and charged abilities.
  let workingState: GameState = withUnit(state, {
    ...actor,
    vitals: { ...actor.vitals, mp: actor.vitals.mp - ability.mpCost },
  });

  // Decrement actsAvailable. The Act is consumed at commit even for
  // charged spells (the caster spent their action; the spell resolves
  // later). Charging then skips subsequent turns via `queryTurnSkipped`.
  workingState = decrementActBudget(workingState);

  // Action Speed gate. actionSpeed > 0 → spawn a ChargedAction with
  // `ct: 0, speed: actionSpeed` and apply the Charging status to the
  // caster. Effect resolution happens later via charged_action_resolve.
  // actionSpeed === 0 → resolve immediately.
  if (ability.actionSpeed > 0) {
    return commitCharged(workingState, action, ability, actor, catalog);
  }

  const incomingProposed: ProposedAction = {
    type: 'use_ability',
    source: action.source,
    actorId: actor.id,
    payload: action.payload,
  };

  const resolved = resolveAbilityTargets(workingState, catalog, {
    ability,
    attacker: actor,
    payloadTarget: action.payload.target,
    incomingProposed,
    sourceActionSeq: action.sequenceNumber,
    seed: action.seed,
  });

  const outcome: UseAbilityOutcome = {
    kind: 'use_ability',
    abilityId: ability.id,
    perTargetResults: resolved.perTargetResults,
    mpSpent: ability.mpCost,
  };

  return {
    newState: resolved.newState,
    outcome,
    generatedActions: resolved.generatedActions,
    ...(resolved.generatedReactions.length > 0
      ? { generatedReactions: resolved.generatedReactions }
      : {}),
  };
}

// Decrement actsAvailable on the active turn; bump consumed.actsConsumed.
function decrementActBudget(state: GameState): GameState {
  const turn = state.turnState;
  if (turn === null) throw new Error('decrementActBudget: turnState was null');
  return {
    ...state,
    turnState: {
      ...turn,
      budget: { ...turn.budget, actsAvailable: turn.budget.actsAvailable - 1 },
      consumed: { ...turn.consumed, actsConsumed: turn.consumed.actsConsumed + 1 },
    },
  };
}

// Commit-charged path: spawn the ChargedAction, apply Charging status,
// return the use_ability outcome with chargedActionId set and empty
// per-target results (resolution lands later in
// `reduceChargedActionResolve`).
function commitCharged(
  state: GameState,
  action: Extract<Action, { type: 'use_ability' }>,
  ability: ActiveAbilityDefinition,
  actor: Unit,
  catalog: Catalog,
): ReduceResult<UseAbilityOutcome> {
  const targets = buildTargetRefs(action.payload.target);
  const caId = chargedActionId(`ca:${actor.id}:${action.sequenceNumber}`);

  const charged: ChargedAction = {
    id: caId,
    casterId: actor.id,
    abilityId: ability.id,
    ct: 0,
    speed: ability.actionSpeed,
    targets,
    sourceSequenceNumber: action.sequenceNumber,
  };

  let workingState: GameState = {
    ...state,
    chargedActions: [...state.chargedActions, charged],
  };

  // Apply the Charging status to the caster. The named type id comes
  // from the active ruleset so the engine stays content-agnostic.
  const ruleset = catalog.getRuleset(state.ruleset.id);
  const chargingTypeId = ruleset.chargedActions.chargingStatusTypeId;
  const applied = applyStatus(
    workingState,
    {
      targetId: actor.id,
      typeId: chargingTypeId,
      sourceUnitId: actor.id,
      sourceActionSeq: action.sequenceNumber,
      customState: { chargedActionId: caId },
    },
    catalog,
  );
  workingState = applied.newState;

  const outcome: UseAbilityOutcome = {
    kind: 'use_ability',
    abilityId: ability.id,
    perTargetResults: [],
    mpSpent: ability.mpCost,
    chargedActionId: caId,
  };

  return {
    newState: workingState,
    outcome,
    generatedActions: [],
  };
}

// Convert the proposed `AbilityTarget` to the ChargedAction-stored
// `TargetRef` shape. Self-targeting charged abilities are unusual but
// supported (caster's id captured at commit; FFT-pinning to the unit
// applies — caster still resolves on themselves even if displaced).
function buildTargetRefs(target: AbilityTarget): TargetRef[] {
  switch (target.kind) {
    case 'self':
      throw new Error(
        'buildTargetRefs: charged self-target not yet specified — ' +
          "no v1 content uses 'self' targeting on a charged ability",
      );
    case 'unit':
      return [{ kind: 'unit', unitId: target.unitId }];
    case 'tile':
      return [{ kind: 'tile', position: target.position }];
  }
}

// Per-target resolver shared by the instant UseAbility path and the
// deferred charged_action_resolve path. Drives:
//   - The damage pipeline (when the ability declares damage AND has a
//     unit target).
//   - Status application (per-effect spec).
//   - Post-application onActionTargeted reactions on the unit target.
//
// Returns one AbilityTargetResult plus state updates and any reactions.
// AoE callers (session 17) drive this per-target with an appropriate
// per-target seed branching via `perTargetSeed`.
interface ResolveAbilityEffectArgs {
  readonly ability: ActiveAbilityDefinition;
  readonly attacker: Unit;
  readonly targetUnit: Unit | null;
  // What goes into the AbilityTargetResult.target field. For unit
  // targets this is `{ kind: 'unit', unitId }`; for self this is
  // `{ kind: 'self' }`; for tile-anchored this is the tile or the unit
  // ultimately resolved on it (caller decides).
  readonly payloadTargetForResult: AbilityTarget;
  // The synthetic ProposedAction passed to onActionTargeted's
  // `incomingAction` arg. Reaction handlers see this to gate on
  // ability id / tags / actor.
  readonly incomingProposed: ProposedAction;
  readonly sourceActionSeq: number;
  readonly seed: number;
  // When false, status effects with `target: 'caster'` are skipped.
  // Used by the AoE dispatcher: caster-targeted effects fire once per
  // ability use, not once per AoE target. Defaults to true so single-
  // target callers (and the existing charged_action_resolve loop)
  // continue to resolve both kinds.
  readonly applyCasterEffects?: boolean;
}

interface ResolveAbilityEffectResult {
  readonly newState: GameState;
  readonly perTargetResults: ReadonlyArray<AbilityTargetResult>;
  readonly generatedReactions: ReadonlyArray<GeneratedReaction>;
  // Non-reaction system actions emitted by pipeline-stage hooks
  // (onDamageReceived's `emittedActions` slot per ADR-0027 — Sleep
  // wake-on-damage is the canonical worked example). The reducer adds
  // these to its own `generatedActions` so commitAction enqueues them
  // FIFO behind the use_ability outcome.
  readonly generatedActions: ReadonlyArray<ProposedAction>;
}

function resolveAbilityEffect(
  state: GameState,
  catalog: Catalog,
  args: ResolveAbilityEffectArgs,
): ResolveAbilityEffectResult {
  let workingState = state;

  // Damage / healing pipeline.
  let damageContext: DamageContext | null = null;
  let damageDealt: number | undefined;
  let healingDealt: number | undefined;
  const pipelineEmissions: ProposedAction[] = [];
  if (args.ability.effects.damage !== undefined && args.targetUnit !== null) {
    damageContext = runDamagePipeline({
      state: workingState,
      catalog,
      attacker: args.attacker,
      target: args.targetUnit,
      ability: args.ability,
      sourceActionSeq: args.sourceActionSeq,
      seed: args.seed,
      registry: defaultDamageHandlers,
    });
    workingState = applyDamageToTarget(workingState, damageContext);
    if (damageContext.damageTags.has('healing')) {
      healingDealt = damageContext.finalDamage ?? 0;
    } else {
      damageDealt = damageContext.finalDamage ?? 0;
    }
    // Per ADR-0027, onDamageReceived handlers may emit system actions
    // (Sleep wake-on-damage's status_remove, future Vulnerable consume).
    // The runner accumulates them onto ctx.emittedActions; forward to
    // generatedActions so commitAction enqueues them.
    if (damageContext.emittedActions !== undefined) {
      for (const a of damageContext.emittedActions) pipelineEmissions.push(a);
    }
  }

  // Apply status effects. Skipped if damage KO'd the target.
  // The application chance formula (BMG / ADR-0024) is rolled before
  // the apply pipeline runs:
  //   hit_chance = base_chance × Faith_factor × MA_factor
  //              × (1 - target_resistance/100) × ∏modifiers
  // A failed roll emits a `missed` outcome and skips the apply. The
  // damage-pipeline `'hit'` and the status-application roll are
  // independent — a magical attack can deal full damage and the rider
  // status can still miss.
  //
  // Auto-apply: `baseChance` omitted from the spec is treated as 100%
  // — the formula still runs (Faith / MA / resistance / modifiers
  // still affect the chance), but the base term is 1.0. For purely
  // engine-driven applications (Charging via commitCharged) we bypass
  // this path entirely with applyStatus directly.
  const targetKO =
    args.targetUnit !== null &&
    workingState.units.get(args.targetUnit.id)?.vitals.hp === 0;
  const statusOutcomes: StatusApplicationOutcome[] = [];
  const applyCasterEffects = args.applyCasterEffects ?? true;
  if (args.ability.effects.statusEffects && !targetKO) {
    let effectIndex = 0;
    for (const spec of args.ability.effects.statusEffects) {
      // AoE per-target callers pass `applyCasterEffects: false`; the
      // dispatcher fires caster-target status effects once before the
      // per-target loop, not per affected target.
      if (spec.target === 'caster' && !applyCasterEffects) continue;
      const targetStatusUnitId =
        spec.target === 'caster'
          ? args.attacker.id
          : args.targetUnit !== null
            ? args.targetUnit.id
            : null;
      if (targetStatusUnitId === null) {
        throw new Error(
          `resolveAbilityEffect: status effect ${JSON.stringify(spec.typeId)} targets primary_target but ability ${JSON.stringify(args.ability.id)} has no unit target`,
        );
      }
      const targetUnit = getUnit(workingState, targetStatusUnitId);
      const statusType = catalog.getStatusType(spec.typeId);
      const chanceResult = rollStatusChance({
        state: workingState,
        catalog,
        caster: args.attacker,
        target: targetUnit,
        statusType,
        ability: args.ability,
        baseChance: spec.baseChance ?? 100,
        seed: args.seed,
        effectIndex,
      });
      effectIndex++;
      if (!chanceResult.applied) {
        statusOutcomes.push({
          kind: 'missed',
          chance: chanceResult.chance,
          roll: chanceResult.roll,
        });
        continue;
      }
      const applied = applyStatus(
        workingState,
        {
          targetId: targetStatusUnitId,
          typeId: spec.typeId,
          sourceUnitId: args.attacker.id,
          sourceActionSeq: args.sourceActionSeq,
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

  // Post-application reactions: onActionTargeted on the target's hooks.
  // The runner stamps each emission with `reactorId: target.id`; the
  // commit-time cap accounts on that field independent of the emitted
  // action's `actorId` shape.
  const reactions: GeneratedReaction[] = [];
  if (args.targetUnit !== null && damageContext !== null) {
    const postTarget = workingState.units.get(args.targetUnit.id) ?? args.targetUnit;
    const targetedReactions = runOnActionTargeted(workingState, catalog, {
      unit: postTarget,
      incomingAction: args.incomingProposed,
      damageDealt: damageContext.damageTags.has('healing')
        ? -(damageContext.finalDamage ?? 0)
        : damageContext.finalDamage ?? 0,
      damageTags: damageContext.damageTags,
      seed: args.seed,
    });
    for (const r of targetedReactions) reactions.push(r);
  }

  const result: AbilityTargetResult = {
    target: args.payloadTargetForResult,
    hit: damageContext !== null ? damageContext.hit : true,
    ...(damageDealt !== undefined ? { damage: damageDealt } : {}),
    ...(healingDealt !== undefined ? { healing: healingDealt } : {}),
    ...(statusOutcomes.length > 0 ? { statusesApplied: statusOutcomes } : {}),
  };

  return {
    newState: workingState,
    perTargetResults: [result],
    generatedReactions: reactions,
    generatedActions: pipelineEmissions,
  };
}

// Per-cast dispatcher (session 17). Bridges the proposed `AbilityTarget`
// to the per-target `resolveAbilityEffect` body. Two modes:
//
//   - **Single-target** (no `effects.aoe`): identical to the pre-AoE
//     shape — resolves the payload target to a unit (or null for empty-
//     tile / self-no-unit) and calls `resolveAbilityEffect` once with
//     `perTargetSeed(seed, 0)` (which is the action seed unchanged).
//     RNG behavior is bit-identical to pre-session-17 for any caller
//     that doesn't declare AoE.
//
//   - **AoE** (`effects.aoe` set): expands the proposed anchor (target
//     unit's position, target tile, or caster's position for
//     self-targeted) into the shape's footprint. Affected units are
//     filtered by caster exclusion + friendly-fire policy and sorted by
//     unit id for deterministic per-target ordering. Each affected unit
//     resolves with `perTargetSeed(seed, i)` so variance / evasion /
//     status-chance / brave-reaction rolls are independent per target.
//     Caster-target status effects (rare; v1 has none in AoE) are
//     applied once before the loop.
//
// Empty AoE footprint is allowed (no targets to affect) — perTargetResults
// is empty and the caller's outcome reflects mpSpent + chargedActionId
// regardless. KO'd targets are skipped at filtering and at the per-target
// guard (a target may be KO'd by an earlier target's reaction).
interface ResolveAbilityTargetsArgs {
  readonly ability: ActiveAbilityDefinition;
  readonly attacker: Unit;
  readonly payloadTarget: AbilityTarget;
  readonly incomingProposed: ProposedAction;
  readonly sourceActionSeq: number;
  readonly seed: number;
}

interface ResolveAbilityTargetsResult {
  readonly newState: GameState;
  readonly perTargetResults: ReadonlyArray<AbilityTargetResult>;
  readonly generatedReactions: ReadonlyArray<GeneratedReaction>;
  readonly generatedActions: ReadonlyArray<ProposedAction>;
}

function resolveAbilityTargets(
  state: GameState,
  catalog: Catalog,
  args: ResolveAbilityTargetsArgs,
): ResolveAbilityTargetsResult {
  const aoe = args.ability.effects.aoe;
  if (aoe === undefined) {
    return resolveSingleTargetDispatch(state, catalog, args);
  }
  return resolveAoeDispatch(state, catalog, args, aoe);
}

// Single-target dispatch: resolves the payload target to a Unit | null
// and calls `resolveAbilityEffect` with `perTargetSeed(seed, 0)` (which
// returns the action seed unchanged at index 0 — see seed.ts).
function resolveSingleTargetDispatch(
  state: GameState,
  catalog: Catalog,
  args: ResolveAbilityTargetsArgs,
): ResolveAbilityTargetsResult {
  const targetUnit = resolveSingleTargetUnit(state, args.payloadTarget, args.attacker);
  const resolved = resolveAbilityEffect(state, catalog, {
    ability: args.ability,
    attacker: args.attacker,
    targetUnit,
    payloadTargetForResult: args.payloadTarget,
    incomingProposed: args.incomingProposed,
    sourceActionSeq: args.sourceActionSeq,
    seed: perTargetSeed(args.seed, 0),
  });
  return {
    newState: resolved.newState,
    perTargetResults: resolved.perTargetResults,
    generatedReactions: resolved.generatedReactions,
    generatedActions: resolved.generatedActions,
  };
}

// Resolve the payload target to a Unit for the damage/onActionTargeted
// path. `self` returns the caster (so caster-target status / self-buff
// abilities can flow through the single-target body). `unit` looks up
// by id. `tile` looks up the unit at the position; null when the tile
// is empty (caller's body handles that — `resolveAbilityEffect` skips
// damage and onActionTargeted when targetUnit is null).
function resolveSingleTargetUnit(
  state: GameState,
  target: AbilityTarget,
  attacker: Unit,
): Unit | null {
  switch (target.kind) {
    case 'self':
      return attacker;
    case 'unit':
      return getUnit(state, target.unitId);
    case 'tile': {
      const at = unitAt(state, target.position.x, target.position.y, target.position.layer);
      return at ?? null;
    }
  }
}

// AoE dispatch: expand the anchor into the shape's footprint, filter
// to affected units, sort deterministically, then call
// `resolveAbilityEffect` per target with branched seeds.
function resolveAoeDispatch(
  state: GameState,
  catalog: Catalog,
  args: ResolveAbilityTargetsArgs,
  aoe: AoeSpec,
): ResolveAbilityTargetsResult {
  // v1 constraint: AoE abilities cannot have caster-target status
  // effects. The dispatcher would need to fire them once before the
  // per-target loop; no v1 ability uses this combination. Throwing
  // here surfaces violations clearly when a future ability adds the
  // case (then we add the once-per-cast caster-effect handling).
  for (const spec of args.ability.effects.statusEffects ?? []) {
    if (spec.target === 'caster') {
      throw new Error(
        `resolveAbilityTargets: ability ${JSON.stringify(args.ability.id)} declares an AoE and a caster-target status effect (${JSON.stringify(spec.typeId)}) — this combination is not supported in v1`,
      );
    }
  }

  // Anchor position from the payload target.
  const anchorPos = resolveAoeAnchor(state, args.payloadTarget, args.attacker);
  const anchorTile = tileAt(state.map, anchorPos.x, anchorPos.y, anchorPos.layer);
  if (anchorTile === undefined) {
    throw new Error(
      `resolveAoeDispatch: anchor tile (${anchorPos.x},${anchorPos.y},${anchorPos.layer}) does not exist — validation should have caught this`,
    );
  }

  // Shape modifier hook on the caster (Fire Mage's "larger AoE" rider
  // is the planned session 19 consumer; v1 chain is identity).
  const finalShape = runModifyAoeShape(state, catalog, {
    unit: args.attacker,
    ability: args.ability,
    baseShape: aoe.shape,
  });

  // Footprint: tiles within the shape's offsets and within vertical
  // tolerance of the anchor's elevation. Per-ability override takes
  // precedence over the ruleset's `rangeDefaults.aoeVerticalTolerance`.
  const ruleset = catalog.getRuleset(state.ruleset.id);
  const verticalTolerance =
    aoe.verticalTolerance ?? ruleset.rangeDefaults.aoeVerticalTolerance;
  const tiles = aoeFootprint({
    map: state.map,
    anchor: { x: anchorPos.x, y: anchorPos.y, elevation: anchorTile.elevation },
    shape: finalShape,
    verticalTolerance,
  });

  // Affected unit set. A multi-layer footprint may include several tiles
  // at the same (x, y); the dedup-by-unit-id keeps a unit from appearing
  // twice when their tile and a neighbor at the same column both qualify.
  const excludeCaster = aoe.excludeCaster ?? true;
  const respectFriendlyFire = !ruleset.behaviors.friendlyFire;
  const seen = new Set<UnitId>();
  const affected: Unit[] = [];
  for (const tile of tiles) {
    const unit = unitAt(state, tile.x, tile.y, tile.layer);
    if (unit === undefined) continue;
    if (seen.has(unit.id)) continue;
    if (unit.vitals.hp <= 0) continue;
    if (excludeCaster && unit.id === args.attacker.id) continue;
    if (respectFriendlyFire && unit.team === args.attacker.team && unit.id !== args.attacker.id) {
      continue;
    }
    seen.add(unit.id);
    affected.push(unit);
  }

  // Stable ordering. UnitId is a branded string, lexicographic compare.
  affected.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  // Per-target dispatch with branched seeds.
  let workingState = state;
  const allResults: AbilityTargetResult[] = [];
  const allReactions: GeneratedReaction[] = [];
  const allEmissions: ProposedAction[] = [];
  for (let i = 0; i < affected.length; i++) {
    const target = affected[i]!;
    // A prior target's reaction may have KO'd this target, or removed
    // them from state in some other way. Re-fetch and skip if gone.
    const current = workingState.units.get(target.id);
    if (current === undefined || current.vitals.hp <= 0) continue;

    const resolved = resolveAbilityEffect(workingState, catalog, {
      ability: args.ability,
      attacker: args.attacker,
      targetUnit: current,
      payloadTargetForResult: { kind: 'unit', unitId: current.id },
      incomingProposed: args.incomingProposed,
      sourceActionSeq: args.sourceActionSeq,
      seed: perTargetSeed(args.seed, i),
      applyCasterEffects: false,
    });
    workingState = resolved.newState;
    for (const r of resolved.perTargetResults) allResults.push(r);
    for (const r of resolved.generatedReactions) allReactions.push(r);
    for (const a of resolved.generatedActions) allEmissions.push(a);
  }

  return {
    newState: workingState,
    perTargetResults: allResults,
    generatedReactions: allReactions,
    generatedActions: allEmissions,
  };
}

// Anchor position for AoE expansion. `self` is the caster's current
// position; `tile` is the targeted tile; `unit` reads the target unit's
// current position (FFT-canonical for unit-anchored AoE — the AoE
// blooms from where the target stands at resolution time).
function resolveAoeAnchor(
  state: GameState,
  target: AbilityTarget,
  attacker: Unit,
): Position {
  switch (target.kind) {
    case 'self':
      return attacker.position;
    case 'tile':
      return target.position;
    case 'unit': {
      const unit = getUnit(state, target.unitId);
      return unit.position;
    }
  }
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
  // the skip on the outcome, and emit a turn_end as a generated action.
  //
  // Per-unit-CT status ticks: governed by the skip's
  // `suppressStatusTicks` flag (ADR-0024). Stop suppresses ticks (frozen
  // in time); Charging does not (caster is conscious — DoTs still
  // progress). When skipping with ticks suppressed, only the turn_end
  // is emitted. When skipping without suppression, ticks are emitted
  // *before* the turn_end so they fire first in the chain.
  const skip = runQueryTurnSkipped(state, catalog, { unit });

  const newTurn = {
    unitId,
    budget: skip !== null ? { movesAvailable: 0, actsAvailable: 0 } : { ...ruleset.defaultTurnBudget },
    consumed: { movesConsumed: 0, actsConsumed: 0, waited: false },
    reactionsUsedThisTurn: new Map<UnitId, number>(),
  };

  // Per ADR-0027, `permanent_per_unit_ct` joins `per_unit_ct` for the
  // status_tick fan-out — both modes tick at the unit's CT cadence; the
  // difference (decrement-vs-not) lives downstream in reduceStatusTick.
  if (skip !== null) {
    const generated: ProposedAction[] = [];
    if (!skip.suppressStatusTicks) {
      for (const status of unit.statuses) {
        const type = catalog.getStatusType(status.typeId);
        if (type.durationMode === 'per_unit_ct' || type.durationMode === 'permanent_per_unit_ct') {
          generated.push({
            type: 'status_tick',
            source: 'system',
            payload: { unitId, statusTypeId: status.typeId },
          });
        }
      }
    }
    const turnEnd: ProposedAction = {
      type: 'turn_end',
      source: 'system',
      payload: { unitId },
    };
    generated.push(turnEnd);
    return {
      newState: { ...state, turnState: newTurn },
      outcome: { kind: 'turn_start', unitId, skipped: true, skipReason: skip.reason },
      generatedActions: generated,
    };
  }

  // Generate status_tick actions for CT-cadence statuses on this unit.
  // The chain processor runs them after this action commits.
  const generated: ProposedAction[] = [];
  for (const status of unit.statuses) {
    const type = catalog.getStatusType(status.typeId);
    if (type.durationMode === 'per_unit_ct' || type.durationMode === 'permanent_per_unit_ct') {
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
//
// status_tick fires onTick handlers (Regen heals, future Poison damages),
// then decrements the duration. The order is intentional — the tick
// "happens" while the status is still on the unit, then the duration
// counter consumes one unit of progress. Per ADR-0024.
//
// Emissions from onTick handlers (system_heal for Regen, etc.) are
// returned as generatedActions; commitAction enqueues them after this
// reducer's outcome is appended to the log.

export function reduceStatusTick(
  state: GameState,
  action: Extract<Action, { type: 'status_tick' }>,
  catalog: Catalog,
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

  // Fire onTick handlers — collect emissions. Handlers read state and
  // catalog from args (Regen reads MaxHP and Faith via runModifyStatQuery
  // to compute its heal amount). The runner filters to handlers
  // registered by *this* status type (other statuses on the unit don't
  // tick when statusTypeId fires).
  const emissions = runOnTick(state, catalog, { unit, statusTypeId });

  // Decrement remaining duration. null durations (permanent / conditional)
  // never tick down and never expire here.
  if (instance.remainingDuration === null) {
    return {
      newState: state,
      outcome: { kind: 'status_tick', unitId, statusTypeId, removed: false },
      generatedActions: emissions,
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
      generatedActions: emissions,
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
    generatedActions: emissions,
  };
}

// --- system_heal ---
//
// Engine-emitted heal-the-target action used by onTick (Regen) and
// other status side effects. Distinct from healing-tagged use_ability
// because it has no caster / ability / reaction surface — it's a pure
// HP modification driven by a status in flight. Per ADR-0024.
//
// Caps the heal at the target's effective max HP (read through
// modifyStatQuery, so HP-buff statuses compose). KO'd targets (HP 0)
// are skipped — Regen on a fallen unit is a no-op until they're raised.
// (Per BMG: "DoT statuses do not tick while KO'd"; the symmetric rule
// for HoT means Regen also pauses while KO'd.)
export function reduceSystemHeal(
  state: GameState,
  action: Extract<Action, { type: 'system_heal' }>,
  catalog: Catalog,
): ReduceResult<SystemHealOutcome> {
  const { targetId, amount } = action.payload;
  const target = state.units.get(targetId);
  if (target === undefined) {
    // Target removed mid-chain — silent no-op.
    return {
      newState: state,
      outcome: { kind: 'system_heal', targetId, amount, applied: 0 },
      generatedActions: [],
    };
  }
  if (target.vitals.hp <= 0) {
    return {
      newState: state,
      outcome: { kind: 'system_heal', targetId, amount, applied: 0 },
      generatedActions: [],
    };
  }
  const maxHp = runModifyStatQuery(state, catalog, {
    unit: target,
    statName: 'maxHp',
    baseValue: target.baseStats.maxHpBase,
  });
  const room = Math.max(0, maxHp - target.vitals.hp);
  const applied = Math.max(0, Math.min(amount, room));
  if (applied === 0) {
    return {
      newState: state,
      outcome: { kind: 'system_heal', targetId, amount, applied: 0 },
      generatedActions: [],
    };
  }
  const newTarget: Unit = {
    ...target,
    vitals: { ...target.vitals, hp: target.vitals.hp + applied },
  };
  return {
    newState: withUnit(state, newTarget),
    outcome: { kind: 'system_heal', targetId, amount, applied },
    generatedActions: [],
  };
}

// --- system_damage ---
//
// Engine-emitted damage-the-target action. Symmetric to system_heal.
// Used by Poison's onTick and ADR-0026 falling damage. Bypasses the
// seven-stage damage pipeline (no variance, no Faith, no resistance,
// no Counter) — the emitter pre-computes the amount. Per ADR-0027.
//
// Floors HP at 0. KO'd / missing targets are silent no-ops. Does not
// fire onActionTargeted, so reactions never trigger from system damage.
export function reduceSystemDamage(
  state: GameState,
  action: Extract<Action, { type: 'system_damage' }>,
): ReduceResult<SystemDamageOutcome> {
  const { targetId, amount } = action.payload;
  const target = state.units.get(targetId);
  if (target === undefined) {
    return {
      newState: state,
      outcome: { kind: 'system_damage', targetId, amount, applied: 0 },
      generatedActions: [],
    };
  }
  if (target.vitals.hp <= 0) {
    return {
      newState: state,
      outcome: { kind: 'system_damage', targetId, amount, applied: 0 },
      generatedActions: [],
    };
  }
  const applied = Math.max(0, Math.min(amount, target.vitals.hp));
  if (applied === 0) {
    return {
      newState: state,
      outcome: { kind: 'system_damage', targetId, amount, applied: 0 },
      generatedActions: [],
    };
  }
  const newTarget: Unit = {
    ...target,
    vitals: { ...target.vitals, hp: target.vitals.hp - applied },
  };
  return {
    newState: withUnit(state, newTarget),
    outcome: { kind: 'system_damage', targetId, amount, applied },
    generatedActions: [],
  };
}

// --- system_apply_status ---
//
// Engine-emitted action that applies a status to a target unit
// *without* running the BMG application chance formula. Used by the
// reaction compiler when a reaction's effect is "apply status to
// self/attacker" (Earth Resilience's Move/Jump self-buff). The
// triggering Brave roll has already gated whether the reaction fires;
// the application itself is deterministic. Per ADR-0024.
export function reduceSystemApplyStatus(
  state: GameState,
  action: Extract<Action, { type: 'system_apply_status' }>,
  catalog: Catalog,
): ReduceResult<SystemApplyStatusOutcome> {
  const { targetId, statusTypeId, sourceUnitId, magnitude, duration, customState } = action.payload;
  const target = state.units.get(targetId);
  if (target === undefined || target.vitals.hp <= 0) {
    // KO'd targets don't receive new statuses (parallel to BMG: DoTs
    // don't tick on KO'd units; symmetric for fresh applies). Outcome
    // reports a `rejected` shape using the existing stacking-rejection
    // signal — no separate "skipped because KO'd" code today.
    return {
      newState: state,
      outcome: {
        kind: 'system_apply_status',
        targetId,
        statusTypeId,
        result: { kind: 'rejected', reason: 'stacking_rule' },
      },
      generatedActions: [],
    };
  }
  const applied = applyStatus(
    state,
    {
      targetId,
      typeId: statusTypeId,
      sourceUnitId,
      sourceActionSeq: action.sequenceNumber,
      ...(magnitude !== undefined ? { magnitude } : {}),
      ...(duration !== undefined ? { duration } : {}),
      ...(customState !== undefined ? { customState } : {}),
    },
    catalog,
  );
  return {
    newState: applied.newState,
    outcome: {
      kind: 'system_apply_status',
      targetId,
      statusTypeId,
      result: applied.result,
    },
    generatedActions: [],
  };
}

// --- status_remove ---
//
// Engine-emitted action that removes a named status instance from a
// target unit. Idempotent: a no-op if the status is not present
// (logged as `removed: false`). Used by ADR-0017 patterns (Sleep
// wake-on-damage, Vulnerable consume-on-damage). Per ADR-0024.
//
// When multiple instances exist (STACK_INDEPENDENT), removes them all —
// the action is "remove this type from this unit," not "remove one
// instance." Future session can add a per-instance variant if needed.
export function reduceStatusRemove(
  state: GameState,
  action: Extract<Action, { type: 'status_remove' }>,
  catalog: Catalog,
): ReduceResult<StatusRemoveOutcome> {
  const { targetId, statusTypeId } = action.payload;
  const target = state.units.get(targetId);
  if (target === undefined) {
    return {
      newState: state,
      outcome: { kind: 'status_remove', targetId, statusTypeId, removed: false },
      generatedActions: [],
    };
  }
  const has = target.statuses.some((s) => s.typeId === statusTypeId);
  if (!has) {
    return {
      newState: state,
      outcome: { kind: 'status_remove', targetId, statusTypeId, removed: false },
      generatedActions: [],
    };
  }
  const removed = removeStatus(state, { targetId, typeId: statusTypeId }, catalog);
  return {
    newState: removed.newState,
    outcome: { kind: 'status_remove', targetId, statusTypeId, removed: true },
    generatedActions: [],
  };
}

// --- status_decrement_stack ---
//
// Decrement an existing instance's stack count by 1; remove the
// instance if stacks reach 0. Used by Burn (per ADR-0017) when its
// CT-100 trigger fires. v1 has no consumer; the reducer ships now
// alongside status_remove for the ADR-0017 commit. Per ADR-0024.
//
// When the status type doesn't define a stack count (older statuses
// using REFRESH/REPLACE rules), the reducer treats it as "remove the
// instance" — equivalent to a status_remove on a one-stack effect.
export function reduceStatusDecrementStack(
  state: GameState,
  action: Extract<Action, { type: 'status_decrement_stack' }>,
  catalog: Catalog,
): ReduceResult<StatusDecrementStackOutcome> {
  const { targetId, statusTypeId } = action.payload;
  const target = state.units.get(targetId);
  if (target === undefined) {
    return {
      newState: state,
      outcome: {
        kind: 'status_decrement_stack',
        targetId,
        statusTypeId,
        newStackCount: 0,
        removed: false,
      },
      generatedActions: [],
    };
  }
  const idx = target.statuses.findIndex((s) => s.typeId === statusTypeId);
  if (idx < 0) {
    return {
      newState: state,
      outcome: {
        kind: 'status_decrement_stack',
        targetId,
        statusTypeId,
        newStackCount: 0,
        removed: false,
      },
      generatedActions: [],
    };
  }
  const instance = target.statuses[idx]!;
  const currentStacks = instance.stacks ?? 1;
  const nextStacks = currentStacks - 1;

  if (nextStacks <= 0) {
    // Stack count reached 0 — remove the instance (fires onRemove via
    // removeStatus).
    const removed = removeStatus(state, { targetId, typeId: statusTypeId }, catalog);
    return {
      newState: removed.newState,
      outcome: {
        kind: 'status_decrement_stack',
        targetId,
        statusTypeId,
        newStackCount: 0,
        removed: true,
      },
      generatedActions: [],
    };
  }

  const newInstance: StatusInstance = { ...instance, stacks: nextStacks };
  const newStatuses = target.statuses.map((s, i) => (i === idx ? newInstance : s));
  const newTarget: Unit = { ...target, statuses: newStatuses };
  return {
    newState: withUnit(state, newTarget),
    outcome: {
      kind: 'status_decrement_stack',
      targetId,
      statusTypeId,
      newStackCount: nextStacks,
      removed: false,
    },
    generatedActions: [],
  };
}

// --- charged_action_resolve ---
//
// Lifecycle: the scheduler emits this when a ChargedAction's CT crosses
// the trigger threshold. Resolution applies the deferred ability effects
// to the targets recorded at commit time, fires the standard
// onActionTargeted reaction surface per unit target, then removes both
// the ChargedAction and the paired Charging status from the caster.
//
// Interruption matrix (per BMG "Interruption rules"):
//
//   - **Caster KO** → fizzle. No damage, no status applied. Reactions
//     never fire. ChargedAction and Charging status both removed.
//   - **onActionAttempted blocks** → fizzle. The same hook that vetoes
//     instant UseAbility commits also vetoes resolution; Silence
//     (`'magical'`/`'voice'` block) and Don't Act will register here
//     when they ship in session 16. v1 has no consumers — the wiring
//     is in place so the addition is one status-side change.
//   - **Stop on caster** → cannot reach this reducer. Stop pauses CT
//     accumulation via `computeActionSpeed` returning 0; the scheduler
//     never picks the ChargedAction. (Edge case noted on
//     computeActionSpeed: post-trigger CT push under Stop is out of v1
//     scope.)
//   - **Damage / movement on caster during charge** → no interruption
//     (the charge is its own entity; range is checked at resolution
//     against the caster's current position).
//
// Target validity (per BMG "Interruption rules"):
//
//   - **Single-unit target KO'd before resolution** → fizzles for that
//     target. v1 has only single-target charged abilities, so the
//     whole resolution becomes empty per-target results.
//   - **Single-unit target moved out of range** → resolves on the
//     original target anyway (FFT pinning).
//   - **Tile-anchored** → resolves at the tile regardless of which unit
//     (if any) is on it at resolution time.
//
// MP refund-on-fizzle: never. Per BMG "MP system": MP was deducted at
// commit time; this reducer does not touch the caster's MP.

export function reduceChargedActionResolve(
  state: GameState,
  action: Extract<Action, { type: 'charged_action_resolve' }>,
  catalog: Catalog,
): ReduceResult<ChargedActionResolveOutcome> {
  const id = action.payload.chargedActionId;
  const ca = state.chargedActions.find((c: ChargedAction) => c.id === id);
  if (ca === undefined) {
    throw new Error(`reduceChargedActionResolve: no ChargedAction with id ${JSON.stringify(id)}`);
  }

  const ability = expectActiveAbility(catalog, ca.abilityId);
  const caster = state.units.get(ca.casterId);

  // Caster KO → fizzle. Remove the ChargedAction; if the caster still
  // exists in state, also remove their Charging status (Charging is
  // only removed on resolve/cancel, so it lingers post-KO until cleaned
  // up here).
  if (caster === undefined || caster.vitals.hp <= 0) {
    return finalizeResolution(
      state,
      catalog,
      ca,
      caster ?? null,
      [],
      [],
      [],
    );
  }

  // Caster onActionAttempted check. Silence on 'magical' / 'voice'
  // tagged abilities, Don't Act in general, etc. — these statuses
  // register a handler that returns `{ kind: 'blocked' }`, which means
  // the charge fizzles at resolution.
  //
  // We synthesize a UseAbility ProposedAction reflecting the caster +
  // ability so existing handler shapes apply. We don't honor
  // `replaced` here: a charged-spell resolution that's "replaced" with
  // a different action is not in any v1 design space; if a future hook
  // wants that behavior it'll need its own resolution-time hook.
  const proposedAtResolve: ProposedAction = synthesizeProposed(ca, caster);
  const attempt = runOnActionAttempted(state, catalog, {
    unit: caster,
    action: proposedAtResolve,
  });
  if (attempt.kind === 'blocked') {
    return finalizeResolution(state, catalog, ca, caster, [], [], []);
  }

  // Per-target resolution. v1 has single-target charged abilities only;
  // the loop pre-stages session 17's AoE per-target dispatch.
  let workingState: GameState = state;
  const allResults: AbilityTargetResult[] = [];
  const allReactions: GeneratedReaction[] = [];
  const allEmissions: ProposedAction[] = [];

  for (const targetRef of ca.targets) {
    const { resolvedUnit, payloadTargetForResult } = resolveTargetAtResolve(
      workingState,
      targetRef,
    );

    // Pre-flight silent fizzles. The dispatcher itself is willing to
    // resolve every target ref, but charged spells have a few cases
    // that should produce no per-target output at all:
    //
    //   - unit-anchored target gone (no longer in state): silent skip.
    //   - unit-anchored target KO'd: silent skip (FFT-faithful — KO
    //     dropouts don't emit per-target results).
    //   - non-AoE tile-anchored with no unit at the tile and no
    //     caster-target status effect: silent skip (avoids emitting an
    //     empty hit=true result for "single-target charged spell hits
    //     where nothing was").
    //
    // AoE-flagged tile-anchored abilities flow through the dispatcher
    // even on empty anchor tiles — the AoE expansion may find nearby
    // units even when the anchor itself is empty.
    if (targetRef.kind === 'unit' && resolvedUnit === null) continue;
    if (targetRef.kind === 'unit' && resolvedUnit !== null && resolvedUnit.vitals.hp <= 0) {
      continue;
    }
    if (
      targetRef.kind === 'tile' &&
      resolvedUnit === null &&
      ability.effects.aoe === undefined
    ) {
      const hasCasterEffect =
        ability.effects.statusEffects?.some((s) => s.target === 'caster') ?? false;
      if (!hasCasterEffect) continue;
      // Else: fall through. The dispatcher's single-target path will
      // call resolveAbilityEffect with targetUnit=null; only caster-
      // target status effects will fire, which is exactly what we want.
    }

    // AoE-aware dispatch. Non-AoE abilities flow through the identity
    // single-target path (perTargetSeed(seed, 0) === seed); AoE
    // abilities expand the anchor.
    const resolved = resolveAbilityTargets(workingState, catalog, {
      ability,
      attacker: caster,
      payloadTarget: payloadTargetForResult,
      incomingProposed: proposedAtResolve,
      sourceActionSeq: action.sequenceNumber,
      seed: action.seed,
    });
    workingState = resolved.newState;
    for (const r of resolved.perTargetResults) allResults.push(r);
    for (const r of resolved.generatedReactions) allReactions.push(r);
    for (const a of resolved.generatedActions) allEmissions.push(a);
  }

  return finalizeResolution(workingState, catalog, ca, caster, allResults, allReactions, allEmissions);
}

// Synthesize the ProposedAction passed into hook chains at resolution
// time. The `target` is the first TargetRef rendered as an
// AbilityTarget — for v1 single-target charged abilities this is
// unambiguous; for AoE the target list is broader and per-target hook
// firing inside `resolveAbilityEffect` is what reaction handlers see.
function synthesizeProposed(ca: ChargedAction, caster: Unit): ProposedAction {
  const head = ca.targets[0];
  let target: AbilityTarget;
  if (head === undefined) {
    target = { kind: 'self' };
  } else if (head.kind === 'unit') {
    target = { kind: 'unit', unitId: head.unitId };
  } else {
    target = { kind: 'tile', position: head.position };
  }
  return {
    type: 'use_ability',
    source: 'system',
    actorId: caster.id,
    payload: { abilityId: ca.abilityId, target },
  };
}

// Resolve a TargetRef to a concrete (Unit | null) at resolution time,
// alongside the AbilityTarget shape used in the per-target result.
// Unit refs do *not* re-look up by position (FFT pinning — the unit's
// id is canonical even if they moved); tile refs look up the unit
// currently at the position.
function resolveTargetAtResolve(
  state: GameState,
  ref: TargetRef,
): { resolvedUnit: Unit | null; payloadTargetForResult: AbilityTarget } {
  if (ref.kind === 'unit') {
    const unit = state.units.get(ref.unitId);
    return {
      resolvedUnit: unit ?? null,
      payloadTargetForResult: { kind: 'unit', unitId: ref.unitId },
    };
  }
  // Tile-anchored: search every layer at (x,y) for an occupant; v1 uses
  // `unitAt(state, x, y, layer)` keyed on the recorded layer.
  const tileUnit = unitAt(state, ref.position.x, ref.position.y, ref.position.layer);
  return {
    resolvedUnit: tileUnit ?? null,
    payloadTargetForResult: { kind: 'tile', position: ref.position },
  };
}

// Finalize: remove the ChargedAction from state.chargedActions, remove
// the Charging status from the caster (if present), produce the
// outcome, and return reactions to enqueue.
function finalizeResolution(
  state: GameState,
  catalog: Catalog,
  ca: ChargedAction,
  caster: Unit | null,
  perTargetResults: ReadonlyArray<AbilityTargetResult>,
  reactions: ReadonlyArray<GeneratedReaction>,
  pipelineEmissions: ReadonlyArray<ProposedAction>,
): ReduceResult<ChargedActionResolveOutcome> {
  let newState: GameState = {
    ...state,
    chargedActions: state.chargedActions.filter((c) => c.id !== ca.id),
  };

  // Remove the Charging status from the caster (if they still exist
  // and have one). The match is by typeId — even though Charging uses
  // STACK_INDEPENDENT-style customState pointers in principle, v1's
  // REJECT stacking ensures at most one Charging instance per caster,
  // so removing all instances of the type is correct.
  if (caster !== null) {
    const chargingTypeId = catalog.getRuleset(state.ruleset.id).chargedActions
      .chargingStatusTypeId;
    const stillHasCharging = newState.units
      .get(caster.id)
      ?.statuses.some((s) => s.typeId === chargingTypeId);
    if (stillHasCharging === true) {
      newState = removeStatus(
        newState,
        { targetId: caster.id, typeId: chargingTypeId },
        catalog,
      ).newState;
    }
  }

  const outcome: ChargedActionResolveOutcome = {
    kind: 'charged_action_resolve',
    chargedActionId: ca.id,
    perTargetResults,
  };

  return {
    newState,
    outcome,
    generatedActions: pipelineEmissions,
    ...(reactions.length > 0 ? { generatedReactions: reactions } : {}),
  };
}
