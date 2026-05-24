// Math Skill targeting predicate tests (Session 49 / ADR-0086).
//
// Coverage: isPrime helper, per-unit predicate evaluation against each
// (parameter, value) pair, and the enumerator's filtering (KO'd /
// removed exclusion) + stable ordering.

import { describe, expect, it } from 'vitest';
import { loadDefaultCatalog } from '@content/index.ts';
import {
  createInitialState,
  teamId,
  unitId,
  classId,
  EMPTY_UNIT_EQUIPMENT,
} from '@engine/index.ts';
import {
  enumerateMathSkillTargets,
  isPrime,
  unitMatchesMathSkill,
} from './math-skill.ts';
import type {
  BattleConfig,
  Direction,
  Loadout,
  MathSkillParameter,
  MathSkillValue,
  Position,
  UnitPlacement,
} from '@engine/index.ts';
import { buildBaseStats } from '@content/teams/built-team.ts';
import { riverRidgeBattle } from '@content/battles/river-ridge-battle.ts';
import { bucketId, commandSetId } from '@engine/index.ts';

// Knight's first_action is pinned to 'battle_skill' — supply the
// minimum loadout createInitialState's validateLoadout accepts.
const KNIGHT_MIN_LOADOUT: Loadout = {
  actionBuckets: {
    [bucketId('first_action')]: [commandSetId('battle_skill')],
  },
  passiveBuckets: {},
};

describe('isPrime', () => {
  it('rejects non-positive and non-integer inputs', () => {
    expect(isPrime(0)).toBe(false);
    expect(isPrime(1)).toBe(false);
    expect(isPrime(-7)).toBe(false);
    expect(isPrime(2.5)).toBe(false);
    expect(isPrime(NaN)).toBe(false);
    expect(isPrime(Infinity)).toBe(false);
  });

  it('accepts the small primes', () => {
    expect(isPrime(2)).toBe(true);
    expect(isPrime(3)).toBe(true);
    expect(isPrime(5)).toBe(true);
    expect(isPrime(7)).toBe(true);
    expect(isPrime(11)).toBe(true);
    expect(isPrime(13)).toBe(true);
    expect(isPrime(17)).toBe(true);
    expect(isPrime(19)).toBe(true);
    expect(isPrime(23)).toBe(true);
    expect(isPrime(29)).toBe(true);
  });

  it('rejects small composites', () => {
    expect(isPrime(4)).toBe(false);
    expect(isPrime(6)).toBe(false);
    expect(isPrime(8)).toBe(false);
    expect(isPrime(9)).toBe(false);
    expect(isPrime(15)).toBe(false);
    expect(isPrime(25)).toBe(false);
    expect(isPrime(27)).toBe(false);
  });

  it('handles larger numbers correctly (across the v1 parameter ranges)', () => {
    // L23-L27 covers level range; HP can hit triple digits.
    expect(isPrime(101)).toBe(true);
    expect(isPrime(127)).toBe(true);
    expect(isPrime(100)).toBe(false);
    expect(isPrime(144)).toBe(false);
  });
});

// Build a 5-unit battle config with controllable CT / HP / Level /
// position-elevation so the predicate tests can target each parameter.
// `template` is one of the existing battle configs (River Ridge) loaded
// to give us a real map; we replace its team_a placements with the test
// configuration.
function makeBattleConfig(units: ReadonlyArray<TestUnit>): BattleConfig {
  // Use river-ridge's map shape so the predicate tests inherit a real
  // map (the elevation parameter would need a multi-elevation map; v1
  // uses ground tiles all at the same elevation, which suits the
  // ct/level/current_hp parameter coverage here).
  const placements: UnitPlacement[] = units.map((u, i) => ({
    id: unitId(u.id),
    name: u.id,
    team: teamId(u.team ?? 'team_a'),
    classId: classId(u.cls ?? 'knight'),
    position: u.position ?? { x: i, y: 0, layer: 0 },
    facing: (u.facing ?? 'N') as Direction,
    baseStats: buildBaseStats(
      classId(u.cls ?? 'knight'),
      70,
      70,
      u.level ?? 25,
    ),
    loadout: KNIGHT_MIN_LOADOUT,
    equipment: EMPTY_UNIT_EQUIPMENT,
    initialCT: u.ct ?? 0,
    level: u.level ?? 25,
    vitals: { hp: u.hp ?? 100, mp: 0 },
  }));
  return { ...riverRidgeBattle, units: placements };
}

interface TestUnit {
  readonly id: string;
  readonly team?: string;
  readonly cls?: string;
  readonly position?: Position;
  readonly facing?: string;
  readonly ct?: number;
  readonly level?: number;
  readonly hp?: number;
}

function matchedIds(
  state: ReturnType<typeof createInitialState>,
  parameter: MathSkillParameter,
  value: MathSkillValue,
): ReadonlyArray<string> {
  return enumerateMathSkillTargets(state, parameter, value).map((u) => String(u.id));
}

describe('unitMatchesMathSkill', () => {
  it('CT divisible by 5: a unit at CT 25 matches; CT 27 does not', () => {
    const catalog = loadDefaultCatalog();
    const state = createInitialState(
      makeBattleConfig([{ id: 'a', ct: 25 }, { id: 'b', ct: 27 }]),
      catalog,
    );
    const a = state.units.get(unitId('a'))!;
    const b = state.units.get(unitId('b'))!;
    expect(unitMatchesMathSkill(state, a, 'ct', 5)).toBe(true);
    expect(unitMatchesMathSkill(state, b, 'ct', 5)).toBe(false);
  });

  it('Level prime: L23 matches; L25 does not (25 = 5×5)', () => {
    const catalog = loadDefaultCatalog();
    const state = createInitialState(
      makeBattleConfig([
        { id: 'a', level: 23 },
        { id: 'b', level: 25 },
      ]),
      catalog,
    );
    const a = state.units.get(unitId('a'))!;
    const b = state.units.get(unitId('b'))!;
    expect(unitMatchesMathSkill(state, a, 'level', 'prime')).toBe(true);
    expect(unitMatchesMathSkill(state, b, 'level', 'prime')).toBe(false);
  });

  it('current_hp divisible by 4: HP 100 matches; HP 99 does not', () => {
    const catalog = loadDefaultCatalog();
    const state = createInitialState(
      makeBattleConfig([
        { id: 'a', hp: 100 },
        { id: 'b', hp: 99 },
      ]),
      catalog,
    );
    const a = state.units.get(unitId('a'))!;
    const b = state.units.get(unitId('b'))!;
    expect(unitMatchesMathSkill(state, a, 'current_hp', 4)).toBe(true);
    expect(unitMatchesMathSkill(state, b, 'current_hp', 4)).toBe(false);
  });
});

describe('enumerateMathSkillTargets', () => {
  it('returns matching units sorted by id', () => {
    const catalog = loadDefaultCatalog();
    const state = createInitialState(
      makeBattleConfig([
        { id: 'zeta', ct: 15 },
        { id: 'alpha', ct: 15 },
        { id: 'mu', ct: 15 },
        { id: 'beta', ct: 14 },
      ]),
      catalog,
    );
    expect(matchedIds(state, 'ct', 5)).toEqual(['alpha', 'mu', 'zeta']);
  });

  it("excludes KO'd units (vitals.hp <= 0)", () => {
    const catalog = loadDefaultCatalog();
    const state = createInitialState(
      makeBattleConfig([
        { id: 'alive', hp: 100, ct: 5 },
        { id: 'kod', hp: 0, ct: 5 },
      ]),
      catalog,
    );
    expect(matchedIds(state, 'ct', 5)).toEqual(['alive']);
  });

  it('empty match set is valid (no enemies on the predicate)', () => {
    const catalog = loadDefaultCatalog();
    const state = createInitialState(
      makeBattleConfig([
        { id: 'a', ct: 7 },
        { id: 'b', ct: 13 },
      ]),
      catalog,
    );
    expect(matchedIds(state, 'ct', 5)).toEqual([]);
  });

  it('self-targets when the caster matches their own predicate', () => {
    const catalog = loadDefaultCatalog();
    const state = createInitialState(
      makeBattleConfig([
        { id: 'caster', level: 25 },
        { id: 'foe', level: 24 },
      ]),
      catalog,
    );
    // L25 → divisible by 5; caster is included.
    expect(matchedIds(state, 'level', 5)).toEqual(['caster']);
  });

  it('Prime selection finds prime CTs across the team', () => {
    const catalog = loadDefaultCatalog();
    const state = createInitialState(
      makeBattleConfig([
        { id: 'a', ct: 2 },
        { id: 'b', ct: 3 },
        { id: 'c', ct: 5 },
        { id: 'd', ct: 4 },
        { id: 'e', ct: 6 },
      ]),
      catalog,
    );
    expect(matchedIds(state, 'ct', 'prime')).toEqual(['a', 'b', 'c']);
  });

  it('Level by 3 (slot-based: L24 / L27 / L21 all divisible by 3)', () => {
    const catalog = loadDefaultCatalog();
    const state = createInitialState(
      makeBattleConfig([
        { id: 'a', level: 24 }, // 24 % 3 == 0
        { id: 'b', level: 25 }, // no
        { id: 'c', level: 27 }, // yes
        { id: 'd', level: 23 }, // no
      ]),
      catalog,
    );
    expect(matchedIds(state, 'level', 3)).toEqual(['a', 'c']);
  });
});
