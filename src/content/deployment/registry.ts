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

// mapKey → (configName → config). 'default' is the convention every map
// provides; further keys are alternate layouts on the same terrain.
export const DEPLOYMENT_ZONE_REGISTRY: Readonly<
  Record<string, Readonly<Record<string, DeploymentZoneConfig>>>
> = {
  river_ridge: { default: riverRidgeDefault },
  stonebridge: { default: stonebridgeDefault },
  marshmoor: { default: marshmoorDefault },
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
