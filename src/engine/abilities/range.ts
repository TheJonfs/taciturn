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

import type {
  ActiveAbilityDefinition,
  Catalog,
  WeaponEquipment,
} from '../catalog/index.ts';
import { runModifyAbilityRange } from '../hooks/index.ts';
import { getEquippedWeapon } from '../items/equipment.ts';
import { isWeaponDelivered } from './range-height.ts';
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

// The implicit reach of a weapon that declares no `range` (and of bare
// hands): adjacent, ±3 elevation — the band the universal `attack` authors.
// S96: this is the fallback for EVERY weapon-delivered ability, so a melee
// weapon can't inherit an ability's bow-flavored authored band.
export const MELEE_WEAPON_RANGE = { horizontal: 1, vertical: 3 } as const;

export function computeAbilityRange(
  state: GameState,
  catalog: Catalog,
  unitId: UnitId,
  ability: ActiveAbilityDefinition,
  // ADR-0107: the specific weapon whose reach to use, when a dual-wield
  // attack checks each swing against its OWN weapon's range (the off-hand
  // Defender's melee 1 vs the dominant Lance's 2). Omitted → the dominant
  // weapon via `getEquippedWeapon`, the default for validation/targeting.
  weaponOverride?: WeaponEquipment,
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
  // Session 45 / S96 (Chris's ruling): weapon-sourced range. A weapon-
  // delivered ability (the universal Attack, weapon-tagged Battle Skills and
  // Marksmanship skills, the Thief's Steal HP / Steal MP) ALWAYS takes its
  // reach from the equipped weapon — a declared range (bows: 2-5) when the
  // weapon has one, the implicit melee band otherwise. The ability's authored
  // band is NEVER the reach of a weapon-delivered ability: pre-S96 it leaked
  // as the fallback, so a Dagger Hunter fired Charged Attack at the ability's
  // bow-flavored 5 tiles. Parallel in spirit to the `physicalVariance` fork:
  // the weapon carries the swing's reach, not the abstract ability. The hook
  // chain still composes on top of the resolved base.
  let baseHorizontal = targeting.range.horizontal;
  let baseVertical = targeting.range.vertical;
  let minHorizontal = targeting.range.minHorizontal;
  if (isWeaponDelivered(ability)) {
    const weapon = weaponOverride ?? getEquippedWeapon(unit, catalog);
    if (weapon?.range !== undefined) {
      baseHorizontal = weapon.range.max;
      minHorizontal = weapon.range.min ?? undefined;
      baseVertical = weapon.range.vertical ?? MELEE_WEAPON_RANGE.vertical;
    } else {
      // Rangeless weapon (swords, daggers…) or bare hands: the swing's
      // reach is the standard melee band (what `attack` authors), with no
      // dead zone — an authored `minHorizontal` (Pin Down's bow min 2)
      // belongs to the ranged delivery, not the stab.
      baseHorizontal = MELEE_WEAPON_RANGE.horizontal;
      baseVertical = MELEE_WEAPON_RANGE.vertical;
      minHorizontal = undefined;
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
