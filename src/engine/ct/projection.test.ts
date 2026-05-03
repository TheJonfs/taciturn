import { nextEvent, projectUpcoming, ticksUntilTrigger } from './projection.ts';
import { emptyCatalog, makeChargedAction, makeGameState, makeUnit } from './test-fixtures.ts';

const CATALOG = emptyCatalog();

describe('ticksUntilTrigger', () => {
  it('divides remaining CT by speed and rounds up', () => {
    expect(ticksUntilTrigger(0, 10)).toBe(10);
    expect(ticksUntilTrigger(0, 25)).toBe(4);
    expect(ticksUntilTrigger(50, 10)).toBe(5);
  });

  it('rounds up for non-divisible cases', () => {
    expect(ticksUntilTrigger(0, 7)).toBe(15);
    expect(ticksUntilTrigger(99, 2)).toBe(1);
  });

  it('returns 0 when already at the threshold', () => {
    expect(ticksUntilTrigger(100, 10)).toBe(0);
  });

  it('returns 0 when above the threshold (CT pushes can leave entities >100)', () => {
    expect(ticksUntilTrigger(120, 5)).toBe(0);
  });

  it('returns Infinity for non-positive speed (Stop, etc.)', () => {
    expect(ticksUntilTrigger(50, 0)).toBe(Infinity);
    expect(ticksUntilTrigger(50, -3)).toBe(Infinity);
  });
});

describe('nextEvent', () => {
  it('returns null when no entities are present', () => {
    const state = makeGameState({});
    expect(nextEvent(state, CATALOG)).toBeNull();
  });

  it('returns null when every unit has speed 0', () => {
    const state = makeGameState({
      units: [makeUnit({ id: 'u1', spd: 0, ct: 50 })],
    });
    expect(nextEvent(state, CATALOG)).toBeNull();
  });

  it('reports the only unit as the next event when alone', () => {
    const state = makeGameState({
      units: [makeUnit({ id: 'u1', spd: 10, ct: 0 })],
    });
    const event = nextEvent(state, CATALOG);
    expect(event).not.toBeNull();
    expect(event!.entityKind).toBe('unit');
    expect(event!.entityId).toBe('u1');
    expect(event!.ticksFromNow).toBe(10);
    expect(event!.actualCT).toBe(100);
    expect(event!.speed).toBe(10);
  });

  it('picks the entity with the fewest ticks to trigger', () => {
    const state = makeGameState({
      units: [
        makeUnit({ id: 'slow', spd: 5, ct: 0 }), // 20 ticks
        makeUnit({ id: 'fast', spd: 20, ct: 0 }), // 5 ticks
      ],
    });
    expect(nextEvent(state, CATALOG)?.entityId).toBe('fast');
  });

  it('treats a Charged Action as a peer of units in the queue', () => {
    const state = makeGameState({
      units: [makeUnit({ id: 'u1', spd: 10, ct: 0 })], // 10 ticks
      chargedActions: [makeChargedAction({ id: 'ca1', speed: 25, ct: 50 })], // 2 ticks
    });
    const event = nextEvent(state, CATALOG);
    expect(event?.entityKind).toBe('charged_action');
    expect(event?.entityId).toBe('ca1');
  });

  it('breaks ties on actual CT (higher wins) when ticks are equal', () => {
    // Both reach trigger at tick 2, but with different actual CT values.
    //   A: CT=50, spd=30 → at tick 2 has CT 110.
    //   B: CT=90, spd=5  → at tick 2 has CT 100.
    const state = makeGameState({
      units: [
        makeUnit({ id: 'b_lower_ct', spd: 5, ct: 90 }),
        makeUnit({ id: 'a_higher_ct', spd: 30, ct: 50 }),
      ],
    });
    const event = nextEvent(state, CATALOG);
    expect(event?.entityId).toBe('a_higher_ct');
    expect(event?.actualCT).toBe(110);
  });

  it('breaks ties on Speed (higher wins) when ticks and actual CT are equal', () => {
    // Both arrive at exactly CT=100 at tick 2; faster wins.
    //   A: CT=80, spd=10 → tick 2: 100
    //   B: CT=60, spd=20 → tick 2: 100
    const state = makeGameState({
      units: [
        makeUnit({ id: 'a_slow', spd: 10, ct: 80 }),
        makeUnit({ id: 'b_fast', spd: 20, ct: 60 }),
      ],
    });
    const event = nextEvent(state, CATALOG);
    expect(event?.entityId).toBe('b_fast');
  });

  it('falls back to a stable lexicographic ID for full ties', () => {
    const state = makeGameState({
      units: [makeUnit({ id: 'zebra', spd: 10, ct: 0 }), makeUnit({ id: 'alpha', spd: 10, ct: 0 })],
    });
    expect(nextEvent(state, CATALOG)?.entityId).toBe('alpha');
  });

  it('skips KO\'d units (hp <= 0) — they cannot trigger turns', () => {
    // The fast unit is KO'd; the slow one wins the next event despite
    // its lower Speed. Mirrors the scheduler's KO filter.
    const state = makeGameState({
      units: [
        makeUnit({ id: 'ko_fast', spd: 50, ct: 0, hp: 0 }),
        makeUnit({ id: 'alive_slow', spd: 10, ct: 0 }),
      ],
    });
    const event = nextEvent(state, CATALOG);
    expect(event?.entityId).toBe('alive_slow');
  });
});

describe('projectUpcoming', () => {
  it('returns an empty array when count is 0', () => {
    const state = makeGameState({
      units: [makeUnit({ id: 'u1', spd: 10, ct: 0 })],
    });
    expect(projectUpcoming(state, 0, CATALOG)).toEqual([]);
  });

  it('returns the same first event as nextEvent when count is 1', () => {
    const state = makeGameState({
      units: [makeUnit({ id: 'u1', spd: 10, ct: 0 })],
    });
    expect(projectUpcoming(state, 1, CATALOG)).toEqual([nextEvent(state, CATALOG)]);
  });

  it('projects a unit cycling on its own per the assumed turn cost', () => {
    // Single unit, spd=10, ct=0. Triggers at tick 10. Per ADR-0003, after
    // trigger CT resets to (100 - assumedTurnCost) = 0, so the next trigger
    // is at the same cadence: tick 20, tick 30.
    const state = makeGameState({
      units: [makeUnit({ id: 'u1', spd: 10, ct: 0 })],
    });
    const events = projectUpcoming(state, 3, CATALOG);
    expect(events.map((e) => e.ticksFromNow)).toEqual([10, 20, 30]);
    expect(events.every((e) => e.entityId === 'u1')).toBe(true);
  });

  it('removes a Charged Action after it triggers; it does not reappear later', () => {
    const state = makeGameState({
      units: [makeUnit({ id: 'u1', spd: 10, ct: 0 })],
      chargedActions: [makeChargedAction({ id: 'ca1', speed: 25, ct: 50 })],
    });
    const events = projectUpcoming(state, 4, CATALOG);
    const chargedActionEvents = events.filter((e) => e.entityKind === 'charged_action');
    expect(chargedActionEvents.length).toBe(1);
    expect(chargedActionEvents[0]!.entityId).toBe('ca1');
  });

  it('returns fewer than count events when the queue empties', () => {
    // One Charged Action triggers and is removed; no other entities remain.
    const state = makeGameState({
      chargedActions: [makeChargedAction({ id: 'ca1', speed: 50, ct: 0 })],
    });
    const events = projectUpcoming(state, 5, CATALOG);
    expect(events).toHaveLength(1);
    expect(events[0]!.entityId).toBe('ca1');
  });

  it('subtracts the assumed turn cost from actual CT, not from the threshold', () => {
    // A unit pushed past 100 (here simulated by setting ct=110) should land
    // at 10 after consuming a full turn — not at 0. Verifies the projection
    // models CT pushes correctly even though session 1 has no push primitive.
    const unit = makeUnit({ id: 'u1', spd: 10, ct: 110 });
    const state = makeGameState({ units: [unit] });
    const events = projectUpcoming(state, 2, CATALOG);
    // First trigger is immediate (ticksFromNow 0, actualCT 110).
    expect(events[0]).toMatchObject({ ticksFromNow: 0, actualCT: 110 });
    // After consuming 100 CT the unit sits at 10; (100-10)/10 = 9 ticks
    // to the next trigger. The 100 figure comes from the test ruleset's
    // ctCosts.moveAndAct (see catalog test fixtures).
    expect(events[1]).toMatchObject({ ticksFromNow: 9, actualCT: 100 });
  });

  it('is deterministic given identical state', () => {
    const build = () =>
      makeGameState({
        units: [
          makeUnit({ id: 'b', spd: 12, ct: 30 }),
          makeUnit({ id: 'a', spd: 8, ct: 50 }),
          makeUnit({ id: 'c', spd: 20, ct: 0 }),
        ],
        chargedActions: [makeChargedAction({ id: 'ca', speed: 15, ct: 25 })],
      });
    const r1 = projectUpcoming(build(), 8, CATALOG);
    const r2 = projectUpcoming(build(), 8, CATALOG);
    expect(r1).toEqual(r2);
  });

  it('does not mutate the input state', () => {
    const unit = makeUnit({ id: 'u1', spd: 10, ct: 30 });
    const ca = makeChargedAction({ id: 'ca1', speed: 5, ct: 60 });
    const state = makeGameState({ units: [unit], chargedActions: [ca] });
    projectUpcoming(state, 5, CATALOG);
    expect(unit.ct).toBe(30);
    expect(ca.ct).toBe(60);
    expect(state.chargedActions).toHaveLength(1);
  });
});
