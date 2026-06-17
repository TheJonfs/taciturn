// Session 68 — per-swing weapon consistency (bug fix).
//
// Before S68, the damage pipeline read WP from the *swinging* slot
// (`attackingWeaponSlot`, S42) but read accuracy (`evasionCheck`) and the
// variance band (`resolvePhysicalVarianceBand`) from the *dominant*
// (right-hand) weapon. For matched dual-wield pairs (two axes / two
// knives / two swords) the two agree, so it was invisible — but a mixed
// pair let a dual-wielder launder the off-hand weapon's WP through the
// right-hand weapon's accuracy and variance (e.g. right-hand Sai's 95%
// accuracy + Speed-variance applied to a left-hand War Axe's WP 12).
//
// The fix routes accuracy and variance through `getSwingWeapon(slot)` so
// each swing is internally consistent. These tests pin that: the
// off-hand swing reads its OWN accuracy and variance, not the dominant
// weapon's.

import { describe, expect, it } from 'vitest';
import { createCatalog } from '../catalog/index.ts';
import {
  DEFAULT_TEST_DAMAGE_PIPELINE,
  makeTestRuleset,
} from '../catalog/test-fixtures.ts';
import { makeKnight } from '../abilities/test-fixtures.ts';
import { makeGameState, makeUnit } from '../ct/test-fixtures.ts';
import { runDamagePipeline } from '../damage/pipeline.ts';
import { resolvePhysicalVarianceBand } from '../damage/handlers.ts';
import { defaultDamageHandlers } from '../damage/default-handlers.ts';
import {
  abilityId,
  bucketId,
  itemId,
  type UnitEquipment,
} from '../types/index.ts';
import type {
  ActiveAbilityDefinition,
  WeaponEquipment,
  WeaponPhysicalVariance,
} from '../catalog/index.ts';

function makeWeapon(args: {
  readonly id: string;
  readonly wp: number;
  readonly accuracy: number;
  readonly variance?: WeaponPhysicalVariance;
}): WeaponEquipment {
  return {
    id: itemId(args.id),
    name: args.id,
    availability: 'available',
    kind: 'weapon',
    weaponType: 'sword',
    wp: args.wp,
    accuracy: args.accuracy,
    tags: ['sword'],
    ...(args.variance !== undefined ? { physicalVariance: args.variance } : {}),
  };
}

// A weapon-tagged physical attack with a hit roll, so WP / accuracy /
// variance all read from the wielder's weapon.
const physAttack: ActiveAbilityDefinition = {
  id: abilityId('phys_swing_test'),
  name: 'Swing',
  kind: 'active',
  bucket: bucketId('first_action'),
  baseCost: 1,
  availability: 'hidden',
  targeting: { kind: 'single_unit', range: { horizontal: 1, vertical: 1 }, rangeMode: 'melee' },
  actionSpeed: 0,
  mpCost: 0,
  hitRoll: {},
  effects: { damage: { tags: ['physical', 'weapon'], power_coefficient: 1 } },
};

function dualWield(rightId: string, leftId: string): UnitEquipment {
  return {
    leftHand: itemId(leftId),
    rightHand: itemId(rightId),
    headgear: null,
    armor: null,
    accessory: null,
  };
}

describe('Session 68 per-swing variance', () => {
  // Right hand = knife-style speed variance (center = Speed/10); left hand
  // = static [0.9, 1.3]. Each swing must resolve its own band.
  function setup() {
    const right = makeWeapon({
      id: 'right_speed_knife',
      wp: 4,
      accuracy: 95,
      variance: { kind: 'attacker_speed', spread: 0.05 },
    });
    const left = makeWeapon({
      id: 'left_static_axe',
      wp: 12,
      accuracy: 75,
      variance: { kind: 'static', min: 0.9, max: 1.3 },
    });
    const cat = createCatalog({
      statusTypes: [],
      abilities: [physAttack],
      commandSets: [],
      classes: [makeKnight()],
      items: [right, left],
      rulesets: [makeTestRuleset({ damagePipelineStages: DEFAULT_TEST_DAMAGE_PIPELINE })],
    });
    const attacker = makeUnit({
      id: 'a',
      spd: 10, // knife center = 10/10 = 1.0 → band [0.95, 1.05]
      equipment: dualWield('right_speed_knife', 'left_static_axe'),
    });
    const target = makeUnit({ id: 'b', spd: 10, hp: 200, maxHpBase: 200 });
    const state = makeGameState({ units: [attacker, target] });
    return { state, cat, attacker, target };
  }

  it('the off-hand (left) swing uses the LEFT weapon’s variance band, not the dominant right’s', () => {
    const { state, cat, attacker, target } = setup();
    const band = resolvePhysicalVarianceBand(state, cat, attacker, target, physAttack, 'leftHand');
    expect(band).toEqual({ min: 0.9, max: 1.3 }); // the static axe band
  });

  it('the right (dominant) swing uses the knife’s Speed band', () => {
    const { state, cat, attacker, target } = setup();
    const band = resolvePhysicalVarianceBand(state, cat, attacker, target, physAttack, 'rightHand');
    expect(band).toEqual({ min: 0.95, max: 1.05 }); // Speed 10 → center 1.0 ± 0.05
  });

  it('no slot (forecast / single-swing) falls back to the dominant weapon (right knife) — unchanged', () => {
    const { state, cat, attacker, target } = setup();
    const band = resolvePhysicalVarianceBand(state, cat, attacker, target, physAttack);
    expect(band).toEqual({ min: 0.95, max: 1.05 });
  });
});

describe('Session 68 per-swing accuracy', () => {
  // Right hand 95% accuracy, left hand 75%; identical WP, no variance, so
  // each swing's only difference is its own accuracy. Empirical hit rate
  // over a fixed seed sweep must track the SWING weapon, not the dominant.
  function hitRate(slot: 'leftHand' | 'rightHand'): number {
    const right = makeWeapon({ id: 'right_hi_acc', wp: 5, accuracy: 95 });
    const left = makeWeapon({ id: 'left_lo_acc', wp: 5, accuracy: 75 });
    const cat = createCatalog({
      statusTypes: [],
      abilities: [physAttack],
      commandSets: [],
      classes: [makeKnight()],
      items: [right, left],
      rulesets: [makeTestRuleset({ damagePipelineStages: DEFAULT_TEST_DAMAGE_PIPELINE })],
    });
    const attacker = makeUnit({ id: 'a', spd: 10, pa: 5, equipment: dualWield('right_hi_acc', 'left_lo_acc') });
    const target = makeUnit({ id: 'b', spd: 10, hp: 9999, maxHpBase: 9999 }); // never dies during the sweep
    const state = makeGameState({ units: [attacker, target] });
    const N = 400;
    let hits = 0;
    for (let seed = 1; seed <= N; seed++) {
      const dmg =
        runDamagePipeline({
          state,
          catalog: cat,
          attacker,
          target,
          ability: physAttack,
          sourceActionSeq: 0,
          seed,
          registry: defaultDamageHandlers,
          attackingWeaponSlot: slot,
        }).finalDamage ?? 0;
      if (dmg > 0) hits++;
    }
    return hits / N;
  }

  it('the right swing lands at ~95% (its own accuracy)', () => {
    const rate = hitRate('rightHand');
    expect(rate).toBeGreaterThan(0.9);
  });

  it('the off-hand (left) swing lands at ~75% (its own accuracy), NOT the dominant 95%', () => {
    const rate = hitRate('leftHand');
    // Pre-fix this read the right-hand 95% and would sit ~0.95. Post-fix
    // it tracks the left weapon's 75%. Generous band around 0.75.
    expect(rate).toBeGreaterThan(0.65);
    expect(rate).toBeLessThan(0.85);
  });
});
