// Session 57 — Worldcraft Tier B: Pillar/Hill perch scoring.
//
// v1 perch is "lift-in-place": the Terraformer raises the tile a
// height-seeking (bow) ally already stands on, gaining elevation for a
// better downhill shot without the ally moving. These tests assert the AI
// builds such a perch when it helps a real archer, and declines it
// otherwise (no archer on the raised tile → no value).
//
// The Terraformer is weaponless so its own actions don't compete.

import { describe, expect, it } from 'vitest';
import {
  abilityId,
  bucketId,
  commandSetId,
  itemId,
  teamId,
  type Position,
  type Tile,
  type Unit,
  type UnitEquipment,
} from '@engine/index.ts';
import { loadDefaultCatalog } from '../content/index.ts';
import { activeTurnFor, makeGameState, makeUnit } from '../engine/ct/test-fixtures.ts';
import { decideBasicAi } from './basic.ts';

const FIRST = bucketId('first_action');
const WORLDCRAFT = commandSetId('worldcraft');
const PILLAR = abilityId('pillar');
const HILL = abilityId('hill');
const LONGBOW = itemId('longbow');
const TEAM_A = teamId('team_a');
const TEAM_B = teamId('team_b');
const TEAMS = [
  { id: TEAM_A, name: 'A', control: 'human' as const },
  { id: TEAM_B, name: 'B', control: 'ai' as const },
];
const WORLDCRAFT_ABILITIES = [PILLAR, HILL, abilityId('pit'), abilityId('valley'), abilityId('barrier')];

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

function terraformer(pos: Position): Unit {
  return makeUnit({
    id: 'terra', spd: 10, ma: 8, classId: 'terraformer', hp: 50, mp: 30, position: pos,
    loadout: { actionBuckets: { [FIRST]: [WORLDCRAFT] }, passiveBuckets: {} },
  });
}

function bow(): UnitEquipment {
  return { leftHand: null, rightHand: LONGBOW, headgear: null, armor: null, accessory: null };
}

describe('S57 Tier B — Pillar/Hill perch (lift-in-place)', () => {
  it('raises the tile under a height-seeking ally to improve its downhill shot', () => {
    const cat = loadDefaultCatalog();
    const actor = terraformer({ x: 0, y: 0, layer: 0 });
    // Archer ally on an elev-2 tile adjacent to the Terraformer; priority
    // enemy far and low, so a Pillar (+4) sharply improves the downhill shot.
    const archer = makeUnit({
      id: 'archer', team: 'team_a', spd: 10, classId: 'hunter', hp: 50, mp: 20,
      position: { x: 1, y: 0, layer: 0 }, equipment: bow(),
    });
    const enemy = makeUnit({
      id: 'enemy', team: 'team_b', spd: 10, classId: 'knight', maxHpBase: 60, hp: 60,
      position: { x: 4, y: 0, layer: 0 },
    });
    const state = makeGameState({
      units: [actor, archer, enemy],
      map: gridMap(6, 6, (x, y) => (x === 1 && y === 0 ? 2 : x === 4 && y === 0 ? 0 : 1)),
      teams: TEAMS, turnState: activeTurnFor(actor.id),
    });
    const d = decideBasicAi(state, cat);
    expect(d.kind).toBe('commit');
    if (d.kind !== 'commit' || d.action.type !== 'use_ability') throw new Error('expected use_ability');
    // A raise on the archer's tile (Pillar single-tile, or Hill anchored so
    // the archer's tile rises). Assert it's a raising work targeting (1,0)
    // — or a Hill whose footprint covers (1,0).
    expect([PILLAR, HILL]).toContain(d.action.payload.abilityId);
    const t = d.action.payload.target;
    expect(t.kind).toBe('tile');
    if (t.kind === 'tile') {
      const dx = Math.abs(t.position.x - 1);
      const dy = Math.abs(t.position.y - 0);
      // Pillar hits (1,0) exactly; Hill's 3×3 must include (1,0).
      expect(dx <= 1 && dy <= 1).toBe(true);
    }
  });

  it('does not build a perch when the ally on the raised tile is not a height-seeker', () => {
    const cat = loadDefaultCatalog();
    const actor = terraformer({ x: 0, y: 0, layer: 0 });
    // A melee ally (no bow) — raising its tile yields no shot improvement.
    const meleeAlly = makeUnit({
      id: 'ally', team: 'team_a', spd: 10, classId: 'knight', hp: 50,
      position: { x: 1, y: 0, layer: 0 },
    });
    const enemy = makeUnit({
      id: 'enemy', team: 'team_b', spd: 10, classId: 'knight', maxHpBase: 60, hp: 60,
      position: { x: 4, y: 0, layer: 0 },
    });
    const state = makeGameState({
      units: [actor, meleeAlly, enemy],
      map: gridMap(6, 6, (x, y) => (x === 1 && y === 0 ? 2 : x === 4 && y === 0 ? 0 : 1)),
      teams: TEAMS, turnState: activeTurnFor(actor.id),
    });
    const d = decideBasicAi(state, cat);
    // No worthwhile perch (or fall) → must not cast a Worldcraft work.
    if (d.kind === 'commit' && d.action.type === 'use_ability') {
      expect(WORLDCRAFT_ABILITIES).not.toContain(d.action.payload.abilityId);
    }
  });
});
