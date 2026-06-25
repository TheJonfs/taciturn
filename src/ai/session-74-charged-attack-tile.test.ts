// Session 74 — Charged Attack is a tile-targeted aimed shot.
//
// Charged Attack was `unit_or_tile`, so the AI (which always pins the unit
// for unit-targetable abilities) committed it unit-pinned — and unit-pinned
// charged actions resolve FFT-canonically (track the unit by id even if it
// moved). The intent is a positional gamble: pin a tile, hit whoever stands
// there at resolution, miss if the target moved off. The ability is now
// `kind: 'tile'`, and the AI's single-target tile-offensive branch commits a
// tile-pin payload aimed at the enemy's current tile.

import { describe, expect, it } from 'vitest';
import { bucketId, commandSetId, teamId, type Tile, type Unit } from '@engine/index.ts';
import { loadDefaultCatalog } from '../content/index.ts';
import { chargedAttack } from '../content/abilities/charged-attack.ts';
import { longbow } from '../content/items/longbow.ts';
import { activeTurnFor, makeGameState, makeUnit } from '../engine/ct/test-fixtures.ts';
import { validateAction } from '../engine/actions/validate.ts';
import { _basicAiInternals } from './basic.ts';

const FIRST = bucketId('first_action');
const MARKSMANSHIP = commandSetId('marksmanship');
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

describe('S74 — Charged Attack targeting', () => {
  it('is tile-targeted (the positional aimed shot), not unit_or_tile', () => {
    expect(chargedAttack.targeting.kind).toBe('tile');
  });
});

describe('S74 — AI tile-pins Charged Attack', () => {
  const cat = loadDefaultCatalog();

  function setup(): { state: ReturnType<typeof makeGameState>; hunter: Unit; enemy: Unit } {
    const hunter = makeUnit({
      id: 'hunter', spd: 9, pa: 6, classId: 'hunter', hp: 100, mp: 50,
      position: { x: 1, y: 1, layer: 0 },
      loadout: { actionBuckets: { [FIRST]: [MARKSMANSHIP] }, passiveBuckets: {} },
      equipment: { leftHand: null, rightHand: longbow.id, headgear: null, armor: null, accessory: null },
    });
    const enemy = makeUnit({
      id: 'foe', team: 'team_b', spd: 9, classId: 'knight', maxHpBase: 80, hp: 80,
      position: { x: 4, y: 1, layer: 0 }, // distance 3 — inside the bow's 2-5 band
    });
    const state = makeGameState({
      units: [hunter, enemy], map: { width: 8, height: 4, tiles: flatGround(8, 4) },
      teams: TEAMS, turnState: activeTurnFor(hunter.id),
    });
    return { state, hunter, enemy };
  }

  it('commits a tile-pin payload at the enemy tile (not a unit-pin that would track)', () => {
    const { state, hunter, enemy } = setup();
    const best = _basicAiInternals.bestActFromSource(
      state, cat, hunter, hunter.position, [enemy], [hunter], [chargedAttack], [],
    );
    expect(best).not.toBeNull();
    if (best === null) throw new Error('expected a Charged Attack plan');
    expect(best.action.type).toBe('use_ability');
    if (best.action.type !== 'use_ability') throw new Error('expected use_ability');
    expect(best.action.payload.abilityId).toEqual(chargedAttack.id);
    expect(best.action.payload.target.kind).toBe('tile');
    if (best.action.payload.target.kind !== 'tile') throw new Error('expected a tile target');
    expect(best.action.payload.target.position).toEqual(enemy.position);
  });

  it('validates a tile-pinned Charged Attack (weapon-range fork + arc) but rejects a unit-pin', () => {
    const { state, hunter, enemy } = setup();
    // Tile-pin at the enemy's tile, in the bow's 2-5 band → accepted.
    const tilePin = validateAction(state, {
      type: 'use_ability', source: 'player', actorId: hunter.id,
      payload: { abilityId: chargedAttack.id, target: { kind: 'tile', position: enemy.position } },
    }, cat);
    expect(tilePin.valid).toBe(true);
    // A unit-pin is no longer a legal targeting for this ability (it's
    // tile-only now) — so there's no track-the-unit option to exploit.
    const unitPin = validateAction(state, {
      type: 'use_ability', source: 'player', actorId: hunter.id,
      payload: { abilityId: chargedAttack.id, target: { kind: 'unit', unitId: enemy.id } },
    }, cat);
    expect(unitPin.valid).toBe(false);
  });
});
