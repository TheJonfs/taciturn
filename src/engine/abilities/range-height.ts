// Bow horizontal range-from-height (Session 52).
//
// FFT-canon "shoot farther from the high ground": a ranged weapon that
// declares `rangeFromHeightBonus` gains horizontal range when the
// shooter sits above the target. The bonus is `deltaHorizontal` per
// `perDeltaVertical` tiles of *downward* elevation delta (shooter
// elevation − target elevation), floored to whole increments, and is
// never negative (shooting level or uphill grants no bonus and no
// penalty — see ADR-0083's height-delta *damage* variance for the
// orthogonal downhill-damage reward; the two stack by design).
//
// Why a separate resolver instead of folding into `computeAbilityRange`:
// the bonus depends on the *target's* elevation, but `computeAbilityRange`
// is target-independent (it sizes the AI/UI enumeration box with a single
// value). So this mirrors the `resolvePhysicalVarianceBand` precedent
// (ADR-0083) — one small pure resolver, called at each in-range site
// where both endpoints' elevations are already in hand. The gate matches
// the weapon-sourced `range` / `physicalVariance` forks: weapon-tagged
// physical abilities whose equipped weapon declares the field.
//
// Pure. No state mutation, no RNG.

import type { ActiveAbilityDefinition, Catalog } from '../catalog/index.ts';
import { getEquippedWeapon } from '../items/equipment.ts';
import type { Unit } from '../types/index.ts';

export interface RangeFromHeightBonus {
  readonly perDeltaVertical: number;
  readonly deltaHorizontal: number;
}

// Returns the equipped weapon's `rangeFromHeightBonus` spec iff this is a
// weapon-tagged physical ability and the weapon declares the field;
// otherwise `undefined`. Same gate as `computeAbilityRange`'s weapon
// range fork, so non-weapon abilities (and melee weapons) never get a
// height bonus.
export function weaponRangeFromHeightSpec(
  unit: Unit,
  catalog: Catalog,
  ability: ActiveAbilityDefinition,
): RangeFromHeightBonus | undefined {
  if (ability.effects.damage?.tags.includes('weapon') !== true) return undefined;
  const weapon = getEquippedWeapon(unit, catalog);
  return weapon?.rangeFromHeightBonus;
}

// The extra horizontal range for a shot from `sourceElevation` at a
// target at `targetElevation`. Zero when the spec is absent or the
// shooter is level/below the target.
export function rangeFromHeightBonus(
  spec: RangeFromHeightBonus | undefined,
  sourceElevation: number,
  targetElevation: number,
): number {
  if (spec === undefined) return 0;
  const drop = sourceElevation - targetElevation;
  if (drop <= 0) return 0;
  return Math.floor(drop / spec.perDeltaVertical) * spec.deltaHorizontal;
}

// The maximum extra horizontal range this shooter could gain at its
// current elevation — i.e. the bonus against the lowest possible target
// (elevation 0). Used to widen the AI / UI candidate-enumeration box so
// the far tiles a height bonus newly puts in range actually get tested
// (they'd otherwise fall outside a box sized to the base range).
export function maxRangeFromHeightBonus(
  spec: RangeFromHeightBonus | undefined,
  sourceElevation: number,
): number {
  return rangeFromHeightBonus(spec, sourceElevation, 0);
}
