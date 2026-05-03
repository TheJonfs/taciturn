// Turn scheduler — the cycle driver. After a turn ends and battle
// hasn't decided, the orchestrator (UI / AI driver) calls
// `advanceToNextEvent(state, catalog)` to fast-forward CT and produce
// the next system action to commit (`turn_start` for a unit, or
// `charged_action_resolve` for a Charged Action that triggered first).
//
// Why a separate scheduler vs. having `reduceTurnEnd` self-emit the
// next `turn_start`: per ADR-0011, each reducer's job is "apply this
// action's effect"; turn-to-turn handoff (CT advancement, who's next)
// is a different beat that's the orchestrator's concern. UI animation
// pacing, AI thinking time, network round-trips on online play all
// live at the orchestrator level — keeping the scheduler separate from
// reducers means those concerns compose without reaching back into
// engine internals.
//
// The scheduler is *almost* pure: it advances `state.tick` and each
// unit's `ct` to the next trigger threshold, returning the new state
// alongside the proposed action. The advance is deterministic from
// (state, catalog) — same state always produces the same next event.

import type { Catalog } from '../catalog/index.ts';
import { TRIGGER_THRESHOLD } from '../ct/constants.ts';
import { computeActionSpeed, computeSpeed } from '../ct/speed.ts';
import {
  type ChargedAction,
  type ChargedActionId,
  type GameState,
  type ProposedAction,
  type Unit,
  type UnitId,
} from '../types/index.ts';

export interface ScheduledAction {
  readonly newState: GameState;
  readonly proposed: ProposedAction;
  readonly ticksAdvanced: number;
}

// Compute the next event from current state and advance CT to it.
// Returns `null` when:
// - The battle has already decided (`state.outcome !== undefined`).
// - A turn is in progress (`state.turnState !== null`) — caller must
//   commit the rest of the current turn first.
// - No entity can ever trigger (every unit has speed <= 0; v1 won't
//   produce this from content, but it's a defensive guard).
//
// Tiebreak rules match `projectUpcoming` exactly: actual CT > Speed >
// (entityKind, then entityId) for a stable order.
export function advanceToNextEvent(
  state: GameState,
  catalog: Catalog,
): ScheduledAction | null {
  if (state.outcome !== undefined) return null;
  if (state.turnState !== null) return null;

  const snapshot = buildSnapshot(state, catalog);
  const advanceable = snapshot.filter((e) => e.speed > 0 || e.ct >= TRIGGER_THRESHOLD);
  if (advanceable.length === 0) return null;

  const ticksToNext = Math.min(
    ...advanceable.map((e) => ticksUntilTrigger(e.ct, e.speed)),
  );
  if (!Number.isFinite(ticksToNext)) return null;

  if (ticksToNext > 0) {
    for (const e of snapshot) {
      e.ct += e.speed * ticksToNext;
    }
  }

  const candidates = snapshot.filter((e) => e.ct >= TRIGGER_THRESHOLD);
  candidates.sort(compareForTrigger);
  const winner = candidates[0];
  if (winner === undefined) return null;

  // Apply the CT advance to state. Charged actions are re-built from
  // the snapshot's CT values; units get their `ct` field updated. Other
  // fields are untouched.
  const newUnits = new Map(state.units);
  for (const e of snapshot) {
    if (e.entityKind !== 'unit') continue;
    const existing = newUnits.get(e.entityId as UnitId);
    if (existing === undefined) continue;
    if (existing.ct === e.ct) continue;
    newUnits.set(existing.id, { ...existing, ct: e.ct });
  }
  const newChargedActions: ChargedAction[] = state.chargedActions.map((ca) => {
    const found = snapshot.find(
      (e) => e.entityKind === 'charged_action' && e.entityId === ca.id,
    );
    if (found === undefined) return ca;
    if (found.ct === ca.ct) return ca;
    return { ...ca, ct: found.ct };
  });

  const newState: GameState = {
    ...state,
    units: newUnits,
    chargedActions: newChargedActions,
    tick: state.tick + ticksToNext,
  };

  const proposed: ProposedAction =
    winner.entityKind === 'unit'
      ? {
          type: 'turn_start',
          source: 'system',
          payload: { unitId: winner.entityId as UnitId },
        }
      : {
          type: 'charged_action_resolve',
          source: 'system',
          payload: { chargedActionId: winner.entityId as ChargedActionId },
        };

  return { newState, proposed, ticksAdvanced: ticksToNext };
}

// --- internals (mirrors engine/ct/projection.ts but mutates a snapshot
// for state advancement) ---

type EntityKind = 'unit' | 'charged_action';

interface SnapshotEntry {
  readonly entityKind: EntityKind;
  readonly entityId: string;
  ct: number;
  speed: number;
}

function buildSnapshot(state: GameState, catalog: Catalog): SnapshotEntry[] {
  const entries: SnapshotEntry[] = [];
  for (const unit of state.units.values()) {
    if (isKO(unit)) continue;
    entries.push({
      entityKind: 'unit',
      entityId: unit.id,
      ct: unit.ct,
      speed: computeSpeed(state, unit.id, catalog),
    });
  }
  for (const action of state.chargedActions) {
    entries.push({
      entityKind: 'charged_action',
      entityId: action.id,
      ct: action.ct,
      speed: computeActionSpeed(state, action, catalog),
    });
  }
  return entries;
}

function ticksUntilTrigger(currentCT: number, speed: number): number {
  if (currentCT >= TRIGGER_THRESHOLD) return 0;
  if (speed <= 0) return Infinity;
  return Math.ceil((TRIGGER_THRESHOLD - currentCT) / speed);
}

function compareForTrigger(a: SnapshotEntry, b: SnapshotEntry): number {
  if (a.ct !== b.ct) return b.ct - a.ct;
  if (a.speed !== b.speed) return b.speed - a.speed;
  if (a.entityKind !== b.entityKind) return a.entityKind < b.entityKind ? -1 : 1;
  if (a.entityId === b.entityId) return 0;
  return a.entityId < b.entityId ? -1 : 1;
}

function isKO(unit: Unit): boolean {
  return unit.vitals.hp <= 0;
}
