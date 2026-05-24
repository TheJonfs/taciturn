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
// authored placements are left intact.
//
// S48: variable team size. The built team's unit count must be at most
// the template's authored slot count for `team` (the template is the
// upper-bound surface — bumping a map's max team size means adding more
// authored slots to the battle config). When the built team is shorter
// than the template, the trailing template slots are simply dropped,
// matching the team-builder's "empty slot = valid-but-empty" semantics.
// Throws when the built team is larger than the template can support so
// the failure is loud rather than silently truncating.
export function buildTeamBattleConfig(
  template: BattleConfig,
  builtTeam: BuiltTeam,
  team: TeamId,
): BattleConfig {
  const templateSlots = template.units.filter((u) => u.team === team);
  if (builtTeam.units.length > templateSlots.length) {
    throw new Error(
      `buildTeamBattleConfig: built team has ${builtTeam.units.length} ` +
        `units but template team ${JSON.stringify(team)} only authors ` +
        `${templateSlots.length} slot(s)`,
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
      // S49: forward the BuiltUnit's level into the placement so Math
      // Skill's `parameter: 'level'` predicate can read it off the
      // constructed `Unit`. `baseStats` is already level-adjusted
      // upstream by `buildBaseStats(..., level)`.
      level: unit.level,
    };
  });

  const otherUnits = template.units.filter((u) => u.team !== team);
  return { ...template, units: [...builtPlacements, ...otherUnits] };
}
