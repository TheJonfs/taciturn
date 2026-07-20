// Cartographer — import: shipped runtime values → editor model.
//
// Both sides import as runtime VALUES (the Atlas move — no text parsing):
// the generated map modules export their MapSpec, and the deployment-zone
// registry object converts structurally. Import is lossless by
// construction; the codegen round-trip test pins that exporting what was
// imported reproduces the shipped bytes.

import { ALVERA_VILLAGE_SPEC } from '@content/maps/alvera-village.ts';
import { MARSHMOOR_SPEC } from '@content/maps/marshmoor.ts';
import { MOUNTAIN_PASS_SPEC } from '@content/maps/mountain-pass.ts';
import { OSKUN_FIELDS_SPEC } from '@content/maps/oskun-fields.ts';
import { RIVER_RIDGE_SPEC } from '@content/maps/river-ridge.ts';
import { STONEBRIDGE_SPEC } from '@content/maps/stonebridge.ts';
import { DEPLOYMENT_ZONE_REGISTRY } from '@content/deployment/registry.ts';
import type { MapSpec } from '@content/maps/map-format.ts';
import type { LineupSpec } from '@content/battles/lineup-format.ts';
import type { LineupModel, MapZoneEntry, ZoneTeamKey } from './model.ts';

// The shipped, Cartographer-owned maps, in registry order. Training Field
// is deliberately absent — it's a hand-written test probe, not a
// battlefield (S98 findings).
export const SHIPPED_MAP_SPECS: ReadonlyArray<MapSpec> = [
  RIVER_RIDGE_SPEC,
  STONEBRIDGE_SPEC,
  MARSHMOOR_SPEC,
  MOUNTAIN_PASS_SPEC,
  OSKUN_FIELDS_SPEC,
  ALVERA_VILLAGE_SPEC,
];

export function shippedMapSpec(key: string): MapSpec | undefined {
  return SHIPPED_MAP_SPECS.find((s) => s.key === key);
}

// Shipped GENERATED lineup modules, keyed by map key (Tier 2). The six
// original battle files are hand-written Mage War content (Chris's S98
// call) and never appear here; when a Cartographer-authored lineup ships,
// add its `<PREFIX>_LINEUP` import so the tool can reload it — same
// convention as SHIPPED_MAP_SPECS for new maps.
export const SHIPPED_LINEUPS: ReadonlyArray<LineupSpec> = [];

export function shippedLineupModel(mapKey: string): LineupModel | null {
  const spec = SHIPPED_LINEUPS.find((l) => l.mapKey === mapKey);
  if (spec === undefined) return null;
  return {
    battleId: spec.battleId,
    players: spec.players,
    guests: spec.guests,
    enemies: spec.enemies,
  };
}

// The shipped registry as the editor's zone model, preserving file order
// (object insertion order — the codegen re-emits in this order).
export function importZoneRegistry(): ReadonlyArray<MapZoneEntry> {
  return Object.entries(DEPLOYMENT_ZONE_REGISTRY).map(([mapKey, configs]) => ({
    mapKey,
    configs: Object.entries(configs).map(([name, config]) => ({
      name,
      teams: config.teams.map((t) => {
        const team = t.team as unknown as string;
        if (team !== 'team_a' && team !== 'team_b') {
          throw new Error(
            `cartographer import: unexpected team id '${team}' in zone config '${mapKey}/${name}'`,
          );
        }
        return {
          team: team as ZoneTeamKey,
          subZones: t.subZones.map((s) => ({
            ...(s.cap !== undefined ? { cap: s.cap } : {}),
            tiles: s.tiles.map((p) => ({ x: p.x, y: p.y, layer: p.layer })),
          })),
        };
      }),
    })),
  }));
}
