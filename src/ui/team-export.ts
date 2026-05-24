// Team export — serialize a `BuiltTeam` to a paste-ready JSON form for
// hand-authoring new bundled templates (S48).
//
// Authoring workflow: a player builds a team in the team builder, clicks
// the Export button, copies the JSON, and hands it to the implementer
// who wires it into `defaultTemplates` as a new `BuiltTeam` constant.
// The exporter outputs a *thin* form — only the fields the team-builder
// state actually carries (classId, brave/faith, loadout, equipment).
// Stats derive from those at load time via `buildBaseStats`, so the
// export doesn't repeat them.
//
// Round-trip note: this exporter doesn't import (the input from a hand-
// authored TS template still uses the branded-id constructors). It's
// strictly a *paste-and-translate* surface; the implementer pastes JSON
// into a new file and wraps each id with `classId('…')` / `itemId(…)` /
// `abilityId(…)` / `commandSetId(…)`.
//
// Pre-S48: no exporter; templates were hand-authored from scratch.

import type { BuiltTeam } from '@content/teams/index.ts';

export interface TeamExportThinUnit {
  readonly name: string;
  readonly classId: string;
  readonly brave: number;
  readonly faith: number;
  // S49: Level system. The team-builder assigns level by active-unit
  // position (slot 0 = L25 baseline; outward steps per `slotLevelFor`),
  // and the exporter preserves whatever value the BuiltUnit carries. The
  // implementer pastes the JSON into a new template and wraps each
  // unit's level with the source of their choice — `slotLevelFor(index)`
  // for slot-derived (the team-builder convention) or a literal value
  // for hand-tuned templates.
  readonly level: number;
  readonly loadout: {
    readonly actionBuckets: Readonly<Record<string, ReadonlyArray<string>>>;
    readonly passiveBuckets: Readonly<Record<string, ReadonlyArray<string>>>;
  };
  readonly equipment: {
    readonly leftHand: string | null;
    readonly rightHand: string | null;
    readonly headgear: string | null;
    readonly armor: string | null;
    readonly accessory: string | null;
  };
}

export interface TeamExportThin {
  readonly name: string;
  readonly units: ReadonlyArray<TeamExportThinUnit>;
}

// Branded ids are runtime strings — coerce explicitly so the typed
// JSON shape doesn't carry branded types into JSON.stringify.
function bucketsAsStrings(
  buckets: Readonly<Record<string, ReadonlyArray<unknown>>>,
): Record<string, ReadonlyArray<string>> {
  const out: Record<string, ReadonlyArray<string>> = {};
  for (const [bucket, ids] of Object.entries(buckets)) {
    out[bucket] = ids.map((id) => String(id));
  }
  return out;
}

// Thin-form serialization. Stats are re-derived at load time from
// (classId, brave, faith) via `buildBaseStats`, so the export omits
// `baseStats` entirely. The exporter is the inverse of the implicit
// thin-form a template constant authors today (mirror `currentTestTeam`
// in src/content/teams/current-test-team.ts).
export function exportBuiltTeamThin(team: BuiltTeam): TeamExportThin {
  return {
    name: team.name,
    units: team.units.map(
      (u): TeamExportThinUnit => ({
        name: u.name,
        classId: String(u.classId),
        brave: u.baseStats.brave,
        faith: u.baseStats.faith,
        level: u.level,
        loadout: {
          actionBuckets: bucketsAsStrings(u.loadout.actionBuckets),
          passiveBuckets: bucketsAsStrings(u.loadout.passiveBuckets),
        },
        equipment: {
          leftHand: u.equipment.leftHand !== null ? String(u.equipment.leftHand) : null,
          rightHand: u.equipment.rightHand !== null ? String(u.equipment.rightHand) : null,
          headgear: u.equipment.headgear !== null ? String(u.equipment.headgear) : null,
          armor: u.equipment.armor !== null ? String(u.equipment.armor) : null,
          accessory: u.equipment.accessory !== null ? String(u.equipment.accessory) : null,
        },
      }),
    ),
  };
}

// Convenience — the modal renders this string into a textarea. 2-space
// indent matches existing TS template files (see current-test-team.ts).
export function exportBuiltTeamJson(team: BuiltTeam): string {
  return JSON.stringify(exportBuiltTeamThin(team), null, 2);
}
