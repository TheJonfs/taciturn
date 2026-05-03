// End-to-end content tests, mirroring session 3's Haste-end-to-end
// pattern. These exercise the real abilities defined in src/content/
// through the default catalog and confirm the engine wiring lights up
// from registration → collection → runner → consumer.

import { loadDefaultCatalog } from '../../content/index.ts';
import { makeGameState, makeUnit } from '../ct/test-fixtures.ts';
import { computeMovementProfile } from '../map/movement-profile.ts';
import { getLegalMoves, positionKey } from '../map/pathfinding.ts';
import { flatMap, mapFrom, mapWith } from '../map/test-fixtures.ts';
import { abilityId } from '../types/index.ts';
import { BUCKET_MOVEMENT } from './constants.ts';
import { loadoutOf } from './test-fixtures.ts';

const cat = loadDefaultCatalog();

describe('Move +1 (passive, scalar via modifyStatQuery)', () => {
  it('adds 1 to moveRange when equipped', () => {
    const u = makeUnit({
      id: 'u1',
      spd: 10,
      loadout: loadoutOf({
        passive: [[BUCKET_MOVEMENT, [abilityId('move_plus_1')]]],
      }),
    });
    const state = makeGameState({ units: [u] });
    expect(computeMovementProfile(state, u.id, cat).moveRange).toBe(4); // knight base 3 + 1
  });

  it('without it, the moveRange is the class baseline', () => {
    const u = makeUnit({ id: 'u1', spd: 10 });
    const state = makeGameState({ units: [u] });
    expect(computeMovementProfile(state, u.id, cat).moveRange).toBe(3);
  });

  it('extends the reachable set in pathfinding', () => {
    const buffed = makeUnit({
      id: 'b',
      spd: 10,
      position: { x: 3, y: 3, layer: 0 },
      loadout: loadoutOf({
        passive: [[BUCKET_MOVEMENT, [abilityId('move_plus_1')]]],
      }),
    });
    const baseline = makeUnit({ id: 'a', spd: 10, position: { x: 3, y: 3, layer: 0 } });
    const stateB = makeGameState({ units: [buffed], map: flatMap(7, 7) });
    const stateA = makeGameState({ units: [baseline], map: flatMap(7, 7) });
    expect(getLegalMoves(stateB, buffed.id, cat).reachable.size).toBeGreaterThan(
      getLegalMoves(stateA, baseline.id, cat).reachable.size,
    );
  });
});

describe('Float (passive, modifyCanEnter)', () => {
  it('adds water to canEnter when equipped', () => {
    const u = makeUnit({
      id: 'u1',
      spd: 10,
      loadout: loadoutOf({
        passive: [[BUCKET_MOVEMENT, [abilityId('float')]]],
      }),
    });
    const state = makeGameState({ units: [u] });
    const profile = computeMovementProfile(state, u.id, cat);
    expect(profile.canEnter.has('water')).toBe(true);
    expect(profile.canEnter.has('ground')).toBe(true);
  });

  it('lets pathfinding cross water tiles it otherwise could not', () => {
    // 3-tile strip GWG. Without Float the knight can't cross the water.
    const map = mapFrom(['GWG']);
    const baseline = makeUnit({ id: 'a', spd: 10, position: { x: 0, y: 0, layer: 0 } });
    const floater = makeUnit({
      id: 'b',
      spd: 10,
      position: { x: 0, y: 0, layer: 0 },
      loadout: loadoutOf({
        passive: [[BUCKET_MOVEMENT, [abilityId('float')]]],
      }),
    });
    const stateA = makeGameState({ units: [baseline], map });
    const stateB = makeGameState({ units: [floater], map });
    expect(
      getLegalMoves(stateA, baseline.id, cat).reachable.has(positionKey({ x: 2, y: 0, layer: 0 })),
    ).toBe(false);
    expect(
      getLegalMoves(stateB, floater.id, cat).reachable.has(positionKey({ x: 2, y: 0, layer: 0 })),
    ).toBe(true);
  });
});

describe('Fly (passive, modifySpecialMovement → fly pathfinding)', () => {
  it('sets specialMovement to fly when equipped', () => {
    const u = makeUnit({
      id: 'u1',
      spd: 10,
      loadout: loadoutOf({
        passive: [[BUCKET_MOVEMENT, [abilityId('fly')]]],
      }),
    });
    const state = makeGameState({ units: [u] });
    expect(computeMovementProfile(state, u.id, cat).specialMovement).toBe('fly');
  });

  it('lets pathfinding ignore the jump constraint', () => {
    // Two tiles, elevation differential 5. Knight jump 2 can't cross
    // standard; flying knight can.
    const map = mapWith({
      width: 2,
      height: 1,
      tiles: [
        { x: 0, y: 0 },
        { x: 1, y: 0, elevation: 5 },
      ],
    });
    const baseline = makeUnit({ id: 'a', spd: 10, position: { x: 0, y: 0, layer: 0 } });
    const flier = makeUnit({
      id: 'b',
      spd: 10,
      position: { x: 0, y: 0, layer: 0 },
      loadout: loadoutOf({
        passive: [[BUCKET_MOVEMENT, [abilityId('fly')]]],
      }),
    });
    const stateA = makeGameState({ units: [baseline], map });
    const stateB = makeGameState({ units: [flier], map });
    expect(
      getLegalMoves(stateA, baseline.id, cat).reachable.has(positionKey({ x: 1, y: 0, layer: 0 })),
    ).toBe(false);
    expect(
      getLegalMoves(stateB, flier.id, cat).reachable.has(positionKey({ x: 1, y: 0, layer: 0 })),
    ).toBe(true);
  });
});

describe('Float + Move +1 stacked', () => {
  it('combines structural and scalar modifiers correctly', () => {
    const u = makeUnit({
      id: 'u1',
      spd: 10,
      loadout: loadoutOf({
        passive: [[BUCKET_MOVEMENT, [abilityId('float'), abilityId('move_plus_1')]]],
      }),
    });
    const state = makeGameState({ units: [u] });
    const profile = computeMovementProfile(state, u.id, cat);
    expect(profile.moveRange).toBe(4);
    expect(profile.canEnter.has('water')).toBe(true);
  });
});
