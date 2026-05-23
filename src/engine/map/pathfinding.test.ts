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

// S43: FFT-faithful KO'd-unit pathing — a unit may path *through* a
// downed unit (ally or enemy) but cannot *stop on* its tile. A `removed`
// (permadead, ADR-0076) unit occupies nothing, so its tile is both
// traversable and settle-able.
describe('getLegalMoves — KO\'d / removed occupancy (S43)', () => {
  it('routes through a KO\'d enemy to reach the tile beyond', () => {
    // friendlyPassThrough off so a *living* enemy would block fully —
    // isolates the KO'd-passability behavior from the friendly rule.
    const cat = knightCatalog({ moveRange: 3, friendlyPassThrough: false });
    const mover = makeUnit({
      id: 'mover',
      spd: 10,
      team: 'team_a',
      position: { x: 0, y: 0, layer: 0 },
    });
    const koEnemy = makeUnit({
      id: 'ko_enemy',
      spd: 10,
      team: 'team_b',
      hp: 0,
      position: { x: 1, y: 0, layer: 0 },
    });
    const state = makeGameState({ units: [mover, koEnemy], map: flatMap(3, 1) });
    const { reachable } = getLegalMoves(state, mover.id, cat);
    // The tile beyond the downed enemy is reachable...
    expect(reachable.has(positionKey({ x: 2, y: 0, layer: 0 }))).toBe(true);
    // ...but the downed enemy's own tile cannot be settled on.
    expect(reachable.has(positionKey({ x: 1, y: 0, layer: 0 }))).toBe(false);
  });

  it('routes through a KO\'d ally just like a living one, but cannot settle on it', () => {
    const cat = knightCatalog({ moveRange: 3, friendlyPassThrough: false });
    const mover = makeUnit({
      id: 'mover',
      spd: 10,
      team: 'team_a',
      position: { x: 0, y: 0, layer: 0 },
    });
    const koAlly = makeUnit({
      id: 'ko_ally',
      spd: 10,
      team: 'team_a',
      hp: 0,
      position: { x: 1, y: 0, layer: 0 },
    });
    const state = makeGameState({ units: [mover, koAlly], map: flatMap(3, 1) });
    const { reachable } = getLegalMoves(state, mover.id, cat);
    expect(reachable.has(positionKey({ x: 2, y: 0, layer: 0 }))).toBe(true);
    expect(reachable.has(positionKey({ x: 1, y: 0, layer: 0 }))).toBe(false);
  });

  it('a removed (permadead) unit occupies nothing — its tile is traversable and settle-able', () => {
    const cat = knightCatalog({ moveRange: 3, friendlyPassThrough: false });
    const mover = makeUnit({
      id: 'mover',
      spd: 10,
      team: 'team_a',
      position: { x: 0, y: 0, layer: 0 },
    });
    const removedEnemy = makeUnit({
      id: 'removed_enemy',
      spd: 10,
      team: 'team_b',
      hp: 0,
      removed: true,
      position: { x: 1, y: 0, layer: 0 },
    });
    const state = makeGameState({ units: [mover, removedEnemy], map: flatMap(3, 1) });
    const { reachable } = getLegalMoves(state, mover.id, cat);
    expect(reachable.has(positionKey({ x: 1, y: 0, layer: 0 }))).toBe(true);
    expect(reachable.has(positionKey({ x: 2, y: 0, layer: 0 }))).toBe(true);
  });

  it('a living enemy still blocks (regression — the fix is scoped to KO\'d only)', () => {
    const cat = knightCatalog({ moveRange: 3, friendlyPassThrough: false });
    const mover = makeUnit({
      id: 'mover',
      spd: 10,
      team: 'team_a',
      position: { x: 0, y: 0, layer: 0 },
    });
    const liveEnemy = makeUnit({
      id: 'live_enemy',
      spd: 10,
      team: 'team_b',
      hp: 50,
      position: { x: 1, y: 0, layer: 0 },
    });
    const state = makeGameState({ units: [mover, liveEnemy], map: flatMap(3, 1) });
    const { reachable } = getLegalMoves(state, mover.id, cat);
    expect(reachable.has(positionKey({ x: 1, y: 0, layer: 0 }))).toBe(false);
    expect(reachable.has(positionKey({ x: 2, y: 0, layer: 0 }))).toBe(false);
  });

  it('leaps over a KO\'d unit on the landing tile, but cannot settle there', () => {
    // L s L with a KO'd enemy on the far land tile (2,0). The leap
    // traverses onto it; the settlement filter rejects it as a stop.
    const LEAP_LEGEND = {
      L: { terrain: 'ground', elevation: 2 },
      s: { terrain: 'water', elevation: 1 },
    };
    const cat = knightCatalog({ moveRange: 4, jump: 1, canEnter: ['ground'] });
    const mover = makeUnit({
      id: 'mover',
      spd: 10,
      team: 'team_a',
      position: { x: 0, y: 0, layer: 0 },
    });
    const koEnemy = makeUnit({
      id: 'ko_enemy',
      spd: 10,
      team: 'team_b',
      hp: 0,
      position: { x: 2, y: 0, layer: 0 },
    });
    const state = makeGameState({
      units: [mover, koEnemy],
      map: mapFrom(['LsLL'], LEAP_LEGEND),
    });
    const { reachable } = getLegalMoves(state, mover.id, cat);
    // The landing tile holds a downed unit — not settle-able...
    expect(reachable.has(positionKey({ x: 2, y: 0, layer: 0 }))).toBe(false);
    // ...but the leap is traversable, so the land tile beyond is reachable.
    expect(reachable.has(positionKey({ x: 3, y: 0, layer: 0 }))).toBe(true);
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

// Session 32 / Item 15: jump-over-water leap candidates.
// Cardinal two-step leap where the intermediate is water (elev 0 or 1)
// and the destination is land (elev ≥ 2). Cost 2 fixed. Requires jump ≥ 1.
// Per docs/maps/river-ridge.md "Jump-Over-Water Rule".
//
// Tests use a custom legend pairing water terrain with elevation 0/1
// and ground terrain with elevation 2 (matches the universal water-table
// convention: elev → water-ness).
describe('getLegalMoves — jump-over-water leap (Session 32)', () => {
  // Legend: 'L' land at elev 2, 's' shallow water elev 1, 'd' deep water elev 0.
  // Unit's canEnter must include 'ground' (the land terrain); water terrains
  // can be omitted (leap doesn't require canEnter on the intermediate).
  const LEAP_LEGEND = {
    L: { terrain: 'ground', elevation: 2 },
    s: { terrain: 'water', elevation: 1 },
    d: { terrain: 'water', elevation: 0 },
  };

  it('generates a leap candidate over shallow water (1 water tile, land destination)', () => {
    // 3-tile strip: land, shallow water, land. Unit at (0,0), moveRange 2,
    // jump 1. Should reach (2,0) at cost 2 via leap; not (1,0) since
    // water isn't in canEnter and is elev 1 (no step possible).
    const cat = knightCatalog({ moveRange: 2, jump: 1, canEnter: ['ground'] });
    const u = makeUnit({ id: 'u1', spd: 10, position: { x: 0, y: 0, layer: 0 } });
    const state = makeGameState({ units: [u], map: mapFrom(['LsL'], LEAP_LEGEND) });
    const { reachable } = getLegalMoves(state, u.id, cat);
    const dest = reachable.get(positionKey({ x: 2, y: 0, layer: 0 }));
    expect(dest).toBeDefined();
    expect(dest!.cost).toBe(2);
    // Path is [start, leap-destination] (intermediate water not in path).
    expect(dest!.path).toEqual([
      { x: 0, y: 0, layer: 0 },
      { x: 2, y: 0, layer: 0 },
    ]);
    // Intermediate water tile is not reachable (canEnter excludes water).
    expect(reachable.has(positionKey({ x: 1, y: 0, layer: 0 }))).toBe(false);
  });

  it('generates a leap over deep water (elev 0)', () => {
    const cat = knightCatalog({ moveRange: 2, jump: 1, canEnter: ['ground'] });
    const u = makeUnit({ id: 'u1', spd: 10, position: { x: 0, y: 0, layer: 0 } });
    const state = makeGameState({ units: [u], map: mapFrom(['LdL'], LEAP_LEGEND) });
    const { reachable } = getLegalMoves(state, u.id, cat);
    expect(reachable.get(positionKey({ x: 2, y: 0, layer: 0 }))!.cost).toBe(2);
  });

  it('does not leap when the unit has jump 0', () => {
    const cat = knightCatalog({ moveRange: 5, jump: 0, canEnter: ['ground'] });
    const u = makeUnit({ id: 'u1', spd: 10, position: { x: 0, y: 0, layer: 0 } });
    const state = makeGameState({ units: [u], map: mapFrom(['LsL'], LEAP_LEGEND) });
    const { reachable } = getLegalMoves(state, u.id, cat);
    expect(reachable.has(positionKey({ x: 2, y: 0, layer: 0 }))).toBe(false);
  });

  it('does not leap when the destination is also water (must land on land)', () => {
    // L s s L — leap from (0,0) to (2,0) requires destination land,
    // (2,0) is shallow water — should not generate. (1,0) and (3,0)
    // also water-only, not reachable.
    const cat = knightCatalog({ moveRange: 5, jump: 1, canEnter: ['ground'] });
    const u = makeUnit({ id: 'u1', spd: 10, position: { x: 0, y: 0, layer: 0 } });
    const state = makeGameState({ units: [u], map: mapFrom(['LssL'], LEAP_LEGEND) });
    const { reachable } = getLegalMoves(state, u.id, cat);
    expect(reachable.has(positionKey({ x: 2, y: 0, layer: 0 }))).toBe(false);
    // The land 3 tiles out *isn't* reachable via a single leap (two water
    // tiles between source and destination). Confirms one-water-tile rule.
    expect(reachable.has(positionKey({ x: 3, y: 0, layer: 0 }))).toBe(false);
  });

  it('does not leap when the intermediate is land (standard step path covers it)', () => {
    // L L L — three land tiles. Should not generate a leap candidate
    // because the intermediate is not water; standard adjacency handles it.
    const cat = knightCatalog({ moveRange: 2, jump: 1, canEnter: ['ground'] });
    const u = makeUnit({ id: 'u1', spd: 10, position: { x: 0, y: 0, layer: 0 } });
    const state = makeGameState({ units: [u], map: mapFrom(['LLL'], LEAP_LEGEND) });
    const { reachable } = getLegalMoves(state, u.id, cat);
    // (2,0) reaches via two standard steps at cost 2 (matching leap cost
    // by coincidence; what matters is path content, not just cost).
    const dest = reachable.get(positionKey({ x: 2, y: 0, layer: 0 }))!;
    expect(dest.cost).toBe(2);
    expect(dest.path.length).toBe(3); // includes intermediate land tile
    expect(dest.path[1]).toEqual({ x: 1, y: 0, layer: 0 });
  });

  it('does not leap diagonally — cardinals only', () => {
    // 2x2 of land with diagonal-adjacent water: leap would need to be
    // cardinal-two-step. CARDINAL_DELTAS already enforces this; we
    // confirm by setup that the leap predicate isn't hit on a diagonal
    // pairing. (No leap dest exists since there's no row of L-W-L
    // diagonally.)
    const cat = knightCatalog({ moveRange: 2, jump: 1, canEnter: ['ground'] });
    const u = makeUnit({ id: 'u1', spd: 10, position: { x: 0, y: 0, layer: 0 } });
    const state = makeGameState({
      units: [u],
      map: mapFrom(
        [
          'Ls',
          'sL',
        ],
        LEAP_LEGEND,
      ),
    });
    const { reachable } = getLegalMoves(state, u.id, cat);
    // (1,1) — diagonally across the water — is not reachable.
    expect(reachable.has(positionKey({ x: 1, y: 1, layer: 0 }))).toBe(false);
  });

  it('respects elevation tolerance — leap blocked when source-to-dest delta exceeds jump', () => {
    // Source at elev 2; intermediate water elev 1; destination at elev 6
    // (high cliff). Δelev = 4. With jump 2 the leap is blocked; with
    // jump 4 it succeeds.
    const HIGH_LEGEND = {
      L: { terrain: 'ground', elevation: 2 },
      s: { terrain: 'water', elevation: 1 },
      H: { terrain: 'ground', elevation: 6 },
    };
    const blockedCat = knightCatalog({ moveRange: 2, jump: 2, canEnter: ['ground'] });
    const allowedCat = knightCatalog({ moveRange: 2, jump: 4, canEnter: ['ground'] });
    const u = makeUnit({ id: 'u1', spd: 10, position: { x: 0, y: 0, layer: 0 } });
    const blockedState = makeGameState({
      units: [u],
      map: mapFrom(['LsH'], HIGH_LEGEND),
    });
    const allowedState = makeGameState({
      units: [u],
      map: mapFrom(['LsH'], HIGH_LEGEND),
    });
    expect(
      getLegalMoves(blockedState, u.id, blockedCat).reachable.has(
        positionKey({ x: 2, y: 0, layer: 0 }),
      ),
    ).toBe(false);
    expect(
      getLegalMoves(allowedState, u.id, allowedCat).reachable.has(
        positionKey({ x: 2, y: 0, layer: 0 }),
      ),
    ).toBe(true);
  });

  it('does not generate leap when destination is occupied by an enemy', () => {
    const cat = knightCatalog({ moveRange: 2, jump: 1, canEnter: ['ground'] });
    const u1 = makeUnit({ id: 'u1', spd: 10, team: 'team_a', position: { x: 0, y: 0, layer: 0 } });
    const u2 = makeUnit({ id: 'u2', spd: 10, team: 'team_b', position: { x: 2, y: 0, layer: 0 } });
    const state = makeGameState({ units: [u1, u2], map: mapFrom(['LsL'], LEAP_LEGEND) });
    const { reachable } = getLegalMoves(state, u1.id, cat);
    expect(reachable.has(positionKey({ x: 2, y: 0, layer: 0 }))).toBe(false);
  });

  it('leap cost stays fixed at 2 even when terrainCosts increase water cost', () => {
    // Even if a custom terrain cost is authored for 'water', the leap is
    // a category of move that pays a fixed 2 — it doesn't lookup
    // terrainCosts for the intermediate. Confirms River Ridge's
    // "leap pays 2 move points total" framing.
    const cat = knightCatalog({
      moveRange: 2,
      jump: 1,
      canEnter: ['ground'],
      terrainCosts: [['water', 3]],
    });
    const u = makeUnit({ id: 'u1', spd: 10, position: { x: 0, y: 0, layer: 0 } });
    const state = makeGameState({ units: [u], map: mapFrom(['LsL'], LEAP_LEGEND) });
    const { reachable } = getLegalMoves(state, u.id, cat);
    expect(reachable.get(positionKey({ x: 2, y: 0, layer: 0 }))!.cost).toBe(2);
  });

  it('no spurious leaps on a land-only flat map (regression)', () => {
    // Pre-S32 reachable-set on a flat 5×5 map should be unchanged. The
    // leap predicate's water check short-circuits before any leap edges
    // are added.
    const cat = knightCatalog({ moveRange: 2, jump: 2 });
    const u = makeUnit({ id: 'u1', spd: 10, position: { x: 2, y: 2, layer: 0 } });
    const state = makeGameState({ units: [u], map: flatMap(5, 5) });
    const { reachable } = getLegalMoves(state, u.id, cat);
    expect(reachable.size).toBe(13);
  });
});
