// BuiltTeam → battle-config bridge.
//
// Session 36 (Phase E). The team builder is engine-blind: it produces a
// `BuiltTeam` (four assembled units — class, stats, loadout, equipment,
// but no position / facing). This module folds that team into a map's
// `BattleConfig` template, replacing one team's authored placements.
//
// It is the upstream sibling of `buildDeployedBattleConfig`: team
// builder output flows through here first (producing a config whose
// player team is the built units, sitting on placeholder positions),
// then the deployment phase overwrites those positions. The output is
// an ordinary `BattleConfig`.
//
// Slot mapping: the built team's units map 1:1, by index, onto the
// template's units for `team`. Each built unit inherits the template
// slot's stable `id` and its position / facing as a placeholder — so
// `createInitialState` sees valid on-map positions even before the
// deployment phase runs, and the deployment roster keys off the same
// ids the template used.

import type { BattleConfig, TeamId, UnitPlacement } from '@engine/index.ts';
import type { BuiltTeam } from './built-team.ts';

// Fold a `BuiltTeam` into a `BattleConfig` template. The `team`'s
// authored placements are replaced by the built units (preserving each
// slot's id + placeholder position + facing); every other team's
// authored placements are left intact. Throws if the template's `team`
// has a different unit count than the built team — a mismatch means the
// template and the locked team size have drifted, which should fail
// loud rather than silently truncate.
export function buildTeamBattleConfig(
  template: BattleConfig,
  builtTeam: BuiltTeam,
  team: TeamId,
): BattleConfig {
  const templateSlots = template.units.filter((u) => u.team === team);
  if (templateSlots.length !== builtTeam.units.length) {
    throw new Error(
      `buildTeamBattleConfig: template team ${JSON.stringify(team)} has ` +
        `${templateSlots.length} units but the built team has ` +
        `${builtTeam.units.length}`,
    );
  }

  const builtPlacements: UnitPlacement[] = builtTeam.units.map((unit, index) => {
    const slot = templateSlots[index]!;
    return {
      id: slot.id,
      name: unit.name,
      team,
      classId: unit.classId,
      position: slot.position,
      facing: slot.facing,
      baseStats: unit.baseStats,
      loadout: unit.loadout,
      equipment: unit.equipment,
    };
  });

  const otherUnits = template.units.filter((u) => u.team !== team);
  return { ...template, units: [...builtPlacements, ...otherUnits] };
}
