// Coverage map — the incoming-threat model (S59 keystone, ADR-0094).
//
// "Which enemies can reach-and-hit tile X this turn, tagged melee vs.
// ranged, with expected damage to a given occupant." A pure function of
// board state. This is Layer 1 of the threat model (blueprint §3); Layer 2
// (positional prediction — where an enemy will actually *be* next turn) is
// deliberately deferred. Enemies are evaluated from where they stand now:
// an enemy's coverage of tile X = "could it move-and-hit X if it took its
// turn from where it is?"
//
// Built from per-enemy `getLegalMoves` × per-(destination, attack) reach,
// mirroring the engine's own targetability gate — distance + bow
// height-range bonus + the `rangeMode` LoS/arc check (see
// `src/engine/actions/validate.ts`, the source of truth this re-derives).
// Because the reach check reads the passed `state`'s map, a hypothetical
// elevation- or barrier-mutated state recomputes correctly through the
// *same* code path (the three-resolver discipline — no parallel
// approximation that can drift from the live map). That is what lets the
// Tier B Barrier-denial and defensive consumers query "threat on a board
// that doesn't exist yet."
//
// Damage is projected via the shared `projectExpectedDamage` resolver
// against a specific potential occupant (the moving unit itself for the
// defensive term, or a protected ally for Barrier denial), in the same
// currency as the offensive scorer. It is computed **once per (enemy,
// attack)** from the units' current positions and reused for every tile that
// attack can reach — a fixed danger estimate, not re-projected per tile. The
// per-tile work is the exact reach geometry (which preserves the elevation
// gate); folding per-tile elevation into the damage magnitude was dropped as
// a deliberate perf trade (projection is the costly stage and the headline
// S59 risk), and it keeps the damage consistent with Layer 1's "enemy
// evaluated where it stands."
//
// **melee vs. ranged.** Tagged by *effective horizontal reach*, not by
// `rangeMode`: a true melee swing reaches 1 (adjacency), vertical 3, so
// it is elevation-defeatable — the honest range check already drops it
// from a tile more than 3 levels above the attacker, so the
// "above-melee-reach" safety the defensive term wants falls out of the
// geometry with no separate nullification. Reach > 1 is ranged. Note a
// longbow leaves Attack at `rangeMode: 'melee'` but extends its reach to
// 5 (vertical 99) — so rangeMode would mis-tag a bow shot; effective reach
// classifies it correctly as ranged, never elevation-escapable. The tag
// feeds the defensive term's "ranged threat is NOT discounted by
// elevation" split and the tests.
//
// Pure; no I/O, no RNG, no mutation of the input state.

import {
  arcTargetable,
  computeAbilityRange,
  computeMpCost,
  endpointFrom,
  getLegalMoves,
  hasLineOfSight,
  inRange,
  positionKey,
  rangeFromHeightBonus,
  runModifyAttackerElevation,
  tileAt,
  weaponRangeFromHeightSpec,
  type AbilityId,
  type ActiveAbilityDefinition,
  type Catalog,
  type GameState,
  type Position,
  type RangeMode,
  type Unit,
  type UnitId,
} from '@engine/index.ts';
import { projectExpectedDamage } from '../projection.ts';

export type ThreatKind = 'melee' | 'ranged';

// One enemy attack that can reach-and-hit a given tile, with the expected
// damage it would deal to the queried occupant (max over the enemy's
// reachable firing positions — a worst-case read appropriate for a safety
// model). One entry per (enemy, attack) that reaches; an enemy with two
// attacks that both reach contributes two entries.
export interface ThreatEntry {
  readonly enemyId: UnitId;
  readonly abilityId: AbilityId;
  readonly kind: ThreatKind;
  readonly expectedDamage: number;
}

export interface CoverageMap {
  // Every threat entry on the tile (empty array if none / off-map).
  query(position: Position): ReadonlyArray<ThreatEntry>;
  // Sum of expected incoming damage on the tile across all threats.
  expectedIncoming(position: Position): number;
  // Expected incoming damage restricted to one threat kind. The defensive
  // term reads `'ranged'` (never elevation-discounted) and `'melee'`
  // (already geometry-nullified above reach) separately.
  expectedIncomingByKind(position: Position, kind: ThreatKind): number;
}

const EMPTY: ReadonlyArray<ThreatEntry> = [];

// Per-enemy precomputation shared across every tile query in a full-map
// build: the enemy, every tile it can stand on this turn (current
// position included — an enemy that stays put still attacks), and its
// affordable damage attacks. `getLegalMoves` (Dijkstra) runs once per
// enemy here rather than once per tile.
interface EnemyThreatData {
  readonly enemy: Unit;
  readonly sources: ReadonlyArray<Position>;
  readonly attacks: ReadonlyArray<EnemyAttack>;
}

// One of an enemy's damage attacks, with its melee/ranged tag, effective
// range, and expected damage to the occupant precomputed once per build.
// The expected damage is projected from the enemy's and occupant's *current*
// positions — a fixed per-attack danger estimate reused for every tile this
// attack can reach, rather than re-projecting per (source, tile). That keeps
// the build cheap (projection is O(enemies × attacks), not × tiles ×
// sources) and is consistent with Layer 1 (the enemy is evaluated where it
// stands); tile reachability is still computed exactly per-tile from the
// real board geometry. See ADR-0094.
interface EnemyAttack {
  readonly ability: ActiveAbilityDefinition;
  readonly kind: ThreatKind;
  readonly effective: ReturnType<typeof computeAbilityRange>;
  readonly expectedDamage: number;
}

// Build the per-turn coverage map of threats to `occupant` (tile → the
// enemies that can reach-and-hit it). For the defensive term, which queries
// many candidate move destinations.
//
// `tiles` optionally bounds which tiles are computed — the defensive term
// passes only the actor's reachable move destinations (plus its current
// tile), so the expensive per-tile projection sweep runs over ~move-range
// tiles rather than the whole board (perf: the headline S59 risk). Omitted
// → the full board (a tile not in the computed set queries as no-threat).
export function buildCoverageMap(
  state: GameState,
  catalog: Catalog,
  occupant: Unit,
  tiles?: ReadonlyArray<Position>,
): CoverageMap {
  const enemyData = enemyThreatData(state, catalog, occupant);
  const targets: ReadonlyArray<Position> =
    tiles ?? state.map.tiles.map((t) => ({ x: t.x, y: t.y, layer: t.layer }));
  const byTile = new Map<string, ThreatEntry[]>();
  for (const pos of targets) {
    const entries = threatsToTileFrom(state, catalog, occupant, pos, enemyData);
    if (entries.length > 0) byTile.set(positionKey(pos), entries);
  }
  return makeCoverageMap(byTile);
}

// Threats to a single tile. Used by Barrier denial, which compares the
// threat to a protected ally's tile on the live board vs. a hypothetical
// barrier-inserted board — building only the one tile it cares about
// rather than the whole map.
export function threatsToTile(
  state: GameState,
  catalog: Catalog,
  occupant: Unit,
  tile: Position,
): ReadonlyArray<ThreatEntry> {
  const enemyData = enemyThreatData(state, catalog, occupant);
  return threatsToTileFrom(state, catalog, occupant, tile, enemyData);
}

function makeCoverageMap(byTile: ReadonlyMap<string, ReadonlyArray<ThreatEntry>>): CoverageMap {
  const get = (p: Position): ReadonlyArray<ThreatEntry> => byTile.get(positionKey(p)) ?? EMPTY;
  return {
    query: get,
    expectedIncoming: (p) => get(p).reduce((s, e) => s + e.expectedDamage, 0),
    expectedIncomingByKind: (p, kind) =>
      get(p).reduce((s, e) => (e.kind === kind ? s + e.expectedDamage : s), 0),
  };
}

function enemyThreatData(state: GameState, catalog: Catalog, occupant: Unit): EnemyThreatData[] {
  const out: EnemyThreatData[] = [];
  for (const enemy of state.units.values()) {
    if (enemy.team === occupant.team) continue;
    if (enemy.vitals.hp <= 0) continue;
    const sources: Position[] = [];
    for (const path of getLegalMoves(state, enemy.id, catalog).reachable.values()) {
      sources.push(path.destination);
    }
    const attacks: EnemyAttack[] = [];
    for (const ability of enemyAttacks(state, catalog, enemy)) {
      // Effective horizontal reach is source-independent (the bow
      // height-range bonus is applied per-source inside canReachAndHit),
      // so it doubles as the melee/ranged tag: reach 1 = elevation-defeatable
      // melee. Expected damage is projected once here (current positions).
      const effective = computeAbilityRange(state, catalog, enemy.id, ability);
      attacks.push({
        ability,
        kind: effective.horizontal <= 1 ? 'melee' : 'ranged',
        effective,
        expectedDamage: projectExpectedDamage({ state, catalog, attacker: enemy, target: occupant, ability }),
      });
    }
    out.push({ enemy, sources, attacks });
  }
  return out;
}

function threatsToTileFrom(
  state: GameState,
  catalog: Catalog,
  _occupant: Unit,
  tile: Position,
  enemyData: ReadonlyArray<EnemyThreatData>,
): ThreatEntry[] {
  const out: ThreatEntry[] = [];
  for (const { enemy, sources, attacks } of enemyData) {
    for (const attack of attacks) {
      // Geometry only: can the enemy reach a firing tile from which `attack`
      // hits this tile? Damage was precomputed in enemyThreatData.
      const reaches = sources.some((source) =>
        canReachAndHit(state, catalog, enemy, source, tile, attack.ability, attack.effective),
      );
      if (!reaches) continue;
      out.push({
        enemyId: enemy.id,
        abilityId: attack.ability.id,
        kind: attack.kind,
        expectedDamage: Math.max(0, attack.expectedDamage),
      });
    }
  }
  return out;
}

// An enemy's affordable damage attacks. Damage-dealing only: debuff-only
// appliers (Magnetic Mark, etc.) are real threats but deal no damage, so
// they contribute nothing to the incoming-damage model the v1 consumers
// read — deferred. Mirrors the loadout walk in `basic.ts`
// (`enumerateActiveAbilities`); kept local so the dependency arrow runs
// basic.ts → coverage-map only (no cycle), and the filter here is
// genuinely narrower (damage attacks, not the broader "offensive" set).
function enemyAttacks(
  state: GameState,
  catalog: Catalog,
  enemy: Unit,
): ActiveAbilityDefinition[] {
  const seen = new Set<AbilityId>();
  const out: ActiveAbilityDefinition[] = [];
  const consider = (memberId: AbilityId): void => {
    if (seen.has(memberId)) return;
    seen.add(memberId);
    if (!catalog.hasAbility(memberId)) return;
    const ability = catalog.getAbility(memberId);
    if (ability.kind !== 'active') return;
    const damage = ability.effects.damage;
    if (damage === undefined || damage.tags.includes('healing')) return;
    if (enemy.vitals.mp < computeMpCost(state, catalog, enemy.id, ability.id)) return;
    out.push(ability);
  };
  const cls = catalog.getClass(enemy.classState.currentClass);
  for (const freeId of cls.freeAbilities) consider(freeId);
  for (const entries of Object.values(enemy.loadout.actionBuckets)) {
    for (const commandSetId of entries) {
      if (!catalog.hasCommandSet(commandSetId)) continue;
      for (const memberId of catalog.getCommandSet(commandSetId).members) consider(memberId);
    }
  }
  return out;
}

function rangeModeOf(ability: ActiveAbilityDefinition): RangeMode | undefined {
  return 'rangeMode' in ability.targeting ? ability.targeting.rangeMode : undefined;
}

// Can `attacker`, standing on `source`, reach-and-hit `targetPos` with
// `ability`? Mirrors validate.ts: the distance gate (with the bow
// height-range bonus) plus the `rangeMode` LoS / arc gate. Melee carries
// no LoS check; straight-line requires an unblocked sightline (a barrier
// breaks it — the denial lever); arc lobs over intermediate obstructions
// (a barrier does NOT block it).
function canReachAndHit(
  state: GameState,
  catalog: Catalog,
  attacker: Unit,
  source: Position,
  targetPos: Position,
  ability: ActiveAbilityDefinition,
  effective: ReturnType<typeof computeAbilityRange>,
): boolean {
  const sourceTile = tileAt(state.map, source.x, source.y, source.layer);
  const targetTile = tileAt(state.map, targetPos.x, targetPos.y, targetPos.layer);
  if (sourceTile === undefined || targetTile === undefined) return false;
  const ruleset = catalog.getRuleset(state.ruleset.id);
  // S68 (Vantage, ADR-0115): a threatening unit with Vantage menaces from
  // its effective (raised) elevation — so the threat model fears its
  // extended reach-from-height and over-cover shots. Vertical `inRange`
  // stays raw, mirroring validate.ts.
  const offensiveSourceElev = runModifyAttackerElevation(state, catalog, {
    unit: attacker,
    baseValue: sourceTile.elevation,
  });
  const heightBonus = rangeFromHeightBonus(
    weaponRangeFromHeightSpec(attacker, catalog, ability),
    offensiveSourceElev,
    targetTile.elevation,
  );
  const within = inRange({
    source: endpointFrom(source, sourceTile.elevation),
    target: endpointFrom(targetPos, targetTile.elevation),
    params: {
      horizontalMax: effective.horizontal + heightBonus,
      horizontalMin: effective.minHorizontal ?? ruleset.rangeDefaults.minHorizontal,
      verticalMax: effective.vertical,
    },
  });
  if (!within) return false;
  const mode = rangeModeOf(ability);
  if (mode === 'straight_line') {
    return hasLineOfSight(
      state.map,
      endpointFrom(source, offensiveSourceElev),
      endpointFrom(targetPos, targetTile.elevation),
    );
  }
  if (mode === 'arc') {
    return arcTargetable(state.map, source, targetPos);
  }
  return true; // melee — range gate only
}
