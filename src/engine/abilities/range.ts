// Per-unit ability range. Threads `ability.targeting.range` through the
// `modifyAbilityRange` hook chain so equipment / status / passive
// contributors (Wand of Depths +1 horizontal/+1 vertical on Water-tagged
// spells) compose into the value read by `validateProposedAction`, the
// AI's targeting / range scoring, and the UI's target-picker overlay.
// Per Session 29.
//
// Composition is additive per axis; the runner threads through each
// handler. `minHorizontal` carries through unchanged (no v1 hook
// modifies the minimum-range floor).

import type { ActiveAbilityDefinition, Catalog } from '../catalog/index.ts';
import { runModifyAbilityRange } from '../hooks/index.ts';
import { getEquippedWeapon } from '../items/equipment.ts';
import {
  getUnit,
  type GameState,
  type UnitId,
} from '../types/index.ts';

export interface AbilityRangeView {
  readonly horizontal: number;
  readonly vertical: number;
  readonly minHorizontal: number | undefined;
}

export function computeAbilityRange(
  state: GameState,
  catalog: Catalog,
  unitId: UnitId,
  ability: ActiveAbilityDefinition,
): AbilityRangeView {
  const unit = getUnit(state, unitId);
  const targeting = ability.targeting;
  if (targeting.kind === 'self') {
    return { horizontal: 0, vertical: 0, minHorizontal: undefined };
  }
  // Session 49: Math Skill is battlefield-wide — every unit is in
  // range by definition. Reporting `Infinity` keeps any range-check
  // call site that erroneously dispatches against a Math Skill ability
  // from blocking a legitimate target.
  if (targeting.kind === 'math_skill') {
    return { horizontal: Infinity, vertical: Infinity, minHorizontal: undefined };
  }
  // Session 45: weapon-sourced range fork. Weapon-tagged physical attacks
  // (the universal Attack and weapon-tagged Battle Skills like Lightning
  // Stab) read the equipped weapon's range when it declares one — a bow
  // reaches 2-5 where the ability hardcodes melee 1. Parallel in spirit
  // to the `physicalVariance` fork: the weapon carries the swing's reach,
  // not the abstract attack ability. The hook chain still composes on top
  // of the resolved base. Absent → ability-declared range (melee).
  let baseHorizontal = targeting.range.horizontal;
  let baseVertical = targeting.range.vertical;
  let minHorizontal = targeting.range.minHorizontal;
  if (ability.effects.damage?.tags.includes('weapon') === true) {
    const weapon = getEquippedWeapon(unit, catalog);
    if (weapon?.range !== undefined) {
      baseHorizontal = weapon.range.max;
      minHorizontal = weapon.range.min ?? minHorizontal;
      if (weapon.range.vertical !== undefined) baseVertical = weapon.range.vertical;
    }
  }
  const composed = runModifyAbilityRange(state, catalog, {
    unit,
    ability,
    baseHorizontal,
    baseVertical,
  });
  return {
    horizontal: composed.horizontal,
    vertical: composed.vertical,
    minHorizontal,
  };
}
