// Deployment-zone configuration — where each team may place its units
// during the pre-battle deployment phase.
//
// Session 70 (ADR pending): deployment zones used to live as a per-tile
// field (`Tile.deploymentZone`) baked into the map data. That coupled one
// terrain to exactly one deployment layout. They now live *beside* the
// terrain in a per-map registry, assembled with the terrain by the
// combiner (`assembleBattlefield`). One terrain can therefore carry many
// deployment configs (a story ambush vs a random-battle layout) without
// any map surgery.
//
// A side's zone is a *list of sub-zones*. The common single-contiguous
// zone is the one-element degenerate case (one sub-zone, no cap). A split
// zone (Map 4's ambush) is several disjoint sub-zones, each an independent
// tile-set with an optional per-sub-zone unit cap.
//
// Pure data: no engine reducer reads this (deployment is strictly upstream
// of `createInitialState` — see the Session 35 audit). It lives in
// `engine/types` so every layer (AI, UI, renderer, validator) shares one
// vocabulary, exactly as `Tile.deploymentZone` did.

import type { Position } from './spatial.ts';
import type { TeamId } from './ids.ts';

// One contiguous (or at least independently-capped) placement region for a
// side. `cap` is the maximum number of units that may deploy into this
// sub-zone; `undefined` = uncapped (bounded only by the tile count and the
// roster size). A single-zone side uses one sub-zone with no cap.
export interface DeploymentSubZone {
  readonly tiles: ReadonlyArray<Position>;
  readonly cap?: number;
}

// One side's full deployment region: its team plus its sub-zones.
export interface TeamDeploymentZone {
  readonly team: TeamId;
  readonly subZones: ReadonlyArray<DeploymentSubZone>;
}

// A complete deployment-zone config for a map: every side's region. A
// terrain may have several of these in the registry (story vs random);
// the combiner takes one and pairs it with the terrain.
export interface DeploymentZoneConfig {
  readonly teams: ReadonlyArray<TeamDeploymentZone>;
}
