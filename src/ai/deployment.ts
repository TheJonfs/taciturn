// AI deployment heuristic (Session 43; role-aware sorting added S66).
//
// Places an AI-controlled team's units onto its deployment-zone tiles
// without human input. The heuristic is intentionally simple: a melee
// front line, ranged/casters protected behind it, everyone facing the
// enemy.
//
//   1. Opposing-zone centroid — the average position of every tile in
//      some *other* team's deployment zone.
//   2. Order units melee-first then ranged, each sorted by descending
//      maxHP (high-HP bodies soak the front), class id ascending as the
//      deterministic tie-break.
//   3. Distribute units across the side's *sub-zones* respecting each
//      sub-zone's cap: melee round-robin across sub-zones (front wing —
//      the one whose centroid is closest to the enemy — gets the top
//      tank first), then ranged round-robin into the remaining capacity.
//      A single contiguous zone is the one-sub-zone degenerate case, so
//      this reduces to the pre-S70 behavior exactly.
//   4. Within each sub-zone, lay its assigned units onto its own tiles by
//      *local* forwardness: that sub-zone's melee take its frontmost
//      tiles, its ranged the tiles behind. Each wing is its own front/
//      back line — roles are never sorted across the gap between disjoint
//      sub-zones. Facing points from each tile toward the opposing
//      centroid.
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
//
// Session 70: reads the deployment-zone *config* (extracted off the map
// tiles) rather than `map.tiles[].deploymentZone`. The geometry is
// unchanged — it only ever used tile (x, y, layer), so the switch from
// `Tile` to `Position` is transparent for single-zone sides.

import {
  cardinalFromTo,
  opposingTilesFor,
  zoneForTeam,
  type ClassId,
  type DeploymentSubZone,
  type DeploymentZoneConfig,
  type Direction,
  type Position,
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
// Accepts any {x, y} so it serves both tiles and sub-zone centroids.
function dist2(a: { readonly x: number; readonly y: number }, b: Centroid): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

// Deterministic total order over tiles: row, then column, then layer.
// Used as the tie-break whenever two tiles are equidistant from a
// reference point, so the heuristic never depends on tile iteration
// order.
function tileOrder(a: Position, b: Position): number {
  if (a.y !== b.y) return a.y - b.y;
  if (a.x !== b.x) return a.x - b.x;
  return a.layer - b.layer;
}

function centroidOf(tiles: ReadonlyArray<Position>): Centroid {
  let sx = 0;
  let sy = 0;
  for (const t of tiles) {
    sx += t.x;
    sy += t.y;
  }
  return { x: sx / tiles.length, y: sy / tiles.length };
}

export function planAiDeployment(args: {
  readonly zones: DeploymentZoneConfig;
  readonly team: TeamId;
  readonly units: ReadonlyArray<DeployableUnit>;
}): AiDeploymentResult {
  const { zones, team, units } = args;

  const ownZone = zoneForTeam(zones, team);
  // Opposing zone = every tile belonging to a *different* team.
  const opposingZone = opposingTilesFor(zones, team);

  if (opposingZone.length === 0) {
    throw new Error(
      `planAiDeployment: config declares no opposing deployment zone for team ${JSON.stringify(team)}`,
    );
  }

  // No own-zone tiles → nothing can be placed. Fail loud rather than
  // silently returning an empty plan (it's a malformed-config signal).
  const ownTileCount = ownZone?.subZones.reduce((n, sz) => n + sz.tiles.length, 0) ?? 0;
  if (ownZone === undefined || ownTileCount === 0) {
    throw new Error(
      `planAiDeployment: config declares no deployment zone for team ${JSON.stringify(team)}`,
    );
  }

  const opposingCentroid = centroidOf(opposingZone);

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

  // Per-sub-zone state: effective capacity (cap or tile count, whichever
  // is smaller), forwardness (sub-zone centroid → enemy), and the units
  // assigned to it (melee then ranged, the placement order within the
  // wing). Sub-zones are ordered front-first so the dominant wing — the
  // one nearest the enemy — receives the top tank first; the authored
  // sub-zone index breaks ties (the brief's D2 lists the dominant wing
  // first).
  interface SubZoneState {
    readonly subZone: DeploymentSubZone;
    readonly index: number;
    readonly forward: number;
    capacity: number;
    readonly melee: DeployableUnit[];
    readonly ranged: DeployableUnit[];
  }
  const subZones: SubZoneState[] = ownZone.subZones.map((sz, index) => ({
    subZone: sz,
    index,
    forward: dist2(centroidOf(sz.tiles), opposingCentroid),
    capacity: Math.min(sz.cap ?? Number.POSITIVE_INFINITY, sz.tiles.length),
    melee: [],
    ranged: [],
  }));
  const order = [...subZones].sort((a, b) =>
    a.forward !== b.forward ? a.forward - b.forward : a.index - b.index,
  );

  const unplaced: UnitId[] = [];

  // Round-robin a role's units across the sub-zones (front-first), each
  // placement consuming one of that sub-zone's capacity units. The cursor
  // advances so consecutive units of a role spread across wings rather
  // than stacking in one — every wing gets a slice of the line. Overflow
  // (more units than total capacity) drops to `unplaced`.
  const distribute = (list: ReadonlyArray<DeployableUnit>, role: 'melee' | 'ranged'): void => {
    let cursor = 0;
    for (const unit of list) {
      let placed = false;
      for (let k = 0; k < order.length; k++) {
        const sz = order[(cursor + k) % order.length]!;
        if (sz.capacity > 0) {
          sz[role].push(unit);
          sz.capacity -= 1;
          cursor = (cursor + k + 1) % order.length;
          placed = true;
          break;
        }
      }
      if (!placed) unplaced.push(unit.id);
    }
  };
  distribute(melee, 'melee');
  distribute(ranged, 'ranged');

  const placements = new Map<UnitId, { readonly position: Position; readonly facing: Direction }>();

  // Lay each sub-zone's assigned units onto its own tiles by local
  // forwardness: its melee on the frontmost tiles, its ranged behind.
  // Each wing is an independent front/back line.
  for (const sz of subZones) {
    const localTiles = [...sz.subZone.tiles].sort((a, b) => {
      const da = dist2(a, opposingCentroid);
      const db = dist2(b, opposingCentroid);
      if (da !== db) return da - db;
      return tileOrder(a, b);
    });
    const seq = [...sz.melee, ...sz.ranged];
    for (let i = 0; i < seq.length; i++) {
      const tile = localTiles[i]!;
      placements.set(seq[i]!.id, {
        position: { x: tile.x, y: tile.y, layer: tile.layer },
        facing: cardinalFromTo({ x: tile.x, y: tile.y }, opposingCentroid),
      });
    }
  }

  return { placements, unplaced };
}
