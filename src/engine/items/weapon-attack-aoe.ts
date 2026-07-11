// Weapon-attack AoE (TABA Ch3, Volley Bow) — the target-anchored arm of
// the weapon-attack-shape seam (lance pierce is the caster-anchored arm).
//
// A weapon declaring `attackAoe` makes the basic Attack strike a diamond
// around the aimed tile/unit instead of a single target. ONE resolver
// backs every consumer:
//   - `validateAction` upgrades the basic Attack's effective targeting
//     to unit_or_tile so an EMPTY tile is aimable;
//   - the reducer's swing dispatch injects the AoeSpec (per-swing, like
//     pierce) so resolution runs the standard AoE machinery — per-target
//     seeds (independent accuracy rolls at the weapon's Acc), ruleset
//     friendly fire (v1 TRUE: it hits allies, settled ruling), barrier
//     damage in the footprint;
//   - the UI's target highlight and hover footprint read the same spec.
// Aether Bloom does NOT grow this AoE — its modifyAoeShape handler gates
// on the 'magical' ability tag and the basic Attack is physical.

import type { Catalog } from '../catalog/index.ts';
import type {
  ActiveAbilityDefinition,
  AoeSpec,
} from '../catalog/definitions/ability-definition.ts';
import type { WeaponEquipment } from '../catalog/definitions/item-definition.ts';
import type { Unit } from '../types/index.ts';
import { getEquippedWeapon } from './equipment.ts';

// The AoeSpec a given weapon injects into a basic Attack, or undefined
// for non-basic-attacks / weapons without `attackAoe`. Vertical
// tolerance mirrors the pierce seam: the weapon's declared vertical
// range when present (bows: 99 — shots land across elevation), else the
// ruleset default.
export function attackAoeForWeapon(
  weapon: WeaponEquipment | null,
  ability: ActiveAbilityDefinition,
): AoeSpec | undefined {
  if (ability.basicAttack !== true) return undefined;
  if (weapon === null || weapon.attackAoe === undefined) return undefined;
  return {
    shape: { kind: 'diamond', radius: weapon.attackAoe.radius },
    ...(weapon.range?.vertical !== undefined
      ? { verticalTolerance: weapon.range.vertical }
      : {}),
  };
}

// Dominant-weapon read — the validation/UI entry (per-swing resolution
// reads each swing's own weapon via `attackAoeForWeapon` directly).
export function weaponAttackAoeSpec(
  attacker: Unit,
  catalog: Catalog,
  ability: ActiveAbilityDefinition,
): AoeSpec | undefined {
  return attackAoeForWeapon(getEquippedWeapon(attacker, catalog), ability);
}
