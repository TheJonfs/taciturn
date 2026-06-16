// Session 68 integration tests — equipment expansion (4 pieces).
//
// Covers:
//   1. Vicious Dagger — +25 crit_chance, per-unit, additive through
//      `modifyStatQuery`; stacks with Arcane Lens (+10).
//   2. Scimitar — +1 Speed (sword family; no physicalVariance).
//   3. Gauntlet of Might — +3 PA, additive through `modifyStatQuery`.
//   4. Wand of Potential — the genuinely new piece: the `modifySpellPower`
//      hook adds +1 Spell Power to the holder's lightning-tagged magic
//      (and ONLY that), plus the water/earth Resonance proc config.

import { describe, expect, it } from 'vitest';
import { createCatalog } from '../catalog/index.ts';
import {
  DEFAULT_TEST_DAMAGE_PIPELINE,
  makeTestRuleset,
} from '../catalog/test-fixtures.ts';
import { makeKnight } from '../abilities/test-fixtures.ts';
import { makeGameState, makeUnit } from '../ct/test-fixtures.ts';
import { runModifyStatQuery } from '../hooks/runners.ts';
import { runDamagePipeline } from '../damage/pipeline.ts';
import { defaultDamageHandlers } from '../damage/default-handlers.ts';
import { viciousDagger } from '../../content/items/vicious-dagger.ts';
import { scimitar } from '../../content/items/scimitar.ts';
import { gauntletOfMight } from '../../content/items/gauntlet-of-might.ts';
import { wandOfPotential } from '../../content/items/wand-of-potential.ts';
import { arcaneLens } from '../../content/items/arcane-lens.ts';
import { wandOfPotentialApplyShift } from '../../content/abilities/wand-of-potential-apply-shift.ts';
import {
  abilityId,
  bucketId,
  itemId,
  statusTypeId,
  type UnitEquipment,
} from '../types/index.ts';
import type { ActiveAbilityDefinition } from '../catalog/index.ts';

const EMPTY: UnitEquipment = {
  leftHand: null,
  rightHand: null,
  headgear: null,
  armor: null,
  accessory: null,
};
function withRight(id: string): UnitEquipment {
  return { ...EMPTY, rightHand: itemId(id) };
}
function withAccessory(id: string): UnitEquipment {
  return { ...EMPTY, accessory: itemId(id) };
}

function rulesetForPipeline() {
  return makeTestRuleset({ damagePipelineStages: DEFAULT_TEST_DAMAGE_PIPELINE });
}

// A magical spell with a configurable element tag + power coefficient.
// No hitRoll (magical auto-hits), no variance (default {1,1}), so damage
// is deterministic given fixed Faith.
function magicalSpell(
  element: 'lightning' | 'fire',
  power_coefficient = 12,
): ActiveAbilityDefinition {
  return {
    id: abilityId('spell_test'),
    name: 'Spell',
    kind: 'active',
    bucket: bucketId('first_action'),
    baseCost: 1,
    availability: 'hidden',
    targeting: { kind: 'single_unit', range: { horizontal: 4, vertical: 2 }, rangeMode: 'arc' },
    actionSpeed: 0,
    mpCost: 0,
    effects: { damage: { tags: ['magical', element], power_coefficient } },
  };
}

// A *physical* lightning attack (e.g. Lightning Stab): tags physical,
// not magical. The SP rider lives in the magical base handler, so this
// must never see the bonus.
function physicalLightningAttack(): ActiveAbilityDefinition {
  return {
    id: abilityId('phys_lightning_test'),
    name: 'Lightning Stab',
    kind: 'active',
    bucket: bucketId('first_action'),
    baseCost: 1,
    availability: 'hidden',
    targeting: { kind: 'single_unit', range: { horizontal: 1, vertical: 1 }, rangeMode: 'melee' },
    actionSpeed: 0,
    mpCost: 0,
    effects: { damage: { tags: ['physical', 'lightning'], power_coefficient: 1 } },
  };
}

// ---------------------------------------------------------------------------
// 1. Vicious Dagger — +25 crit, per-unit, additive
// ---------------------------------------------------------------------------

describe('Session 68 Vicious Dagger', () => {
  function critChanceOf(equipment: UnitEquipment): number {
    const cat = createCatalog({
      statusTypes: [],
      abilities: [],
      commandSets: [],
      classes: [makeKnight()],
      items: [viciousDagger, arcaneLens],
      rulesets: [rulesetForPipeline()],
    });
    const u = makeUnit({ id: 'u', spd: 10, equipment });
    const state = makeGameState({ units: [u] });
    return runModifyStatQuery(state, cat, {
      unit: u,
      statName: 'crit_chance',
      baseValue: u.baseStats.crit_chance,
    });
  }

  it('adds +25 crit_chance to the wielder (base 0 → 25)', () => {
    expect(critChanceOf(withRight('vicious_dagger'))).toBe(25);
  });

  it('stacks additively with Arcane Lens (+10) → 35', () => {
    expect(
      critChanceOf({ ...withRight('vicious_dagger'), accessory: itemId('arcane_lens') }),
    ).toBe(35);
  });

  it('is a knife with WP 5, accuracy 95, Speed-scaled variance', () => {
    expect(viciousDagger.weaponType).toBe('knife');
    expect(viciousDagger.wp).toBe(5);
    expect(viciousDagger.accuracy).toBe(95);
    expect(viciousDagger.physicalVariance).toEqual({ kind: 'attacker_speed', spread: 0.05 });
  });
});

// ---------------------------------------------------------------------------
// 2. Scimitar — +1 Speed, sword family (flat, no variance)
// ---------------------------------------------------------------------------

describe('Session 68 Scimitar', () => {
  it('adds +1 Speed to the wielder', () => {
    const cat = createCatalog({
      statusTypes: [],
      abilities: [],
      commandSets: [],
      classes: [makeKnight()],
      items: [scimitar],
      rulesets: [rulesetForPipeline()],
    });
    const u = makeUnit({ id: 'u', spd: 10, equipment: withRight('scimitar') });
    const state = makeGameState({ units: [u] });
    const spd = runModifyStatQuery(state, cat, {
      unit: u,
      statName: 'spd',
      baseValue: u.baseStats.spd,
    });
    expect(spd).toBe(11);
  });

  it('is a sword with WP 7 and NO physicalVariance (flat PA×WP, sidegrade to Longsword)', () => {
    expect(scimitar.weaponType).toBe('sword');
    expect(scimitar.wp).toBe(7);
    expect(scimitar.accuracy).toBe(95);
    expect(scimitar.physicalVariance).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// 3. Gauntlet of Might — +3 PA
// ---------------------------------------------------------------------------

describe('Session 68 Gauntlet of Might', () => {
  it('adds +3 PA to the wearer (base 5 → 8)', () => {
    const cat = createCatalog({
      statusTypes: [],
      abilities: [],
      commandSets: [],
      classes: [makeKnight()],
      items: [gauntletOfMight],
      rulesets: [rulesetForPipeline()],
    });
    const u = makeUnit({ id: 'u', spd: 10, pa: 5, equipment: withAccessory('gauntlet_of_might') });
    const state = makeGameState({ units: [u] });
    const pa = runModifyStatQuery(state, cat, {
      unit: u,
      statName: 'pa',
      baseValue: u.baseStats.pa,
    });
    expect(pa).toBe(8);
  });

  it('is an accessory carrying PA +3', () => {
    expect(gauntletOfMight.kind).toBe('accessory');
    expect(gauntletOfMight.statMods).toEqual({ pa: 3 });
  });
});

// ---------------------------------------------------------------------------
// 4. Wand of Potential — the +1 Spell Power rider (the new substrate)
// ---------------------------------------------------------------------------

describe('Session 68 Wand of Potential — Spell Power rider', () => {
  // MA 10, Faith 100 both sides → Faith_factor 1.0, crit 0, variance {1,1}.
  // baseDamage = MA × (SP) × 1.0. SP 12 → 120; with wand SP 13 → 130.
  function castDamage(args: {
    readonly element: 'lightning' | 'fire';
    readonly equip: UnitEquipment;
    readonly ability?: ActiveAbilityDefinition;
  }): number {
    const ability = args.ability ?? magicalSpell(args.element, 12);
    const cat = createCatalog({
      statusTypes: [],
      abilities: [ability],
      commandSets: [],
      classes: [makeKnight()],
      items: [wandOfPotential],
      rulesets: [rulesetForPipeline()],
    });
    const attacker = makeUnit({ id: 'a', spd: 10, ma: 10, faith: 100, equipment: args.equip });
    const target = makeUnit({ id: 'b', spd: 10, hp: 200, maxHpBase: 200, faith: 100 });
    const state = makeGameState({ units: [attacker, target] });
    return (
      runDamagePipeline({
        state,
        catalog: cat,
        attacker,
        target,
        ability,
        sourceActionSeq: 0,
        seed: 12345,
        registry: defaultDamageHandlers,
      }).finalDamage ?? -1
    );
  }

  it('grants +1 SP to the holder’s lightning magic (SP 12 → 13: 120 → 130)', () => {
    expect(castDamage({ element: 'lightning', equip: EMPTY })).toBe(120);
    expect(castDamage({ element: 'lightning', equip: withRight('wand_of_potential') })).toBe(130);
  });

  it('does NOT affect non-lightning magic (fire stays 120 with the wand)', () => {
    expect(castDamage({ element: 'fire', equip: withRight('wand_of_potential') })).toBe(120);
  });

  it('does NOT affect a non-holder (no wand → no bonus on lightning)', () => {
    expect(castDamage({ element: 'lightning', equip: EMPTY })).toBe(120);
  });

  it('does NOT affect physical lightning attacks (SP lives in the magical handler)', () => {
    // Physical Lightning Stab: PA 5 × WP 2 (wand) × 1.0 = 10, no SP rider.
    const phys = physicalLightningAttack();
    const cat = createCatalog({
      statusTypes: [],
      abilities: [phys],
      commandSets: [],
      classes: [makeKnight()],
      items: [wandOfPotential],
      rulesets: [rulesetForPipeline()],
    });
    const attacker = makeUnit({
      id: 'a',
      spd: 10,
      pa: 5,
      faith: 100,
      equipment: withRight('wand_of_potential'),
    });
    const target = makeUnit({ id: 'b', spd: 10, hp: 200, maxHpBase: 200, faith: 100 });
    const state = makeGameState({ units: [attacker, target] });
    const dmg =
      runDamagePipeline({
        state,
        catalog: cat,
        attacker,
        target,
        ability: phys,
        sourceActionSeq: 0,
        seed: 12345,
        registry: defaultDamageHandlers,
      }).finalDamage ?? -1;
    // PA 5 × WP 2 × 1.0 = 10 — no +1 SP (that would only touch magical SP).
    expect(dmg).toBe(10);
  });
});

describe('Session 68 Wand of Potential — Resonance + wiring', () => {
  it('wand fires the resonance proc at 100% and carries the lightning SP rider', () => {
    expect(wandOfPotential.weaponType).toBe('wand');
    expect(wandOfPotential.wp).toBe(2);
    expect(wandOfPotential.accuracy).toBe(90);
    expect(wandOfPotential.attackProcs).toEqual([
      { chance: 1.0, abilityId: abilityId('wand_of_potential_apply_shift') },
    ]);
    expect(wandOfPotential.spellPowerModifiers).toEqual([
      { delta: 1, tagFilter: ['lightning'] },
    ]);
  });

  it('resonance applies the +25 water / -25 earth shift that completes the rotation', () => {
    const effect = wandOfPotentialApplyShift.effects.statusEffects?.[0];
    expect(effect?.typeId).toBe(statusTypeId('tagged_resistance_shift'));
    expect(effect?.applyAlways).toBe(true);
    expect(effect?.customState?.['tagDeltas']).toEqual({ water: 25, earth: -25 });
  });
});
