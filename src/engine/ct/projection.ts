// CT projection: fast-forward to the next entity that triggers, and look
// ahead over a sequence of events.
// See docs/design/ct-system.md ("Tick simulation strategy", "Tiebreaking")
// and ADR-0003 (projection-after-trigger assumption).
//
// All functions in this file are pure projections over `state`: they read
// CT and Speed values, simulate forward, and return events. They never
// mutate `state`. State transitions are the reducer's job (session 7).

import { type ChargedActionId, type GameState, type UnitId } from '../types/index.ts';
import { ASSUMED_TURN_CT_COST, TRIGGER_THRESHOLD } from './constants.ts';
import { computeActionSpeed, computeSpeed } from './speed.ts';

export type ProjectedEntityKind = 'unit' | 'charged_action';

export type ProjectedEvent =
  | {
      readonly entityKind: 'unit';
      readonly entityId: UnitId;
      readonly ticksFromNow: number;
      readonly actualCT: number;
      readonly speed: number;
    }
  | {
      readonly entityKind: 'charged_action';
      readonly entityId: ChargedActionId;
      readonly ticksFromNow: number;
      readonly actualCT: number;
      readonly speed: number;
    };

// Number of ticks until an entity reaches the trigger threshold, given its
// current CT and Speed.
//
// Returns 0 when the entity is already at or above the threshold (CT pushes
// can leave entities >= 100 between events).
// Returns Infinity when speed <= 0 (Stop, or any future effect that floors
// Speed to zero) — the entity will never advance on its own.
export function ticksUntilTrigger(currentCT: number, speed: number): number {
  if (currentCT >= TRIGGER_THRESHOLD) return 0;
  if (speed <= 0) return Infinity;
  return Math.ceil((TRIGGER_THRESHOLD - currentCT) / speed);
}

interface SimEntry {
  readonly entityKind: ProjectedEntityKind;
  readonly entityId: string;
  ct: number;
  speed: number;
}

// Tiebreak when multiple entities reach the threshold in the same advance:
// higher actual CT wins, then higher Speed, then a stable deterministic key
// (entityKind, then entityId) for full determinism. See ct-system.md.
function compareForTrigger(
  a: { actualCT: number; speed: number; entityKind: ProjectedEntityKind; entityId: string },
  b: { actualCT: number; speed: number; entityKind: ProjectedEntityKind; entityId: string },
): number {
  if (a.actualCT !== b.actualCT) return b.actualCT - a.actualCT;
  if (a.speed !== b.speed) return b.speed - a.speed;
  if (a.entityKind !== b.entityKind) return a.entityKind < b.entityKind ? -1 : 1;
  if (a.entityId === b.entityId) return 0;
  return a.entityId < b.entityId ? -1 : 1;
}

function buildSnapshot(state: GameState): SimEntry[] {
  const entries: SimEntry[] = [];
  for (const unit of state.units.values()) {
    entries.push({
      entityKind: 'unit',
      entityId: unit.id,
      ct: unit.ct,
      speed: computeSpeed(state, unit.id),
    });
  }
  for (const action of state.chargedActions) {
    entries.push({
      entityKind: 'charged_action',
      entityId: action.id,
      ct: action.ct,
      speed: computeActionSpeed(state, action),
    });
  }
  return entries;
}

function entryToEvent(entry: SimEntry, ticksFromNow: number): ProjectedEvent {
  // Branded IDs are strings; the cast is safe because entries are built from
  // typed sources (unit.id, chargedAction.id) and we discriminate on entityKind.
  if (entry.entityKind === 'unit') {
    return {
      entityKind: 'unit',
      entityId: entry.entityId as UnitId,
      ticksFromNow,
      actualCT: entry.ct,
      speed: entry.speed,
    };
  }
  return {
    entityKind: 'charged_action',
    entityId: entry.entityId as ChargedActionId,
    ticksFromNow,
    actualCT: entry.ct,
    speed: entry.speed,
  };
}

// The next entity that will trigger from the current state. Returns null
// when no entity can trigger (empty state, or every entity has speed <= 0).
export function nextEvent(state: GameState): ProjectedEvent | null {
  const events = projectUpcoming(state, 1);
  return events[0] ?? null;
}

// Project the next `count` triggers, in order. Each triggering entity is
// resolved per ADR-0003: a Unit's CT resets to 0 (assumed Move + Act, full
// turn cost), a ChargedAction is removed from the simulation. Returns
// fewer than `count` events if no entities remain that can trigger.
export function projectUpcoming(state: GameState, count: number): ProjectedEvent[] {
  if (count <= 0) return [];

  const snapshot = buildSnapshot(state);
  const events: ProjectedEvent[] = [];
  let cumulativeTicks = 0;

  for (let i = 0; i < count; i++) {
    const advanceable = snapshot.filter((e) => e.speed > 0);
    if (advanceable.length === 0) break;

    const ticksToNext = Math.min(...advanceable.map((e) => ticksUntilTrigger(e.ct, e.speed)));
    if (!Number.isFinite(ticksToNext)) break;

    if (ticksToNext > 0) {
      for (const e of snapshot) {
        e.ct += e.speed * ticksToNext;
      }
      cumulativeTicks += ticksToNext;
    }

    const candidates = snapshot.filter((e) => e.ct >= TRIGGER_THRESHOLD);
    candidates.sort((a, b) =>
      compareForTrigger(
        { actualCT: a.ct, speed: a.speed, entityKind: a.entityKind, entityId: a.entityId },
        { actualCT: b.ct, speed: b.speed, entityKind: b.entityKind, entityId: b.entityId },
      ),
    );

    const winner = candidates[0];
    if (winner === undefined) break;

    events.push(entryToEvent(winner, cumulativeTicks));

    if (winner.entityKind === 'charged_action') {
      const idx = snapshot.indexOf(winner);
      snapshot.splice(idx, 1);
    } else {
      // Subtract the per-turn cost from the *actual* CT, not from the
      // threshold. CT pushes can leave a unit above 100 at trigger time;
      // a unit with actual CT 110 should land at 10 after consuming 100,
      // not at 0. Floors at 0 (cost cannot push CT negative).
      winner.ct = Math.max(0, winner.ct - ASSUMED_TURN_CT_COST);
    }
  }

  return events;
}
