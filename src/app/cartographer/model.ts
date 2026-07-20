// Cartographer — the editor model.
//
// The map side of the model IS the shipped `MapSpec` (the generated map
// modules export their spec as a runtime value, so import is lossless by
// construction — no reconstruction step, unlike Atlas's beat
// classification). The zone side mirrors the deployment-zone registry:
// every map's configs ride along in the model even though the editor
// edits one map at a time, because the registry file is codegenned
// WHOLESALE (Chris's S98 call) — exporting map A must re-emit maps B–F's
// zones byte-identically.
//
// Sub-zones and caps are carried in full fidelity (Mountain Pass's split
// ambush config) even where the v1 canvas only paints the simple cases.

import type { MapSpec } from '@content/maps/map-format.ts';
import type { EnemyLineupSlot, LineupSlot } from '@content/battles/lineup-format.ts';

// The two team slots every shipped config uses. A third team id in the
// registry would be an engine-level change; the importer throws on one.
export type ZoneTeamKey = 'team_a' | 'team_b';

export interface ZonePosition {
  readonly x: number;
  readonly y: number;
  readonly layer: number;
}

export interface ZoneSubZone {
  // Max units deployable in this sub-zone; omitted = uncapped.
  readonly cap?: number;
  readonly tiles: ReadonlyArray<ZonePosition>;
}

export interface ZoneTeamEntry {
  readonly team: ZoneTeamKey;
  readonly subZones: ReadonlyArray<ZoneSubZone>;
}

// One named config ('default' by convention; alternates are alternate
// layouts on the same terrain).
export interface ZoneConfig {
  readonly name: string;
  readonly teams: ReadonlyArray<ZoneTeamEntry>;
}

// One map's slot in the registry file, in file (= authored) order.
export interface MapZoneEntry {
  readonly mapKey: string;
  readonly configs: ReadonlyArray<ZoneConfig>;
}

// The current map's authored lineup (Tier 2, the unit mode) — the spatial
// slots plus each enemy's class/level. `null` = no lineup authored. On
// export it becomes a LineupSpec with key/mapKey = the map's key. ENEMY
// ORDER IS MEANINGFUL (lead = slot 0; the campaign fold re-skins by index).
export interface LineupModel {
  readonly battleId: string;
  readonly players: ReadonlyArray<LineupSlot>;
  readonly guests: ReadonlyArray<LineupSlot>;
  readonly enemies: ReadonlyArray<EnemyLineupSlot>;
}

// The whole editor state: the map being edited plus the full registry
// (the edited map's entry lives inside `registry`, kept in sync by the
// edit helpers; `mapKey` names it) plus the map's lineup, if any.
export interface CartographerModel {
  readonly spec: MapSpec;
  readonly registry: ReadonlyArray<MapZoneEntry>;
  readonly lineup: LineupModel | null;
}

// The edited map's zone entry (present for shipped maps; a fresh map gets
// one on first zone paint).
export function zonesForEditedMap(model: CartographerModel): MapZoneEntry | undefined {
  return model.registry.find((e) => e.mapKey === model.spec.key);
}
