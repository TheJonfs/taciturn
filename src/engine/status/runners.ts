// Status-specific lifecycle runners.
//
// Chain runners (modifyStatQuery, modifyCanEnter, …) live in
// engine/hooks/runners.ts because they're source-agnostic. The two here
// are the single-source event runners fired during status apply / remove:
// they target one specific status type's hooks, not the broader set of
// active handlers on the unit.
//
// `fireOnApply` fires the *new* instance's onApply handlers; other
// unrelated statuses on the unit do NOT see this — their onApply
// already fired when they were applied. `fireOnRemove` is symmetric.

import type { StatusEffectType } from '../catalog/index.ts';
import type { StatusInstance, Unit } from '../types/index.ts';

export function fireOnApply(type: StatusEffectType, unit: Unit, instance: StatusInstance): void {
  for (const reg of type.hooks) {
    if (reg.name !== 'onApply') continue;
    reg.handler({ unit }, { instance });
  }
}

export function fireOnRemove(type: StatusEffectType, unit: Unit, instance: StatusInstance): void {
  for (const reg of type.hooks) {
    if (reg.name !== 'onRemove') continue;
    reg.handler({ unit }, { instance });
  }
}
