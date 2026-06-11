// Session 37 integration tests — equipment batch.
//
// Covers the six simple stat-mod / resistance / movement items added in
// S37: Travel Garb (universal body, Move +1), Lookout's Hood (universal
// head, Speed +1), Crusader's Helm (Knight head, Faith +10), Light Robe
// / Dark Robe (Mage bodies, paired elemental resistances), Tricorn
// (Mage head, Brave +10). Spiked Mail's reflect lives in a separate
// integration test (see session-37-reflect-integration.test.ts).

import { describe, expect, it } from 'vitest';
import { createCatalog } from '../catalog/index.ts';
import { defaultTestRulesets } from '../catalog/test-fixtures.ts';
import { makeKnight } from '../abilities/test-fixtures.ts';
import { makeGameState, makeUnit } from '../ct/test-fixtures.ts';
import {
  runModifyResistance,
  runModifyStatQuery,
} from '../hooks/runners.ts';
import { items as allItems } from '../../content/items/index.ts';
import { travelGarb } from '../../content/items/travel-garb.ts';
import { lookoutsHood } from '../../content/items/lookouts-hood.ts';
import { crusadersHelm } from '../../content/items/crusaders-helm.ts';
import { lightRobe } from '../../content/items/light-robe.ts';
import { darkRobe } from '../../content/items/dark-robe.ts';
import { tricorn } from '../../content/items/tricorn.ts';
import { classId, itemId, type ItemId, type UnitEquipment } from '../types/index.ts';
import type { ItemDefinition } from '../catalog/index.ts';

function catalogWith(items: ReadonlyArray<ItemDefinition>) {
  return createCatalog({
    statusTypes: [],
    abilities: [],
    commandSets: [],
    classes: [makeKnight()],
    items,
    rulesets: defaultTestRulesets,
  });
}

function equipBody(id: ItemId): UnitEquipment {
  return { leftHand: null, rightHand: null, headgear: null, armor: id, accessory: null };
}

function equipHead(id: ItemId): UnitEquipment {
  return { leftHand: null, rightHand: null, headgear: id, armor: null, accessory: null };
}

// ===========================================================================
// Structural — items are catalog-registered with the expected fields
// ===========================================================================

describe('Session 37 — items registered in the default catalog', () => {
  it('registers all six simple items', () => {
    const ids = new Set(allItems.map((i) => i.id));
    expect(ids.has(itemId('travel_garb'))).toBe(true);
    expect(ids.has(itemId('lookouts_hood'))).toBe(true);
    expect(ids.has(itemId('crusaders_helm'))).toBe(true);
    expect(ids.has(itemId('light_robe'))).toBe(true);
    expect(ids.has(itemId('dark_robe'))).toBe(true);
    expect(ids.has(itemId('tricorn'))).toBe(true);
  });

  it('Travel Garb: universal body armor, +80 HP, Move +1', () => {
    expect(travelGarb.kind).toBe('armor');
    expect(travelGarb.classRestrictions).toBeUndefined();
    expect(travelGarb.statMods).toEqual({ maxHpBase: 80 });
    expect(travelGarb.movementMods).toEqual({ moveRange: 1 });
  });

  it("Lookout's Hood: universal head, +20 HP, +1 Speed", () => {
    expect(lookoutsHood.kind).toBe('headgear');
    expect(lookoutsHood.classRestrictions).toBeUndefined();
    expect(lookoutsHood.statMods).toEqual({ maxHpBase: 20, spd: 1 });
  });

  it("Crusader's Helm: Knight/Templar head, +20 HP, +10 MP, +10 Faith", () => {
    expect(crusadersHelm.kind).toBe('headgear');
    // S62: Templar shares Knight head/body gear.
    expect(crusadersHelm.classRestrictions).toEqual([classId('knight'), classId('templar')]);
    expect(crusadersHelm.statMods).toEqual({ maxHpBase: 20, maxMpBase: 10, faith: 10 });
  });

  it('Light Robe: Mage-only body, +75 HP, +20 MP, +75 Fire/Lightning resist', () => {
    expect(lightRobe.kind).toBe('armor');
    // S49: calculator added to the Mage allowlist for body + head gear.
    // S54: terraformer added (mage gear tier).
    expect(lightRobe.classRestrictions).toEqual([
      classId('earth_mage'),
      classId('water_mage'),
      classId('fire_mage'),
      classId('lightning_mage'),
      classId('calculator'),
      classId('terraformer'),
    ]);
    expect(lightRobe.statMods).toEqual({ maxHpBase: 75, maxMpBase: 20 });
    expect(lightRobe.resistanceMods?.get('fire')).toBe(75);
    expect(lightRobe.resistanceMods?.get('lightning')).toBe(75);
    expect(lightRobe.resistanceMods?.get('water')).toBeUndefined();
    expect(lightRobe.resistanceMods?.get('earth')).toBeUndefined();
  });

  it('Dark Robe: Mage-only body, +75 HP, +20 MP, +75 Water/Earth resist', () => {
    expect(darkRobe.kind).toBe('armor');
    expect(darkRobe.resistanceMods?.get('water')).toBe(75);
    expect(darkRobe.resistanceMods?.get('earth')).toBe(75);
    expect(darkRobe.resistanceMods?.get('fire')).toBeUndefined();
    expect(darkRobe.resistanceMods?.get('lightning')).toBeUndefined();
  });

  it('Tricorn: Mage-only head, +10 HP, +10 MP, +10 Brave', () => {
    expect(tricorn.kind).toBe('headgear');
    // S49: calculator added to the Mage allowlist for body + head gear.
    // S54: terraformer added (mage gear tier).
    expect(tricorn.classRestrictions).toEqual([
      classId('earth_mage'),
      classId('water_mage'),
      classId('fire_mage'),
      classId('lightning_mage'),
      classId('calculator'),
      classId('terraformer'),
    ]);
    expect(tricorn.statMods).toEqual({ maxHpBase: 10, maxMpBase: 10, brave: 10 });
  });
});

// ===========================================================================
// Composition — stat / movement / resistance modifiers flow through hooks
// ===========================================================================

describe('Session 37 — Travel Garb composes Move +1', () => {
  it('moveRange query reads +1 over class baseline', () => {
    const cat = catalogWith([travelGarb]);
    const u = makeUnit({ id: 'u', spd: 10, equipment: equipBody(travelGarb.id) });
    const state = makeGameState({ units: [u] });
    const moveRange = runModifyStatQuery(state, cat, {
      unit: u,
      statName: 'moveRange',
      baseValue: 3,
    });
    expect(moveRange).toBe(4);
  });

  it('also bumps maxHpBase via statMods', () => {
    const cat = catalogWith([travelGarb]);
    const u = makeUnit({ id: 'u', spd: 10, equipment: equipBody(travelGarb.id) });
    const state = makeGameState({ units: [u] });
    const maxHp = runModifyStatQuery(state, cat, {
      unit: u,
      statName: 'maxHp',
      baseValue: u.baseStats.maxHpBase,
    });
    expect(maxHp - u.baseStats.maxHpBase).toBe(80);
  });
});

describe("Session 37 — Lookout's Hood composes +1 Speed", () => {
  it('spd query reads +1 over baseline', () => {
    const cat = catalogWith([lookoutsHood]);
    const u = makeUnit({ id: 'u', spd: 10, equipment: equipHead(lookoutsHood.id) });
    const state = makeGameState({ units: [u] });
    const spd = runModifyStatQuery(state, cat, {
      unit: u,
      statName: 'spd',
      baseValue: u.baseStats.spd,
    });
    expect(spd).toBe(u.baseStats.spd + 1);
  });
});

describe('Session 37 — Light Robe composes Fire/Lightning resistance', () => {
  it('+75 to Fire and Lightning, untouched on Water/Earth', () => {
    const cat = catalogWith([lightRobe]);
    const u = makeUnit({ id: 'u', spd: 10, equipment: equipBody(lightRobe.id) });
    const state = makeGameState({ units: [u] });
    expect(runModifyResistance(state, cat, { unit: u, tag: 'fire', baseValue: 0 })).toBe(75);
    expect(runModifyResistance(state, cat, { unit: u, tag: 'lightning', baseValue: 0 })).toBe(75);
    expect(runModifyResistance(state, cat, { unit: u, tag: 'water', baseValue: 0 })).toBe(0);
    expect(runModifyResistance(state, cat, { unit: u, tag: 'earth', baseValue: 0 })).toBe(0);
  });
});

describe('Session 37 — Dark Robe composes Water/Earth resistance', () => {
  it('+75 to Water and Earth, untouched on Fire/Lightning', () => {
    const cat = catalogWith([darkRobe]);
    const u = makeUnit({ id: 'u', spd: 10, equipment: equipBody(darkRobe.id) });
    const state = makeGameState({ units: [u] });
    expect(runModifyResistance(state, cat, { unit: u, tag: 'water', baseValue: 0 })).toBe(75);
    expect(runModifyResistance(state, cat, { unit: u, tag: 'earth', baseValue: 0 })).toBe(75);
    expect(runModifyResistance(state, cat, { unit: u, tag: 'fire', baseValue: 0 })).toBe(0);
    expect(runModifyResistance(state, cat, { unit: u, tag: 'lightning', baseValue: 0 })).toBe(0);
  });
});

describe("Session 37 — Crusader's Helm composes +10 Faith", () => {
  it('faith query reads +10 over baseline', () => {
    const cat = catalogWith([crusadersHelm]);
    const u = makeUnit({ id: 'u', spd: 10, equipment: equipHead(crusadersHelm.id) });
    const state = makeGameState({ units: [u] });
    const faith = runModifyStatQuery(state, cat, {
      unit: u,
      statName: 'faith',
      baseValue: u.baseStats.faith,
    });
    expect(faith).toBe(u.baseStats.faith + 10);
  });
});

describe('Session 37 — Tricorn composes +10 Brave', () => {
  it('brave query reads +10 over baseline', () => {
    const cat = catalogWith([tricorn]);
    const u = makeUnit({ id: 'u', spd: 10, equipment: equipHead(tricorn.id) });
    const state = makeGameState({ units: [u] });
    const brave = runModifyStatQuery(state, cat, {
      unit: u,
      statName: 'brave',
      baseValue: u.baseStats.brave,
    });
    expect(brave).toBe(u.baseStats.brave + 10);
  });
});
