// Training Field battle config sanity tests. These are guard-rails
// against accidental drift between demo.ts (the test fixture) and the
// runtime battle config that consumes its unit roster — and against
// staging units off-board on the 14×14 grid.

import { describe, expect, it } from 'vitest';
import { loadDefaultCatalog } from '@content/index.ts';
import { createInitialState } from '@engine/index.ts';
import { trainingField } from '../maps/training-field.ts';
import { demoBattle } from './demo.ts';
import { trainingFieldBattle } from './training-field-battle.ts';

describe('Training Field battle config', () => {
  it('uses the Training Field map', () => {
    expect(trainingFieldBattle.map).toBe(trainingField);
  });

  it('inherits the demo unit roster (same ids, same teams)', () => {
    expect(trainingFieldBattle.units.length).toBe(demoBattle.units.length);
    const demoIds = new Set(demoBattle.units.map((u) => u.id));
    const battleIds = new Set(trainingFieldBattle.units.map((u) => u.id));
    expect(battleIds).toEqual(demoIds);
    for (const unit of trainingFieldBattle.units) {
      const demoUnit = demoBattle.units.find((u) => u.id === unit.id);
      expect(demoUnit).toBeDefined();
      expect(unit.team).toBe(demoUnit!.team);
      expect(unit.classId).toBe(demoUnit!.classId);
    }
  });

  it('places every unit within the 14×14 board', () => {
    for (const unit of trainingFieldBattle.units) {
      expect(unit.position.x).toBeGreaterThanOrEqual(0);
      expect(unit.position.x).toBeLessThan(trainingField.width);
      expect(unit.position.y).toBeGreaterThanOrEqual(0);
      expect(unit.position.y).toBeLessThan(trainingField.height);
      expect(unit.position.layer).toBe(0);
    }
  });

  it('starting positions are unique (no two units share a tile)', () => {
    const seen = new Set<string>();
    for (const unit of trainingFieldBattle.units) {
      const key = `${unit.position.x},${unit.position.y},${unit.position.layer}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });

  it('initializes against the catalog without throwing', () => {
    // Catalog-driven createInitialState is the same path BattleView uses;
    // if any field on a derived unit is malformed (e.g. a position that
    // accidentally collided with a non-existent layer), this surfaces
    // it as a unit-test failure rather than a runtime crash.
    const catalog = loadDefaultCatalog();
    const state = createInitialState(trainingFieldBattle, catalog);
    expect(state.units.size).toBe(trainingFieldBattle.units.length);
    expect(state.map.width).toBe(14);
    expect(state.map.height).toBe(14);
  });
});
