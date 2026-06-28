// Session 76 — grapple_throw (Bear's Heave) targeting. Mirrors the tile_set
// targeting test: the picker's offered throwees / destinations must match what
// `validateAction` accepts (the helpers enumerate by validating each candidate),
// and the two-phase FSM (throwee → destination → commit, with two-stage cancel)
// must route correctly.

import { describe, expect, it } from 'vitest';
import { abilityId, commandSetId, type Unit } from '@engine/index.ts';
import { loadDefaultCatalog } from '../content/index.ts';
import { makeGameState, makeUnit, activeTurnFor } from '../engine/ct/test-fixtures.ts';
import { flatMap } from '../engine/map/test-fixtures.ts';
import { validGrappleThrowees, validGrappleDestinations } from './use-turn-flow.ts';
import { transition } from './turn-flow.ts';

const catalog = loadDefaultCatalog();
const bearsHeaveDef = catalog.getAbility(abilityId('bears_heave'));
if (bearsHeaveDef.kind !== 'active') throw new Error('bears_heave must be active');
const bearsHeave = bearsHeaveDef;

function monk(overrides: Partial<Parameters<typeof makeUnit>[0]> = {}): Unit {
  return makeUnit({ id: 'monk', spd: 10, pa: 9, mp: 26, maxMpBase: 26, classId: 'monk', position: { x: 2, y: 2, layer: 0 }, ...overrides });
}

describe('grapple_throw targeting helpers', () => {
  it('offers both an adjacent enemy and an adjacent ally as throwees (D5: enemies + allies)', () => {
    const m = monk();
    const enemy = makeUnit({ id: 'enemy', team: 'team_b', spd: 8, position: { x: 3, y: 2, layer: 0 } });
    const ally = makeUnit({ id: 'ally', team: 'team_a', spd: 8, position: { x: 1, y: 2, layer: 0 } });
    const state = makeGameState({ units: [m, enemy, ally], map: flatMap(6, 6), turnState: activeTurnFor(m.id) });
    const throwees = validGrappleThrowees(state, catalog, m, bearsHeave);
    expect(throwees).toContainEqual(enemy.position);
    expect(throwees).toContainEqual(ally.position);
    // The Monk never offers itself.
    expect(throwees).not.toContainEqual(m.position);
  });

  it('does not offer a non-adjacent unit (out of grab range)', () => {
    const m = monk();
    const far = makeUnit({ id: 'far', team: 'team_b', spd: 8, position: { x: 5, y: 5, layer: 0 } });
    const state = makeGameState({ units: [m, far], map: flatMap(6, 6), turnState: activeTurnFor(m.id) });
    expect(validGrappleThrowees(state, catalog, m, bearsHeave)).toHaveLength(0);
  });

  it('every offered destination is within the 2-diamond, unoccupied, and validateAction-accepted', () => {
    const m = monk();
    const enemy = makeUnit({ id: 'enemy', team: 'team_b', spd: 8, position: { x: 3, y: 2, layer: 0 } });
    const state = makeGameState({ units: [m, enemy], map: flatMap(8, 8), turnState: activeTurnFor(m.id) });
    const dests = validGrappleDestinations(state, catalog, m, bearsHeave, enemy.id);
    expect(dests.length).toBeGreaterThan(0);
    for (const d of dests) {
      const manhattan = Math.abs(d.x - enemy.position.x) + Math.abs(d.y - enemy.position.y);
      expect(manhattan).toBeGreaterThan(0);
      expect(manhattan).toBeLessThanOrEqual(2);
      // No destination lands on an occupied tile (the Monk's or the enemy's).
      expect(d).not.toEqual(m.position);
    }
  });
});

describe('grapple_throw FSM', () => {
  it('routes pickAbility(grapple_throw) into the throwee phase', () => {
    const after = transition(
      { kind: 'ability-list', commandSetId: commandSetId('martial_arts'), commandSetCount: 2 },
      { kind: 'pickAbility', abilityId: bearsHeave.id, route: 'grapple_throw' },
    );
    expect(after.kind).toBe('grapple-throw-target-select');
    expect(after.kind === 'grapple-throw-target-select' && after.throweeId).toBeNull();
  });

  it('pickGrappleThrowee advances to the destination phase; commitTarget → animation', () => {
    const throwee = transition(
      { kind: 'grapple-throw-target-select', commandSetId: null, commandSetCount: 2, abilityId: bearsHeave.id, throweeId: null, hoverTarget: null },
      { kind: 'pickGrappleThrowee', throweeId: makeUnit({ id: 'enemy', spd: 8 }).id },
    );
    expect(throwee.kind === 'grapple-throw-target-select' && throwee.throweeId).not.toBeNull();
    const committed = transition(throwee, {
      kind: 'commitTarget',
      action: { type: 'wait', source: 'player', actorId: makeUnit({ id: 'monk', spd: 10 }).id, payload: {} } as never,
      confirmStep: false,
    });
    expect(committed.kind).toBe('animation');
  });

  it('cancel is two-stage: destination → re-pick throwee; throwee → leave the picker', () => {
    const dest = { kind: 'grapple-throw-target-select', commandSetId: null, commandSetCount: 2, abilityId: bearsHeave.id, throweeId: makeUnit({ id: 'e', spd: 8 }).id, hoverTarget: null } as const;
    const backToThrowee = transition(dest, { kind: 'cancel' });
    expect(backToThrowee.kind === 'grapple-throw-target-select' && backToThrowee.throweeId).toBeNull();
    const leave = transition({ ...dest, throweeId: null }, { kind: 'cancel' });
    expect(leave.kind).toBe('command-set-select');
  });
});
