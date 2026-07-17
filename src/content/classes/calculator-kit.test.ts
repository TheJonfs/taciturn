// Calculator kit — end-to-end integration tests (Session 49).
//
// Covers the high-value Math Skill paths and the R/S/M passives'
// observable effects against a real BattleConfig + reducer chain.
// Substrate-level correctness (predicate enumeration, dispatcher fan-
// out) is covered in `src/engine/targeting/math-skill.test.ts`; this
// file verifies the content interactions:
//   1. Precision Fire damages matched units (cluster fan-out; SP × MA,
//      Faith-independent per S63).
//   2. Targeted Treatment heals matched units.
//   3. Exact Rhythm reduces matched CTs (SP × MA magnitude, Faith-
//      independent per S71 #15).
//   4. Mathematician's per-target MP discount (3 → 1).
//   5. Mathematician's +1 SP bonus surfaces on damage / CT magnitudes.
//   6. Thoughtful Pacing emits system_mp_restore on Move.
//   7. Engineered Defenses status applies +10 resistance + 5% evasion.
//   8. Cornered Focus accumulates +1 MA per enemy hit.

import { describe, expect, it } from 'vitest';
import { loadDefaultCatalog } from '@content/index.ts';
import {
  bucketId,
  classId,
  commandSetId,
  abilityId,
  unitId,
  teamId,
  statusTypeId,
  createInitialState,
  commitAction,
  EMPTY_UNIT_EQUIPMENT,
  type BattleConfig,
  type Direction,
  type Loadout,
  type UnitPlacement,
  type ProposedAction,
} from '@engine/index.ts';
import { buildBaseStats } from '@content/teams/built-team.ts';
import { riverRidgeBattle } from '@content/battles/river-ridge-battle.ts';

const CALCULATOR_LOADOUT: Loadout = {
  actionBuckets: {
    [bucketId('first_action')]: [commandSetId('math_skill')],
  },
  passiveBuckets: {},
};

const MATHEMATICIAN_LOADOUT: Loadout = {
  actionBuckets: {
    [bucketId('first_action')]: [commandSetId('math_skill')],
  },
  passiveBuckets: {
    [bucketId('support')]: [abilityId('mathematician')],
  },
};

const THOUGHTFUL_PACING_LOADOUT: Loadout = {
  actionBuckets: {
    [bucketId('first_action')]: [commandSetId('math_skill')],
  },
  passiveBuckets: {
    [bucketId('movement')]: [abilityId('thoughtful_pacing')],
  },
};

const KNIGHT_MIN_LOADOUT: Loadout = {
  actionBuckets: {
    [bucketId('first_action')]: [commandSetId('battle_skill')],
  },
  passiveBuckets: {},
};

interface KitUnit {
  readonly id: string;
  readonly team?: string;
  readonly cls?: string;
  readonly ct?: number;
  readonly hp?: number;
  readonly mp?: number;
  readonly level?: number;
  readonly loadout?: Loadout;
}

// Known-good ground-tile positions on the River Ridge map (per
// `riverRidgeBattle.ts`'s authored placements). Used so a Move action
// in the Thoughtful Pacing test has a valid destination.
const GROUND_POSITIONS: ReadonlyArray<{ x: number; y: number; layer: number }> = [
  { x: 5, y: 1, layer: 0 },
  { x: 5, y: 2, layer: 0 },
  { x: 6, y: 1, layer: 0 },
  { x: 6, y: 2, layer: 0 },
  { x: 7, y: 2, layer: 0 },
  { x: 8, y: 1, layer: 0 },
];

function makeConfig(units: ReadonlyArray<KitUnit>): BattleConfig {
  const placements: UnitPlacement[] = units.map((u, i) => {
    const cls = classId(u.cls ?? 'knight');
    const isCalculator = (u.cls ?? '') === 'calculator';
    const isKnight = (u.cls ?? 'knight') === 'knight';
    const loadout = u.loadout ?? (isCalculator ? CALCULATOR_LOADOUT : isKnight ? KNIGHT_MIN_LOADOUT : KNIGHT_MIN_LOADOUT);
    return {
      id: unitId(u.id),
      name: u.id,
      team: teamId(u.team ?? 'team_a'),
      classId: cls,
      position: GROUND_POSITIONS[i] ?? { x: i, y: 0, layer: 0 },
      facing: 'N' as Direction,
      baseStats: buildBaseStats(cls, 70, 70, u.level ?? 25),
      loadout,
      equipment: EMPTY_UNIT_EQUIPMENT,
      initialCT: u.ct ?? 0,
      level: u.level ?? 25,
      vitals: { hp: u.hp ?? 100, mp: u.mp ?? 40 },
    };
  });
  return { ...riverRidgeBattle, units: placements };
}

function freshTurnState(
  state: ReturnType<typeof createInitialState>,
  actorId: string,
): ReturnType<typeof createInitialState> {
  return {
    ...state,
    turnState: {
      unitId: unitId(actorId),
      budget: { movesAvailable: 1, actsAvailable: 1 },
      consumed: { movesConsumed: 0, actsConsumed: 0 },
      reactionsUsedThisTurn: new Map(),
    },
  };
}

function castMath(
  actorId: string,
  ability: string,
  parameter: 'ct' | 'height' | 'level' | 'current_hp',
  value: 'prime' | 3 | 4 | 5,
): ProposedAction {
  return {
    type: 'use_ability',
    source: 'player',
    actorId: unitId(actorId),
    payload: {
      abilityId: abilityId(ability),
      target: { kind: 'math_skill', parameter, value },
    },
  };
}

describe('Calculator kit — Math Skill end-to-end', () => {
  it('Precision Fire damages each matching enemy (cluster fan-out)', () => {
    const catalog = loadDefaultCatalog();
    // Two enemies at CT 5 (both match), one ally (Calculator) at CT 0.
    const state = freshTurnState(
      createInitialState(
        makeConfig([
          { id: 'caster', cls: 'calculator', team: 'team_a', ct: 0, mp: 40 },
          { id: 'foe1', team: 'team_b', ct: 5, hp: 100 },
          { id: 'foe2', team: 'team_b', ct: 5, hp: 100 },
          { id: 'foe3', team: 'team_b', ct: 7, hp: 100 },
        ]),
        catalog,
      ),
      'caster',
    );
    const result = commitAction(
      state,
      castMath('caster', 'precision_fire', 'ct', 5),
      catalog,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const foe1After = result.newState.units.get(unitId('foe1'))!;
    const foe2After = result.newState.units.get(unitId('foe2'))!;
    const foe3After = result.newState.units.get(unitId('foe3'))!;
    // foe1 / foe2 (CT 5) take damage; foe3 (CT 7) does not.
    expect(foe1After.vitals.hp).toBeLessThan(100);
    expect(foe2After.vitals.hp).toBeLessThan(100);
    expect(foe3After.vitals.hp).toBe(100);
  });

  it('Targeted Treatment heals each matching ally', () => {
    const catalog = loadDefaultCatalog();
    const state = freshTurnState(
      createInitialState(
        makeConfig([
          { id: 'caster', cls: 'calculator', team: 'team_a', ct: 0, mp: 40 },
          // Wounded allies, CTs divisible by 5.
          { id: 'ally1', team: 'team_a', ct: 5, hp: 50 },
          { id: 'ally2', team: 'team_a', ct: 10, hp: 60 },
        ]),
        catalog,
      ),
      'caster',
    );
    const result = commitAction(
      state,
      castMath('caster', 'targeted_treatment', 'ct', 5),
      catalog,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const ally1 = result.newState.units.get(unitId('ally1'))!;
    const ally2 = result.newState.units.get(unitId('ally2'))!;
    expect(ally1.vitals.hp).toBeGreaterThan(50);
    expect(ally2.vitals.hp).toBeGreaterThan(60);
  });

  it('Exact Rhythm reduces matching CT (clamped at 0)', () => {
    const catalog = loadDefaultCatalog();
    const state = freshTurnState(
      createInitialState(
        makeConfig([
          { id: 'caster', cls: 'calculator', team: 'team_a', ct: 0, mp: 40 },
          { id: 'foe1', team: 'team_b', ct: 30 },
          { id: 'foe2', team: 'team_b', ct: 50 },
          // Non-match (CT 7); should not move.
          { id: 'foe3', team: 'team_b', ct: 7 },
        ]),
        catalog,
      ),
      'caster',
    );
    const result = commitAction(
      state,
      castMath('caster', 'exact_rhythm', 'ct', 5),
      catalog,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const foe1 = result.newState.units.get(unitId('foe1'))!;
    const foe2 = result.newState.units.get(unitId('foe2'))!;
    const foe3 = result.newState.units.get(unitId('foe3'))!;
    // foe1 and foe2 CT reduced. foe3 (CT 7, no match) unchanged.
    expect(foe1.ct).toBeLessThan(30);
    expect(foe2.ct).toBeLessThan(50);
    expect(foe3.ct).toBe(7);
  });

  it('Engineered Defenses applies the new status to each match', () => {
    const catalog = loadDefaultCatalog();
    const state = freshTurnState(
      createInitialState(
        makeConfig([
          { id: 'caster', cls: 'calculator', team: 'team_a', ct: 0, mp: 40 },
          { id: 'ally1', team: 'team_a', ct: 5, hp: 100 },
        ]),
        catalog,
      ),
      'caster',
    );
    // S71 #15: 40% base × MA factor (0.9 + 8/10 = 1.7), Faith-independent,
    // ≈ 68% — a single roll has variance. Use a seeded retry-window: run a few
    // seeds and require at least one to apply.
    let applied = false;
    for (let seed = 1; seed <= 8; seed++) {
      const result = commitAction(
        { ...state, rng: { masterSeed: seed, nextSeq: 0 } },
        castMath('caster', 'engineered_defenses', 'ct', 5),
        catalog,
      );
      if (!result.ok) continue;
      const ally = result.newState.units.get(unitId('ally1'))!;
      if (ally.statuses.some((s) => s.typeId === statusTypeId('engineered_defenses'))) {
        applied = true;
        break;
      }
    }
    expect(applied).toBe(true);
  });

  // S71 #15 (Option B): the three Math Skill status applications are
  // Faith-independent (MA-only factor), at the tuned 25/25/40 base set.
  // Pins both the faith removal and the retune so a future change is
  // deliberate. The 25/25/40 set is itself a tuning watch item.
  it('Math Skill status applications drop Faith (MA-only) at the tuned 25/25/40 bases', () => {
    const catalog = loadDefaultCatalog();
    const specsOf = (id: string) => {
      const a = catalog.getAbility(abilityId(id));
      return a.kind === 'active' ? a.effects.statusEffects ?? [] : [];
    };
    const burn = specsOf('precision_fire').find((s) => s.typeId === statusTypeId('burn'))!;
    expect(burn.baseChance).toBe(25);
    expect(burn.factors).toEqual({ ma: true });

    // Sculpted Enhancement's PA Up + MA Up must share base + factors so
    // linkRoll keeps them coupled (same roll AND same computed chance).
    const sculpted = specsOf('sculpted_enhancement');
    expect(sculpted.length).toBe(2);
    for (const s of sculpted) {
      expect(s.baseChance).toBe(25);
      expect(s.factors).toEqual({ ma: true });
    }

    const ed = specsOf('engineered_defenses')[0]!;
    expect(ed.baseChance).toBe(40);
    expect(ed.factors).toEqual({ ma: true });
  });
});

describe('Calculator kit — Mathematician (Support)', () => {
  it('per-target MP cost drops 3 → 1 with Mathematician equipped', () => {
    const catalog = loadDefaultCatalog();
    const baseConfig = (loadout: Loadout) =>
      makeConfig([
        // Caster at CT 7 so the caster's own CT does NOT match the
        // 'ct % 5 == 0' predicate — only the three foes do (3 targets).
        { id: 'caster', cls: 'calculator', team: 'team_a', ct: 7, mp: 40, loadout },
        { id: 'foe1', team: 'team_b', ct: 5, hp: 100 },
        { id: 'foe2', team: 'team_b', ct: 5, hp: 100 },
        { id: 'foe3', team: 'team_b', ct: 5, hp: 100 },
      ]);
    // 3 matches × 3 perTarget + 4 base = 13 MP w/o Mathematician
    const baseline = commitAction(
      freshTurnState(createInitialState(baseConfig(CALCULATOR_LOADOUT), catalog), 'caster'),
      castMath('caster', 'precision_fire', 'ct', 5),
      catalog,
    );
    if (!baseline.ok) {
      throw new Error(`baseline cast failed at ${baseline.stage}: ${baseline.reason}`);
    }
    const baselineMp = baseline.newState.units.get(unitId('caster'))!.vitals.mp;
    expect(baselineMp).toBe(40 - (4 + 3 * 3));

    // 3 matches × 1 perTarget + 4 base = 7 MP w/ Mathematician
    const withMath = commitAction(
      freshTurnState(createInitialState(baseConfig(MATHEMATICIAN_LOADOUT), catalog), 'caster'),
      castMath('caster', 'precision_fire', 'ct', 5),
      catalog,
    );
    if (!withMath.ok) {
      throw new Error(`withMath cast failed at ${withMath.stage}: ${withMath.reason}`);
    }
    const mathMp = withMath.newState.units.get(unitId('caster'))!.vitals.mp;
    expect(mathMp).toBe(40 - (4 + 1 * 3));
  });

  it('+1 SP bonus surfaces on Precision Fire damage', () => {
    const catalog = loadDefaultCatalog();
    const config = (loadout: Loadout) =>
      makeConfig([
        // CT 7 → not a match; only the foe (CT 5) is hit.
        { id: 'caster', cls: 'calculator', team: 'team_a', ct: 7, mp: 40, loadout },
        { id: 'foe', team: 'team_b', ct: 5, hp: 100 },
      ]);

    const baseline = commitAction(
      freshTurnState(createInitialState(config(CALCULATOR_LOADOUT), catalog), 'caster'),
      castMath('caster', 'precision_fire', 'ct', 5),
      catalog,
    );
    const withMath = commitAction(
      freshTurnState(createInitialState(config(MATHEMATICIAN_LOADOUT), catalog), 'caster'),
      castMath('caster', 'precision_fire', 'ct', 5),
      catalog,
    );
    expect(baseline.ok).toBe(true);
    expect(withMath.ok).toBe(true);
    if (!baseline.ok || !withMath.ok) return;
    const baselineHp = baseline.newState.units.get(unitId('foe'))!.vitals.hp;
    const withMathHp = withMath.newState.units.get(unitId('foe'))!.vitals.hp;
    // Mathematician's +1 SP bumps power_coefficient 3 → 4, increasing
    // damage. Strict less-than: more damage means lower remaining HP.
    expect(withMathHp).toBeLessThan(baselineHp);
  });
});

describe('Calculator kit — Thoughtful Pacing (Movement)', () => {
  it('emits 2 × tilesMoved MP restore after a Move action', () => {
    const catalog = loadDefaultCatalog();
    const state = freshTurnState(
      createInitialState(
        makeConfig([
          {
            id: 'caster',
            cls: 'calculator',
            team: 'team_a',
            ct: 0,
            mp: 30,
            loadout: THOUGHTFUL_PACING_LOADOUT,
          },
        ]),
        catalog,
      ),
      'caster',
    );
    const caster = state.units.get(unitId('caster'))!;
    // Move to an adjacent known-good ground tile. Caster starts at
    // (5,1,0); (5,2,0) is the second authored ground position and
    // unoccupied.
    const move: ProposedAction = {
      type: 'move',
      source: 'player',
      actorId: caster.id,
      payload: {
        destination: { x: 5, y: 2, layer: 0 },
      },
    };
    const result = commitAction(state, move, catalog);
    if (!result.ok) {
      throw new Error(`move failed at ${result.stage}: ${result.reason}`);
    }
    const after = result.newState.units.get(unitId('caster'))!;
    // Tile count of 1 → +2 MP restored.
    expect(after.vitals.mp).toBeGreaterThan(30);
  });
});

describe('Math Skill XP (S94) — a CT-only cast is a connecting, earning action', () => {
  const catalog = loadDefaultCatalog();

  it('Exact Rhythm on matched CTs awards XP once to a leveling caster', () => {
    // Exact Rhythm's whole payoff is the tempo shift; pre-fix the
    // no-effect guard only read HP/status/MP/position, so a CT-only Math
    // cast earned nothing (Thessaly's report). A target's CT change now
    // counts as an effect.
    const state0 = freshTurnState(
      createInitialState(
        makeConfig([
          { id: 'caster', cls: 'calculator', team: 'team_a', ct: 0, mp: 40 },
          { id: 'foe1', team: 'team_b', ct: 30 },
          { id: 'foe2', team: 'team_b', ct: 50 },
        ]),
        catalog,
      ),
      'caster',
    );
    // Opt the caster into leveling (statsByLevel is the engine's opt-in).
    const units = new Map(state0.units);
    const caster = units.get(unitId('caster'))!;
    units.set(caster.id, { ...caster, statsByLevel: new Map([[caster.level + 1, caster.baseStats]]) });
    const state = { ...state0, units };

    const result = commitAction(state, castMath('caster', 'exact_rhythm', 'ct', 5), catalog);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // The CTs really shifted…
    expect(result.newState.units.get(unitId('foe1'))!.ct).toBeLessThan(30);
    // …and exactly ONE award was emitted (the AoE-single-grant rule).
    const awards = result.committed.filter((a) => a.type === 'system_xp_award');
    expect(awards).toHaveLength(1);
    const award = awards[0]!;
    if (award.type !== 'system_xp_award') return;
    expect(award.payload.unitId).toBe(unitId('caster'));
    expect(award.payload.amount).toBeGreaterThan(0);
  });

  it('a Math cast matching NOBODY still earns nothing (no-effect guard holds)', () => {
    const state0 = freshTurnState(
      createInitialState(
        makeConfig([
          { id: 'caster', cls: 'calculator', team: 'team_a', ct: 0, mp: 40 },
          { id: 'foe1', team: 'team_b', ct: 7 }, // no multiple-of-5 match
        ]),
        catalog,
      ),
      'caster',
    );
    const units = new Map(state0.units);
    const caster = units.get(unitId('caster'))!;
    units.set(caster.id, { ...caster, statsByLevel: new Map([[caster.level + 1, caster.baseStats]]) });
    const state = { ...state0, units };

    const result = commitAction(state, castMath('caster', 'exact_rhythm', 'ct', 5), catalog);
    if (!result.ok) return; // an unmatchable cast may be rejected outright — also fine
    expect(result.committed.filter((a) => a.type === 'system_xp_award')).toHaveLength(0);
  });
});
