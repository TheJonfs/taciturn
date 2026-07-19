// Per-map deployment-zone registry.
//
// Session 70 (ADR pending): the seam between terrain and deployment
// layout. A terrain is keyed to one-or-more named zone configs; the
// combiner (`assembleBattlefield`) pairs a chosen config with the terrain.
// Today every existing map has a single `default` config migrated 1:1
// from its old baked-in zones (single sub-zone per side, no caps — the
// behavior-preserving degenerate case). Adding a *second* config for any
// terrain is pure authoring: add a key here, no map or engine change.
// That "one terrain, many layouts" property is what the extraction buys.
//
// The machinery that *selects* a config by context (story vs random
// battle) is deliberately NOT here — that's campaign work. The registry
// just holds configs; callers name one.

import { teamId, type DeploymentZoneConfig } from '@engine/index.ts';
import { rect } from './zone-helpers.ts';

const TEAM_BLUE = teamId('team_a');
const TEAM_RED = teamId('team_b');

// River Ridge (14×14): Blue rows 0-2 / cols 5-8 (12); Red rows 11-13 /
// cols 5-8 (12). Verbatim from the old `deploymentZoneFor`.
const riverRidgeDefault: DeploymentZoneConfig = {
  teams: [
    { team: TEAM_BLUE, subZones: [{ tiles: rect(5, 8, 0, 2) }] },
    { team: TEAM_RED, subZones: [{ tiles: rect(5, 8, 11, 13) }] },
  ],
};

// Stonebridge (16×16): Blue rows 0-1 / cols 5-8 (8); Red rows 14-15 /
// cols 5-8 (8).
const stonebridgeDefault: DeploymentZoneConfig = {
  teams: [
    { team: TEAM_BLUE, subZones: [{ tiles: rect(5, 8, 0, 1) }] },
    { team: TEAM_RED, subZones: [{ tiles: rect(5, 8, 14, 15) }] },
  ],
};

// Marshmoor (16×16): Blue NE corner cols 13-15 / rows 0-2 (9); Red SW
// corner cols 0-2 / rows 13-15 (9).
const marshmoorDefault: DeploymentZoneConfig = {
  teams: [
    { team: TEAM_BLUE, subZones: [{ tiles: rect(13, 15, 0, 2) }] },
    { team: TEAM_RED, subZones: [{ tiles: rect(0, 2, 13, 15) }] },
  ],
};

// Mountain Pass (16×16) — the first SPLIT config (S70). The victim (Blue,
// team_a) deploys as one contiguous block in the NW valley basin; the
// ambusher (Red, team_b) splits across two disjoint SE-heights sub-zones
// flanking the defile: the dominant SW massif (cap 3) and the lower NE
// edge (cap 2). Caps sum to 5 = the 5v5 roster, so the ambusher fills
// exactly. Tiles per the brief's D1; assignment per D2 (Chris, S70).
const mountainPassAmbush: DeploymentZoneConfig = {
  teams: [
    {
      // Victim — NW valley basin (elev 3-5). One sub-zone, uncapped:
      // 8 tiles for 5 units.
      team: TEAM_BLUE,
      subZones: [
        {
          tiles: [
            { x: 1, y: 1, layer: 0 },
            { x: 2, y: 1, layer: 0 },
            { x: 3, y: 1, layer: 0 },
            { x: 1, y: 2, layer: 0 },
            { x: 2, y: 2, layer: 0 },
            { x: 3, y: 2, layer: 0 },
            { x: 2, y: 3, layer: 0 },
            { x: 3, y: 3, layer: 0 },
          ],
        },
      ],
    },
    {
      // Ambusher — two SE-heights sub-zones flanking the defile.
      team: TEAM_RED,
      subZones: [
        {
          // SW massif — the dominant wall (elev 7-10). Cap 3.
          cap: 3,
          tiles: [
            { x: 8, y: 12, layer: 0 },
            { x: 9, y: 12, layer: 0 },
            { x: 8, y: 13, layer: 0 },
            { x: 9, y: 13, layer: 0 },
            { x: 8, y: 14, layer: 0 },
            { x: 9, y: 14, layer: 0 },
          ],
        },
        {
          // NE edge — the lower, weaker flank (elev 5-8). Cap 2.
          cap: 2,
          tiles: [
            { x: 14, y: 11, layer: 0 },
            { x: 15, y: 11, layer: 0 },
            { x: 15, y: 12, layer: 0 },
            { x: 15, y: 13, layer: 0 },
          ],
        },
      ],
    },
  ],
};

// Oskun Fields (16×16, S96): an east-west engagement across the col-7
// stream. Blue (player) on the west-bank fields cols 3-5 / rows 4-7
// (12 tiles, elev 2-4); Red (enemy) on the eastern knolls cols 9-11 /
// rows 4-7 (12 tiles, elev 3-5). Proposed layout — one Atlas-free edit
// to re-place if playtest wants a different axis.
const oskunFieldsDefault: DeploymentZoneConfig = {
  teams: [
    { team: TEAM_BLUE, subZones: [{ tiles: rect(3, 5, 4, 7) }] },
    { team: TEAM_RED, subZones: [{ tiles: rect(9, 11, 4, 7) }] },
  ],
};

// Alvera Village (16×16, S96): a ford assault on the village. Blue
// (player) on the east-west road cols 6-11 / rows 10-11 (12 tiles, all
// elev 2); Red (enemy) in the NW fields cols 1-4 / rows 4-6 (12 tiles,
// elev 2-3) across the row-8 river. Proposed layout, same caveat.
const alveraVillageDefault: DeploymentZoneConfig = {
  teams: [
    { team: TEAM_BLUE, subZones: [{ tiles: rect(6, 11, 10, 11) }] },
    { team: TEAM_RED, subZones: [{ tiles: rect(1, 4, 4, 6) }] },
  ],
};

// mapKey → (configName → config). 'default' is the convention every map
// provides; further keys are alternate layouts on the same terrain.
export const DEPLOYMENT_ZONE_REGISTRY: Readonly<
  Record<string, Readonly<Record<string, DeploymentZoneConfig>>>
> = {
  river_ridge: { default: riverRidgeDefault },
  stonebridge: { default: stonebridgeDefault },
  marshmoor: { default: marshmoorDefault },
  mountain_pass: { default: mountainPassAmbush },
  oskun_fields: { default: oskunFieldsDefault },
  alvera_village: { default: alveraVillageDefault },
};

// Look up a map's deployment-zone config by name (defaults to 'default').
// Throws loud on an unknown map or config — a missing config is a content
// wiring bug, not a silent fallback.
export function deploymentZonesFor(
  mapKey: string,
  configName = 'default',
): DeploymentZoneConfig {
  const configs = DEPLOYMENT_ZONE_REGISTRY[mapKey];
  if (configs === undefined) {
    throw new Error(
      `deploymentZonesFor: no deployment-zone configs registered for map '${mapKey}'.`,
    );
  }
  const config = configs[configName];
  if (config === undefined) {
    throw new Error(
      `deploymentZonesFor: map '${mapKey}' has no deployment-zone config named '${configName}'.`,
    );
  }
  return config;
}
