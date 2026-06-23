// Session 73, chunk 2 — buff-aware cohesion.
//
// When an AI team fields an AoE-buffer (the Enchanter's Auramancy — a
// diamond-1 ally buff), its beneficiaries should advance *grouped* so the
// buff lands on multiple allies, rather than scattering. The cohesion term
// lives in the move-destination scorer's pure-advance regime: among advance
// destinations within COHESION_BAND (1) tiles of the best forward progress,
// prefer the one nearest the buffer. Bounded so the advance never halts, and
// inert when the team fields no buffer (so non-Enchanter teams are
// unchanged). Subordinate to combat: it only shapes the otherwise-pure
// distance-close, never an attack tile or a height-seeker's perch approach.
//
// Layers:
//   1. isAoeBuffer — detects the Enchanter (Auramancy) but not a Knight.
//   2. pickBestMove — with a buffer on the team the actor advances toward a
//      more-clustered tile; without one it takes the most-forward tile; and
//      it always still makes forward progress (no stall).

import { describe, expect, it } from 'vitest';
import {
  bucketId,
  commandSetId,
  teamId,
  horizontalDistance,
  type Tile,
  type Unit,
} from '@engine/index.ts';
import { loadDefaultCatalog } from '../content/index.ts';
import { activeTurnFor, makeGameState, makeUnit } from '../engine/ct/test-fixtures.ts';
import { _basicAiInternals } from './basic.ts';

const FIRST = bucketId('first_action');
const AURAMANCY = commandSetId('auramancy');
const BATTLE_SKILL = commandSetId('battle_skill');
const TEAM_A = teamId('team_a');
const TEAM_B = teamId('team_b');
const TEAMS = [
  { id: TEAM_A, name: 'A', control: 'ai' as const },
  { id: TEAM_B, name: 'B', control: 'ai' as const },
];

function flatGround(width: number, height: number): Tile[] {
  const tiles: Tile[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      tiles.push({ x, y, layer: 0, elevation: 0, terrain: 'ground', properties: [] });
    }
  }
  return tiles;
}

function enchanter(x: number, y: number): Unit {
  return makeUnit({
    id: 'ench', team: 'team_a', spd: 10, ma: 10, classId: 'enchanter', hp: 103, maxMpBase: 40, mp: 40,
    position: { x, y, layer: 0 },
    loadout: { actionBuckets: { [FIRST]: [AURAMANCY] }, passiveBuckets: {} },
  });
}

// A melee beneficiary at (4,4) on a wide flat map with an enemy parked far
// to the east (out of reach), so the only move is a pure advance.
function knightBeneficiary(): Unit {
  return makeUnit({
    id: 'kn', team: 'team_a', spd: 10, classId: 'knight', hp: 100,
    position: { x: 4, y: 4, layer: 0 },
    loadout: { actionBuckets: { [FIRST]: [BATTLE_SKILL] }, passiveBuckets: {} },
  });
}

describe('S73 chunk 2 — isAoeBuffer', () => {
  const cat = loadDefaultCatalog();

  it('detects the Enchanter (Auramancy is an AoE ally buff)', () => {
    expect(_basicAiInternals.isAoeBuffer(enchanter(4, 8), cat)).toBe(true);
  });

  it('is false for a Knight (no AoE buff in the kit)', () => {
    expect(_basicAiInternals.isAoeBuffer(knightBeneficiary(), cat)).toBe(false);
  });
});

describe('S73 chunk 2 — pickBestMove clusters toward the buffer while advancing', () => {
  const cat = loadDefaultCatalog();

  function decide(ally: Unit): { x: number; y: number } {
    const actor = knightBeneficiary();
    const enemy = makeUnit({
      id: 'foe', team: 'team_b', spd: 10, classId: 'knight', maxHpBase: 60, hp: 60,
      position: { x: 15, y: 4, layer: 0 },
    });
    const state = makeGameState({
      units: [actor, ally, enemy], map: { width: 16, height: 12, tiles: flatGround(16, 12) },
      teams: TEAMS, turnState: activeTurnFor(actor.id),
    });
    const move = _basicAiInternals.pickBestMove(state, cat, actor, [enemy], [actor, ally], [], null);
    if (move === null || move.type !== 'move') throw new Error('expected a move');
    return { x: move.payload.destination.x, y: move.payload.destination.y };
  }

  it('without a buffer, takes the most-forward tile', () => {
    // A plain Knight ally → no cohesion → minimize distance to the enemy.
    const plain = makeUnit({
      id: 'ally', team: 'team_a', spd: 10, classId: 'knight', hp: 100,
      position: { x: 4, y: 8, layer: 0 },
      loadout: { actionBuckets: { [FIRST]: [BATTLE_SKILL] }, passiveBuckets: {} },
    });
    expect(decide(plain)).toEqual({ x: 7, y: 4 });
  });

  it('with an Enchanter on the team, holds back toward the buffer (bounded)', () => {
    // Buffer at (4,8); the banded advance prefers (6,4) — one tile less
    // forward but nearer the buffer's column — over the most-forward (7,4).
    const dest = decide(enchanter(4, 8));
    expect(dest).toEqual({ x: 6, y: 4 });
  });

  it('still makes forward progress (no stall): chosen tile is closer to the enemy', () => {
    const dest = decide(enchanter(4, 8));
    const enemyPos = { x: 15, y: 4 };
    const start = { x: 4, y: 4 };
    expect(horizontalDistance(dest, enemyPos)).toBeLessThan(horizontalDistance(start, enemyPos));
  });
});
