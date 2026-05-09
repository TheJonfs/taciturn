import { createCatalog, type ClassDefinition } from '../catalog/index.ts';
import { defaultTestRulesets, makeTestRuleset } from '../catalog/test-fixtures.ts';
import { makeGameState, makeUnit } from '../ct/test-fixtures.ts';
import { statusHook } from '../status/index.ts';
import { makeStatusInstance, makeStatusType } from '../status/test-fixtures.ts';
import { classId, commandSetId } from '../types/index.ts';
import {
  getLegalMoves,
  positionKey,
  SpecialMovementNotImplementedError,
} from './pathfinding.ts';
import { flatMap, mapFrom, mapWith } from './test-fixtures.ts';

function knightCatalog(args?: {
  readonly moveRange?: number;
  readonly jump?: number;
  readonly canEnter?: ReadonlyArray<string>;
  readonly terrainCosts?: ReadonlyArray<readonly [string, number]>;
  readonly specialMovement?: 'fly' | 'teleport' | 'phase';
  readonly extraStatusTypes?: Parameters<typeof createCatalog>[0]['statusTypes'];
  readonly friendlyPassThrough?: boolean;
}) {
  const knight: ClassDefinition = {
    id: classId('knight'),
    name: 'Knight',
    movement: {
      moveRange: args?.moveRange ?? 3,
      jump: args?.jump ?? 2,
      terrainCosts: new Map(args?.terrainCosts ?? []),
      canEnter: new Set(args?.canEnter ?? ['ground']),
      ...(args?.specialMovement !== undefined ? { specialMovement: args.specialMovement } : {}),
    },
    evasion: { front: 0, side: 0, back: 0 },
    equipmentSlots: { leftHand: true, rightHand: true, headgear: true, armor: true, accessory: true },
    firstActionCommandSet: commandSetId('battle_skill'),
    freeAbilities: new Set(),
  };
  const rulesets =
    args?.friendlyPassThrough === undefined
      ? defaultTestRulesets
      : [makeTestRuleset({ friendlyPassThrough: args.friendlyPassThrough })];
  return createCatalog({
    statusTypes: args?.extraStatusTypes ?? [],
    abilities: [],
    commandSets: [],
    classes: [knight],
    items: [],
    rulesets,
  });
}

describe('getLegalMoves — basic flat map', () => {
  it('reaches the starting tile at cost 0 with a single-tile path', () => {
    const cat = knightCatalog({ moveRange: 2 });
    const u = makeUnit({ id: 'u1', spd: 10, position: { x: 1, y: 1, layer: 0 } });
    const state = makeGameState({ units: [u], map: flatMap(5, 5) });
    const { reachable } = getLegalMoves(state, u.id, cat);
    const start = reachable.get(positionKey({ x: 1, y: 1, layer: 0 }))!;
    expect(start.cost).toBe(0);
    expect(start.path).toHaveLength(1);
    expect(start.path[0]).toEqual({ x: 1, y: 1, layer: 0 });
  });

  it('reaches all tiles within Manhattan distance ≤ moveRange (uniform cost-1 terrain)', () => {
    const cat = knightCatalog({ moveRange: 2 });
    const u = makeUnit({ id: 'u1', spd: 10, position: { x: 2, y: 2, layer: 0 } });
    const state = makeGameState({ units: [u], map: flatMap(5, 5) });
    const { reachable } = getLegalMoves(state, u.id, cat);
    // moveRange 2 on a 5x5 flat map → 13 reachable tiles (diamond of
    // radius 2 around (2, 2)). Includes the starting tile.
    expect(reachable.size).toBe(13);
    // Spot-check a far tile.
    expect(reachable.get(positionKey({ x: 4, y: 2, layer: 0 }))!.cost).toBe(2);
    // (3, 3) at cost 2 (e.g., right-then-down).
    expect(reachable.get(positionKey({ x: 3, y: 3, layer: 0 }))!.cost).toBe(2);
    // (4, 4) is at distance 4 — out of range.
    expect(reachable.has(positionKey({ x: 4, y: 4, layer: 0 }))).toBe(false);
  });

  it('does not return tiles past moveRange', () => {
    const cat = knightCatalog({ moveRange: 1 });
    const u = makeUnit({ id: 'u1', spd: 10, position: { x: 0, y: 0, layer: 0 } });
    const state = makeGameState({ units: [u], map: flatMap(3, 3) });
    const { reachable } = getLegalMoves(state, u.id, cat);
    // Starting tile + (1,0) + (0,1) = 3 tiles.
    expect(reachable.size).toBe(3);
  });
});

describe('getLegalMoves — terrain entry rules', () => {
  it('does not enter terrain absent from canEnter', () => {
    // 3x1 strip: ground, water, ground. Knight (canEnter=ground) cannot
    // cross the water tile to reach the third.
    const cat = knightCatalog({ moveRange: 5, canEnter: ['ground'] });
    const u = makeUnit({ id: 'u1', spd: 10, position: { x: 0, y: 0, layer: 0 } });
    const state = makeGameState({
      units: [u],
      map: mapFrom(['GWG']),
    });
    const { reachable } = getLegalMoves(state, u.id, cat);
    expect(reachable.has(positionKey({ x: 0, y: 0, layer: 0 }))).toBe(true);
    expect(reachable.has(positionKey({ x: 1, y: 0, layer: 0 }))).toBe(false);
    expect(reachable.has(positionKey({ x: 2, y: 0, layer: 0 }))).toBe(false);
  });

  it('enters allowed extra terrain when canEnter is broadened', () => {
    const cat = knightCatalog({ moveRange: 5, canEnter: ['ground', 'water'] });
    const u = makeUnit({ id: 'u1', spd: 10, position: { x: 0, y: 0, layer: 0 } });
    const state = makeGameState({ units: [u], map: mapFrom(['GWG']) });
    const { reachable } = getLegalMoves(state, u.id, cat);
    expect(reachable.has(positionKey({ x: 2, y: 0, layer: 0 }))).toBe(true);
  });

  it('applies per-terrain costs from the profile', () => {
    // 4-tile strip: ground, sand (cost 2), ground, ground. moveRange 3
    // means we should reach (0), (1)@2, (2)@4 — wait 4 > 3, so (2) is
    // unreachable through sand.
    const cat = knightCatalog({
      moveRange: 3,
      canEnter: ['ground', 'sand'],
      terrainCosts: [['sand', 2]],
    });
    const u = makeUnit({ id: 'u1', spd: 10, position: { x: 0, y: 0, layer: 0 } });
    const state = makeGameState({ units: [u], map: mapFrom(['GSGG']) });
    const { reachable } = getLegalMoves(state, u.id, cat);
    expect(reachable.get(positionKey({ x: 0, y: 0, layer: 0 }))!.cost).toBe(0);
    expect(reachable.get(positionKey({ x: 1, y: 0, layer: 0 }))!.cost).toBe(2);
    // (2, 0) would cost 2 (sand) + 1 (ground) = 3 → reachable.
    expect(reachable.get(positionKey({ x: 2, y: 0, layer: 0 }))!.cost).toBe(3);
    // (3, 0) would cost 4 → out of range.
    expect(reachable.has(positionKey({ x: 3, y: 0, layer: 0 }))).toBe(false);
  });
});

describe('getLegalMoves — elevation and jump', () => {
  it('rejects steps with elevation differential > jump', () => {
    // Two-tile strip at layer 0: (0,0) elev 0, (1,0) elev 3. Jump 2 → cannot step.
    const cat = knightCatalog({ moveRange: 5, jump: 2 });
    const u = makeUnit({ id: 'u1', spd: 10, position: { x: 0, y: 0, layer: 0 } });
    const state = makeGameState({
      units: [u],
      map: mapWith({
        width: 2,
        height: 1,
        tiles: [
          { x: 0, y: 0 },
          { x: 1, y: 0, elevation: 3 },
        ],
      }),
    });
    const { reachable } = getLegalMoves(state, u.id, cat);
    expect(reachable.has(positionKey({ x: 1, y: 0, layer: 0 }))).toBe(false);
  });

  it('accepts steps with elevation differential = jump', () => {
    const cat = knightCatalog({ moveRange: 5, jump: 2 });
    const u = makeUnit({ id: 'u1', spd: 10, position: { x: 0, y: 0, layer: 0 } });
    const state = makeGameState({
      units: [u],
      map: mapWith({
        width: 2,
        height: 1,
        tiles: [
          { x: 0, y: 0 },
          { x: 1, y: 0, elevation: 2 },
        ],
      }),
    });
    const { reachable } = getLegalMoves(state, u.id, cat);
    expect(reachable.get(positionKey({ x: 1, y: 0, layer: 0 }))!.cost).toBe(1);
  });

  it('considers tiles at adjacent (x, y) on every layer', () => {
    // 2x1 with two tiles at (1, 0): layer 0 elev 0, layer 1 elev 1.
    // Knight at (0, 0, 0) with jump 2 should reach both.
    const cat = knightCatalog({ moveRange: 2, jump: 2 });
    const u = makeUnit({ id: 'u1', spd: 10, position: { x: 0, y: 0, layer: 0 } });
    const state = makeGameState({
      units: [u],
      map: mapWith({
        width: 2,
        height: 1,
        tiles: [
          { x: 0, y: 0 },
          { x: 1, y: 0, layer: 0 },
          { x: 1, y: 0, layer: 1, elevation: 1 },
        ],
      }),
    });
    const { reachable } = getLegalMoves(state, u.id, cat);
    expect(reachable.has(positionKey({ x: 1, y: 0, layer: 0 }))).toBe(true);
    expect(reachable.has(positionKey({ x: 1, y: 0, layer: 1 }))).toBe(true);
  });
});

describe('getLegalMoves — occupancy', () => {
  it('treats tiles occupied by enemy units as impassable', () => {
    const cat = knightCatalog({ moveRange: 3 });
    const mover = makeUnit({
      id: 'mover',
      spd: 10,
      team: 'team_a',
      position: { x: 0, y: 0, layer: 0 },
    });
    const blocker = makeUnit({
      id: 'blocker',
      spd: 10,
      team: 'team_b',
      position: { x: 1, y: 0, layer: 0 },
    });
    const state = makeGameState({ units: [mover, blocker], map: flatMap(3, 1) });
    const { reachable } = getLegalMoves(state, mover.id, cat);
    expect(reachable.has(positionKey({ x: 1, y: 0, layer: 0 }))).toBe(false);
    // Behind the blocker is also unreachable on a 1-row map (the only
    // route is through the blocked tile, and enemies block fully).
    expect(reachable.has(positionKey({ x: 2, y: 0, layer: 0 }))).toBe(false);
  });

  it('does not block on the moving unit itself', () => {
    const cat = knightCatalog({ moveRange: 1 });
    const u = makeUnit({ id: 'u1', spd: 10, position: { x: 0, y: 0, layer: 0 } });
    const state = makeGameState({ units: [u], map: flatMap(2, 1) });
    const { reachable } = getLegalMoves(state, u.id, cat);
    expect(reachable.has(positionKey({ x: 0, y: 0, layer: 0 }))).toBe(true);
    expect(reachable.has(positionKey({ x: 1, y: 0, layer: 0 }))).toBe(true);
  });

  it('with friendlyPassThrough on: allies route through but cannot be settled on', () => {
    // mover and ally on same team. With friendly pass-through (the v1
    // default), the mover can route past the ally to reach the tile
    // beyond, but the ally's tile itself is not a settle-able destination.
    const cat = knightCatalog({ moveRange: 3, friendlyPassThrough: true });
    const mover = makeUnit({
      id: 'mover',
      spd: 10,
      team: 'team_a',
      position: { x: 0, y: 0, layer: 0 },
    });
    const ally = makeUnit({
      id: 'ally',
      spd: 10,
      team: 'team_a',
      position: { x: 1, y: 0, layer: 0 },
    });
    const state = makeGameState({ units: [mover, ally], map: flatMap(3, 1) });
    const { reachable } = getLegalMoves(state, mover.id, cat);
    expect(reachable.has(positionKey({ x: 1, y: 0, layer: 0 }))).toBe(false);
    expect(reachable.has(positionKey({ x: 2, y: 0, layer: 0 }))).toBe(true);
  });

  it('with friendlyPassThrough off: allies block movement just like enemies', () => {
    const cat = knightCatalog({ moveRange: 3, friendlyPassThrough: false });
    const mover = makeUnit({
      id: 'mover',
      spd: 10,
      team: 'team_a',
      position: { x: 0, y: 0, layer: 0 },
    });
    const ally = makeUnit({
      id: 'ally',
      spd: 10,
      team: 'team_a',
      position: { x: 1, y: 0, layer: 0 },
    });
    const state = makeGameState({ units: [mover, ally], map: flatMap(3, 1) });
    const { reachable } = getLegalMoves(state, mover.id, cat);
    expect(reachable.has(positionKey({ x: 1, y: 0, layer: 0 }))).toBe(false);
    expect(reachable.has(positionKey({ x: 2, y: 0, layer: 0 }))).toBe(false);
  });

  it('friendly pass-through does not let an enemy be passed through', () => {
    const cat = knightCatalog({ moveRange: 3, friendlyPassThrough: true });
    const mover = makeUnit({
      id: 'mover',
      spd: 10,
      team: 'team_a',
      position: { x: 0, y: 0, layer: 0 },
    });
    const enemy = makeUnit({
      id: 'enemy',
      spd: 10,
      team: 'team_b',
      position: { x: 1, y: 0, layer: 0 },
    });
    const state = makeGameState({ units: [mover, enemy], map: flatMap(3, 1) });
    const { reachable } = getLegalMoves(state, mover.id, cat);
    expect(reachable.has(positionKey({ x: 2, y: 0, layer: 0 }))).toBe(false);
  });
});

describe('getLegalMoves — paths', () => {
  it('reconstructs a single shortest path from start to destination', () => {
    const cat = knightCatalog({ moveRange: 4 });
    const u = makeUnit({ id: 'u1', spd: 10, position: { x: 0, y: 0, layer: 0 } });
    const state = makeGameState({ units: [u], map: flatMap(5, 5) });
    const { reachable } = getLegalMoves(state, u.id, cat);
    const dest = reachable.get(positionKey({ x: 2, y: 1, layer: 0 }))!;
    expect(dest.cost).toBe(3);
    expect(dest.path).toHaveLength(4);
    expect(dest.path[0]).toEqual({ x: 0, y: 0, layer: 0 });
    expect(dest.path[dest.path.length - 1]).toEqual({ x: 2, y: 1, layer: 0 });
  });
});

describe('getLegalMoves — modifyStatQuery integration', () => {
  it('a Move+1 status applied to the unit increases reachable size', () => {
    const movePlusOne = makeStatusType({
      id: 'move_plus_one',
      hooks: [
        statusHook('modifyStatQuery', (args) =>
          args.statName === 'moveRange' ? args.baseValue + 1 : args.baseValue,
        ),
      ],
    });
    const catBase = knightCatalog({ moveRange: 2 });
    const catBuff = knightCatalog({ moveRange: 2, extraStatusTypes: [movePlusOne] });
    const buffed = makeUnit({
      id: 'u1',
      spd: 10,
      position: { x: 2, y: 2, layer: 0 },
      statuses: [makeStatusInstance({ typeId: 'move_plus_one' })],
    });
    const unbuffed = makeUnit({ id: 'u2', spd: 10, position: { x: 2, y: 2, layer: 0 } });
    const stateBuffed = makeGameState({ units: [buffed], map: flatMap(7, 7) });
    const stateUnbuffed = makeGameState({ units: [unbuffed], map: flatMap(7, 7) });
    expect(getLegalMoves(stateBuffed, buffed.id, catBuff).reachable.size).toBeGreaterThan(
      getLegalMoves(stateUnbuffed, unbuffed.id, catBase).reachable.size,
    );
  });
});

describe('getLegalMoves — special movement', () => {
  it('Fly: ignores the jump constraint', () => {
    // Two-tile strip: (0,0) elev 0, (1,0) elev 5. Jump 2 standard
    // movement cannot step; fly should.
    const cat = knightCatalog({ moveRange: 5, jump: 2, specialMovement: 'fly' });
    const u = makeUnit({ id: 'u1', spd: 10, position: { x: 0, y: 0, layer: 0 } });
    const state = makeGameState({
      units: [u],
      map: mapWith({
        width: 2,
        height: 1,
        tiles: [
          { x: 0, y: 0 },
          { x: 1, y: 0, elevation: 5 },
        ],
      }),
    });
    const { reachable } = getLegalMoves(state, u.id, cat);
    expect(reachable.has(positionKey({ x: 1, y: 0, layer: 0 }))).toBe(true);
  });

  it('Fly: still respects canEnter (a flying unit with no canEnter for water cannot land)', () => {
    const cat = knightCatalog({
      moveRange: 5,
      specialMovement: 'fly',
      canEnter: ['ground'],
    });
    const u = makeUnit({ id: 'u1', spd: 10, position: { x: 0, y: 0, layer: 0 } });
    const state = makeGameState({ units: [u], map: mapFrom(['GWG']) });
    const { reachable } = getLegalMoves(state, u.id, cat);
    expect(reachable.has(positionKey({ x: 1, y: 0, layer: 0 }))).toBe(false);
    expect(reachable.has(positionKey({ x: 2, y: 0, layer: 0 }))).toBe(false);
  });

  it('throws SpecialMovementNotImplementedError for teleport profiles (no v1 consumer)', () => {
    const cat = knightCatalog({ specialMovement: 'teleport' });
    const u = makeUnit({ id: 'u1', spd: 10 });
    const state = makeGameState({ units: [u], map: flatMap(3, 3) });
    expect(() => getLegalMoves(state, u.id, cat)).toThrow(SpecialMovementNotImplementedError);
  });

  it('throws SpecialMovementNotImplementedError for phase profiles (no v1 consumer)', () => {
    const cat = knightCatalog({ specialMovement: 'phase' });
    const u = makeUnit({ id: 'u1', spd: 10 });
    const state = makeGameState({ units: [u], map: flatMap(3, 3) });
    expect(() => getLegalMoves(state, u.id, cat)).toThrow(SpecialMovementNotImplementedError);
  });
});

describe('getLegalMoves — pure function', () => {
  it('does not mutate the input state', () => {
    const cat = knightCatalog({ moveRange: 2 });
    const u = makeUnit({ id: 'u1', spd: 10, position: { x: 1, y: 1, layer: 0 } });
    const state = makeGameState({ units: [u], map: flatMap(3, 3) });
    const snapshot = JSON.stringify(state, (_k, v) => (v instanceof Map ? Array.from(v) : v));
    getLegalMoves(state, u.id, cat);
    const after = JSON.stringify(state, (_k, v) => (v instanceof Map ? Array.from(v) : v));
    expect(after).toBe(snapshot);
  });

  it('produces the same MovementResult for the same inputs', () => {
    const cat = knightCatalog({ moveRange: 3 });
    const u = makeUnit({ id: 'u1', spd: 10, position: { x: 1, y: 1, layer: 0 } });
    const state = makeGameState({ units: [u], map: flatMap(4, 4) });
    const r1 = getLegalMoves(state, u.id, cat);
    const r2 = getLegalMoves(state, u.id, cat);
    expect(r1.reachable.size).toBe(r2.reachable.size);
    for (const [k, v] of r1.reachable) {
      expect(r2.reachable.get(k)).toEqual(v);
    }
  });
});
