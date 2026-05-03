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
  StatName,
  TerrainType,
  Unit,
} from '../types/index.ts';
import { collectActiveHandlers } from './collector.ts';

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
