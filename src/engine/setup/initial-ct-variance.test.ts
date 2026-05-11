// Tests for the speed-based + variance initial-CT formula.
// See `engine/types/ruleset.ts` (`RulesetInitialCT`) and
// `engine/setup/create-initial-state.ts` (`resolveInitialCT`).

import { knightLoadout } from '../abilities/test-fixtures.ts';
import { createCatalog, type Catalog } from '../catalog/index.ts';
import { makeKnight } from '../abilities/test-fixtures.ts';
import { makeTestRuleset } from '../catalog/test-fixtures.ts';
import { flatMap } from '../map/test-fixtures.ts';
import {
  classId,
  commandSetId,
  rulesetId,
  teamId,
  unitId,
  type BattleConfig,
  type RulesetInitialCT,
  type UnitPlacement,
} from '../types/index.ts';
import { createInitialState } from './create-initial-state.ts';

function placement(args: {
  readonly id: string;
  readonly spd?: number;
  readonly team?: string;
}): UnitPlacement {
  return {
    id: unitId(args.id),
    name: args.id,
    team: teamId(args.team ?? 'team_a'),
    classId: classId('knight'),
    position: { x: 0, y: 0, layer: 0 },
    facing: 'N',
    baseStats: { spd: args.spd ?? 10, pa: 5, ma: 4, maxHpBase: 100, brave: 100, faith: 80, crit_chance: 0, crit_multiplier: 1 },
    vitals: { hp: 100, mp: 0 },
    loadout: knightLoadout(),
  };
}

function makeCatalog(initialCT: RulesetInitialCT): Catalog {
  const ruleset = {
    ...makeTestRuleset(),
    initialCT,
  };
  return createCatalog({
    statusTypes: [],
    abilities: [],
    commandSets: [{ id: commandSetId('battle_skill'), name: 'BS', members: [], baseCost: 1, availability: 'hidden' }],
    classes: [makeKnight()],
    items: [],
    rulesets: [ruleset],
  });
}

function configOf(args: {
  readonly units: ReadonlyArray<UnitPlacement>;
  readonly masterSeed?: number;
}): BattleConfig {
  return {
    battleId: 'b',
    rulesetId: rulesetId('default'),
    map: flatMap(3, 3),
    teams: [
      { id: teamId('team_a'), name: 'A' },
      { id: teamId('team_b'), name: 'B' },
    ],
    units: args.units,
    victoryConditions: [
      { kind: 'defeat_all', side: teamId('team_b'), description: 'defeat enemies' },
    ],
    masterSeed: args.masterSeed ?? 42,
  };
}

describe('initialCT — fixed (existing variant unchanged)', () => {
  it('every unit starts at the named value', () => {
    const cat = makeCatalog({ kind: 'fixed', value: 7 });
    const state = createInitialState(
      configOf({
        units: [placement({ id: 'a' }), placement({ id: 'b', spd: 20 })],
      }),
      cat,
    );
    expect(state.units.get(unitId('a'))!.ct).toBe(7);
    expect(state.units.get(unitId('b'))!.ct).toBe(7);
  });
});

describe('initialCT — speed_with_variance', () => {
  it('faster unit lands with higher initial CT in expectation', () => {
    // Speed differential is large enough that the variance band can't
    // flip the order. spd=30 base = 150 (clamped to 99); spd=10 base
    // = 50; with ±10 variance the slow unit can't exceed the fast.
    const cat = makeCatalog({
      kind: 'speed_with_variance',
      speedFactor: 5,
      variancePct: 20,
    });
    const state = createInitialState(
      configOf({
        units: [
          placement({ id: 'fast', spd: 30 }),
          placement({ id: 'slow', spd: 10 }),
        ],
      }),
      cat,
    );
    const fast = state.units.get(unitId('fast'))!.ct;
    const slow = state.units.get(unitId('slow'))!.ct;
    expect(fast).toBeGreaterThan(slow);
  });

  it('determinism: same masterSeed + same unit id always produce the same CT', () => {
    const cat = makeCatalog({
      kind: 'speed_with_variance',
      speedFactor: 5,
      variancePct: 20,
    });
    const cfg = configOf({
      units: [placement({ id: 'a', spd: 12 })],
      masterSeed: 1234,
    });
    const s1 = createInitialState(cfg, cat);
    const s2 = createInitialState(cfg, cat);
    expect(s1.units.get(unitId('a'))!.ct).toBe(s2.units.get(unitId('a'))!.ct);
  });

  it('different seeds produce different CT (variance is real)', () => {
    const cat = makeCatalog({
      kind: 'speed_with_variance',
      speedFactor: 5,
      variancePct: 20,
    });
    const seeds = [1, 2, 3, 5, 8, 13, 21, 34];
    const results = new Set(
      seeds.map((seed) => {
        const state = createInitialState(
          configOf({ units: [placement({ id: 'a', spd: 12 })], masterSeed: seed }),
          cat,
        );
        return state.units.get(unitId('a'))!.ct;
      }),
    );
    expect(results.size).toBeGreaterThan(1);
  });

  it('two units with identical Speed land at different CT (per-unit-stable variance)', () => {
    const cat = makeCatalog({
      kind: 'speed_with_variance',
      speedFactor: 5,
      variancePct: 20,
    });
    const state = createInitialState(
      configOf({
        units: [
          placement({ id: 'twin_a', spd: 12 }),
          placement({ id: 'twin_b', spd: 12 }),
        ],
      }),
      cat,
    );
    const a = state.units.get(unitId('twin_a'))!.ct;
    const b = state.units.get(unitId('twin_b'))!.ct;
    expect(a).not.toBe(b);
  });

  it('caps below the trigger threshold (no unit starts pre-triggered)', () => {
    // High-Speed unit + high speedFactor → base would exceed 100; the
    // formula clamps below the threshold.
    const cat = makeCatalog({
      kind: 'speed_with_variance',
      speedFactor: 50, // 50 × 12 = 600 unclamped
      variancePct: 20,
    });
    const state = createInitialState(
      configOf({ units: [placement({ id: 'a', spd: 12 })] }),
      cat,
    );
    const ct = state.units.get(unitId('a'))!.ct;
    expect(ct).toBeLessThan(100);
    expect(ct).toBeGreaterThanOrEqual(0);
  });

  it('per-placement initialCT override still wins over the formula', () => {
    const cat = makeCatalog({
      kind: 'speed_with_variance',
      speedFactor: 5,
      variancePct: 20,
    });
    const state = createInitialState(
      configOf({
        units: [{ ...placement({ id: 'a', spd: 12 }), initialCT: 42 }],
      }),
      cat,
    );
    expect(state.units.get(unitId('a'))!.ct).toBe(42);
  });
});

describe('initialCT — uniform_int (ADR-0050)', () => {
  it('every produced CT is within [min, max] inclusive', () => {
    const cat = makeCatalog({ kind: 'uniform_int', min: 0, max: 20 });
    // Many seeds × many ids — sampling the distribution.
    for (let seed = 1; seed <= 30; seed++) {
      const state = createInitialState(
        configOf({
          units: [
            placement({ id: `u${seed}_a`, spd: 10 }),
            placement({ id: `u${seed}_b`, spd: 10 }),
            placement({ id: `u${seed}_c`, spd: 10 }),
          ],
          masterSeed: seed,
        }),
        cat,
      );
      for (const unit of state.units.values()) {
        expect(unit.ct).toBeGreaterThanOrEqual(0);
        expect(unit.ct).toBeLessThanOrEqual(20);
      }
    }
  });

  it('determinism: same masterSeed + same unit id always produce the same CT', () => {
    const cat = makeCatalog({ kind: 'uniform_int', min: 0, max: 20 });
    const cfg = configOf({
      units: [placement({ id: 'a', spd: 10 })],
      masterSeed: 0xC0DE,
    });
    const s1 = createInitialState(cfg, cat);
    const s2 = createInitialState(cfg, cat);
    expect(s1.units.get(unitId('a'))!.ct).toBe(s2.units.get(unitId('a'))!.ct);
  });

  it('speed-independent: two units with very different Speed roll the same range', () => {
    // Speed differential would dominate `speed_with_variance` ordering; under
    // `uniform_int` the slow unit can roll above the fast one.
    const cat = makeCatalog({ kind: 'uniform_int', min: 0, max: 20 });
    // Sweep seeds; check that at least one seed produces slow.ct > fast.ct.
    let flipped = false;
    for (let seed = 1; seed <= 40; seed++) {
      const state = createInitialState(
        configOf({
          units: [
            placement({ id: 'slow', spd: 5 }),
            placement({ id: 'fast', spd: 30 }),
          ],
          masterSeed: seed,
        }),
        cat,
      );
      const slow = state.units.get(unitId('slow'))!.ct;
      const fast = state.units.get(unitId('fast'))!.ct;
      if (slow > fast) {
        flipped = true;
        break;
      }
    }
    expect(flipped).toBe(true);
  });

  it('two units with identical Speed land at different CT in expectation', () => {
    const cat = makeCatalog({ kind: 'uniform_int', min: 0, max: 20 });
    // Per-unit-stable variance — most seeds yield distinct CT per unit.
    let distinct = false;
    for (let seed = 1; seed <= 20; seed++) {
      const state = createInitialState(
        configOf({
          units: [
            placement({ id: 'twin_a', spd: 10 }),
            placement({ id: 'twin_b', spd: 10 }),
          ],
          masterSeed: seed,
        }),
        cat,
      );
      const a = state.units.get(unitId('twin_a'))!.ct;
      const b = state.units.get(unitId('twin_b'))!.ct;
      if (a !== b) {
        distinct = true;
        break;
      }
    }
    expect(distinct).toBe(true);
  });

  it('per-placement initialCT override still wins over the formula', () => {
    const cat = makeCatalog({ kind: 'uniform_int', min: 0, max: 20 });
    const state = createInitialState(
      configOf({
        units: [{ ...placement({ id: 'a', spd: 12 }), initialCT: 99 }],
      }),
      cat,
    );
    expect(state.units.get(unitId('a'))!.ct).toBe(99);
  });
});
