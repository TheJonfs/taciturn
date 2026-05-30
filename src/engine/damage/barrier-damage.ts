// Barrier damage amount (Session 54). A Barrier is an inert tile object: it
// has no Faith, resistance, evasion, or reactions, and `system_barrier_damage`
// doesn't roll variance — it just subtracts a precomputed amount (ADR-0088
// §4). So the amount a damaging ability deals to a barrier is the ability's
// deterministic attacker-side base:
//   physical → PA × WP × coeff   (WP from the equipped / per-swing weapon)
//   magical  → MA × coeff        (no Faith factor — a barrier has no Faith)
// Healing-tagged or tagless abilities deal 0 (a barrier is never healed; no
// consumer). `coeff` folds in `chainBonus` against `targetCount` to match the
// AoE base-stage scaling, so a barrier in a cluster takes the same scaled
// power its unit neighbours do.

import type { ActiveAbilityDefinition, Catalog } from '../catalog/index.ts';
import { getEquippedWeapon, getWeaponInSlot } from '../items/equipment.ts';
import { runModifyStatQuery } from '../hooks/runners.ts';
import type { EquipmentSlotId, GameState, Unit } from '../types/index.ts';

export function computeBarrierDamage(
  state: GameState,
  catalog: Catalog,
  attacker: Unit,
  ability: ActiveAbilityDefinition,
  opts: { readonly attackingWeaponSlot?: EquipmentSlotId; readonly targetCount?: number } = {},
): number {
  const damage = ability.effects.damage;
  if (damage === undefined) return 0;
  const tags = new Set(damage.tags);
  if (tags.has('healing')) return 0;

  const base = damage.power_coefficient ?? 1;
  const chainBonus = damage.chainBonus;
  const coeff =
    base +
    (chainBonus !== undefined
      ? chainBonus.powerPerAdditionalTarget * Math.max(0, (opts.targetCount ?? 1) - 1)
      : 0);

  if (tags.has('physical')) {
    const pa = runModifyStatQuery(state, catalog, {
      unit: attacker,
      statName: 'pa',
      baseValue: attacker.baseStats.pa,
    });
    const weapon =
      opts.attackingWeaponSlot !== undefined
        ? getWeaponInSlot(attacker, opts.attackingWeaponSlot, catalog)
        : getEquippedWeapon(attacker, catalog);
    const wp = weapon?.wp ?? 1;
    return Math.max(0, Math.floor(pa * wp * coeff));
  }
  if (tags.has('magical')) {
    const ma = runModifyStatQuery(state, catalog, {
      unit: attacker,
      statName: 'ma',
      baseValue: attacker.baseStats.ma,
    });
    return Math.max(0, Math.floor(ma * coeff));
  }
  return 0;
}
