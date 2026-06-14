// AI deployment heuristic (Session 43; role-aware sorting added S66).
//
// Places an AI-controlled team's units onto its deployment-zone tiles
// without human input. The heuristic is intentionally simple: a melee
// front line, ranged/casters protected behind it, everyone facing the
// enemy.
//
//   1. Opposing-zone centroid — the average position of every tile
//      tagged as a deployment zone for some *other* team.
//   2. Forwardness rank — own-zone tiles sorted by distance to that
//      centroid, closest first (front) to farthest (protected rear). The
//      old "front center" (S43) is just rank 0 of this ordering.
//   3. Order units melee-first then ranged, each sorted by descending
//      maxHP (high-HP bodies soak the front), class id ascending as the
//      deterministic tie-break.
//   4. Assign that ordered list onto the forwardness rank in order: melee
//      take the frontmost tiles (tanks at the tip), ranged/casters take
//      the tiles immediately behind (S66, D3). Facing points from the
//      tile toward the opposing centroid.
//
// Role is classified off the unit's equipped weapon type (ADR-0105 — this
// retires that banked hook's first consumer); the caller resolves it (it
// holds the catalog) and passes it in, keeping this a pure, catalog-blind
// geometry function. Why forwardness-by-centroid and not the in-battle
// coverage map (ADR-0094): the coverage map projects threat from *placed*
// units for a given active actor, but at deployment neither team is on the
// field yet — the opposing centroid is the only enemy-position signal, so
// distance-to-centroid is the deployment-appropriate "exposure" proxy.
//
// Pure: no RNG, no I/O. The zone-smaller-than-team edge case returns the
// leftover unit ids in `unplaced` rather than logging — the caller (the
// app's deployment routing) owns the warning so this stays a pure,
// trivially-testable geometry function.

import {
  cardinalFromTo,
  type BattleMap,
  type ClassId,
  type Direction,
  type Position,
  type Tile,
  type TeamId,
  type UnitId,
  type WeaponType,
} from '@engine/index.ts';

// Coarse deployment role (S66, D3). `melee` units form the front line;
// `ranged` (archers and casters) sit on protected rear tiles.
export type DeployRole = 'melee' | 'ranged';

// Classify a unit's deployment role from its equipped weapon type
// (ADR-0105). Bows, wands, and staves want to fire from the protected
// rear; every melee weapon — and an unarmed / unclassified unit — defaults
// to the front line. Pure; the single source of truth for the mapping.
const RANGED_WEAPON_TYPES: ReadonlySet<WeaponType> = new Set(['bow', 'wand', 'staff']);
export function deployRoleFromWeaponType(weaponType: WeaponType | undefined): DeployRole {
  return weaponType !== undefined && RANGED_WEAPON_TYPES.has(weaponType) ? 'ranged' : 'melee';
}

// The minimum a unit needs to be placed by the heuristic: its id, its
// computed maxHP (a sort key — caller computes it, since maxHP is a
// computed-not-stored value), its class id (the deterministic tie-break),
// and its deployment role. `role` is optional and defaults to `melee` so
// callers/tests that predate role-aware sorting keep the original
// tanks-forward behavior unchanged.
export interface DeployableUnit {
  readonly id: UnitId;
  readonly maxHP: number;
  readonly classId: ClassId;
  readonly role?: DeployRole;
}

export interface AiDeploymentResult {
  readonly placements: ReadonlyMap<UnitId, { readonly position: Position; readonly facing: Direction }>;
  // Unit ids that did not fit (zone smaller than the team). Empty in the
  // normal case; non-empty signals a content-authoring problem the
  // caller should surface.
  readonly unplaced: ReadonlyArray<UnitId>;
}

interface Centroid {
  readonly x: number;
  readonly y: number;
}

// Squared Euclidean distance on (x, y). Squared avoids a sqrt and
// preserves ordering — we only ever compare distances, never report them.
function dist2(tile: Tile, point: Centroid): number {
  const dx = tile.x - point.x;
  const dy = tile.y - point.y;
  return dx * dx + dy * dy;
}

// Deterministic total order over tiles: row, then column, then layer.
// Used as the tie-break whenever two tiles are equidistant from a
// reference point, so the heuristic never depends on map-tile iteration
// order.
function tileOrder(a: Tile, b: Tile): number {
  if (a.y !== b.y) return a.y - b.y;
  if (a.x !== b.x) return a.x - b.x;
  return a.layer - b.layer;
}

function centroidOf(tiles: ReadonlyArray<Tile>): Centroid {
  let sx = 0;
  let sy = 0;
  for (const t of tiles) {
    sx += t.x;
    sy += t.y;
  }
  return { x: sx / tiles.length, y: sy / tiles.length };
}

export function planAiDeployment(args: {
  readonly map: BattleMap;
  readonly team: TeamId;
  readonly units: ReadonlyArray<DeployableUnit>;
}): AiDeploymentResult {
  const { map, team, units } = args;

  const ownZone = map.tiles.filter((t) => t.deploymentZone === team);
  // Opposing zone = any tile tagged for a *different* team. `null` (an
  // explicitly-neutral shared zone) and `undefined` (no zone) are skipped.
  const opposingZone = map.tiles.filter(
    (t) => t.deploymentZone != null && t.deploymentZone !== team,
  );

  if (opposingZone.length === 0) {
    throw new Error(
      `planAiDeployment: map declares no opposing deployment zone for team ${JSON.stringify(team)}`,
    );
  }

  // No own-zone tiles → nothing can be placed. Fail loud rather than
  // silently returning an empty plan (it's a malformed-map signal).
  if (ownZone.length === 0) {
    throw new Error(
      `planAiDeployment: map declares no deployment zone for team ${JSON.stringify(team)}`,
    );
  }

  const opposingCentroid = centroidOf(opposingZone);

  // Forwardness rank: own-zone tiles ordered front (closest to the enemy
  // centroid) to rear. tileOrder breaks equidistant ties deterministically.
  // Rank 0 is the old "front center" (the tip of the spear).
  const byForward = [...ownZone].sort((a, b) => {
    const da = dist2(a, opposingCentroid);
    const db = dist2(b, opposingCentroid);
    if (da !== db) return da - db;
    return tileOrder(a, b);
  });

  // Within a role: high HP first, class id breaks ties (deterministic).
  const byPriority = (a: DeployableUnit, b: DeployableUnit): number => {
    if (a.maxHP !== b.maxHP) return b.maxHP - a.maxHP;
    return a.classId < b.classId ? -1 : a.classId > b.classId ? 1 : 0;
  };
  // Melee first (they claim the frontmost tiles), then ranged/casters
  // (the protected tiles immediately behind the line). Default-melee for
  // units whose role is unset (see DeployableUnit.role).
  const melee = units.filter((u) => (u.role ?? 'melee') === 'melee').sort(byPriority);
  const ranged = units.filter((u) => u.role === 'ranged').sort(byPriority);
  const ordered = [...melee, ...ranged];

  const placements = new Map<UnitId, { readonly position: Position; readonly facing: Direction }>();
  const unplaced: UnitId[] = [];

  // Assign the role-ordered units onto the forwardness rank in order:
  // ordered[i] → byForward[i]. Overflow (zone smaller than team) drops the
  // tail of the ordered list — lowest-priority ranged first, then melee.
  for (let i = 0; i < ordered.length; i++) {
    const unit = ordered[i]!;
    const tile = byForward[i];
    if (tile === undefined) {
      unplaced.push(unit.id);
      continue;
    }
    const facing = cardinalFromTo({ x: tile.x, y: tile.y }, opposingCentroid);
    placements.set(unit.id, {
      position: { x: tile.x, y: tile.y, layer: tile.layer },
      facing,
    });
  }

  return { placements, unplaced };
}
