// Derived events over the action log — single-walk synthesis that produces
// the data four UI surfaces want:
//
//   1. Action log panel — `[ko]` rows interleaved with the natural log.
//   2. Action log panel — hover-counterpart lookup (per action: who acted,
//      who was targeted; used for the on-canvas pulse).
//   3. Results screen — chronological KO timeline.
//   4. Results screen — per-unit damage/healing/KO-scored stats.
//
// Per ADR-0043: pure module, no React, no state mutation. All consumers
// build on the same derivation so there's no chance of "what the log
// panel called a KO" diverging from "what the results screen calls a
// KO." Tests live alongside.
//
// Implementation note: KO detection requires tracking running HP per
// unit, which the action log doesn't carry directly. The walker
// initializes each unit's HP to `baseStats.maxHpBase` from the current
// state's `units` map (correct under v1's "full HP at battle start"
// rule from `createInitialState`). Damage/heal actions adjust running
// HP; the crossing-from-positive-to-zero edge emits a KO event. This is
// O(N actions × M units-affected-per-action); fast for v1's battle
// sizes and replays cleanly.

import type { Action, GameState, UnitId } from '@engine/index.ts';

// A unit reached 0 HP at the action with `atSequence`. `killingActor`
// is whoever the action attributed to (the `actorId` envelope field).
// Used by the action log panel ([ko] rows), the results screen (KO
// timeline + MVP attribution), and the hover-counterpart system.
export interface KoEvent {
  readonly unitId: UnitId;
  readonly atSequence: number;
  // The acting unit that delivered the lethal blow, if attributable.
  // `null` for system-emitted lethal damage (Burn tick, falling damage,
  // ability self-cost) where no actor is on the action envelope.
  readonly killingActor: UnitId | null;
  // The T-number (count of `turn_start` actions up to and including
  // this point in the log) at which the KO occurred. Used by the
  // results screen's chronological display.
  readonly tNumber: number;
}

// Per-unit aggregate stats derived from the full log. Used by the
// results screen and the MVP-unit metric.
export interface PerUnitStats {
  readonly damageDealt: number;
  readonly damageTaken: number;
  readonly healingDealt: number;
  // Number of KOs this unit was the killing actor for.
  readonly kosScored: number;
}

// Participants in a single action — the actor (if attributable) and
// the targeted unit(s). Used by hover-counterpart to highlight the
// actor + target(s) on the canvas. Order-stable; deterministic.
export interface ActionParticipants {
  readonly actorId: UnitId | null;
  readonly targetIds: ReadonlyArray<UnitId>;
}

// Walk the log and emit KO events at each HP-positive-to-zero crossing.
//
// State is a snapshot of the current game state; `state.units` provides
// each unit's `maxHpBase` so the running-HP tracker starts at the right
// value. The walker assumes "full HP at battle start" (per
// createInitialState in v1); a future content path that authors
// unit-specific starting HP would feed it via the unit fixture, not the
// log.
//
// Charged-action attribution: `charged_action_resolve` actions are
// system-emitted and carry no `actorId`. The walker maintains a map
// from chargedActionId → caster's UnitId (populated from the
// originating `use_ability` action's `outcome.chargedActionId` +
// `actorId`) so KO attribution credits the actual caster.
export function deriveKoEvents(
  log: ReadonlyArray<Action>,
  state: GameState,
): ReadonlyArray<KoEvent> {
  const runningHp = new Map<UnitId, number>();
  for (const u of state.units.values()) {
    runningHp.set(u.id, u.baseStats.maxHpBase);
  }

  const chargedActor = buildChargedActorMap(log);

  const koEvents: KoEvent[] = [];
  const koed = new Set<UnitId>();
  let tNumber = 0;

  for (const action of log) {
    if (action.type === 'turn_start') tNumber += 1;
    const deltas = damageDealtByAction(action);
    for (const { targetId, hp } of deltas) {
      if (koed.has(targetId)) continue;
      const before = runningHp.get(targetId) ?? 0;
      const after = Math.max(0, before + hp);
      runningHp.set(targetId, after);
      if (before > 0 && after <= 0) {
        koed.add(targetId);
        koEvents.push({
          unitId: targetId,
          atSequence: action.sequenceNumber,
          killingActor: attributeActor(action, chargedActor),
          tNumber,
        });
      }
    }
  }
  return koEvents;
}

// Compute per-unit stats over the full log. Used by the results screen.
export function derivePerUnitStats(
  log: ReadonlyArray<Action>,
  state: GameState,
): ReadonlyMap<UnitId, PerUnitStats> {
  const dealt = new Map<UnitId, number>();
  const taken = new Map<UnitId, number>();
  const healing = new Map<UnitId, number>();
  const kos = new Map<UnitId, number>();

  // Seed all known units so the map has zero entries for inactive units
  // (cleaner for the UI than `undefined` lookups).
  for (const u of state.units.values()) {
    dealt.set(u.id, 0);
    taken.set(u.id, 0);
    healing.set(u.id, 0);
    kos.set(u.id, 0);
  }

  const addTo = (map: Map<UnitId, number>, id: UnitId, n: number): void => {
    map.set(id, (map.get(id) ?? 0) + n);
  };

  const chargedActor = buildChargedActorMap(log);

  // Single pass: tally damage / healing per-action, and use the KO walker's
  // attribution to credit kosScored.
  const koEvents = deriveKoEvents(log, state);
  for (const ev of koEvents) {
    if (ev.killingActor !== null) addTo(kos, ev.killingActor, 1);
  }

  for (const action of log) {
    if (action.type === 'use_ability' || action.type === 'charged_action_resolve') {
      const results = action.outcome?.perTargetResults ?? [];
      const actorId = attributeActor(action, chargedActor);
      for (const r of results) {
        if (!r.hit) continue;
        const targetId = r.target.kind === 'unit' ? r.target.unitId : null;
        if (r.damage !== undefined && r.damage > 0) {
          if (actorId !== null) addTo(dealt, actorId, r.damage);
          if (targetId !== null) addTo(taken, targetId, r.damage);
        }
        if (r.healing !== undefined && r.healing > 0) {
          if (actorId !== null) addTo(healing, actorId, r.healing);
        }
      }
    } else if (action.type === 'system_damage') {
      const applied = action.outcome?.applied ?? action.payload.amount;
      addTo(taken, action.payload.targetId, applied);
    } else if (action.type === 'system_heal') {
      const applied = action.outcome?.applied ?? action.payload.amount;
      if (action.actorId !== undefined) addTo(healing, action.actorId, applied);
      void applied;
    }
  }

  const out = new Map<UnitId, PerUnitStats>();
  for (const id of dealt.keys()) {
    out.set(id, {
      damageDealt: dealt.get(id) ?? 0,
      damageTaken: taken.get(id) ?? 0,
      healingDealt: healing.get(id) ?? 0,
      kosScored: kos.get(id) ?? 0,
    });
  }
  return out;
}

// Build a chargedActionId → caster's UnitId lookup. Sourced from each
// `use_ability` action that spawned a charged action (its
// `outcome.chargedActionId` ties the original cast to the resolve event,
// and the `actorId` on the cast is the caster).
function buildChargedActorMap(log: ReadonlyArray<Action>): ReadonlyMap<string, UnitId> {
  const out = new Map<string, UnitId>();
  for (const action of log) {
    if (action.type !== 'use_ability') continue;
    const cid = action.outcome?.chargedActionId;
    if (cid === undefined) continue;
    if (action.actorId === undefined) continue;
    out.set(String(cid), action.actorId);
  }
  return out;
}

// Pick the actor responsible for an action. `use_ability` has its
// actorId on the envelope. `charged_action_resolve` doesn't — its
// caster lives on the spawning `use_ability`'s envelope, looked up via
// the chargedActionId.
function attributeActor(
  action: Action,
  chargedActor: ReadonlyMap<string, UnitId>,
): UnitId | null {
  if (action.type === 'charged_action_resolve') {
    return chargedActor.get(String(action.payload.chargedActionId)) ?? null;
  }
  return action.actorId ?? null;
}

// Identify which units this action references — used by hover-counterpart
// to know what to highlight when the player hovers a log row.
export function deriveActionParticipants(action: Action): ActionParticipants {
  const actorId = action.actorId ?? null;
  const targetIds: UnitId[] = [];
  switch (action.type) {
    case 'use_ability':
    case 'charged_action_resolve': {
      const results = action.outcome?.perTargetResults ?? [];
      for (const r of results) {
        if (r.target.kind === 'unit') targetIds.push(r.target.unitId);
      }
      break;
    }
    case 'system_damage':
    case 'system_heal':
    case 'system_apply_status':
    case 'system_ct_push':
    case 'status_remove':
    case 'status_decrement_stack':
    case 'status_tick': {
      const payload = action.payload as { targetId?: UnitId; unitId?: UnitId };
      const tid = payload.targetId ?? payload.unitId;
      if (tid !== undefined) targetIds.push(tid);
      break;
    }
    case 'system_mp_drain': {
      // MP transfer carries both source and target. Both participate
      // for hover-counterpart highlighting; the source goes on actorId
      // (the unit "doing" the drain) and the target in targetIds.
      // No envelope actorId on system actions (per the commit-side
      // exclusion list); set it inline here.
      return {
        actorId: action.payload.source,
        targetIds: [action.payload.target],
      };
    }
    default:
      // move, wait, set_facing, turn_start, turn_end, battle_end —
      // single-actor or no-target events.
      break;
  }
  return { actorId, targetIds };
}

// Per-action HP-delta extraction. Negative numbers are damage; positive
// numbers are healing. Returns one entry per affected target.
function damageDealtByAction(action: Action): ReadonlyArray<{ targetId: UnitId; hp: number }> {
  if (action.type === 'use_ability' || action.type === 'charged_action_resolve') {
    const out: { targetId: UnitId; hp: number }[] = [];
    const results = action.outcome?.perTargetResults ?? [];
    for (const r of results) {
      if (!r.hit) continue;
      if (r.target.kind !== 'unit') continue;
      const damage = r.damage ?? 0;
      const healing = r.healing ?? 0;
      const delta = healing - damage;
      if (delta !== 0) out.push({ targetId: r.target.unitId, hp: delta });
    }
    return out;
  }
  if (action.type === 'system_damage') {
    const applied = action.outcome?.applied ?? action.payload.amount;
    return [{ targetId: action.payload.targetId, hp: -applied }];
  }
  if (action.type === 'system_heal') {
    const applied = action.outcome?.applied ?? action.payload.amount;
    return [{ targetId: action.payload.targetId, hp: applied }];
  }
  return [];
}
