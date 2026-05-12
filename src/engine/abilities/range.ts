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

import type { Catalog } from '../catalog/index.ts';
import { runModifyAbilityRange } from '../hooks/index.ts';
import {
  getUnit,
  type ActiveAbilityDefinition,
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
  const composed = runModifyAbilityRange(state, catalog, {
    unit,
    ability,
    baseHorizontal: ability.targeting.range.horizontal,
    baseVertical: ability.targeting.range.vertical,
  });
  return {
    horizontal: composed.horizontal,
    vertical: composed.vertical,
    minHorizontal: ability.targeting.range.minHorizontal,
  };
}
