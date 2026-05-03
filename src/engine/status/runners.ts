// Hook runners — fire a hook against active handlers, threading values
// through chain-style hooks and ignoring returns from event-style ones.
//
// Three runners land in session 3, each with distinct semantics:
//
// - runModifyStatQuery (chain over all active handlers): pipes baseValue
//   through every handler registered for `modifyStatQuery` on the unit.
// - fireOnApply (single-source event): fires the *new* instance's
//   onApply handlers as part of applyStatus. Other unrelated statuses
//   on the unit do NOT see this — their onApply already fired when
//   they were applied.
// - fireOnRemove (single-source event): symmetric with fireOnApply.
//
// Runners for other hooks land alongside their consumers (session 4
// onward).

import type { Catalog } from '../catalog/index.ts';
import type { StatusEffectType } from '../catalog/index.ts';
import type { GameState, StatName, StatusInstance, Unit } from '../types/index.ts';
import { collectActiveHandlers } from './collector.ts';

export function runModifyStatQuery(
  state: GameState,
  catalog: Catalog,
  args: { unit: Unit; statName: StatName; baseValue: number },
): number {
  const handlers = collectActiveHandlers(state, args.unit.id, catalog, 'modifyStatQuery');
  let value = args.baseValue;
  for (const collected of handlers) {
    value = collected.handler(
      { unit: args.unit, statName: args.statName, baseValue: value },
      collected.context,
    );
  }
  return value;
}

// Fire onApply on a single instance's type. The unit reference is what
// the instance is being applied to. The collector is intentionally NOT
// used here — onApply targets one specific newly-applied instance, not
// the broader set of active handlers on the unit.
export function fireOnApply(type: StatusEffectType, unit: Unit, instance: StatusInstance): void {
  for (const reg of type.hooks) {
    if (reg.name !== 'onApply') continue;
    reg.handler({ unit }, { instance });
  }
}

// Fire onRemove on a single instance's type. Symmetric with fireOnApply.
export function fireOnRemove(type: StatusEffectType, unit: Unit, instance: StatusInstance): void {
  for (const reg of type.hooks) {
    if (reg.name !== 'onRemove') continue;
    reg.handler({ unit }, { instance });
  }
}
