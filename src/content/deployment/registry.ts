// GENERATED-SHAPED — per-map deployment-zone registry (Cartographer map editor).
//
// The seam between terrain and deployment layout (S70): a map key maps to
// one-or-more named zone configs; callers pair a chosen config with the
// terrain (`assembleBattlefield`). The machinery that *selects* a config by
// context (story vs random battle) is deliberately NOT here — this registry
// just holds configs.
// This module is codegen output of the Cartographer map-authoring tool (the
// `?cartographer` dev route): hand edits are legal TypeScript but the next
// Cartographer export OVERWRITES THIS FILE WHOLESALE. Round-trip fidelity
// is pinned by the Cartographer codegen test.

import { teamId, type DeploymentZoneConfig } from '@engine/index.ts';
import { rect } from './zone-helpers.ts';

const TEAM_BLUE = teamId('team_a');
const TEAM_RED = teamId('team_b');

// river_ridge — 'default'.
const riverRidgeDefault: DeploymentZoneConfig = {
  teams: [
    { team: TEAM_BLUE, subZones: [{ tiles: rect(5, 8, 0, 2) }] },
    { team: TEAM_RED, subZones: [{ tiles: rect(5, 8, 11, 13) }] },
  ],
};

// stonebridge — 'default'.
const stonebridgeDefault: DeploymentZoneConfig = {
  teams: [
    { team: TEAM_BLUE, subZones: [{ tiles: rect(5, 8, 0, 1) }] },
    { team: TEAM_RED, subZones: [{ tiles: rect(5, 8, 14, 15) }] },
  ],
};

// marshmoor — 'default'.
const marshmoorDefault: DeploymentZoneConfig = {
  teams: [
    { team: TEAM_BLUE, subZones: [{ tiles: rect(13, 15, 0, 2) }] },
    { team: TEAM_RED, subZones: [{ tiles: rect(0, 2, 13, 15) }] },
  ],
};

// mountain_pass — 'default'.
const mountainPassDefault: DeploymentZoneConfig = {
  teams: [
    {
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
      team: TEAM_RED,
      subZones: [
        {
          cap: 3,
          tiles: rect(8, 9, 12, 14),
        },
        {
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

// oskun_fields — 'default'.
const oskunFieldsDefault: DeploymentZoneConfig = {
  teams: [
    { team: TEAM_BLUE, subZones: [{ tiles: rect(3, 5, 4, 7) }] },
    { team: TEAM_RED, subZones: [{ tiles: rect(9, 11, 4, 7) }] },
  ],
};

// alvera_village — 'default'.
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
  mountain_pass: { default: mountainPassDefault },
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
