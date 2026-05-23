// Tests for projectDamageRange.

import { describe, expect, it } from 'vitest';
import {
  abilityId,
  bucketId,
  classId,
  commandSetId,
  createCatalog,
  itemId,
  type ActiveAbilityDefinition,
  type ClassDefinition,
  type GameState,
} from '../index.ts';
import { loadDefaultCatalog } from '../../content/index.ts';
import {
  DEFAULT_TEST_DAMAGE_PIPELINE,
  makeTestRuleset,
} from '../catalog/test-fixtures.ts';
import { makeGameState, makeUnit } from '../ct/test-fixtures.ts';
import { projectDamageRange } from './damage-range.ts';

function knightClass(): ClassDefinition {
  return {
    id: classId('knight'),
    name: 'Knight',
    movement: { moveRange: 3, jump: 2, terrainCosts: new Map(), canEnter: new Set(['ground']) },
    evasion: { front: 0, side: 0, back: 0 },
    equipmentSlots: { leftHand: true, rightHand: true, headgear: true, armor: true, accessory: true },
    firstActionCommandSet: commandSetId('battle_skill'),
    freeAbilities: new Set(),
  };
}

function ability(opts: {
  readonly power_coefficient?: number;
  readonly variance?: { readonly min: number; readonly max: number };
}): ActiveAbilityDefinition {
  return {
    id: abilityId('attack'),
    name: 'Attack',
    kind: 'active',
    bucket: bucketId('first_action'),
    baseCost: 1,
    availability: 'hidden',
    targeting: { kind: 'single_unit', range: { horizontal: 1, vertical: 3 }, rangeMode: 'melee' },
    actionSpeed: 0,
    mpCost: 0,
    effects: {
      damage: {
        tags: ['physical'],
        power_coefficient: opts.power_coefficient ?? 4,
        ...(opts.variance !== undefined ? { variance: opts.variance } : {}),
      },
    },
  };
}

function makeCatalog(ab: ActiveAbilityDefinition) {
  return createCatalog({
    statusTypes: [],
    abilities: [ab],
    commandSets: [],
    classes: [knightClass()],
    items: [],
    rulesets: [makeTestRuleset({ damagePipelineStages: DEFAULT_TEST_DAMAGE_PIPELINE })],
  });
}

describe('projectDamageRange', () => {
  it('collapses to a single value when variance is flat (no variance band)', () => {
    const attack = ability({ power_coefficient: 4 });
    const attacker = makeUnit({ id: 'a', spd: 10, pa: 5 });
    const target = makeUnit({ id: 'b', spd: 10, hp: 100 });
    const cat = makeCatalog(attack);
    const state = makeGameState({ units: [attacker, target] });
    const r = projectDamageRange({ state, catalog: cat, attacker, target, ability: attack });
    expect(r.min).toBe(20);
    expect(r.expected).toBe(20);
    expect(r.max).toBe(20);
  });

  it('returns the variance band as min/expected/max with expected at midpoint', () => {
    const attack = ability({ power_coefficient: 4, variance: { min: 0.5, max: 1.5 } });
    const attacker = makeUnit({ id: 'a', spd: 10, pa: 5 });
    const target = makeUnit({ id: 'b', spd: 10, hp: 100 });
    const cat = makeCatalog(attack);
    const state = makeGameState({ units: [attacker, target] });
    const r = projectDamageRange({ state, catalog: cat, attacker, target, ability: attack });
    // Base 20 → min 0.5×=10, expected 1.0×=20, max 1.5×=30.
    expect(r.min).toBe(10);
    expect(r.expected).toBe(20);
    expect(r.max).toBe(30);
  });

  it('reflects a weapon Speed-based variance band, not the ability static band (S42 fix)', () => {
    // Knives use `attacker_speed` variance: band center = Speed/10. The
    // forecast must resolve THAT band, not the attack ability's static
    // [0.9, 1.1] — otherwise a fast knife wielder's damage is badly
    // under-projected (the playtest report: forecast ~17-21, hits ~30s).
    const cat = loadDefaultCatalog();
    const sai = { leftHand: null, rightHand: itemId('sai'), headgear: null, armor: null, accessory: null };
    const attack = cat.getAbility(abilityId('attack')) as ActiveAbilityDefinition;
    const mk = (spd: number) =>
      makeUnit({ id: 'a', spd, pa: 5, classId: 'assassin', position: { x: 0, y: 0, layer: 0 }, equipment: sai });
    // Target faces away (front = east) so the west attacker lands a 0-evasion
    // back hit — keeps the hit-chance multiplier constant across Speeds.
    const target = makeUnit({ id: 'b', spd: 8, hp: 400, maxHpBase: 400, classId: 'assassin', facing: 'E', position: { x: 1, y: 0, layer: 0 } });
    const mp = (spd: number) => {
      const attacker = mk(spd);
      return projectDamageRange({ state: makeGameState({ units: [attacker, target] }), catalog: cat, attacker, target, ability: attack });
    };
    const r16 = mp(16);
    const r10 = mp(10);
    // Expected scales with the Speed-band center (16/10 = 1.6), not pinned
    // to the ability's ~1.0 midpoint. Ratio is hit-chance / PA / WP
    // independent, so it isolates the band.
    expect(r16.expected / r10.expected).toBeGreaterThan(1.45);
    expect(r16.expected / r10.expected).toBeLessThan(1.75);
    // The Speed-16 band [1.55, 1.65] is a tight spread → min/max bracket
    // expected closely (and well above the old static-band projection).
    expect(r16.min).toBeLessThan(r16.expected);
    expect(r16.max).toBeGreaterThan(r16.expected);
    expect(r16.max / r16.min).toBeLessThan(1.2);
  });

  it('reflects bow height_delta variance — shooting downhill multiplies the projection (S46 fix)', () => {
    // Hunter (PA 6) with Longbow (WP 7) shooting a target on a lower tile.
    // Longbow's `physicalVariance` is `height_delta` with falloffPerHeight
    // 0.2 → shooting 5 tiles down → factor max(0, 1 - 0.2 × -5) = 2.0.
    // Expected projected damage: 6 × 7 × 1.0 × 2.0 = 84. Pre-S46 the
    // pinned-1 escape hatch in `projectionVarianceRoll` quietly skipped
    // the resolver on the midpoint path, leaving the expected at ×1.0.
    const cat = loadDefaultCatalog();
    const attack = cat.getAbility(abilityId('attack')) as ActiveAbilityDefinition;
    const longbow = { leftHand: null, rightHand: itemId('longbow'), headgear: null, armor: null, accessory: null };
    const attacker = makeUnit({
      id: 'hunter', spd: 9, pa: 6, classId: 'hunter',
      position: { x: 0, y: 0, layer: 0 },
      equipment: longbow,
    });
    const target = makeUnit({
      id: 'target', spd: 9, classId: 'knight', maxHpBase: 200, hp: 200,
      // Place target far enough away to be inside bow range; back-facing
      // to keep evasion neutral (though noEvasion now drops the multiplier).
      facing: 'N',
      position: { x: 4, y: 0, layer: 0 },
    });
    const map: GameState['map'] = {
      width: 5,
      height: 5,
      tiles: [
        { x: 0, y: 0, layer: 0, elevation: 5, terrain: 'ground', properties: [] },
        { x: 4, y: 0, layer: 0, elevation: 0, terrain: 'ground', properties: [] },
      ],
    };
    const state = makeGameState({ units: [attacker, target], map });
    const r = projectDamageRange({ state, catalog: cat, attacker, target, ability: attack });
    // Base 42 × variance 2.0 = 84. Variance is deterministic (single
    // point) so min/expected/max all collapse to 84.
    expect(r.min).toBe(84);
    expect(r.expected).toBe(84);
    expect(r.max).toBe(84);
  });

  it('reflects bow height_delta variance — shooting at the same elevation projects ×1.0', () => {
    const cat = loadDefaultCatalog();
    const attack = cat.getAbility(abilityId('attack')) as ActiveAbilityDefinition;
    const longbow = { leftHand: null, rightHand: itemId('longbow'), headgear: null, armor: null, accessory: null };
    const attacker = makeUnit({
      id: 'hunter', spd: 9, pa: 6, classId: 'hunter',
      position: { x: 0, y: 0, layer: 0 },
      equipment: longbow,
    });
    const target = makeUnit({
      id: 'target', spd: 9, classId: 'knight', maxHpBase: 200, hp: 200,
      position: { x: 4, y: 0, layer: 0 },
    });
    const map: GameState['map'] = {
      width: 5, height: 5,
      tiles: [
        { x: 0, y: 0, layer: 0, elevation: 0, terrain: 'ground', properties: [] },
        { x: 4, y: 0, layer: 0, elevation: 0, terrain: 'ground', properties: [] },
      ],
    };
    const state = makeGameState({ units: [attacker, target], map });
    const r = projectDamageRange({ state, catalog: cat, attacker, target, ability: attack });
    expect(r.expected).toBe(42); // 6 × 7 × 1.0
  });

  it('reflects bow height_delta variance — shooting 5+ tiles uphill projects 0', () => {
    const cat = loadDefaultCatalog();
    const attack = cat.getAbility(abilityId('attack')) as ActiveAbilityDefinition;
    const longbow = { leftHand: null, rightHand: itemId('longbow'), headgear: null, armor: null, accessory: null };
    const attacker = makeUnit({
      id: 'hunter', spd: 9, pa: 6, classId: 'hunter',
      position: { x: 0, y: 0, layer: 0 },
      equipment: longbow,
    });
    const target = makeUnit({
      id: 'target', spd: 9, classId: 'knight', maxHpBase: 200, hp: 200,
      position: { x: 4, y: 0, layer: 0 },
    });
    const map: GameState['map'] = {
      width: 5, height: 5,
      tiles: [
        { x: 0, y: 0, layer: 0, elevation: 0, terrain: 'ground', properties: [] },
        { x: 4, y: 0, layer: 0, elevation: 5, terrain: 'ground', properties: [] },
      ],
    };
    const state = makeGameState({ units: [attacker, target], map });
    const r = projectDamageRange({ state, catalog: cat, attacker, target, ability: attack });
    expect(r.expected).toBe(0);
  });

  it('damage range excludes hit chance — bow with low-accuracy weapon projects raw damage (S46 fix)', () => {
    // Pre-S46 the projection folded hit_chance into the damage multipliers,
    // so a Longbow's 33% accuracy produced a damage range that was
    // pre-multiplied by ~0.33. The forecast panel separately displays hit
    // chance, so this double-counted visually. Post-fix, the damage range
    // is the raw variance-only projection; the panel's hit-chance row
    // shows accuracy as its own number.
    const cat = loadDefaultCatalog();
    const attack = cat.getAbility(abilityId('attack')) as ActiveAbilityDefinition;
    const longbow = { leftHand: null, rightHand: itemId('longbow'), headgear: null, armor: null, accessory: null };
    const attacker = makeUnit({
      id: 'hunter', spd: 9, pa: 6, classId: 'hunter',
      position: { x: 0, y: 0, layer: 0 },
      equipment: longbow,
    });
    // Target facing toward attacker — front evasion lookup. Knight has
    // 0/0/0 evasion in v1, so the multiplier would be 33% × 1.0 × 1.0 =
    // 0.33 if hit chance were folded in. We assert it's NOT folded in.
    const target = makeUnit({
      id: 'target', spd: 9, classId: 'knight', maxHpBase: 200, hp: 200,
      position: { x: 4, y: 0, layer: 0 },
      facing: 'W',
    });
    const map: GameState['map'] = {
      width: 5, height: 5,
      tiles: [
        { x: 0, y: 0, layer: 0, elevation: 0, terrain: 'ground', properties: [] },
        { x: 4, y: 0, layer: 0, elevation: 0, terrain: 'ground', properties: [] },
      ],
    };
    const state = makeGameState({ units: [attacker, target], map });
    const r = projectDamageRange({ state, catalog: cat, attacker, target, ability: attack });
    // Raw 6 × 7 × 1.0 = 42. If hit chance (33%) were folded in, it would
    // be ~14. Anything between 14 and 42 indicates partial folding.
    expect(r.expected).toBe(42);
  });

  it('returns zero range for an ability without a damage spec', () => {
    const debuff: ActiveAbilityDefinition = {
      id: abilityId('debuff'),
      name: 'Debuff',
      kind: 'active',
      bucket: bucketId('first_action'),
      baseCost: 1,
      availability: 'hidden',
      targeting: { kind: 'single_unit', range: { horizontal: 4, vertical: 3 }, rangeMode: 'arc' },
      actionSpeed: 0,
      mpCost: 6,
      effects: {},
    };
    const attacker = makeUnit({ id: 'a', spd: 10 });
    const target = makeUnit({ id: 'b', spd: 10, hp: 100 });
    const cat = makeCatalog(debuff);
    const state = makeGameState({ units: [attacker, target] });
    const r = projectDamageRange({ state, catalog: cat, attacker, target, ability: debuff });
    expect(r).toEqual({ min: 0, expected: 0, max: 0, regime: 'damage' });
  });
});
