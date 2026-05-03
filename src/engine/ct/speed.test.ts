import { unitId, type UnitId } from '../types/index.ts';
import { computeActionSpeed, computeSpeed } from './speed.ts';
import { emptyCatalog, makeChargedAction, makeGameState, makeUnit } from './test-fixtures.ts';

const CATALOG = emptyCatalog();

describe('computeSpeed', () => {
  it('returns the unit base Speed when no modifiers apply', () => {
    const unit = makeUnit({ id: 'u1', spd: 12 });
    const state = makeGameState({ units: [unit] });
    expect(computeSpeed(state, unit.id, CATALOG)).toBe(12);
  });

  it("floors a non-positive base Speed at the ruleset's speed floor (0)", () => {
    const unit = makeUnit({ id: 'u1', spd: -5 });
    const state = makeGameState({ units: [unit] });
    expect(computeSpeed(state, unit.id, CATALOG)).toBe(0);
  });

  it('throws UnknownEntityError for an unknown unit id', () => {
    const state = makeGameState({});
    const ghost: UnitId = unitId('does_not_exist');
    expect(() => computeSpeed(state, ghost, CATALOG)).toThrowError(/UnknownEntityError|No Unit/);
  });
});

describe('computeActionSpeed', () => {
  it('returns the stored Action Speed of the ChargedAction', () => {
    const action = makeChargedAction({ id: 'ca1', speed: 7 });
    const state = makeGameState({ chargedActions: [action] });
    expect(computeActionSpeed(state, action, CATALOG)).toBe(7);
  });

  it("floors a non-positive Action Speed at the ruleset's speed floor (0)", () => {
    const action = makeChargedAction({ id: 'ca1', speed: -3 });
    const state = makeGameState({ chargedActions: [action] });
    expect(computeActionSpeed(state, action, CATALOG)).toBe(0);
  });
});
