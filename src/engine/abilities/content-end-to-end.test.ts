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

describe('Float (passive, modifyTerrainCosts)', () => {
  // Session 33.5 (ADR-0074 context): Float redesigned. Pre-S33 it added
  // water to canEnter; under S33's universal-water-enter convention that
  // role became a no-op against the production catalog. Float is now the
  // universal terrain-cost leveller — every terrain's move cost drops to
  // min(cost, 1). On the default ruleset that means water_shallow 2 → 1
  // and water_deep 3 → 1; ground (already 1) is unchanged.
  it('flattens every terrain cost to min(cost, 1)', () => {
    const floatUnit = makeUnit({
      id: 'f',
      spd: 10,
      loadout: loadoutOf({
        passive: [[BUCKET_MOVEMENT, [abilityId('float')]]],
      }),
    });
    const baseUnit = makeUnit({ id: 'b', spd: 10 });
    const state = makeGameState({ units: [floatUnit, baseUnit] });
    // Baseline: the ruleset's default water costs apply unmodified.
    const baseProfile = computeMovementProfile(state, baseUnit.id, cat);
    expect(baseProfile.terrainCosts.get('water_shallow')).toBe(2);
    expect(baseProfile.terrainCosts.get('water_deep')).toBe(3);
    // Float: every terrain capped at cost 1.
    const floatProfile = computeMovementProfile(state, floatUnit.id, cat);
    expect(floatProfile.terrainCosts.get('water_shallow')).toBe(1);
    expect(floatProfile.terrainCosts.get('water_deep')).toBe(1);
    expect(floatProfile.terrainCosts.get('ground')).toBe(1);
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
  // Confirms a cost-modifier (`modifyTerrainCosts`) and a scalar
  // (`modifyStatQuery`) chain compose independently in one profile
  // resolution. See the Float describe above for the redesign context.
  it('combines cost and scalar modifiers correctly', () => {
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
    expect(profile.terrainCosts.get('water_shallow')).toBe(1);
    expect(profile.terrainCosts.get('water_deep')).toBe(1);
  });
});
