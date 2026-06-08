// Session 57 — Worldcraft Tier A: Pit / Valley fall-damage scoring.
//
// Two layers: unit tests on `scoreWorldcraftFall` (the signed per-footprint
// fall-damage value, where the subtle rules live — >1 gate, elevation clamp,
// corner = 0, friendly fire) and `decideBasicAi` integration tests (the AI
// casts Pit/Valley when worthwhile and declines flat ground).
//
// The Terraformer is left weaponless so its `attack` free ability projects
// ~0 damage, isolating the Worldcraft scoring from melee competition.

import { describe, expect, it } from 'vitest';
import {
  abilityId,
  bucketId,
  commandSetId,
  teamId,
  type Position,
  type Tile,
  type Unit,
} from '@engine/index.ts';
import { loadDefaultCatalog } from '../content/index.ts';
import { activeTurnFor, makeGameState, makeUnit } from '../engine/ct/test-fixtures.ts';
import { decideBasicAi, _basicAiInternals } from './basic.ts';

const FIRST = bucketId('first_action');
const WORLDCRAFT = commandSetId('worldcraft');
const PIT = abilityId('pit');
const VALLEY = abilityId('valley');
const TEAM_A = teamId('team_a');
const TEAM_B = teamId('team_b');
const TEAMS = [
  { id: TEAM_A, name: 'A', control: 'human' as const },
  { id: TEAM_B, name: 'B', control: 'ai' as const },
];

// Pit's single -4 kernel and Valley's 3×3 negated kernel, mirrored from the
// content (src/content/abilities/worldcraft/{pit,valley}.ts) for the
// scorer-level unit tests.
const PIT_DELTAS = [{ dx: 0, dy: 0, delta: -4 }];
const VALLEY_DELTAS = [
  { dx: -1, dy: -1, delta: -1 }, { dx: 0, dy: -1, delta: -2 }, { dx: 1, dy: -1, delta: -1 },
  { dx: -1, dy: 0, delta: -2 }, { dx: 0, dy: 0, delta: -3 }, { dx: 1, dy: 0, delta: -2 },
  { dx: -1, dy: 1, delta: -1 }, { dx: 0, dy: 1, delta: -2 }, { dx: 1, dy: 1, delta: -1 },
];

function gridMap(width: number, height: number, elevAt: (x: number, y: number) => number): {
  width: number; height: number; tiles: Tile[];
} {
  const tiles: Tile[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      tiles.push({ x, y, layer: 0, elevation: elevAt(x, y), terrain: 'ground', properties: [] });
    }
  }
  return { width, height, tiles };
}

function terraformer(pos: Position, mp = 30): Unit {
  return makeUnit({
    id: 'terra', spd: 10, ma: 8, classId: 'terraformer', hp: 50, mp, position: pos,
    loadout: { actionBuckets: { [FIRST]: [WORLDCRAFT] }, passiveBuckets: {} },
  });
}

function knight(id: string, team: 'team_a' | 'team_b', pos: Position): Unit {
  return makeUnit({ id, team, spd: 10, classId: 'knight', maxHpBase: 60, hp: 60, position: pos });
}

describe('S57 Tier A — scoreWorldcraftFall (per-footprint signed fall damage)', () => {
  it('clamps the drop to current elevation (elev-2 Pit on a full-HP enemy → 20)', () => {
    const actor = terraformer({ x: 0, y: 0, layer: 0 });
    const enemy = knight('e', 'team_b', { x: 1, y: 0, layer: 0 });
    const state = makeGameState({
      units: [actor, enemy], map: gridMap(4, 4, () => 2), teams: TEAMS,
      turnState: activeTurnFor(actor.id),
    });
    // drop = min(4, 2) = 2 → 20 dmg × killValue(full HP)=1.
    expect(_basicAiInternals.scoreWorldcraftFall(state, actor, { x: 1, y: 0, layer: 0 }, PIT_DELTAS)).toBe(20);
  });

  it('a drop of exactly 1 deals 0 (flat/low ground)', () => {
    const actor = terraformer({ x: 0, y: 0, layer: 0 });
    const enemy = knight('e', 'team_b', { x: 1, y: 0, layer: 0 });
    const state = makeGameState({
      units: [actor, enemy], map: gridMap(4, 4, (x, y) => (x === 1 && y === 0 ? 1 : 2)), teams: TEAMS,
      turnState: activeTurnFor(actor.id),
    });
    // elev 1 → drop 1 → > 1 gate fails → 0.
    expect(_basicAiInternals.scoreWorldcraftFall(state, actor, { x: 1, y: 0, layer: 0 }, PIT_DELTAS)).toBe(0);
  });

  it('a tall drop scales (elev-5 Pit → 40)', () => {
    const actor = terraformer({ x: 0, y: 0, layer: 0 });
    const enemy = knight('e', 'team_b', { x: 1, y: 0, layer: 0 });
    const state = makeGameState({
      units: [actor, enemy], map: gridMap(4, 4, () => 5), teams: TEAMS,
      turnState: activeTurnFor(actor.id),
    });
    // drop = min(4, 5) = 4 → 40.
    expect(_basicAiInternals.scoreWorldcraftFall(state, actor, { x: 1, y: 0, layer: 0 }, PIT_DELTAS)).toBe(40);
  });

  it('penalizes dropping an ally (friendly fire → negative)', () => {
    const actor = terraformer({ x: 0, y: 0, layer: 0 });
    const ally = knight('a', 'team_a', { x: 1, y: 0, layer: 0 });
    const state = makeGameState({
      units: [actor, ally], map: gridMap(4, 4, () => 3), teams: TEAMS,
      turnState: activeTurnFor(actor.id),
    });
    // drop = min(4, 3) = 3 → 30, ally → −30 (FRIENDLY_FIRE_PENALTY_FACTOR 1.0).
    expect(_basicAiInternals.scoreWorldcraftFall(state, actor, { x: 1, y: 0, layer: 0 }, VALLEY_DELTAS_CENTER_ONLY())).toBe(-30);
  });

  it('Valley sums occupants and gives corners 0 (center enemy 30 + corner enemy 0 = 30)', () => {
    const actor = terraformer({ x: 0, y: 0, layer: 0 });
    const center = knight('c', 'team_b', { x: 1, y: 1, layer: 0 });
    const corner = knight('k', 'team_b', { x: 0, y: 0, layer: 0 }); // corner of anchor (1,1)
    const state = makeGameState({
      units: [actor, center, corner], map: gridMap(4, 4, () => 4), teams: TEAMS,
      turnState: activeTurnFor(actor.id),
    });
    // center delta -3 → drop 3 → 30; corner delta -1 → drop 1 → 0.
    expect(_basicAiInternals.scoreWorldcraftFall(state, actor, { x: 1, y: 1, layer: 0 }, VALLEY_DELTAS)).toBe(30);
  });
});

// Valley's center-only delta, reused for the friendly-fire scorer test where
// we want a single -3 drop on one tile.
function VALLEY_DELTAS_CENTER_ONLY() {
  return [{ dx: 0, dy: 0, delta: -3 }];
}

describe('S57 Tier A — decideBasicAi casts Pit/Valley when worthwhile', () => {
  it('casts Pit on a high-ground enemy', () => {
    const cat = loadDefaultCatalog();
    const actor = terraformer({ x: 0, y: 0, layer: 0 });
    const enemy = knight('e', 'team_b', { x: 2, y: 0, layer: 0 });
    const state = makeGameState({
      units: [actor, enemy],
      map: gridMap(6, 6, (x, y) => (x === 2 && y === 0 ? 4 : 2)),
      teams: TEAMS, turnState: activeTurnFor(actor.id),
    });
    const d = decideBasicAi(state, cat);
    expect(d.kind).toBe('commit');
    if (d.kind !== 'commit' || d.action.type !== 'use_ability') throw new Error('expected use_ability');
    // Pit (drop 4 → 40) beats Valley on the lone enemy (drop 3 → 30).
    expect(d.action.payload.abilityId).toEqual(PIT);
    const t = d.action.payload.target;
    expect(t.kind).toBe('tile');
    if (t.kind === 'tile') expect({ x: t.position.x, y: t.position.y }).toEqual({ x: 2, y: 0 });
  });

  it('declines a Pit on flat/low ground (0 fall damage)', () => {
    const cat = loadDefaultCatalog();
    const actor = terraformer({ x: 0, y: 0, layer: 0 });
    // Enemy on an elev-1 tile: any drop is ≤ 1 → no fall damage anywhere.
    const enemy = knight('e', 'team_b', { x: 1, y: 0, layer: 0 });
    const state = makeGameState({
      units: [actor, enemy],
      map: gridMap(6, 6, (x, y) => (x === 1 && y === 0 ? 1 : 1)),
      teams: TEAMS, turnState: activeTurnFor(actor.id),
    });
    const d = decideBasicAi(state, cat);
    // Whatever it does (move/end-turn), it must NOT cast a worthless Worldcraft work.
    if (d.kind === 'commit' && d.action.type === 'use_ability') {
      expect([PIT, VALLEY]).not.toContain(d.action.payload.abilityId);
    }
  });

  it('casts Valley over an enemy cluster (sum beats a single Pit)', () => {
    const cat = loadDefaultCatalog();
    const actor = terraformer({ x: 0, y: 0, layer: 0 });
    const e1 = knight('e1', 'team_b', { x: 3, y: 0, layer: 0 }); // center of anchor (3,0)
    const e2 = knight('e2', 'team_b', { x: 2, y: 0, layer: 0 }); // edge
    const e3 = knight('e3', 'team_b', { x: 4, y: 0, layer: 0 }); // edge
    const state = makeGameState({
      units: [actor, e1, e2, e3],
      map: gridMap(6, 6, (x, y) => ([3, 2, 4].includes(x) && y === 0 ? 4 : 2)),
      teams: TEAMS, turnState: activeTurnFor(actor.id),
    });
    const d = decideBasicAi(state, cat);
    expect(d.kind).toBe('commit');
    if (d.kind !== 'commit' || d.action.type !== 'use_ability') throw new Error('expected use_ability');
    // Valley@(3,0): 30 + 20 + 20 = 70 > Pit's best single 40.
    expect(d.action.payload.abilityId).toEqual(VALLEY);
    const t = d.action.payload.target;
    if (t.kind === 'tile') expect({ x: t.position.x, y: t.position.y }).toEqual({ x: 3, y: 0 });
  });

  it('prefers an ally-safe Pit over a Valley that would catch an ally', () => {
    const cat = loadDefaultCatalog();
    const actor = terraformer({ x: 0, y: 0, layer: 0 });
    const enemy = knight('e', 'team_b', { x: 3, y: 0, layer: 0 });
    const ally = knight('a', 'team_a', { x: 4, y: 0, layer: 0 }); // edge of Valley@(3,0)
    const state = makeGameState({
      units: [actor, enemy, ally],
      map: gridMap(6, 6, (x, y) => ([3, 4].includes(x) && y === 0 ? 4 : 2)),
      teams: TEAMS, turnState: activeTurnFor(actor.id),
    });
    const d = decideBasicAi(state, cat);
    expect(d.kind).toBe('commit');
    if (d.kind !== 'commit' || d.action.type !== 'use_ability') throw new Error('expected use_ability');
    // Valley@(3,0) = 30 − 20(ally) = 10; Pit@(3,0) = 40 (enemy only) wins.
    expect(d.action.payload.abilityId).toEqual(PIT);
  });
});
