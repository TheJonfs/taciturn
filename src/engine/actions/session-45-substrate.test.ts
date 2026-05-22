// Session 45 substrate tests — the bow-weapon-class substrate that the
// Hunter builds on:
//
//   1. Height-delta variance: `physicalVariance: { kind: 'height_delta',
//      falloffPerHeight }` reads the target's tile elevation relative to
//      the attacker's and collapses to a single deterministic factor
//      `Max(0, 1 - falloffPerHeight × (targetHeight - attackerHeight))`.
//   2. Weapon-sourced range fork: a weapon that declares `range` overrides
//      the universal Attack's hardcoded melee 1 for weapon-tagged physical
//      attacks (min/max/vertical); non-weapon abilities ignore it.
//   3. Two-handed slotting: a two-handed weapon forbids any item in the
//      other hand (no shield, no second weapon).

import { describe, expect, it } from 'vitest';
import { createCatalog } from '../catalog/index.ts';
import { defaultTestRulesets } from '../catalog/test-fixtures.ts';
import { makeCommandSet, makeKnight, knightLoadout } from '../abilities/test-fixtures.ts';
import { activeTurnFor, makeGameState, makeUnit } from '../ct/test-fixtures.ts';
import { resolvePhysicalVarianceBand } from '../damage/handlers.ts';
import { computeAbilityRange } from './../abilities/range.ts';
import { BattleConfigError, createInitialState } from '../setup/create-initial-state.ts';
import { reduceUseAbility } from './reducers.ts';
import { validateAction } from './validate.ts';
import { flatMap } from '../map/test-fixtures.ts';
import {
  abilityId,
  bucketId,
  classId,
  itemId,
  teamId,
  unitId,
  type BattleConfig,
  type GameState,
  type Tile,
  type UnitEquipment,
  type UnitPlacement,
} from '../types/index.ts';
import type { ActiveAbilityDefinition, WeaponEquipment } from '../catalog/index.ts';

// A bow: two-handed, range 2-5 (vertical "infinite"), height-delta variance.
const testLongbow: WeaponEquipment = {
  id: itemId('test_longbow'),
  name: 'Test Longbow',
  availability: 'hidden',
  kind: 'weapon',
  wp: 7,
  accuracy: 33,
  tags: ['weapon'],
  twoHanded: true,
  range: { min: 2, max: 5, vertical: 99 },
  physicalVariance: { kind: 'height_delta', falloffPerHeight: 0.2 },
};

// A plain melee weapon — no range, no two-handed.
const testSword: WeaponEquipment = {
  id: itemId('test_sword'),
  name: 'Test Sword',
  availability: 'hidden',
  kind: 'weapon',
  wp: 5,
  accuracy: 95,
  tags: ['weapon', 'sword'],
};

// A weapon-tagged physical attack, like the universal Attack.
const weaponAttack: ActiveAbilityDefinition = {
  id: abilityId('attack_test'),
  name: 'Attack',
  kind: 'active',
  bucket: bucketId('first_action'),
  baseCost: 1,
  availability: 'hidden',
  targeting: { kind: 'single_unit', range: { horizontal: 1, vertical: 3 }, rangeMode: 'melee' },
  actionSpeed: 0,
  mpCost: 0,
  hitRoll: { accuracy: 100 },
  effects: { damage: { tags: ['physical', 'weapon'], power_coefficient: 1 } },
};

// A magical (non-weapon) ability — must ignore weapon range.
const spell: ActiveAbilityDefinition = {
  id: abilityId('spell_test'),
  name: 'Spell',
  kind: 'active',
  bucket: bucketId('first_action'),
  baseCost: 1,
  availability: 'hidden',
  targeting: { kind: 'unit_or_tile', range: { horizontal: 4, vertical: 2 }, rangeMode: 'arc' },
  actionSpeed: 0,
  mpCost: 10,
  effects: { damage: { tags: ['magical'], power_coefficient: 8 } },
};

function equipRight(id: string): UnitEquipment {
  return { leftHand: null, rightHand: itemId(id), headgear: null, armor: null, accessory: null };
}

// A 2-wide map where tile (0,0) sits at `aElev` and (1,0) at `bElev`.
function elevMap(aElev: number, bElev: number): GameState['map'] {
  const tile = (x: number, elevation: number): Tile => ({
    x,
    y: 0,
    layer: 0,
    elevation,
    terrain: 'ground',
    properties: [],
  });
  return { width: 2, height: 1, tiles: [tile(0, aElev), tile(1, bElev)] };
}

// ===========================================================================
// 1. Height-delta variance
// ===========================================================================

describe('Session 45 — height-delta variance', () => {
  const cat = createCatalog({
    statusTypes: [],
    abilities: [weaponAttack],
    commandSets: [],
    classes: [makeKnight()],
    items: [testLongbow, testSword],
    rulesets: defaultTestRulesets,
  });

  function bandFor(aElev: number, bElev: number): number {
    const attacker = makeUnit({ id: 'a', spd: 9, pa: 6, position: { x: 0, y: 0, layer: 0 }, equipment: equipRight('test_longbow') });
    const target = makeUnit({ id: 'b', spd: 9, position: { x: 1, y: 0, layer: 0 } });
    const state = makeGameState({ units: [attacker, target], map: elevMap(aElev, bElev) });
    const band = resolvePhysicalVarianceBand(state, cat, attacker, target, weaponAttack);
    expect(band.min).toBeCloseTo(band.max); // collapses to a point
    return band.min;
  }

  it('same elevation → 1.0', () => {
    expect(bandFor(0, 0)).toBeCloseTo(1.0);
  });

  it('target 3 above → 0.4', () => {
    expect(bandFor(0, 3)).toBeCloseTo(0.4);
  });

  it('target 4 above → 0.2', () => {
    expect(bandFor(0, 4)).toBeCloseTo(0.2);
  });

  it('target 5 above → 0 (clamped)', () => {
    expect(bandFor(0, 5)).toBeCloseTo(0);
  });

  it('target 7 above → 0 (clamp, no negative damage)', () => {
    expect(bandFor(0, 7)).toBe(0);
  });

  it('target 5 below → 2.0 (downhill bonus)', () => {
    expect(bandFor(5, 0)).toBeCloseTo(2.0);
  });

  it('a melee weapon without physicalVariance falls back to the ability band', () => {
    const attacker = makeUnit({ id: 'a', spd: 9, pa: 6, position: { x: 0, y: 0, layer: 0 }, equipment: equipRight('test_sword') });
    const target = makeUnit({ id: 'b', spd: 9, position: { x: 1, y: 0, layer: 0 } });
    const state = makeGameState({ units: [attacker, target], map: elevMap(0, 4) });
    const band = resolvePhysicalVarianceBand(state, cat, attacker, target, weaponAttack);
    // weaponAttack declares no `damage.variance` → fallback { 1, 1 }.
    expect(band).toEqual({ min: 1, max: 1 });
  });

  it('a magical ability ignores the bow band (physical-gated)', () => {
    const attacker = makeUnit({ id: 'a', spd: 9, pa: 6, position: { x: 0, y: 0, layer: 0 }, equipment: equipRight('test_longbow') });
    const target = makeUnit({ id: 'b', spd: 9, position: { x: 1, y: 0, layer: 0 } });
    const state = makeGameState({ units: [attacker, target], map: elevMap(0, 4) });
    const band = resolvePhysicalVarianceBand(state, cat, attacker, target, spell);
    expect(band).toEqual({ min: 1, max: 1 });
  });
});

// ===========================================================================
// 2. Weapon-sourced range fork
// ===========================================================================

describe('Session 45 — weapon-sourced range fork', () => {
  const cat = createCatalog({
    statusTypes: [],
    abilities: [weaponAttack, spell],
    commandSets: [],
    classes: [makeKnight()],
    items: [testLongbow, testSword],
    rulesets: defaultTestRulesets,
  });

  it('a bow lifts a weapon-tagged attack to its range (2-5, vertical 99)', () => {
    const attacker = makeUnit({ id: 'a', spd: 9, equipment: equipRight('test_longbow') });
    const state = makeGameState({ units: [attacker], map: flatMap(8, 8) });
    const view = computeAbilityRange(state, cat, attacker.id, weaponAttack);
    expect(view.horizontal).toBe(5);
    expect(view.minHorizontal).toBe(2);
    expect(view.vertical).toBe(99);
  });

  it('a melee weapon leaves the ability-declared range (horizontal 1, no floor)', () => {
    const attacker = makeUnit({ id: 'a', spd: 9, equipment: equipRight('test_sword') });
    const state = makeGameState({ units: [attacker], map: flatMap(8, 8) });
    const view = computeAbilityRange(state, cat, attacker.id, weaponAttack);
    expect(view.horizontal).toBe(1);
    expect(view.minHorizontal).toBeUndefined();
    expect(view.vertical).toBe(3);
  });

  it('a non-weapon (magical) ability ignores the equipped bow range', () => {
    const attacker = makeUnit({ id: 'a', spd: 9, equipment: equipRight('test_longbow') });
    const state = makeGameState({ units: [attacker], map: flatMap(8, 8) });
    const view = computeAbilityRange(state, cat, attacker.id, spell);
    expect(view.horizontal).toBe(4);
    expect(view.vertical).toBe(2);
  });
});

// ===========================================================================
// 3. Two-handed slotting
// ===========================================================================

describe('Session 45 — two-handed slotting', () => {
  const testShield = {
    id: itemId('test_shield'),
    name: 'Test Shield',
    availability: 'hidden' as const,
    kind: 'shield' as const,
  };
  const cat = createCatalog({
    statusTypes: [],
    abilities: [],
    commandSets: [makeCommandSet({ id: 'battle_skill' })],
    classes: [makeKnight()],
    items: [testLongbow, testSword, testShield],
    rulesets: defaultTestRulesets,
  });

  function configWith(equipment: UnitEquipment): BattleConfig {
    const placement: UnitPlacement = {
      id: unitId('u1'),
      name: 'u1',
      team: teamId('team_a'),
      classId: classId('knight'),
      position: { x: 0, y: 0, layer: 0 },
      facing: 'N',
      baseStats: { spd: 9, pa: 6, ma: 3, maxHpBase: 116, maxMpBase: 28, brave: 70, faith: 70, crit_chance: 0, crit_multiplier: 1 },
      vitals: { hp: 116, mp: 0 },
      loadout: knightLoadout(),
      equipment,
    };
    return {
      battleId: 'test',
      rulesetId: defaultTestRulesets[0]!.id,
      map: flatMap(5, 5),
      teams: [{ id: teamId('team_a'), name: 'A', control: 'human' }],
      units: [placement],
      victoryConditions: [{ kind: 'defeat_all', side: teamId('team_b'), description: 'd' }],
      masterSeed: 1,
    };
  }

  it('rejects a shield in the off-hand when the main hand is two-handed', () => {
    const equipment: UnitEquipment = {
      leftHand: itemId('test_shield'),
      rightHand: itemId('test_longbow'),
      headgear: null,
      armor: null,
      accessory: null,
    };
    expect(() => createInitialState(configWith(equipment), cat)).toThrow(BattleConfigError);
  });

  it('rejects a second weapon in the off-hand when the main hand is two-handed', () => {
    const equipment: UnitEquipment = {
      leftHand: itemId('test_sword'),
      rightHand: itemId('test_longbow'),
      headgear: null,
      armor: null,
      accessory: null,
    };
    expect(() => createInitialState(configWith(equipment), cat)).toThrow(BattleConfigError);
  });

  it('accepts a two-handed weapon alone (off-hand empty)', () => {
    const equipment: UnitEquipment = {
      leftHand: null,
      rightHand: itemId('test_longbow'),
      headgear: null,
      armor: null,
      accessory: null,
    };
    expect(() => createInitialState(configWith(equipment), cat)).not.toThrow();
  });
});

// ===========================================================================
// 4. Caster-reposition (Scramble) — selfMove ability effect
// ===========================================================================

describe('Session 45 — Scramble (selfMove) repositioning', () => {
  const scramble: ActiveAbilityDefinition = {
    id: abilityId('scramble_test'),
    name: 'Scramble',
    kind: 'active',
    bucket: bucketId('first_action'),
    baseCost: 1,
    availability: 'hidden',
    // Reach 1 tile, leap delta 5 — expressed entirely in the range.
    targeting: { kind: 'tile', range: { horizontal: 1, vertical: 5 }, rangeMode: 'melee' },
    actionSpeed: 0,
    mpCost: 0,
    effects: { selfMove: true },
  };
  const cat = createCatalog({
    statusTypes: [],
    abilities: [scramble],
    commandSets: [],
    classes: [makeKnight()], // canEnter: { ground }
    items: [],
    rulesets: defaultTestRulesets,
  });

  // A 2-wide map; tile (1,0) takes a configurable terrain + elevation.
  function mapWith(destTerrain: string, destElev: number): GameState['map'] {
    const tile = (x: number, terrain: string, elevation: number): Tile => ({
      x,
      y: 0,
      layer: 0,
      elevation,
      terrain,
      properties: [],
    });
    return { width: 2, height: 1, tiles: [tile(0, 'ground', 0), tile(1, destTerrain, destElev)] };
  }

  function scrambleAction(dest: { x: number; y: number; layer: number }) {
    return {
      type: 'use_ability' as const,
      source: 'player' as const,
      actorId: unitId('a'),
      payload: { abilityId: abilityId('scramble_test'), target: { kind: 'tile' as const, position: dest } },
      sequenceNumber: 0,
      seed: 1,
      timestamp: { tick: 0, ct: 0 },
      chainDepth: 0,
      isReaction: false,
    };
  }

  it('relocates the caster to the target tile and records the hop', () => {
    const actor = makeUnit({ id: 'a', spd: 9, position: { x: 0, y: 0, layer: 0 } });
    const state = makeGameState({ units: [actor], map: mapWith('ground', 0), turnState: activeTurnFor(actor.id) });
    const r = reduceUseAbility(state, scrambleAction({ x: 1, y: 0, layer: 0 }), cat);
    expect(r.newState.units.get(unitId('a'))?.position).toEqual({ x: 1, y: 0, layer: 0 });
    expect(r.outcome.casterMove?.path).toEqual([
      { x: 0, y: 0, layer: 0 },
      { x: 1, y: 0, layer: 0 },
    ]);
  });

  it('validates a clear adjacent ground tile', () => {
    const actor = makeUnit({ id: 'a', spd: 9, position: { x: 0, y: 0, layer: 0 } });
    const state = makeGameState({ units: [actor], map: mapWith('ground', 0), turnState: activeTurnFor(actor.id) });
    expect(validateAction(state, scrambleAction({ x: 1, y: 0, layer: 0 }), cat).valid).toBe(true);
  });

  it('leaps onto a 5-elevation cliff (relaxed jump beyond class jump 2)', () => {
    const actor = makeUnit({ id: 'a', spd: 9, position: { x: 0, y: 0, layer: 0 } });
    const state = makeGameState({ units: [actor], map: mapWith('ground', 5), turnState: activeTurnFor(actor.id) });
    expect(validateAction(state, scrambleAction({ x: 1, y: 0, layer: 0 }), cat).valid).toBe(true);
  });

  it('rejects a leap beyond the jump-delta cap (6 > 5)', () => {
    const actor = makeUnit({ id: 'a', spd: 9, position: { x: 0, y: 0, layer: 0 } });
    const state = makeGameState({ units: [actor], map: mapWith('ground', 6), turnState: activeTurnFor(actor.id) });
    expect(validateAction(state, scrambleAction({ x: 1, y: 0, layer: 0 }), cat).valid).toBe(false);
  });

  it('rejects landing on non-enterable terrain', () => {
    const actor = makeUnit({ id: 'a', spd: 9, position: { x: 0, y: 0, layer: 0 } });
    const state = makeGameState({ units: [actor], map: mapWith('wall', 0), turnState: activeTurnFor(actor.id) });
    expect(validateAction(state, scrambleAction({ x: 1, y: 0, layer: 0 }), cat).valid).toBe(false);
  });

  it('rejects landing on an occupied tile', () => {
    const actor = makeUnit({ id: 'a', spd: 9, position: { x: 0, y: 0, layer: 0 } });
    const blocker = makeUnit({ id: 'b', spd: 9, team: 'team_b', position: { x: 1, y: 0, layer: 0 } });
    const state = makeGameState({ units: [actor, blocker], map: mapWith('ground', 0), turnState: activeTurnFor(actor.id) });
    expect(validateAction(state, scrambleAction({ x: 1, y: 0, layer: 0 }), cat).valid).toBe(false);
  });
});
