// Chain-runner helpers — fire a chain hook against every active handler
// for a unit, threading a value through each handler's return.
//
// These runners are source-agnostic: they consume the uniform
// `CollectedHandler<K>` produced by the collector and don't know which
// kind of source registered the handler. Single-source event runners
// (e.g., status-specific `fireOnApply`) live with their owning lifecycle
// instead.

import type { Catalog } from '../catalog/index.ts';
import type {
  GameState,
  MovementProfile,
  ProposedAction,
  StatName,
  TerrainType,
  Unit,
} from '../types/index.ts';
import { collectActiveHandlers } from './collector.ts';
import type { ActionAttemptResult } from './hooks.ts';

export function runModifyStatQuery(
  state: GameState,
  catalog: Catalog,
  args: { unit: Unit; statName: StatName; baseValue: number },
): number {
  const handlers = collectActiveHandlers(state, args.unit.id, catalog, 'modifyStatQuery');
  let value = args.baseValue;
  for (const h of handlers) {
    value = h.invoke({ unit: args.unit, statName: args.statName, baseValue: value });
  }
  return value;
}

export function runModifyCanEnter(
  state: GameState,
  catalog: Catalog,
  args: { unit: Unit; baseValue: ReadonlySet<TerrainType> },
): ReadonlySet<TerrainType> {
  const handlers = collectActiveHandlers(state, args.unit.id, catalog, 'modifyCanEnter');
  let value = args.baseValue;
  for (const h of handlers) {
    value = h.invoke({ unit: args.unit, baseValue: value });
  }
  return value;
}

export function runModifyTerrainCosts(
  state: GameState,
  catalog: Catalog,
  args: { unit: Unit; baseValue: ReadonlyMap<TerrainType, number> },
): ReadonlyMap<TerrainType, number> {
  const handlers = collectActiveHandlers(state, args.unit.id, catalog, 'modifyTerrainCosts');
  let value = args.baseValue;
  for (const h of handlers) {
    value = h.invoke({ unit: args.unit, baseValue: value });
  }
  return value;
}

export function runModifySpecialMovement(
  state: GameState,
  catalog: Catalog,
  args: { unit: Unit; baseValue: MovementProfile['specialMovement'] },
): MovementProfile['specialMovement'] {
  const handlers = collectActiveHandlers(state, args.unit.id, catalog, 'modifySpecialMovement');
  let value = args.baseValue;
  for (const h of handlers) {
    value = h.invoke({ unit: args.unit, baseValue: value });
  }
  return value;
}

// Pre-resolution hook firing — short-circuits on the first non-`allowed`
// result. Stop returns `blocked`, Berserk returns `replaced`. Equipment
// → Class → Passive → Status order is preserved so a class trait that
// allows after a status that blocks does not run (status fires later
// in the order, but the comparator places equipment-tier first; the
// short-circuit means the most-recently-applied source wins by default
// when multiple sources contend — a knob the per-handler priority
// adjusts).
export function runOnActionAttempted(
  state: GameState,
  catalog: Catalog,
  args: { unit: Unit; action: ProposedAction },
): ActionAttemptResult {
  const handlers = collectActiveHandlers(state, args.unit.id, catalog, 'onActionAttempted');
  let current = args.action;
  for (const h of handlers) {
    const result = h.invoke({ unit: args.unit, action: current });
    if (result.kind === 'blocked') return result;
    if (result.kind === 'replaced') {
      current = result.with;
    }
  }
  if (current === args.action) return { kind: 'allowed' };
  return { kind: 'replaced', with: current };
}

// Post-application hook firing — collects reactions every handler
// produces. The reducer enqueues these onto the action chain. Session 8
// drives this from the damage pipeline; the runner ships now so the
// shape is stable.
export function runOnActionTargeted(
  state: GameState,
  catalog: Catalog,
  args: { unit: Unit; incomingAction: ProposedAction },
): ReadonlyArray<ProposedAction> {
  const handlers = collectActiveHandlers(state, args.unit.id, catalog, 'onActionTargeted');
  const reactions: ProposedAction[] = [];
  for (const h of handlers) {
    const result = h.invoke({ unit: args.unit, incomingAction: args.incomingAction });
    for (const r of result) reactions.push(r);
  }
  return reactions;
}
