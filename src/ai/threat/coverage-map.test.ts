// Session 59 — coverage map (the incoming-threat model, ADR-0094).
//
// Exercises the pure threat foundation directly: known board → correct
// threatened tiles; melee vs. ranged tagged by effective reach; the
// elevation gate (a true melee swing can't reach a tile > its vertical
// reach above it, a bow can); hypothetical recompute on elevation- and
// barrier-mutated boards (the three-resolver discipline); and the
// agreement between the full-map and single-tile builders.
//
// Units are built on the default catalog. A weaponless Knight's `attack`
// is true melee (reach 1, vertical 3, unarmed WP 1 → PA×1 = 5 damage). A
// Knight holding a Longbow turns the same `attack` into a ranged shot
// (reach 5, vertical 99) — the bow case that must NOT be elevation-
// escapable.

import { describe, expect, it } from 'vitest';
import {
  EMPTY_UNIT_EQUIPMENT,
  itemId,
  teamId,
  type BarrierState,
  type Position,
  type Tile,
  type Unit,
  type UnitEquipment,
} from '@engine/index.ts';
import { loadDefaultCatalog } from '../../content/index.ts';
import { makeGameState, makeUnit } from '../../engine/ct/test-fixtures.ts';
import { buildCoverageMap, threatsToTile } from './coverage-map.ts';

const catalog = loadDefaultCatalog();

const TEAM_A = teamId('team_a');
const TEAM_B = teamId('team_b');
const TEAMS = [
  { id: TEAM_A, name: 'A', control: 'human' as const },
  { id: TEAM_B, name: 'B', control: 'ai' as const },
];
const LONGBOW = itemId('longbow');

function gridMap(width: number, height: number, elevAt: (x: number, y: number) => number): {
  width: number;
  height: number;
  tiles: Tile[];
} {
  const tiles: Tile[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      tiles.push({ x, y, layer: 0, elevation: elevAt(x, y), terrain: 'ground', properties: [] });
    }
  }
  return { width, height, tiles };
}

// Knight whose `attack` is true melee (no weapon → reach 1, vertical 3).
function meleeKnight(id: string, team: typeof TEAM_A | typeof TEAM_B, pos: Position): Unit {
  return makeUnit({ id, team, spd: 10, classId: 'knight', maxHpBase: 60, hp: 60, position: pos });
}

// Knight holding a Longbow → `attack` becomes a reach-5, vertical-99 shot.
function bowKnight(id: string, team: typeof TEAM_A | typeof TEAM_B, pos: Position): Unit {
  const equipment: UnitEquipment = { ...EMPTY_UNIT_EQUIPMENT, rightHand: LONGBOW };
  return makeUnit({ id, team, spd: 10, classId: 'knight', maxHpBase: 60, hp: 60, position: pos, equipment });
}

const P = (x: number, y: number): Position => ({ x, y, layer: 0 });

describe('S59 coverage map — reach & tagging on a flat board', () => {
  it('a melee enemy threatens an adjacent tile, tagged melee, with positive expected damage', () => {
    const occupant = meleeKnight('ally', TEAM_A, P(5, 2));
    const enemy = meleeKnight('foe', TEAM_B, P(0, 0));
    const state = makeGameState({ units: [occupant, enemy], map: gridMap(10, 3, () => 0), teams: TEAMS });

    const map = buildCoverageMap(state, catalog, occupant);
    const entries = map.query(P(2, 0)); // enemy moves to (1,0), strikes (2,0)
    expect(entries.length).toBe(1);
    expect(entries[0]!.enemyId).toBe(enemy.id);
    expect(entries[0]!.kind).toBe('melee');
    // Weaponless: PA 5 × WP 1 × variance-midpoint 1.0 × hit 1.0 = 5.
    expect(entries[0]!.expectedDamage).toBeCloseTo(5, 5);
  });

  it('leaves tiles beyond move + reach unthreatened', () => {
    const occupant = meleeKnight('ally', TEAM_A, P(5, 2));
    const enemy = meleeKnight('foe', TEAM_B, P(0, 0));
    const state = makeGameState({ units: [occupant, enemy], map: gridMap(10, 3, () => 0), teams: TEAMS });

    const map = buildCoverageMap(state, catalog, occupant);
    // Enemy move 3 + melee reach 1 = 4; (9,0) is 9 away.
    expect(map.query(P(9, 0))).toEqual([]);
    expect(map.expectedIncoming(P(9, 0))).toBe(0);
  });

  it('tags a longbow-wielder as ranged (effective reach 5 > 1)', () => {
    const occupant = meleeKnight('ally', TEAM_A, P(5, 2));
    const enemy = bowKnight('foe', TEAM_B, P(0, 0));
    const state = makeGameState({ units: [occupant, enemy], map: gridMap(10, 3, () => 0), teams: TEAMS });

    const map = buildCoverageMap(state, catalog, occupant);
    const entries = map.query(P(3, 0)); // distance 3, within the bow's 2-5 band
    expect(entries.length).toBe(1);
    expect(entries[0]!.kind).toBe('ranged');
    expect(entries[0]!.expectedDamage).toBeGreaterThan(0);
  });

  it('respects the bow dead zone (min range 2 → no adjacent threat from current tile)', () => {
    const occupant = meleeKnight('ally', TEAM_A, P(5, 2));
    const enemy = bowKnight('foe', TEAM_B, P(0, 0));
    const state = makeGameState({ units: [occupant, enemy], map: gridMap(10, 3, () => 0), teams: TEAMS });
    // The bow can still reach (1,0) by NOT firing from (0,0) — it can move
    // away and shoot back. So we assert the bow reaches it as ranged, never
    // as melee (the dead zone is a per-source constraint, not a coverage hole).
    const entries = buildCoverageMap(state, catalog, occupant).query(P(1, 0));
    expect(entries.every((e) => e.kind === 'ranged')).toBe(true);
  });
});

describe('S59 coverage map — the elevation gate', () => {
  // A pillar at (2,0) rises to elevation 4 (above melee's vertical reach 3,
  // so melee is excluded — but a bow firing 4 uphill still lands ×0.2 of its
  // damage, where a 5-uphill shot would be reduced to exactly 0). Flat 0
  // elsewhere.
  const pillarMap = gridMap(6, 3, (x, y) => (x === 2 && y === 0 ? 4 : 0));

  it('a melee swing cannot threaten a tile more than 3 levels above it', () => {
    const occupant = meleeKnight('ally', TEAM_A, P(5, 2));
    const enemy = meleeKnight('foe', TEAM_B, P(0, 0));
    const state = makeGameState({ units: [occupant, enemy], map: pillarMap, teams: TEAMS });

    const map = buildCoverageMap(state, catalog, occupant);
    // Enemy stands at elevation 0, can't climb the pillar (jump 2 < 4), and
    // adjacent tiles are elev 0 → delta 4 > vertical reach 3 → unreachable.
    expect(map.query(P(2, 0))).toEqual([]);
    // A flat neighbour is still threatened — the gate is elevation-specific.
    expect(map.query(P(1, 0)).some((e) => e.kind === 'melee')).toBe(true);
  });

  it('a ranged shot is NOT discounted by elevation (bow reaches the high tile)', () => {
    const occupant = meleeKnight('ally', TEAM_A, P(5, 2));
    const enemy = bowKnight('foe', TEAM_B, P(0, 0));
    const state = makeGameState({ units: [occupant, enemy], map: pillarMap, teams: TEAMS });

    const map = buildCoverageMap(state, catalog, occupant);
    const entries = map.query(P(2, 0)); // elev 4, distance 2 — within bow reach, vertical 99
    expect(entries.length).toBe(1);
    expect(entries[0]!.kind).toBe('ranged');
    expect(entries[0]!.expectedDamage).toBeGreaterThan(0);
  });

  it('melee absent and ranged present on the same high tile (combined threat)', () => {
    const occupant = meleeKnight('ally', TEAM_A, P(5, 2));
    const melee = meleeKnight('m', TEAM_B, P(0, 0));
    const bow = bowKnight('b', TEAM_B, P(0, 2));
    const state = makeGameState({ units: [occupant, melee, bow], map: pillarMap, teams: TEAMS });

    const entries = buildCoverageMap(state, catalog, occupant).query(P(2, 0));
    expect(entries.some((e) => e.kind === 'melee')).toBe(false);
    expect(entries.some((e) => e.kind === 'ranged' && e.enemyId === bow.id)).toBe(true);
    // Aggregate split: melee component zero, ranged component positive.
    expect(buildCoverageMap(state, catalog, occupant).expectedIncomingByKind(P(2, 0), 'melee')).toBe(0);
    expect(buildCoverageMap(state, catalog, occupant).expectedIncomingByKind(P(2, 0), 'ranged')).toBeGreaterThan(0);
  });
});

describe('S59 coverage map — hypothetical recompute (pure function of board state)', () => {
  it('raising a tile above melee reach removes the melee threat to it', () => {
    const occupant = meleeKnight('ally', TEAM_A, P(5, 2));
    const enemy = meleeKnight('foe', TEAM_B, P(0, 0));
    // Same units, two boards: (2,0) flat vs (2,0) raised to elevation 5.
    const flat = makeGameState({ units: [occupant, enemy], map: gridMap(6, 3, () => 0), teams: TEAMS });
    const raised = makeGameState({
      units: [occupant, enemy],
      map: gridMap(6, 3, (x, y) => (x === 2 && y === 0 ? 5 : 0)),
      teams: TEAMS,
    });

    expect(buildCoverageMap(flat, catalog, occupant).query(P(2, 0)).some((e) => e.kind === 'melee')).toBe(true);
    expect(buildCoverageMap(raised, catalog, occupant).query(P(2, 0))).toEqual([]);
  });

  it('a barrier on the approach removes the melee threat behind it (pathing-delta)', () => {
    // 1-wide corridor: enemy at (0,0), protected ally at (3,0).
    const occupant = meleeKnight('ally', TEAM_A, P(3, 0));
    const enemy = meleeKnight('foe', TEAM_B, P(0, 0));
    const corridor = gridMap(5, 1, () => 0);
    const base = makeGameState({ units: [occupant, enemy], map: corridor, teams: TEAMS });

    // Without a wall the enemy reaches (2,0) and threatens the ally's tile.
    expect(threatsToTile(base, catalog, occupant, P(3, 0)).some((e) => e.kind === 'melee')).toBe(true);

    // Insert a barrier on (1,0): the corridor is severed, the enemy can't
    // path to an adjacent firing tile, so the threat vanishes.
    const barrier: BarrierState = { hp: 48, ttl: 50, ownerId: enemy.id };
    const walled = makeGameState({
      units: [occupant, enemy],
      map: {
        ...corridor,
        tiles: corridor.tiles.map((t) => (t.x === 1 && t.y === 0 ? { ...t, barrier } : t)),
      },
      teams: TEAMS,
    });
    expect(threatsToTile(walled, catalog, occupant, P(3, 0))).toEqual([]);
  });
});

describe('S59 coverage map — builder agreement & edge cases', () => {
  it('buildCoverageMap.query agrees with threatsToTile on the same tile', () => {
    const occupant = meleeKnight('ally', TEAM_A, P(5, 2));
    const enemy = bowKnight('foe', TEAM_B, P(0, 0));
    const state = makeGameState({ units: [occupant, enemy], map: gridMap(10, 3, () => 0), teams: TEAMS });

    const tile = P(3, 0);
    expect(buildCoverageMap(state, catalog, occupant).query(tile)).toEqual(
      threatsToTile(state, catalog, occupant, tile),
    );
  });

  it('no enemies → empty map', () => {
    const occupant = meleeKnight('ally', TEAM_A, P(2, 0));
    const lone = meleeKnight('friend', TEAM_A, P(0, 0)); // same team
    const state = makeGameState({ units: [occupant, lone], map: gridMap(5, 1, () => 0), teams: TEAMS });

    const map = buildCoverageMap(state, catalog, occupant);
    expect(map.query(P(1, 0))).toEqual([]);
  });

  it('a KO’d enemy is not a threat', () => {
    const occupant = meleeKnight('ally', TEAM_A, P(2, 0));
    const dead = makeUnit({ id: 'corpse', team: TEAM_B, spd: 10, classId: 'knight', maxHpBase: 60, hp: 0, position: P(1, 0) });
    const state = makeGameState({ units: [occupant, dead], map: gridMap(5, 1, () => 0), teams: TEAMS });

    expect(buildCoverageMap(state, catalog, occupant).query(P(2, 0))).toEqual([]);
  });
});
