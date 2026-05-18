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

import type {
  ActiveAbilityDefinition,
  AoeSpec,
  Catalog,
  ConsumableDefinition,
  StatusEffectType,
} from '../catalog/index.ts';
import { defaultDamageHandlers } from '../damage/default-handlers.ts';
import { runDamagePipeline } from '../damage/pipeline.ts';
import {
  runModifyAoeShape,
  runModifyStatQuery,
  runModifyStatusTickAmount,
  runModifySystemDamage,
  runOnActionAttempted,
  runOnActionResolved,
  runOnActionTargeted,
  runOnMoveCompleted,
  runOnTick,
  runOnTurnEnd,
  runQueryTurnSkipped,
} from '../hooks/runners.ts';
import { tileAt, unitAt } from '../map/accessors.ts';
import { aoeFootprint, cardinalFromTo } from '../map/aoe.ts';
import { applyKnockback, type KnockbackDirection } from '../map/knockback.ts';
import { getLegalMoves, positionKey } from '../map/pathfinding.ts';
import { applyStatus } from '../status/apply.ts';
import { rollAbilityChance, rollStatusChance } from '../status/chance.ts';
import { removeStatus } from '../status/remove.ts';
import { TRIGGER_THRESHOLD } from '../ct/constants.ts';
import { perTargetSeed } from './seed.ts';
import {
  chargedActionId,
  getUnit,
  type Action,
  type AbilityTarget,
  type AbilityTargetResult,
  type BattleEndOutcome,
  type CardinalDirection,
  type ChargedAction,
  type ChargedActionResolveOutcome,
  type DamageContext,
  type Direction,
  type GameState,
  type GeneratedReaction,
  type ItemId,
  type MoveOutcome,
  type Position,
  type ProposedAction,
  type SetFacingOutcome,
  type StatusApplicationOutcome,
  type StatusDecrementStackOutcome,
  type StatusInstance,
  type StatusRemoveOutcome,
  type StatusTickOutcome,
  type StatusTypeId,
  type SystemApplyStatusOutcome,
  type SystemCtPushOutcome,
  type SystemSetCtOutcome,
  type SystemDamageOutcome,
  type SystemHealOutcome,
  type SystemMpDrainOutcome,
  type SystemKoTickOutcome,
  type SystemMpRestoreOutcome,
  type SystemUnitRemovedOutcome,
  type TargetRef,
  type TurnEndOutcome,
  type TurnStartOutcome,
  type Unit,
  type UnitId,
  type UseAbilityOutcome,
  type UseCompoundOutcome,
  type UseThrowItemOutcome,
  type WaitOutcome,
} from '../types/index.ts';
import { expectActiveAbility } from './validate.ts';
import { isRiderCast } from './payload-helpers.ts';
import { computeMpCost } from '../abilities/cost.ts';
import { computeBaseActionSpeed } from '../ct/speed.ts';

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

  // Session 39b: onMoveCompleted fires against the mover's hooks with
  // the tiles-moved count (path entries minus the starting position).
  // Field Recovery (Alchemist Movement) emits a `system_heal` of
  // `tilesMoved²` HP via this hook. Forced movement (knockback / pull)
  // doesn't go through reduceMove, so the brief's "intentional only"
  // gate is structural — no need for an explicit flag.
  const tilesMoved = Math.max(0, path.path.length - 1);
  const moveEmissions =
    tilesMoved > 0 ? runOnMoveCompleted(newState, catalog, { unit: newActor, tilesMoved }) : [];

  const outcome: MoveOutcome = {
    kind: 'move',
    pathTaken: path.path,
    finalPosition: dest,
    facingAfter,
  };
  return { newState, outcome, generatedActions: moveEmissions };
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
  // Reactions can fire when no turn is in progress — e.g., a charged
  // ability resolves (charged_action_resolve has no turnState) and its
  // damage triggers an `onActionTargeted` reaction (Discharge,
  // future Reflect). The reaction commits as `use_ability` with
  // `isReaction: true`. Pre-session-20 Counter avoided this case
  // because its reaction compiler filters to `'physical'` damage and
  // charged abilities are magical; session 20's Discharge has no
  // damage-tag filter, so it surfaces the gap. Per ADR-0032's
  // "magical reactions" item.
  if (state.turnState === null && !action.isReaction) {
    throw new Error('reduceUseAbility: no turn in progress');
  }

  const ability = expectActiveAbility(catalog, action.payload.abilityId);
  const actor = getUnit(state, action.actorId);

  // Deduct MP up front. Per BMG ("MP system"): MP is committed at
  // commit time and not refunded on fizzle — applies to both instant
  // and charged abilities. The cost is read through `computeMpCost` so
  // equipment / status `modifyMpCost` contributors compose (per ADR-0056).
  //
  // Per ADR-0064 (Session 30): rider casts (weapon `attackProcs`) bypass
  // MP deduction — the weapon pays, not the wielder. `mpSpent` is
  // recorded as 0 on the outcome so logs and replays know the cast was
  // free. The validator already skipped the affordability check for
  // rider casts.
  const isRider = isRiderCast(action.payload);
  const mpCost = isRider ? 0 : computeMpCost(state, catalog, actor.id, ability.id);
  let workingState: GameState = state;
  if (!isRider && mpCost > 0) {
    workingState = withUnit(state, {
      ...actor,
      vitals: { ...actor.vitals, mp: actor.vitals.mp - mpCost },
    });
  }

  // Decrement actsAvailable. The Act is consumed at commit even for
  // charged spells (the caster spent their action; the spell resolves
  // later). Charging then skips subsequent turns via `queryTurnSkipped`.
  // Reactions don't consume the actor's turn budget — they fire out-of-
  // turn — so skip the budget decrement when isReaction is true OR when
  // there's no turn at all (the reactor isn't the active unit anyway).
  //
  // Per Session 31 (ADR-0068 extension): rider casts also skip Act
  // budget decrement — the wielder paid for the original swing's Act
  // and the rider proc fires off that swing's resolution. Sibling
  // bypass to validate.ts's actsAvailable skip.
  if (state.turnState !== null && !action.isReaction && !isRider) {
    workingState = decrementActBudget(workingState);
  }

  // Action Speed gate. actionSpeed > 0 → spawn a ChargedAction with
  // `ct: 0, speed: actionSpeed` and apply the Charging status to the
  // caster. Effect resolution happens later via charged_action_resolve.
  // actionSpeed === 0 → resolve immediately.
  //
  // Per Session 31 (ADR-0068): rider casts (`riderSource !== undefined`)
  // bypass the charge path and resolve instantly regardless of the
  // ability's authored `actionSpeed`. Bolt Hammer procs Lightning Strike
  // (authored `actionSpeed: 30`) directly via this gate — the proc is
  // the weapon's power, fired against the target on the same swing's
  // resolution rather than queued for the target to charge through.
  // The sibling bypasses for MP affordability and `onActionAttempted`
  // (Silence / Stop / Don't Act) also key off `riderSource`; this is
  // the fourth such bypass site (per ADR-0064's "one bypass, three
  // semantics" rationale, now four).
  if (ability.actionSpeed > 0 && !isRider) {
    return commitCharged(workingState, action, ability, actor, catalog, mpCost);
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
    ...(action.isReaction === true ? { isReaction: true } : {}),
  });

  // onActionResolved fires once per UseAbility against the actor's
  // hooks (per session 18). The actor reference is re-fetched from the
  // resolved state so any self-mutation (rare; v1 has no consumer that
  // does this on the instant path) is reflected. Skipped if the actor
  // was KO'd mid-resolution (extreme edge: a self-targeting ability
  // that returns reactions that KO the caster — no v1 case).
  const generatedActions: ProposedAction[] = [...resolved.generatedActions];
  const postActor = resolved.newState.units.get(actor.id);
  if (postActor !== undefined && postActor.vitals.hp > 0) {
    const resolvedEmissions = runOnActionResolved(resolved.newState, catalog, {
      unit: postActor,
      action: incomingProposed,
      ability,
    });
    for (const a of resolvedEmissions) generatedActions.push(a);
  }

  // ADR-0074 amendment: record the caster's actual post-cast MP from the
  // committed state, so the renderer settles its MP bar from this absolute
  // rather than `snap.mp - mpSpent` arithmetic. KO'd-self casts still leave
  // the actor in state (KO is derived; removal is a later generatedAction),
  // so the read resolves.
  const casterMpAfter = resolved.newState.units.get(actor.id)?.vitals.mp;

  const outcome: UseAbilityOutcome = {
    kind: 'use_ability',
    abilityId: ability.id,
    perTargetResults: resolved.perTargetResults,
    mpSpent: mpCost,
    ...(casterMpAfter !== undefined ? { mpAfter: casterMpAfter } : {}),
  };

  return {
    newState: resolved.newState,
    outcome,
    generatedActions,
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
  mpCost: number,
): ReduceResult<UseAbilityOutcome> {
  const targets = buildTargetRefs(action.payload.target);
  const caId = chargedActionId(`ca:${actor.id}:${action.sequenceNumber}`);

  // Action speed routed through `computeBaseActionSpeed` so equipment /
  // status `modifyActionSpeed` contributors compose into the stored
  // value (per ADR-0056). The line-264 `ability.actionSpeed > 0`
  // charged-vs-instant gate stays on the unmodified base so equipment
  // can't flip an instant ability into a charged one.
  const charged: ChargedAction = {
    id: caId,
    casterId: actor.id,
    abilityId: ability.id,
    ct: 0,
    speed: computeBaseActionSpeed(state, catalog, actor, ability),
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

  // ADR-0074 amendment: a charged cast deducts MP at this commit (the
  // `workingState` above already has it removed). Record the absolute so
  // the renderer settles the caster's MP bar in sync with the cast beat.
  const casterMpAfter = workingState.units.get(actor.id)?.vitals.mp;

  const outcome: UseAbilityOutcome = {
    kind: 'use_ability',
    abilityId: ability.id,
    perTargetResults: [],
    mpSpent: mpCost,
    ...(casterMpAfter !== undefined ? { mpAfter: casterMpAfter } : {}),
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
  // When `true`, the cast itself is a reaction (e.g. Discharge Strike
  // emitted by `runOnActionTargeted` against an inbound hit). Reactions
  // never trigger further reactions — see `docs/design/action-resolution.md`
  // ("Type-based suppression"). The flag rides through to the
  // `runOnActionTargeted` call below, which short-circuits when set.
  // Defaults to `false` for the volitional / charged-resolve paths.
  readonly isReaction?: boolean;
  // What goes into the AbilityTargetResult.target field. For unit
  // targets this is `{ kind: 'unit', unitId }`; for self this is
  // `{ kind: 'self' }`; for tile-anchored this is the tile or the unit
  // ultimately resolved on it (caller decides).
  readonly payloadTargetForResult: AbilityTarget;
  // The original payload target's anchor position — used to derive the
  // uniform knockback direction (caster → effectAnchorPosition cardinal)
  // for damage.knockback riders, including AoE casts where the per-
  // target body sees a per-target unit but the knockback direction must
  // be uniform across all hit targets. For non-AoE single-target,
  // dispatchers set this to the resolved target's position.
  readonly effectAnchorPosition: Position;
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
  // AoE cluster size for chain-damage scaling (per ADR-0032). Single-
  // target callers omit (defaults to 1 in the pipeline); AoE callers
  // pass `affected.length` so every target sees the same scaled
  // power_coefficient via `damage.chainBonus`.
  readonly targetCount?: number;
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
  let absorbed = false;
  // Records the new position when a knockback rider successfully
  // displaced the target. Populated below; threaded onto the per-target
  // result so the renderer can settle the sprite to the new tile at
  // flash finalize. Per Session 31.5 (bug A).
  let displacedTo: Position | undefined;
  const pipelineEmissions: ProposedAction[] = [];
  if (args.ability.effects.damage !== undefined && args.targetUnit !== null) {
    const targetBefore = workingState.units.get(args.targetUnit.id);
    damageContext = runDamagePipeline({
      state: workingState,
      catalog,
      attacker: args.attacker,
      target: args.targetUnit,
      ability: args.ability,
      sourceActionSeq: args.sourceActionSeq,
      seed: args.seed,
      registry: defaultDamageHandlers,
      ...(args.targetCount !== undefined ? { targetCount: args.targetCount } : {}),
    });
    workingState = applyDamageToTarget(workingState, damageContext);
    if (damageContext.damageTags.has('healing')) {
      healingDealt = damageContext.finalDamage ?? 0;
      // Absorption flag: the result is healing-flagged but the ability
      // wasn't natively healing — the resistance pipeline flipped it.
      // Per ADR-0057, this distinguishes "absorbed Lightning Strike for
      // 12 HP" from "Cure healed for 12 HP" in the action log.
      const nativelyHealing = args.ability.effects.damage.tags.includes('healing');
      absorbed = !nativelyHealing;
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
    // Source-KO sweep (per ADR-0028): when the damage just KO'd the
    // target, statuses anchored to that target with `removeOnSourceKO`
    // should auto-remove. Emit one `status_remove` per affected
    // (unit, type) pair onto the pipeline emissions list.
    const targetAfter = workingState.units.get(args.targetUnit.id);
    if (detectKO(targetBefore, targetAfter)) {
      for (const a of collectSourceKoSweep(workingState, args.targetUnit.id, catalog)) {
        pipelineEmissions.push(a);
      }
      workingState = clearChargedActionsForCaster(workingState, args.targetUnit.id);
    }
  }

  // Damage riders (per session 18, Water Mage). Both gated on a
  // successful damage application: `damageContext.hit === true` AND the
  // target is still alive (KO'd target's CT / position are meaningless).
  // Both fire BEFORE the status-effect chance roll and reactions so the
  // CT change / position change is reflected in subsequent state reads.
  const damage = args.ability.effects.damage;
  if (
    damage !== undefined &&
    args.targetUnit !== null &&
    damageContext !== null &&
    damageContext.hit
  ) {
    const targetCurrent = workingState.units.get(args.targetUnit.id);
    if (targetCurrent !== undefined && targetCurrent.vitals.hp > 0) {
      // CT push rider — deterministic on-hit. Skipped on healing-tagged
      // attacks (the rider is for damage-flavored CT manipulation).
      // Final delta uses the caster's MA via runModifyStatQuery so
      // status / equipment MA modifiers compose.
      if (
        damage.ctPush !== undefined &&
        !damageContext.damageTags.has('healing') &&
        (damageContext.finalDamage ?? 0) > 0
      ) {
        const ma = runModifyStatQuery(workingState, catalog, {
          unit: args.attacker,
          statName: 'ma',
          baseValue: args.attacker.baseStats.ma,
        });
        const magnitude = Math.floor(damage.ctPush.factor * ma);
        if (magnitude > 0) {
          pipelineEmissions.push({
            type: 'system_ct_push',
            source: 'system',
            payload: {
              targetId: targetCurrent.id,
              delta: -magnitude,
              source: {
                kind: 'damage_rider',
                abilityId: args.ability.id,
                attackerId: args.attacker.id,
              },
            },
          });
        }
      }

      // Knockback rider. Chance is rolled per target when `chance` is
      // set; deterministic when omitted. Direction is uniform across
      // an AoE — caster→effectAnchorPosition cardinal, captured by the
      // dispatcher before per-target dispatch.
      //
      // Session 31.5: when knockback displaces the target, the new
      // position is recorded onto the per-target result (`displacedTo`)
      // so the renderer can settle its snapshot to the destination at
      // flash finalize. Pre-31.5 the engine state updated correctly but
      // the renderer's sprite stayed on the original tile.
      if (damage.knockback !== undefined) {
        let chanceLanded = true;
        if (damage.knockback.chance !== undefined) {
          const roll = rollAbilityChance({
            state: workingState,
            catalog,
            caster: args.attacker,
            target: targetCurrent,
            baseChance: damage.knockback.chance,
            seed: args.seed,
            ...(damage.knockback.factors !== undefined
              ? { factors: damage.knockback.factors }
              : {}),
          });
          chanceLanded = roll.applied;
        }
        if (chanceLanded) {
          const direction: KnockbackDirection = cardinalFromTo(
            args.attacker.position,
            args.effectAnchorPosition,
          );
          const knockResult = applyKnockback({
            state: workingState,
            unit: targetCurrent,
            direction,
            distance: damage.knockback.distance,
          });
          if (knockResult.stepsTaken > 0) {
            // Apply the position update. The path is logged on the
            // result for future renderer consumption (a knockback
            // animation). Session 31.5: also record the destination
            // onto the per-target result's `displacedTo` so the
            // animator settles `snap.position` at flash finalize. Pre-
            // 31.5 the renderer's sprite stayed on the original tile
            // until the unit's next Move action.
            workingState = withUnit(workingState, {
              ...targetCurrent,
              position: knockResult.finalPosition,
            });
            displacedTo = knockResult.finalPosition;
          }
          if (knockResult.fallingDamageAction !== undefined) {
            pipelineEmissions.push(knockResult.fallingDamageAction);
          }
        }
      }
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
    let lastEffectIndex = -1;
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
      // Per session 19: `linkRoll` shares the previous effect's
      // effectIndex so the seed-derived `roll` is identical. When the
      // chance computation also matches (same baseChance/factors/
      // resistance), the `applied` outcome is identical too — used by
      // Fire Strike/Embrace for linked dual stat shifts. Ignored on
      // the first effect (no previous index to share).
      const useEffectIndex =
        spec.linkRoll === true && lastEffectIndex >= 0 ? lastEffectIndex : effectIndex;
      const chanceResult = rollStatusChance({
        state: workingState,
        catalog,
        caster: args.attacker,
        target: targetUnit,
        statusType,
        ability: args.ability,
        baseChance: spec.baseChance ?? 100,
        seed: args.seed,
        effectIndex: useEffectIndex,
        ...(spec.factors !== undefined ? { factors: spec.factors } : {}),
        ...(spec.applyAlways !== undefined ? { applyAlways: spec.applyAlways } : {}),
      });
      lastEffectIndex = useEffectIndex;
      if (useEffectIndex === effectIndex) effectIndex++;
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
          ...(spec.stackQuantity !== undefined ? { stackQuantity: spec.stackQuantity } : {}),
        },
        catalog,
      );
      workingState = applied.newState;
      statusOutcomes.push(applied.result);
    }
  }

  // Free-standing CT effects (per session 18). Each entry rolls the
  // ability-chance gate (Faith × MA × baseChance), then emits a
  // `system_ct_push` against the chosen target. Distinct from
  // `damage.ctPush` (deterministic on-hit damage rider). KO'd targets
  // are skipped for `target: 'primary_target'`; `target: 'caster'`
  // always fires (caster is alive by construction inside this function).
  if (args.ability.effects.ctEffects !== undefined && !targetKO) {
    let ctEffectIndex = 0;
    for (const spec of args.ability.effects.ctEffects) {
      if (spec.target === 'caster' && !applyCasterEffects) continue;
      const targetUnitId =
        spec.target === 'caster'
          ? args.attacker.id
          : args.targetUnit !== null
            ? args.targetUnit.id
            : null;
      if (targetUnitId === null) {
        throw new Error(
          `resolveAbilityEffect: ctEffect targets primary_target but ability ${JSON.stringify(args.ability.id)} has no unit target`,
        );
      }
      const recipientUnit = workingState.units.get(targetUnitId);
      if (recipientUnit === undefined || recipientUnit.vitals.hp <= 0) {
        ctEffectIndex++;
        continue;
      }
      // Chance gate: run the ability-chance roll when `baseChance` is
      // declared (Faith × MA factors compose). When `baseChance` is
      // omitted, fire deterministically — the spec's "always" expression.
      let chanceLanded = true;
      if (spec.baseChance !== undefined) {
        const roll = rollAbilityChance({
          state: workingState,
          catalog,
          caster: args.attacker,
          target: recipientUnit,
          baseChance: spec.baseChance,
          seed: args.seed,
          effectIndex: ctEffectIndex + 1, // offset from knockback's index 0 within the ability-chance stream
          ...(spec.factors !== undefined ? { factors: spec.factors } : {}),
        });
        chanceLanded = roll.applied;
      }
      ctEffectIndex++;
      if (!chanceLanded) continue;
      const ma = runModifyStatQuery(workingState, catalog, {
        unit: args.attacker,
        statName: 'ma',
        baseValue: args.attacker.baseStats.ma,
      });
      const magnitude = Math.floor(spec.factor * ma);
      if (magnitude === 0) continue;
      pipelineEmissions.push({
        type: 'system_ct_push',
        source: 'system',
        payload: {
          targetId: targetUnitId,
          delta: magnitude,
          source: {
            kind: 'ct_effect',
            abilityId: args.ability.id,
            attackerId: args.attacker.id,
          },
        },
      });
    }
  }

  // Post-application reactions: onActionTargeted on the target's hooks.
  // The runner stamps each emission with `reactorId: target.id`; the
  // commit-time cap accounts on that field independent of the emitted
  // action's `actorId` shape.
  //
  // Type-based suppression (per `docs/design/action-resolution.md`,
  // "Chain termination"): when the *incoming* action is itself a
  // reaction (`args.isReaction === true`), do NOT enumerate further
  // reactions. This blocks the Discharge → Discharge → Discharge ping-
  // pong surfaced in S38 playtest: a Lightning Mage's spell hits a
  // second Lightning Mage, the target's Discharge fires back, and
  // without this guard the original caster's own Discharge would fire
  // off the reaction's inbound hit. The per-unit-per-turn reaction cap
  // (1 by default) coincidentally limits the depth in some cases, but
  // a chain across two reactors (each with cap 1) still slips through;
  // this guard catches it at the source.
  const reactions: GeneratedReaction[] = [];
  if (args.targetUnit !== null && damageContext !== null && args.isReaction !== true) {
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

  // Per ADR-0074: record the target unit's actual post-application HP so
  // the renderer settles its visual from engine truth rather than from
  // `damage` / `healing` arithmetic (which diverges when the engine gates
  // an application — e.g. a heal on a KO'd target).
  const hpAfter =
    args.targetUnit !== null
      ? workingState.units.get(args.targetUnit.id)?.vitals.hp
      : undefined;

  const result: AbilityTargetResult = {
    target: args.payloadTargetForResult,
    hit: damageContext !== null ? damageContext.hit : true,
    ...(damageDealt !== undefined ? { damage: damageDealt } : {}),
    ...(healingDealt !== undefined ? { healing: healingDealt } : {}),
    ...(absorbed ? { absorbed: true } : {}),
    ...(statusOutcomes.length > 0 ? { statusesApplied: statusOutcomes } : {}),
    ...(displacedTo !== undefined ? { displacedTo } : {}),
    ...(hpAfter !== undefined ? { hpAfter } : {}),
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
  // Forwarded to `resolveAbilityEffect` so the reaction-trigger guard
  // fires when the cast itself is a reaction. See `ResolveAbilityEffectArgs`.
  readonly isReaction?: boolean;
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
  const result =
    aoe === undefined
      ? resolveSingleTargetDispatch(state, catalog, args)
      : resolveAoeDispatch(state, catalog, args, aoe);

  // Per-cast self-damage cost (ADR-0032). Fires once per resolved cast,
  // independent of cluster size or hit/miss. Emitted as a labeled
  // `system_damage` so the downstream reducer floors HP at 0; the
  // labeled source enables a future preventer to gate via
  // `onActionAttempted`. Skipped when the caster is already at 0 HP at
  // dispatch time (defensive — a charged Storm Caller whose caster died
  // mid-charge wouldn't reach this point anyway since
  // `reduceChargedActionResolve` short-circuits on caster KO).
  const selfDamage = args.ability.selfDamage;
  if (selfDamage !== undefined) {
    const caster = result.newState.units.get(args.attacker.id);
    if (caster !== undefined && caster.vitals.hp > 0) {
      const amount = Math.floor(selfDamage.fraction * caster.baseStats.maxHpBase);
      if (amount > 0) {
        const emission: ProposedAction = {
          type: 'system_damage',
          source: 'system',
          payload: {
            targetId: caster.id,
            amount,
            tags: [],
            source: {
              kind: 'ability_self_cost',
              abilityId: args.ability.id,
              casterId: caster.id,
            },
          },
        };
        return {
          ...result,
          generatedActions: [...result.generatedActions, emission],
        };
      }
    }
  }

  return result;
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
  const effectAnchorPosition = resolveAoeAnchor(state, args.payloadTarget, args.attacker);
  const resolved = resolveAbilityEffect(state, catalog, {
    ability: args.ability,
    attacker: args.attacker,
    targetUnit,
    payloadTargetForResult: args.payloadTarget,
    effectAnchorPosition,
    incomingProposed: args.incomingProposed,
    sourceActionSeq: args.sourceActionSeq,
    seed: perTargetSeed(args.seed, 0),
    ...(args.isReaction === true ? { isReaction: true } : {}),
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
  // Same gate for ctEffects (per session 18). v1 has no AoE ability with
  // a caster-target CT effect; the once-per-cast caster-effect handling
  // lands when a content consumer needs it.
  for (const spec of args.ability.effects.ctEffects ?? []) {
    if (spec.target === 'caster') {
      throw new Error(
        `resolveAbilityTargets: ability ${JSON.stringify(args.ability.id)} declares an AoE and a caster-target ctEffect — this combination is not supported in v1`,
      );
    }
  }

  // Anchor position. `anchorMode === 'caster'` (Maelstrom-style cones)
  // anchors at the caster's tile and uses the payload target only for
  // direction; default `'target'` blooms from the targeted tile / unit
  // position (Earth Quake, Earth Cataclysm).
  const anchorMode = aoe.anchorMode ?? 'target';
  const anchorPos =
    anchorMode === 'caster'
      ? args.attacker.position
      : resolveAoeAnchor(state, args.payloadTarget, args.attacker);
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

  // Direction for directional shapes (cone, line). Derived from
  // caster→target-tile cardinal vector; required when shape is 'cone' or
  // 'line'. Throws if the ability author paired a directional shape with
  // `anchorMode: 'target'` — content error (these shapes need caster→
  // target geometry to project from).
  let direction: CardinalDirection | undefined;
  if (finalShape.kind === 'cone' || finalShape.kind === 'line') {
    if (anchorMode !== 'caster') {
      throw new Error(
        `resolveAoeDispatch: ${finalShape.kind} shapes require anchorMode 'caster' (ability ${JSON.stringify(args.ability.id)})`,
      );
    }
    const targetPos = resolveAoeAnchor(state, args.payloadTarget, args.attacker);
    direction = cardinalFromTo(args.attacker.position, targetPos);
  }

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
    ...(direction !== undefined ? { direction } : {}),
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

  // Original anchor for knockback-direction derivation. For AoE casts,
  // the knockback direction is uniform across targets — caster→original
  // anchor cardinal — even when the AoE itself anchors at the caster
  // (cone). Captured before per-target dispatch so all targets see the
  // same direction.
  const originalAnchorForKnockback = resolveAoeAnchor(state, args.payloadTarget, args.attacker);

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
      effectAnchorPosition: originalAnchorForKnockback,
      incomingProposed: args.incomingProposed,
      sourceActionSeq: args.sourceActionSeq,
      seed: perTargetSeed(args.seed, i),
      applyCasterEffects: false,
      // ADR-0032: pass the cluster size so chainBonus-scaled power
      // reads uniformly across the cluster.
      targetCount: affected.length,
      ...(args.isReaction === true ? { isReaction: true } : {}),
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
  // Session 31.5 (bug B / ADR-0070): healing-tagged effects don't raise
  // a KO'd target's HP. This covers two cases with the same gate:
  //   - The absorption tag-flip path (ADR-0057): a Lightning attack on
  //     a unit with +150 Lightning resistance flips to healing in the
  //     cap stage. If the target was already KO'd from earlier damage
  //     in the chain, the absorption-flipped heal would revive them —
  //     bringing a KO'd unit back to HP > 0, which the scheduler then
  //     picks up for a normal turn. (Reproduced via playtest.)
  //   - Explicit healing abilities (Cure, future content): match the
  //     FFT precedent that ambient healing doesn't revive — explicit
  //     Raise / Phoenix Down is required (deferred in v1).
  // Parallel to system_apply_status's KO'd-target gate at line 1855.
  if (isHealing && currentTarget.vitals.hp <= 0) return state;
  const nextHp = isHealing
    ? currentTarget.vitals.hp + finalDamage
    : Math.max(0, currentTarget.vitals.hp - finalDamage);
  const updated: Unit = {
    ...currentTarget,
    vitals: { ...currentTarget.vitals, hp: nextHp },
  };
  return withUnit(state, updated);
}

// Source-KO sweep (per ADR-0028): when `koUnitId` just dropped to 0
// HP, scan every unit's statuses for instances whose source.unitId
// matches AND whose StatusEffectType.removeOnSourceKO === true; emit
// one `status_remove` system action per affected (target, type) pair.
//
// v1 consumer is Taunted: when the Knight that taunted goes down, the
// Taunted enemy reverts. Multiple instances of the same type on the
// same unit collapse to a single emission — `removeStatus` strips all
// matching instances at once.
//
// Read-only: this function returns the emissions but does not mutate
// state. The caller threads them onto its `generatedActions` for
// commitAction to enqueue.
function collectSourceKoSweep(
  state: GameState,
  koUnitId: UnitId,
  catalog: Catalog,
): ProposedAction[] {
  const emissions: ProposedAction[] = [];
  for (const unit of state.units.values()) {
    const seenTypes = new Set<StatusTypeId>();
    for (const inst of unit.statuses) {
      if (inst.source.unitId !== koUnitId) continue;
      if (seenTypes.has(inst.typeId)) continue;
      const type = catalog.getStatusType(inst.typeId);
      if (type.removeOnSourceKO !== true) continue;
      seenTypes.add(inst.typeId);
      emissions.push({
        type: 'status_remove',
        source: 'system',
        payload: { targetId: unit.id, statusTypeId: inst.typeId },
      });
    }
  }
  return emissions;
}

// On caster KO, drop any in-flight ChargedActions belonging to that
// caster from the queue. The default semantics (per Chris, post-S38
// playtest): a dead caster's spell does not resolve. The pre-existing
// fizzle-at-resolve path in `reduceChargedActionResolve` becomes
// unreachable in normal flow once this strips the entry; it remains as
// a defensive backstop for any path that reaches resolve with a KO'd
// caster (e.g. a future ability that KO's a unit *during* their own
// charge resolution). Future content can opt out per-ability if a
// "spell completes from the grave" mechanic is desired.
//
// Charging cleanup rides the existing `collectSourceKoSweep`: Charging
// is self-applied (source.unitId = caster), and `removeOnSourceKO: true`
// on the type causes the sweep to emit a `status_remove`.
function clearChargedActionsForCaster(state: GameState, koUnitId: UnitId): GameState {
  const filtered = state.chargedActions.filter((c) => c.casterId !== koUnitId);
  if (filtered.length === state.chargedActions.length) return state;
  return { ...state, chargedActions: filtered };
}

// Detect whether `unit` transitioned from alive (HP > 0) to KO'd
// (HP === 0) between `before` and `after`. Defensive against the
// damage handler's defensive returns that pass through unchanged
// state — only fires when the unit's HP actually changed downward
// across the boundary.
function detectKO(
  before: Unit | undefined,
  after: Unit | undefined,
): boolean {
  if (before === undefined || after === undefined) return false;
  return before.vitals.hp > 0 && after.vitals.hp === 0;
}

// Whether a status's type ticks once per the holder's CT-100 boundary.
// Both turn_start fan-outs (skipped + non-skipped) read this so they
// can't drift — pre-session-20a, the non-skipped path was missing the
// custom + on_unit_ct_100 case, so Burn never ticked on a normal turn.
function ticksOnUnitCt100(type: StatusEffectType): boolean {
  return (
    type.durationMode === 'per_unit_ct' ||
    type.durationMode === 'permanent_per_unit_ct' ||
    (type.durationMode === 'custom' && type.customTrigger?.kind === 'on_unit_ct_100')
  );
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
    consumed: { movesConsumed: 0, actsConsumed: 0 },
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
        if (ticksOnUnitCt100(type)) {
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
    if (ticksOnUnitCt100(type)) {
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

  // Determine CT cost based on what was consumed. Per the post-MVP
  // designer call (2026-05-10): Wait is the user-facing "end turn now"
  // action and inherits the consumed-bucket cost rather than carrying a
  // special low cost. The `ctCosts.wait` standalone path applies only
  // when literally nothing was consumed (the "hold for cheap delay"
  // case — user clicks End turn before any Move or Act). The action
  // log distinguishes "user chose to end" from "auto-ended" via the
  // presence of a `wait` action entry; session 25 dropped the
  // decorative `consumed.waited` flag that previously mirrored that.
  const ruleset = catalog.getRuleset(state.ruleset.id);
  const consumed = state.turnState.consumed;
  let ctCost: number;
  if (consumed.movesConsumed > 0 && consumed.actsConsumed > 0) ctCost = ruleset.ctCosts.moveAndAct;
  else if (consumed.actsConsumed > 0) ctCost = ruleset.ctCosts.actOnly;
  else if (consumed.movesConsumed > 0) ctCost = ruleset.ctCosts.moveOnly;
  else ctCost = ruleset.ctCosts.wait; // nothing consumed → cheap wait cost

  // Subtract from actual CT, floor at 0 — same shape as projection.
  const newCT = Math.max(0, unit.ct - ctCost);
  const newUnit: Unit = { ...unit, ct: newCT };

  // Per ADR-0053: fire `onTurnEnd` against the unit's hooks before
  // `turnState` is cleared, so handlers can read `state.turnState.consumed`
  // to gate on what was committed this turn. The unit visible to handlers
  // already has its CT decremented (mid-turn-end snapshot) but
  // `state.turnState` still exposes `consumed`. Quickstep is the first
  // emitting consumer; legacy void-return handlers continue to type-check.
  const turnEndState = withUnit(state, newUnit);
  const turnEndEmissions = runOnTurnEnd(turnEndState, catalog, { unit: newUnit });

  // Generate status_tick for turn-based statuses on this unit (their
  // duration ticks at turn end per turn-structure.md). Per-unit-CT
  // statuses have already ticked at turn_start.
  const generated: ProposedAction[] = [...turnEndEmissions];
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

  // Battle-outcome evaluation is no longer turn_end's concern. Per
  // ADR-0074, `commitAction` checks the victory conditions after *every*
  // action commits — so a charged-action resolve, a status tick, or a
  // reaction that eliminates the last enemy decides the battle at the
  // moment it happens, not at the next turn_end boundary.
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

  // Per ADR-0030: 'custom' durationMode is event-driven; the status's
  // own onTick handler manages its lifecycle (Burn emits a
  // status_decrement_stack alongside its damage). Skip the
  // engine's duration decrement entirely.
  const type = catalog.getStatusType(statusTypeId);
  if (type.durationMode === 'custom') {
    return {
      newState: state,
      outcome: { kind: 'status_tick', unitId, statusTypeId, removed: false },
      generatedActions: emissions,
    };
  }

  // Decrement remaining duration. null durations (permanent / conditional)
  // never tick down and never expire here.
  if (instance.remainingDuration === null) {
    return {
      newState: state,
      outcome: { kind: 'status_tick', unitId, statusTypeId, removed: false },
      generatedActions: emissions,
    };
  }
  // Per ADR-0060: route the per-tick decrement through
  // `modifyStatusTickAmount`. Default baseAmount 1; equipment (Purifier
  // × 2 on `negative`-tagged statuses) multiplies. Floor at 1 so a
  // pathological 0-or-negative chain product doesn't freeze a status
  // forever; floor at remainingDuration so we never overdraw past
  // expiry. Multiplicative-only chain semantics for v1 — additive
  // shifts can be expressed as factors (× 2 = "doubles per tick").
  const tickAmountRaw = runModifyStatusTickAmount(state, catalog, {
    unit,
    statusTypeId,
    statusTags: type.tags,
    baseAmount: 1,
  });
  const decrement = Math.max(1, Math.floor(tickAmountRaw));
  const nextDuration = instance.remainingDuration - decrement;

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
    // Target removed mid-chain — silent no-op. `hpAfter` absent (no unit
    // in state to settle against).
    return {
      newState: state,
      outcome: { kind: 'system_heal', targetId, amount, applied: 0 },
      generatedActions: [],
    };
  }
  if (target.vitals.hp <= 0) {
    // ADR-0074 amendment: gated heal on a KO'd target — `hpAfter` reports
    // the unchanged HP (the KO walker / renderer anchor to truth, not the
    // `applied` delta which is 0 here anyway).
    return {
      newState: state,
      outcome: { kind: 'system_heal', targetId, amount, applied: 0, hpAfter: target.vitals.hp },
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
      outcome: { kind: 'system_heal', targetId, amount, applied: 0, hpAfter: target.vitals.hp },
      generatedActions: [],
    };
  }
  const newTarget: Unit = {
    ...target,
    vitals: { ...target.vitals, hp: target.vitals.hp + applied },
  };
  return {
    newState: withUnit(state, newTarget),
    outcome: { kind: 'system_heal', targetId, amount, applied, hpAfter: newTarget.vitals.hp },
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
  catalog: Catalog,
): ReduceResult<SystemDamageOutcome> {
  const { targetId, amount: baseAmount, source, tags } = action.payload;
  const target = state.units.get(targetId);
  if (target === undefined) {
    // Target removed mid-chain — `hpAfter` absent (no unit to settle against).
    return {
      newState: state,
      outcome: { kind: 'system_damage', targetId, amount: baseAmount, applied: 0 },
      generatedActions: [],
    };
  }
  if (target.vitals.hp <= 0) {
    // ADR-0074 amendment: already-KO'd target — `hpAfter` reports the
    // unchanged HP (engine-clamped, ≤ 0).
    return {
      newState: state,
      outcome: {
        kind: 'system_damage',
        targetId,
        amount: baseAmount,
        applied: 0,
        hpAfter: target.vitals.hp,
      },
      generatedActions: [],
    };
  }
  // Per ADR-0052: target's `modifySystemDamage` chain may reduce or zero
  // the running amount before HP is touched. Bedrock Stride uses this
  // to nullify falling damage. Floor at 0 — handlers may return negative
  // values; we clamp here rather than asking each handler to clamp.
  const modifiedAmount = Math.max(
    0,
    runModifySystemDamage(state, catalog, {
      unit: target,
      source,
      tags: new Set(tags),
      baseAmount,
    }),
  );
  const applied = Math.max(0, Math.min(modifiedAmount, target.vitals.hp));
  if (applied === 0) {
    return {
      newState: state,
      outcome: {
        kind: 'system_damage',
        targetId,
        amount: modifiedAmount,
        applied: 0,
        hpAfter: target.vitals.hp,
      },
      generatedActions: [],
    };
  }
  const newTarget: Unit = {
    ...target,
    vitals: { ...target.vitals, hp: target.vitals.hp - applied },
  };
  let newState = withUnit(state, newTarget);
  // Source-KO sweep (per ADR-0028): system damage that KOs a unit
  // triggers the same auto-removal sweep as ability damage.
  const generatedActions: ProposedAction[] = [];
  if (detectKO(target, newTarget)) {
    for (const a of collectSourceKoSweep(newState, targetId, catalog)) {
      generatedActions.push(a);
    }
    newState = clearChargedActionsForCaster(newState, targetId);
  }
  return {
    newState,
    outcome: {
      kind: 'system_damage',
      targetId,
      amount: modifiedAmount,
      applied,
      hpAfter: newTarget.vitals.hp,
    },
    generatedActions,
  };
}

// --- system_mp_drain ---
//
// Engine-emitted MP transfer used by Rasp Pendant (Session 31) and any
// future damage-to-MP-drain effects. Distinct from system_damage /
// system_heal because the resource moved is MP, not HP, and the action
// models a transfer (source gains; target loses) rather than a one-sided
// write. Per ADR-0065 (Session 30).
//
// Transfer-bounded math:
//   targetApplied = min(target.vitals.mp, requested)        // floor at 0
//   sourceApplied = min(maxMp(source) − source.mp, targetApplied)
// so the source never goes above maxMp, and never gains more than the
// target actually had to give. The source's MP rises by sourceApplied;
// the target's MP falls by targetApplied. (The two CAN differ when the
// source is near MP cap — the spillover is lost; no buffer.)
//
// Missing source / target short-circuits to all-zero applied fields.
// The entry is still logged for action-log readability so a downstream
// "drain emitted but the unit no longer exists" trace is recoverable.
//
// Session 31.5 / ADR-0069: the prior `vitals.hp <= 0` short-circuit was
// dropped. The contributor's pre-fire gate (`finalDamageDrainContributor`
// reads pre-damage HP) already filters "target was already dead before
// the swing" — a no-emission case. The reducer's same check then bit
// a different scenario: when the swing's damage KO'd the target this
// chain, the drain emission was already queued at pre-damage HP > 0,
// but by the time the reducer ran (after `applyDamageToTarget`), the
// target's HP was 0 and the reducer zeroed the transfer. The drain
// represents "10% of the damage you just dealt" — it should apply
// whether or not the target survived the hit. MP doesn't need HP
// to transfer; the reducer now reads MP directly.
export function reduceSystemMpDrain(
  state: GameState,
  action: Extract<Action, { type: 'system_mp_drain' }>,
  catalog: Catalog,
): ReduceResult<SystemMpDrainOutcome> {
  const { source: sourceId, target: targetId, amount: requested } = action.payload;
  const sourceUnit = state.units.get(sourceId);
  const targetUnit = state.units.get(targetId);
  if (sourceUnit === undefined || targetUnit === undefined) {
    // ADR-0074 amendment: populate the MP absolutes per-unit for whichever
    // end is still in state; absent for the missing end (nothing to settle).
    return {
      newState: state,
      outcome: {
        kind: 'system_mp_drain',
        source: sourceId,
        target: targetId,
        requested,
        targetApplied: 0,
        sourceApplied: 0,
        ...(sourceUnit !== undefined ? { sourceMpAfter: sourceUnit.vitals.mp } : {}),
        ...(targetUnit !== undefined ? { targetMpAfter: targetUnit.vitals.mp } : {}),
      },
      generatedActions: [],
    };
  }
  const safeRequested = Math.max(0, Math.floor(requested));
  const targetApplied = Math.min(targetUnit.vitals.mp, safeRequested);
  const sourceMaxMp = runModifyStatQuery(state, catalog, {
    unit: sourceUnit,
    statName: 'maxMp',
    baseValue: sourceUnit.baseStats.maxMpBase,
  });
  const sourceRoom = Math.max(0, sourceMaxMp - sourceUnit.vitals.mp);
  const sourceApplied = Math.min(sourceRoom, targetApplied);
  if (targetApplied === 0 && sourceApplied === 0) {
    // Gated all-zero path (both units exist; nothing transferred). Populate
    // the MP absolutes with the unchanged values so the renderer settles
    // from truth rather than re-deriving.
    return {
      newState: state,
      outcome: {
        kind: 'system_mp_drain',
        source: sourceId,
        target: targetId,
        requested,
        targetApplied: 0,
        sourceApplied: 0,
        sourceMpAfter: sourceUnit.vitals.mp,
        targetMpAfter: targetUnit.vitals.mp,
      },
      generatedActions: [],
    };
  }
  let nextState = state;
  if (targetApplied > 0) {
    const newTarget: Unit = {
      ...targetUnit,
      vitals: { ...targetUnit.vitals, mp: targetUnit.vitals.mp - targetApplied },
    };
    nextState = withUnit(nextState, newTarget);
  }
  if (sourceApplied > 0) {
    // Re-read the source in case `withUnit` returned a new GameState with
    // a different unit reference (it doesn't today, but cheap to be safe).
    const refreshedSource = nextState.units.get(sourceId) ?? sourceUnit;
    const newSource: Unit = {
      ...refreshedSource,
      vitals: { ...refreshedSource.vitals, mp: refreshedSource.vitals.mp + sourceApplied },
    };
    nextState = withUnit(nextState, newSource);
  }
  return {
    newState: nextState,
    outcome: {
      kind: 'system_mp_drain',
      source: sourceId,
      target: targetId,
      requested,
      targetApplied,
      sourceApplied,
      sourceMpAfter: nextState.units.get(sourceId)?.vitals.mp ?? sourceUnit.vitals.mp,
      targetMpAfter: nextState.units.get(targetId)?.vitals.mp ?? targetUnit.vitals.mp,
    },
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
  const {
    targetId,
    statusTypeId,
    sourceUnitId,
    magnitude,
    duration,
    customState,
    stackQuantity,
    context,
  } = action.payload;
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
  // Per ADR-0071 (Session 32): when `context.kind === 'pre_battle_equipment'`,
  // thread the equipment source through `applyStatus` so the resulting
  // status instance carries `source.kind === 'equipment'` and the
  // equipment id. This preserves the ADR-0028 invariant (equipment-
  // granted instances are immune to in-battle removal until the
  // equipment itself is removed).
  const equipmentSource =
    context !== undefined && context.kind === 'pre_battle_equipment'
      ? { sourceKind: 'equipment' as const, sourceEquipmentId: context.itemId }
      : {};
  const applied = applyStatus(
    state,
    {
      targetId,
      typeId: statusTypeId,
      sourceUnitId,
      sourceActionSeq: action.sequenceNumber,
      ...equipmentSource,
      ...(magnitude !== undefined ? { magnitude } : {}),
      ...(duration !== undefined ? { duration } : {}),
      ...(customState !== undefined ? { customState } : {}),
      ...(stackQuantity !== undefined ? { stackQuantity } : {}),
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

// --- system_ct_push ---
//
// Engine-emitted action that adjusts a unit's CT by a signed delta.
// Used by Water Mage's CT manipulation primitives (session 18):
// damage riders (Water Strike, Tidal Pull's reaction), free-standing
// ctEffects (Tide Surge), and the Flow State support's post-action
// refund. Floors CT at 0; does not cap above 100 (the design permits
// pushes past trigger threshold — see docs/design/ct-system.md).
//
// KO'd targets are skipped (CT manipulation on a corpse is meaningless;
// outcome reports `applied: 0`). Missing target also reports applied: 0
// idempotently — chain-emitted CT pushes against just-removed units
// (rare, but possible in corner cases) don't crash.
export function reduceSystemCtPush(
  state: GameState,
  action: Extract<Action, { type: 'system_ct_push' }>,
): ReduceResult<SystemCtPushOutcome> {
  const { targetId, delta } = action.payload;
  const target = state.units.get(targetId);
  if (target === undefined || target.vitals.hp <= 0) {
    return {
      newState: state,
      outcome: { kind: 'system_ct_push', targetId, delta, applied: 0 },
      generatedActions: [],
    };
  }
  const newCt = Math.max(0, target.ct + delta);
  const applied = newCt - target.ct; // signed; differs from `delta` only when floor clamps
  if (applied === 0) {
    return {
      newState: state,
      outcome: { kind: 'system_ct_push', targetId, delta, applied: 0 },
      generatedActions: [],
    };
  }
  const newTarget: Unit = { ...target, ct: newCt };
  return {
    newState: withUnit(state, newTarget),
    outcome: { kind: 'system_ct_push', targetId, delta, applied },
    generatedActions: [],
  };
}

// --- system_set_ct ---
//
// Engine-emitted action that sets a unit's CT to an absolute value
// (vs. `system_ct_push`'s signed delta). Per ADR-0071 (Session 32), the
// orchestrator's pre-battle phase emits one of these per unit at battle
// setup to log the initial-CT randomization into the action log. Clamps
// to [0, TRIGGER_THRESHOLD - 1] inclusive so no unit can start
// pre-triggered. Missing target is an idempotent no-op (same shape as
// `reduceSystemCtPush`).
export function reduceSystemSetCt(
  state: GameState,
  action: Extract<Action, { type: 'system_set_ct' }>,
): ReduceResult<SystemSetCtOutcome> {
  const { targetId, ct: requested } = action.payload;
  const target = state.units.get(targetId);
  if (target === undefined) {
    // No target: report the requested ct echoed back with previousCt 0.
    return {
      newState: state,
      outcome: { kind: 'system_set_ct', targetId, ct: 0, previousCt: 0 },
      generatedActions: [],
    };
  }
  const clamped = Math.max(0, Math.min(TRIGGER_THRESHOLD - 1, Math.floor(requested)));
  if (clamped === target.ct) {
    return {
      newState: state,
      outcome: { kind: 'system_set_ct', targetId, ct: clamped, previousCt: target.ct },
      generatedActions: [],
    };
  }
  const newTarget: Unit = { ...target, ct: clamped };
  return {
    newState: withUnit(state, newTarget),
    outcome: { kind: 'system_set_ct', targetId, ct: clamped, previousCt: target.ct },
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

  // Per ADR-0030: custom-state-bearing stacking statuses (Burn) need
  // their per-stack metadata transformed alongside the count decrement.
  // The type's customStateOnDecrement method (when defined) returns the
  // new customState to attach to the decremented instance. v1 consumer
  // is Burn — FIFO-shifts stackDamages to drop the oldest stack's value.
  const type = catalog.getStatusType(statusTypeId);
  const newCustomState =
    type.customStateOnDecrement !== undefined
      ? type.customStateOnDecrement(instance)
      : instance.customState;

  const newInstance: StatusInstance = {
    ...instance,
    stacks: nextStacks,
    ...(newCustomState !== undefined ? { customState: newCustomState } : {}),
  };
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

  // onActionResolved fires once per charged-action-resolve against the
  // caster's hooks (per session 18). Skipped if the caster KO'd
  // mid-resolution (charged spells fizzle on caster KO before reaching
  // this point per ADR-0023, but a future indirect-KO path could land
  // here — guard defensively).
  const postCaster = workingState.units.get(caster.id);
  if (postCaster !== undefined && postCaster.vitals.hp > 0) {
    const resolvedEmissions = runOnActionResolved(workingState, catalog, {
      unit: postCaster,
      action: proposedAtResolve,
      ability,
    });
    for (const a of resolvedEmissions) allEmissions.push(a);
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

  // ADR-0074 amendment: record the caster's MP from committed state. A
  // charged cast's MP was spent at the `use_ability` commit, so this is
  // the unchanged current value — it keeps the renderer's MP snapshot
  // anchored without re-deriving. Absent when the caster KO'd / left state.
  const casterMpAfter =
    caster !== null ? newState.units.get(caster.id)?.vitals.mp : undefined;

  const outcome: ChargedActionResolveOutcome = {
    kind: 'charged_action_resolve',
    chargedActionId: ca.id,
    perTargetResults,
    ...(casterMpAfter !== undefined ? { mpAfter: casterMpAfter } : {}),
  };

  return {
    newState,
    outcome,
    generatedActions: pipelineEmissions,
    ...(reactions.length > 0 ? { generatedReactions: reactions } : {}),
  };
}

// =====================================================================
// Session 39a — Alchemist substrate
// =====================================================================

// --- Compound ---
//
// Alchemist's stockpile-build action. Spends `item.compoundMpCost` MP
// and adds 1 of the named item to the unit's stockpile. Self-targeted;
// 100% accuracy; consumes the unit's Act for the turn (standard, not
// instant). Items are catalog-defined consumables (see
// `ConsumableDefinition`). Stockpile is unbounded in v1 per the brief.
//
// No reaction surface: Compound is self-only and produces no effect on
// other units. No `onActionTargeted` fires. Other hooks (Silence on
// 'voice' for example) don't apply — Compound has no ability tags.
//
// The Act-budget decrement runs through the shared `decrementActBudget`
// helper so the consumed.actsConsumed bookkeeping matches UseAbility.

export function reduceUseCompound(
  state: GameState,
  action: Extract<Action, { type: 'use_compound' }>,
  catalog: Catalog,
): ReduceResult<UseCompoundOutcome> {
  if (action.actorId === undefined) {
    throw new Error('reduceUseCompound: action has no actorId');
  }
  if (state.turnState === null) {
    throw new Error('reduceUseCompound: no turn in progress');
  }
  const actor = getUnit(state, action.actorId);
  const item = catalog.getItem(action.payload.itemId);
  if (item.kind !== 'consumable') {
    throw new Error(
      `reduceUseCompound: item ${JSON.stringify(action.payload.itemId)} is not a consumable`,
    );
  }
  const mpCost = item.compoundMpCost;

  // Deduct MP, bump stockpile count, decrement Act budget. All in one
  // pass so the returned newState is committed atomically.
  const have = actor.stockpile.get(item.id) ?? 0;
  const newStockpile = new Map(actor.stockpile);
  newStockpile.set(item.id, have + 1);
  const newMp = actor.vitals.mp - mpCost;
  const newActor: Unit = {
    ...actor,
    vitals: { ...actor.vitals, mp: newMp },
    stockpile: newStockpile,
  };
  const stateAfterUnit = withUnit(state, newActor);
  const newState = decrementActBudget(stateAfterUnit);

  const outcome: UseCompoundOutcome = {
    kind: 'use_compound',
    itemId: item.id,
    mpSpent: mpCost,
    mpAfter: newMp,
    stockpileAfter: have + 1,
  };
  return { newState, outcome, generatedActions: [] };
}

// --- Throw Item ---
//
// Alchemist's stockpile-spend action. Consumes 1 of the named item
// from the unit's stockpile and applies its effects to the target.
// 100% accuracy; range 3 horizontal × 3 vertical with LoS (per the
// brief; see `THROW_ITEM_RANGE` in validate.ts). KO'd targets are
// valid — Phoenix Down revives, non-revival items apply gated zero.
//
// Item effects (per `ConsumableEffects`):
//   - `removeKO`: if target is KO'd, revive (HP=1) and reset turnsKOd.
//   - `hpRestore`: apply caster.PA × coefficient HP via the existing
//     system_heal path (capped at maxHp). Applied AFTER revive so a
//     just-revived unit benefits from the heal.
//   - `mpRestore`: apply caster.PA × coefficient MP via the new
//     system_mp_restore path (capped at maxMp). KO-gated.
//   - `clearStatuses { kind: 'debuff' }`: remove every non-buff status
//     on the target (equipment-sourced statuses immune per ADR-0028).
//     KO isn't a status, so this doesn't touch it.
//
// No reactions fire on Throw Item — items aren't damage-tagged and
// don't enter the `onActionTargeted` chain.
export function reduceUseThrowItem(
  state: GameState,
  action: Extract<Action, { type: 'use_throw_item' }>,
  catalog: Catalog,
): ReduceResult<UseThrowItemOutcome> {
  if (action.actorId === undefined) {
    throw new Error('reduceUseThrowItem: action has no actorId');
  }
  if (state.turnState === null) {
    throw new Error('reduceUseThrowItem: no turn in progress');
  }
  const actor = getUnit(state, action.actorId);
  const item = catalog.getItem(action.payload.itemId);
  if (item.kind !== 'consumable') {
    throw new Error(
      `reduceUseThrowItem: item ${JSON.stringify(action.payload.itemId)} is not a consumable`,
    );
  }
  if (action.payload.target.kind !== 'unit') {
    throw new Error('reduceUseThrowItem: v1 only supports unit targets');
  }
  const targetId = action.payload.target.unitId;
  const target = getUnit(state, targetId);

  // Decrement stockpile by 1.
  const have = actor.stockpile.get(item.id) ?? 0;
  if (have <= 0) {
    throw new Error(
      `reduceUseThrowItem: no ${JSON.stringify(item.id)} in stockpile — validation should have caught this`,
    );
  }
  const stockpileAfter = have - 1;
  const newStockpile = new Map(actor.stockpile);
  if (stockpileAfter === 0) {
    newStockpile.delete(item.id);
  } else {
    newStockpile.set(item.id, stockpileAfter);
  }
  const newActor: Unit = { ...actor, stockpile: newStockpile };

  // Apply effects to the target. Each effect is applied directly to
  // engine state (not emitted as system actions) so the perTargetResult
  // can record the final HP/MP atomically. This keeps the action-log
  // entry single-line and the renderer's settle straightforward.
  let working = withUnit(state, newActor);
  const result = applyConsumableEffects(working, target.id, item, actor, catalog);
  working = result.newState;

  // Decrement Act budget.
  const newState = decrementActBudget(working);

  const outcome: UseThrowItemOutcome = {
    kind: 'use_throw_item',
    itemId: item.id,
    target: action.payload.target,
    perTargetResults: [result.targetResult],
    stockpileAfter,
  };
  return { newState, outcome, generatedActions: result.generatedActions };
}

// Apply a consumable's effects to a single target. Returns the new
// state, the per-target result (used by the Throw Item outcome), and
// any generated system actions (none today — effects apply inline; the
// shape is here for a future item that needs to chain to a system
// emission).
interface ApplyConsumableResult {
  readonly newState: GameState;
  readonly targetResult: AbilityTargetResult;
  readonly generatedActions: ReadonlyArray<ProposedAction>;
}

function applyConsumableEffects(
  state: GameState,
  targetId: UnitId,
  item: ConsumableDefinition,
  caster: Unit,
  catalog: Catalog,
): ApplyConsumableResult {
  let workingState = state;
  let target = getUnit(workingState, targetId);
  let healingTotal = 0;
  let hpAfter = target.vitals.hp;

  // 1) Revive — must run before hpRestore so the heal can land on a
  // just-revived unit (HP > 0). On a non-KO'd target, this is a no-op.
  if (item.effects.removeKO === true && target.vitals.hp <= 0 && !target.removed) {
    target = {
      ...target,
      vitals: { ...target.vitals, hp: 1 },
      turnsKOd: 0,
      // CT resets to 0 — the revived unit re-enters the queue at the
      // bottom rather than instantly re-acting. Per the S39 brief
      // ("resume from 0") and FFT-canonical behavior.
      ct: 0,
    };
    workingState = withUnit(workingState, target);
    hpAfter = target.vitals.hp;
  }

  // 2) HP restore — caster.PA × coefficient, capped at maxHp. Gated to
  // 0 on KO'd targets (the revive branch above already runs first;
  // anything still at HP=0 here means removeKO=false on this item).
  if (item.effects.hpRestore !== undefined) {
    if (target.vitals.hp <= 0 || target.removed) {
      // Gated zero; outcome records 0 healing.
    } else {
      const pa = runModifyStatQuery(workingState, catalog, {
        unit: caster,
        statName: 'pa',
        baseValue: caster.baseStats.pa,
      });
      const requested = pa * item.effects.hpRestore.coefficient;
      const maxHp = runModifyStatQuery(workingState, catalog, {
        unit: target,
        statName: 'maxHp',
        baseValue: target.baseStats.maxHpBase,
      });
      const room = Math.max(0, maxHp - target.vitals.hp);
      const applied = Math.max(0, Math.min(requested, room));
      if (applied > 0) {
        target = {
          ...target,
          vitals: { ...target.vitals, hp: target.vitals.hp + applied },
        };
        workingState = withUnit(workingState, target);
      }
      healingTotal += applied;
      hpAfter = target.vitals.hp;
    }
  }

  // 3) MP restore — caster.PA × coefficient, capped at maxMp. Gated to
  // 0 on KO'd targets (vitals are gated while KO'd, matching the HP
  // gate). No `mpAfter` on the perTargetResult shape today — Throw
  // Item doesn't have a renderer MP-bar consumer yet. Emit as a system
  // action so future MP-restore consumers reuse the same plumbing.
  let generatedActions: ProposedAction[] = [];
  if (item.effects.mpRestore !== undefined) {
    if (target.vitals.hp > 0 && !target.removed) {
      const pa = runModifyStatQuery(workingState, catalog, {
        unit: caster,
        statName: 'pa',
        baseValue: caster.baseStats.pa,
      });
      const amount = pa * item.effects.mpRestore.coefficient;
      generatedActions = [
        ...generatedActions,
        {
          type: 'system_mp_restore',
          source: 'system',
          payload: {
            targetId,
            amount,
            source: { kind: 'throw_item', itemId: item.id, casterId: caster.id },
          },
        },
      ];
    }
  }

  // 4) Status-clear (Remedy). Walk the target's statuses; remove every
  // instance whose type has polarity !== 'buff' (undefined defaults to
  // debuff). Equipment-sourced instances are immune per ADR-0028 and
  // skipped by `removeStatus`. KO isn't a status, so it's untouched.
  if (item.effects.clearStatuses !== undefined) {
    if (item.effects.clearStatuses.kind === 'debuff') {
      // Snapshot unique type ids first — `removeStatus` mutates `working`'s
      // unit reference, so re-reading mid-loop is unsafe.
      const typeIdsToClear = new Set<StatusTypeId>();
      for (const inst of target.statuses) {
        if (inst.source.kind === 'equipment') continue;
        const type = catalog.getStatusType(inst.typeId);
        const polarity = type.aiHints?.polarity ?? 'debuff';
        if (polarity !== 'buff') typeIdsToClear.add(inst.typeId);
      }
      for (const typeId of typeIdsToClear) {
        workingState = removeStatus(workingState, { targetId, typeId }, catalog).newState;
      }
      target = getUnit(workingState, targetId);
    }
  }

  // Healing total drives the action-log line ("Beowulf threw Potion at
  // Marach for 96 HP"). Use `hit: true` (100% accuracy), `hpAfter` set
  // to the absolute post-application HP for renderer settle (ADR-0074).
  const targetResult: AbilityTargetResult = {
    target: { kind: 'unit', unitId: targetId },
    hit: true,
    healing: healingTotal,
    hpAfter,
  };
  return { newState: workingState, targetResult, generatedActions };
}

// --- system_mp_restore ---
//
// Engine-emitted MP-write parallel to system_heal. Bypasses Faith/MA/
// resistance — items are flat-coefficient restores. KO'd targets gate
// to 0 (vitals frozen while KO'd, matching the HP gate). Capped at
// maxMp from `runModifyStatQuery`.
export function reduceSystemMpRestore(
  state: GameState,
  action: Extract<Action, { type: 'system_mp_restore' }>,
  catalog: Catalog,
): ReduceResult<SystemMpRestoreOutcome> {
  const { targetId, amount } = action.payload;
  const target = state.units.get(targetId);
  if (target === undefined) {
    return {
      newState: state,
      outcome: { kind: 'system_mp_restore', targetId, amount, applied: 0 },
      generatedActions: [],
    };
  }
  if (target.vitals.hp <= 0 || target.removed) {
    return {
      newState: state,
      outcome: {
        kind: 'system_mp_restore',
        targetId,
        amount,
        applied: 0,
        mpAfter: target.vitals.mp,
      },
      generatedActions: [],
    };
  }
  const maxMp = runModifyStatQuery(state, catalog, {
    unit: target,
    statName: 'maxMp',
    baseValue: target.baseStats.maxMpBase,
  });
  const room = Math.max(0, maxMp - target.vitals.mp);
  const applied = Math.max(0, Math.min(amount, room));
  if (applied === 0) {
    return {
      newState: state,
      outcome: {
        kind: 'system_mp_restore',
        targetId,
        amount,
        applied: 0,
        mpAfter: target.vitals.mp,
      },
      generatedActions: [],
    };
  }
  const newTarget: Unit = {
    ...target,
    vitals: { ...target.vitals, mp: target.vitals.mp + applied },
  };
  return {
    newState: withUnit(state, newTarget),
    outcome: {
      kind: 'system_mp_restore',
      targetId,
      amount,
      applied,
      mpAfter: newTarget.vitals.mp,
    },
    generatedActions: [],
  };
}

// --- system_unit_removed ---
//
// Permadeath fire: a KO'd unit accumulated `turnsKOd >= threshold` and
// is now permanently out. The unit stays in `state.units` (the action
// log and historical references point into it) but `removed: true`
// excludes them from target eligibility, AoE selection, tile occupancy
// queries, and the scheduler's KO virtual-CT accumulator. HP/MP stay
// at 0/0.
export function reduceSystemUnitRemoved(
  state: GameState,
  action: Extract<Action, { type: 'system_unit_removed' }>,
): ReduceResult<SystemUnitRemovedOutcome> {
  const { targetId } = action.payload;
  const target = state.units.get(targetId);
  if (target === undefined) {
    throw new Error(
      `reduceSystemUnitRemoved: target ${JSON.stringify(targetId)} not in state`,
    );
  }
  if (target.removed) {
    throw new Error(
      `reduceSystemUnitRemoved: target ${JSON.stringify(targetId)} is already removed`,
    );
  }
  const turnsKOdAtRemoval = target.turnsKOd;
  const newTarget: Unit = { ...target, removed: true };
  return {
    newState: withUnit(state, newTarget),
    outcome: { kind: 'system_unit_removed', targetId, turnsKOdAtRemoval },
    generatedActions: [],
  };
}

// Re-export the item-id type for the action.ts ItemId reference (kept
// implicit otherwise — but the dispatcher signatures need it to type-
// narrow correctly when reducers.ts is consumed via the barrel).
export type { ItemId };

// --- system_ko_tick ---
//
// Session 39a permadeath tick. A KO'd unit's virtual CT crossed the
// trigger threshold (the scheduler keeps ticking KO'd units' CT just
// like any other unit). The reducer:
//   - Increments `turnsKOd` by 1.
//   - Resets the unit's CT to 0 (next virtual tick is a fresh cycle).
//   - If the incremented `turnsKOd` reaches the ruleset threshold,
//     queues a `system_unit_removed` so the unit is marked out of
//     battle. The orchestrator commits the queued action next.
//
// If the unit is no longer KO'd (revived between the tick fire and
// the commit), the reducer is a no-op — the CT reset would be wrong
// for a now-living unit, and the counter is moot. If the unit is
// already removed, also a no-op (the scheduler shouldn't have ticked
// them; defensive).
export function reduceSystemKoTick(
  state: GameState,
  action: Extract<Action, { type: 'system_ko_tick' }>,
  catalog: Catalog,
): ReduceResult<SystemKoTickOutcome> {
  const { targetId } = action.payload;
  const target = state.units.get(targetId);
  if (target === undefined) {
    throw new Error(
      `reduceSystemKoTick: target ${JSON.stringify(targetId)} not in state`,
    );
  }
  if (target.vitals.hp > 0 || target.removed) {
    // Revived (or already removed) between fire and commit. No-op.
    return {
      newState: state,
      outcome: {
        kind: 'system_ko_tick',
        targetId,
        turnsKOdAfter: target.turnsKOd,
        removalQueued: false,
      },
      generatedActions: [],
    };
  }

  const turnsKOdAfter = target.turnsKOd + 1;
  const ruleset = catalog.getRuleset(state.ruleset.id);
  const threshold = ruleset.permadeath.threshold;

  const newTarget: Unit = {
    ...target,
    turnsKOd: turnsKOdAfter,
    ct: 0,
  };
  const newState = withUnit(state, newTarget);
  const removalQueued = turnsKOdAfter >= threshold;
  const generatedActions: ProposedAction[] = removalQueued
    ? [
        {
          type: 'system_unit_removed',
          source: 'system',
          payload: { targetId },
        },
      ]
    : [];

  return {
    newState,
    outcome: {
      kind: 'system_ko_tick',
      targetId,
      turnsKOdAfter,
      removalQueued,
    },
    generatedActions,
  };
}
