// Tests for createInitialState — the BattleConfig → GameState
// constructor that battles instantiate from.

import {
  knightLoadout,
  makeAbilitiesCatalog,
  makeKnight,
} from '../abilities/test-fixtures.ts';
import { makeTestRuleset } from '../catalog/test-fixtures.ts';
import { createCatalog } from '../catalog/index.ts';
import { flatMap } from '../map/test-fixtures.ts';
import {
  abilityId,
  bucketId,
  classId,
  commandSetId,
  rulesetId,
  teamId,
  unitId,
  type BattleConfig,
  type Loadout,
  type UnitPlacement,
} from '../types/index.ts';
import { BattleConfigError, createInitialState } from './create-initial-state.ts';

function placementOf(overrides: {
  readonly id: string;
  readonly team?: string;
  readonly classId?: string;
  readonly position?: { readonly x: number; readonly y: number; readonly layer: number };
  readonly initialCT?: number;
  readonly loadout?: Loadout;
}): UnitPlacement {
  return {
    id: unitId(overrides.id),
    name: overrides.id,
    team: teamId(overrides.team ?? 'team_a'),
    classId: classId(overrides.classId ?? 'knight'),
    position: overrides.position ?? { x: 0, y: 0, layer: 0 },
    facing: 'N',
    baseStats: { spd: 10, pa: 5, ma: 4, maxHpBase: 100, maxMpBase: 50, brave: 100, faith: 80, crit_chance: 0, crit_multiplier: 1 },
    vitals: { hp: 100, mp: 0 },
    loadout: overrides.loadout ?? knightLoadout(),
    ...(overrides.initialCT !== undefined ? { initialCT: overrides.initialCT } : {}),
  };
}

function configOf(overrides: {
  readonly units?: ReadonlyArray<UnitPlacement>;
  readonly teams?: ReadonlyArray<string>;
  readonly rulesetId?: string;
  readonly masterSeed?: number;
}): BattleConfig {
  return {
    battleId: 'test-battle',
    rulesetId: rulesetId(overrides.rulesetId ?? 'default'),
    map: flatMap(5, 5),
    teams: (overrides.teams ?? ['team_a']).map((id) => ({ id: teamId(id), name: id })),
    units: overrides.units ?? [placementOf({ id: 'u1' })],
    victoryConditions: [
      { kind: 'defeat_all', side: teamId('team_b'), description: 'defeat enemies' },
    ],
    masterSeed: overrides.masterSeed ?? 42,
  };
}

describe('createInitialState — basics', () => {
  it('produces a GameState with units indexed by id', () => {
    const cat = makeAbilitiesCatalog({});
    const cfg = configOf({
      units: [placementOf({ id: 'a' }), placementOf({ id: 'b' })],
    });
    const state = createInitialState(cfg, cat);
    expect(state.units.size).toBe(2);
    expect(state.units.get(unitId('a'))?.name).toBe('a');
    expect(state.units.get(unitId('b'))?.name).toBe('b');
  });

  it('carries the BattleConfig fields onto the state envelope', () => {
    const cat = makeAbilitiesCatalog({});
    const cfg = configOf({});
    const state = createInitialState(cfg, cat);
    expect(state.battleId).toBe('test-battle');
    expect(state.ruleset.id).toBe(rulesetId('default'));
    expect(state.tick).toBe(0);
    expect(state.actionLog).toEqual([]);
    expect(state.chargedActions).toEqual([]);
    expect(state.rng).toEqual({ masterSeed: 42, nextSeq: 0 });
  });

  it('seeds initial CT from the ruleset when no per-unit override is given', () => {
    // Default ruleset uses { kind: 'fixed', value: 0 }.
    const cat = makeAbilitiesCatalog({});
    const cfg = configOf({});
    const state = createInitialState(cfg, cat);
    const u = state.units.get(unitId('u1'))!;
    expect(u.ct).toBe(0);
  });

  it("seeds initial CT from a non-zero ruleset 'fixed' value", () => {
    const ruleset = makeTestRuleset();
    // Replace initialCT to be non-zero.
    const customRuleset = { ...ruleset, initialCT: { kind: 'fixed' as const, value: 50 } };
    const cat = createCatalog({
      statusTypes: [],
      abilities: [],
      // Knight's first_action pins to battle_skill; the catalog must
      // carry it to satisfy the validator.
      commandSets: [{ id: commandSetId('battle_skill'), name: 'Battle Skill', members: [], baseCost: 1, availability: 'hidden' }],
      classes: [makeKnight()],
      items: [],
      rulesets: [customRuleset],
    });
    const cfg = configOf({});
    const state = createInitialState(cfg, cat);
    expect(state.units.get(unitId('u1'))!.ct).toBe(50);
  });

  it('honors a per-placement initialCT override over the ruleset formula', () => {
    const cat = makeAbilitiesCatalog({});
    const cfg = configOf({
      units: [placementOf({ id: 'preCharged', initialCT: 80 })],
    });
    const state = createInitialState(cfg, cat);
    expect(state.units.get(unitId('preCharged'))!.ct).toBe(80);
  });
});

describe('createInitialState — validation', () => {
  it('throws BattleConfigError on duplicate unit ids', () => {
    const cat = makeAbilitiesCatalog({});
    const cfg = configOf({
      units: [placementOf({ id: 'a' }), placementOf({ id: 'a' })],
    });
    expect(() => createInitialState(cfg, cat)).toThrow(BattleConfigError);
    expect(() => createInitialState(cfg, cat)).toThrow(/duplicate/i);
  });

  it('throws BattleConfigError when a unit references an undeclared team', () => {
    const cat = makeAbilitiesCatalog({});
    const cfg = configOf({
      units: [placementOf({ id: 'u1', team: 'team_phantom' })],
      teams: ['team_a'],
    });
    expect(() => createInitialState(cfg, cat)).toThrow(BattleConfigError);
    expect(() => createInitialState(cfg, cat)).toThrow(/team/i);
  });

  it('throws BattleConfigError when a unit references a class not in the catalog', () => {
    const cat = makeAbilitiesCatalog({});
    const cfg = configOf({
      units: [placementOf({ id: 'u1', classId: 'wizard' })],
    });
    expect(() => createInitialState(cfg, cat)).toThrow(BattleConfigError);
    expect(() => createInitialState(cfg, cat)).toThrow(/class/i);
  });

  it('throws when a unit references an unknown ruleset', () => {
    const cat = makeAbilitiesCatalog({});
    const cfg = configOf({ rulesetId: 'phantom' });
    // The catalog throws UnknownDefinitionError; we let it bubble (the
    // setup function does not wrap it, since a missing ruleset id is
    // a programmer-error path matching ADR-0002).
    expect(() => createInitialState(cfg, cat)).toThrow();
  });

  it('throws BattleConfigError when a unit has an invalid loadout', () => {
    // A passive ability registered to bucket 'support' equipped under
    // 'movement' — wrong_bucket violation.
    const passive = {
      id: abilityId('helpful_thing'),
      name: 'Helpful Thing',
      kind: 'passive' as const,
      bucket: bucketId('support'),
      baseCost: 1,
      availability: 'hidden' as const,
      hooks: [],
    };
    const cat = createCatalog({
      statusTypes: [],
      abilities: [passive],
      commandSets: [{ id: commandSetId('battle_skill'), name: 'Battle Skill', members: [], baseCost: 1, availability: 'hidden' }],
      classes: [makeKnight()],
      items: [],
      rulesets: [makeTestRuleset()],
    });
    const placement = placementOf({
      id: 'u1',
      loadout: knightLoadout({
        passive: [[bucketId('movement'), [abilityId('helpful_thing')]]],
      }),
    });
    const cfg = configOf({ units: [placement] });
    expect(() => createInitialState(cfg, cat)).toThrow(BattleConfigError);
    expect(() => createInitialState(cfg, cat)).toThrow(/loadout/i);
  });

  it('throws BattleConfigError when first_action does not match the class pin', () => {
    const cat = makeAbilitiesCatalog({});
    const placement = placementOf({
      id: 'u1',
      // Empty loadout violates the pin: Knight.firstActionCommandSet
      // is 'battle_skill' but EMPTY_LOADOUT has no first_action.
      loadout: { actionBuckets: {}, passiveBuckets: {} },
    });
    const cfg = configOf({ units: [placement] });
    expect(() => createInitialState(cfg, cat)).toThrow(BattleConfigError);
    expect(() => createInitialState(cfg, cat)).toThrow(/first_action_pin/i);
  });
});

describe('createInitialState — determinism', () => {
  it('produces equivalent states from equivalent configs', () => {
    const cat = makeAbilitiesCatalog({});
    const build = () => createInitialState(configOf({}), cat);
    const s1 = build();
    const s2 = build();
    expect(s1.battleId).toBe(s2.battleId);
    expect(s1.units.size).toBe(s2.units.size);
    expect(s1.rng).toEqual(s2.rng);
  });
});
