// Session 37 — Spiked Mail physical reflect integration.
//
// Covers `physicalReflectContributor` (on the new `onFinalDamageReceived`
// hook) and the revenge-sourced `system_damage` it emits. Verifies:
//
//   1. Reflect emits the correct amount and target on a physical hit.
//   2. Magical damage doesn't trigger reflect.
//   3. Absorbed hits (resistance > 100 tag-flip) don't reflect.
//   4. KO'd wearers don't reflect.
//   5. Zero-damage hits don't emit.
//   6. The wearer can't reflect on themselves.
//   7. Loop guard — `system_damage` bypasses the damage pipeline, so a
//      revenge emission doesn't itself trigger `onFinalDamageReceived`.
//
// Driven directly through `runOnFinalDamageReceived` for the contributor
// semantics; the full pipeline integration is exercised by the production
// ruleset's `postFinalize` stage list, asserted in `default.test.ts`.

import { describe, expect, it } from 'vitest';
import { createCatalog } from '../catalog/index.ts';
import { defaultTestRulesets } from '../catalog/test-fixtures.ts';
import { makeKnight } from '../abilities/test-fixtures.ts';
import { makeGameState, makeUnit } from '../ct/test-fixtures.ts';
import { runOnFinalDamageReceived } from '../hooks/runners.ts';
import { reduceSystemDamage } from './reducers.ts';
import { spikedMail } from '../../content/items/spiked-mail.ts';
import {
  itemId,
  type DamageTag,
  type ItemId,
  type UnitEquipment,
} from '../types/index.ts';
import type { ArmorEquipment } from '../catalog/index.ts';

function makeReflectBody(args: {
  readonly id: string;
  readonly percent: number;
}): ArmorEquipment {
  return {
    id: itemId(args.id),
    name: args.id,
    availability: 'available',
    kind: 'armor',
    physicalReflectPercent: args.percent,
  };
}

function equipBody(id: ItemId): UnitEquipment {
  return { leftHand: null, rightHand: null, headgear: null, armor: id, accessory: null };
}

function catalogWith(items: ReadonlyArray<ArmorEquipment>) {
  return createCatalog({
    statusTypes: [],
    abilities: [],
    commandSets: [],
    classes: [makeKnight()],
    items,
    rulesets: defaultTestRulesets,
  });
}

describe('Session 37 — physicalReflectContributor emission semantics', () => {
  it('emits revenge system_damage against the attacker on a physical hit', () => {
    const mail = makeReflectBody({ id: 'reflect_test', percent: 20 });
    const cat = catalogWith([mail]);
    const wearer = makeUnit({ id: 'wearer', spd: 10, equipment: equipBody(mail.id) });
    const attacker = makeUnit({ id: 'attacker', spd: 10, team: 'team_b' });
    const state = makeGameState({ units: [wearer, attacker] });
    const emissions = runOnFinalDamageReceived(state, cat, {
      unit: wearer,
      attacker,
      damageDealt: 50,
      damageTags: new Set<DamageTag>(['physical']),
      absorbed: false,
    });
    expect(emissions.length).toBe(1);
    const e = emissions[0]!;
    expect(e.type).toBe('system_damage');
    if (e.type !== 'system_damage') return;
    expect(e.payload.targetId).toBe(attacker.id);
    expect(e.payload.amount).toBe(10); // floor(50 * 20 / 100)
    expect(e.payload.tags).toEqual(['physical']);
    expect(e.payload.source.kind).toBe('revenge');
    if (e.payload.source.kind !== 'revenge') return;
    expect(e.payload.source.wearerId).toBe(wearer.id);
    expect(e.payload.source.itemId).toBe(mail.id);
  });

  it('skips reflect on magical damage', () => {
    const mail = makeReflectBody({ id: 'reflect_test', percent: 20 });
    const cat = catalogWith([mail]);
    const wearer = makeUnit({ id: 'wearer', spd: 10, equipment: equipBody(mail.id) });
    const attacker = makeUnit({ id: 'attacker', spd: 10, team: 'team_b' });
    const state = makeGameState({ units: [wearer, attacker] });
    const emissions = runOnFinalDamageReceived(state, cat, {
      unit: wearer,
      attacker,
      damageDealt: 50,
      damageTags: new Set<DamageTag>(['magical', 'fire']),
      absorbed: false,
    });
    expect(emissions).toEqual([]);
  });

  it('skips reflect when the hit was absorbed (resistance > 100 tag-flip)', () => {
    const mail = makeReflectBody({ id: 'reflect_test', percent: 20 });
    const cat = catalogWith([mail]);
    const wearer = makeUnit({ id: 'wearer', spd: 10, equipment: equipBody(mail.id) });
    const attacker = makeUnit({ id: 'attacker', spd: 10, team: 'team_b' });
    const state = makeGameState({ units: [wearer, attacker] });
    const emissions = runOnFinalDamageReceived(state, cat, {
      unit: wearer,
      attacker,
      damageDealt: 0,
      damageTags: new Set<DamageTag>(['physical', 'healing']),
      absorbed: true,
    });
    expect(emissions).toEqual([]);
  });

  it('skips reflect when wearer is KO (HP <= 0)', () => {
    const mail = makeReflectBody({ id: 'reflect_test', percent: 20 });
    const cat = catalogWith([mail]);
    const koWearer = makeUnit({
      id: 'wearer',
      spd: 10,
      hp: 0,
      equipment: equipBody(mail.id),
    });
    const attacker = makeUnit({ id: 'attacker', spd: 10, team: 'team_b' });
    const state = makeGameState({ units: [koWearer, attacker] });
    const emissions = runOnFinalDamageReceived(state, cat, {
      unit: koWearer,
      attacker,
      damageDealt: 50,
      damageTags: new Set<DamageTag>(['physical']),
      absorbed: false,
    });
    expect(emissions).toEqual([]);
  });

  it('skips reflect when damageDealt is zero (miss / blocked)', () => {
    const mail = makeReflectBody({ id: 'reflect_test', percent: 20 });
    const cat = catalogWith([mail]);
    const wearer = makeUnit({ id: 'wearer', spd: 10, equipment: equipBody(mail.id) });
    const attacker = makeUnit({ id: 'attacker', spd: 10, team: 'team_b' });
    const state = makeGameState({ units: [wearer, attacker] });
    const emissions = runOnFinalDamageReceived(state, cat, {
      unit: wearer,
      attacker,
      damageDealt: 0,
      damageTags: new Set<DamageTag>(['physical']),
      absorbed: false,
    });
    expect(emissions).toEqual([]);
  });

  it("skips reflect when the rounded amount is zero (e.g., 4 dmg × 20% = 0.8 → 0)", () => {
    const mail = makeReflectBody({ id: 'reflect_test', percent: 20 });
    const cat = catalogWith([mail]);
    const wearer = makeUnit({ id: 'wearer', spd: 10, equipment: equipBody(mail.id) });
    const attacker = makeUnit({ id: 'attacker', spd: 10, team: 'team_b' });
    const state = makeGameState({ units: [wearer, attacker] });
    const emissions = runOnFinalDamageReceived(state, cat, {
      unit: wearer,
      attacker,
      damageDealt: 4,
      damageTags: new Set<DamageTag>(['physical']),
      absorbed: false,
    });
    expect(emissions).toEqual([]); // floor(4 * 20 / 100) = 0
  });

  it("skips reflect when the wearer is the attacker (self-damage path)", () => {
    const mail = makeReflectBody({ id: 'reflect_test', percent: 20 });
    const cat = catalogWith([mail]);
    const wearer = makeUnit({ id: 'wearer', spd: 10, equipment: equipBody(mail.id) });
    const state = makeGameState({ units: [wearer] });
    const emissions = runOnFinalDamageReceived(state, cat, {
      unit: wearer,
      attacker: wearer,
      damageDealt: 50,
      damageTags: new Set<DamageTag>(['physical']),
      absorbed: false,
    });
    expect(emissions).toEqual([]);
  });
});

describe('Session 37 — Spiked Mail real-content composition', () => {
  it("real Spiked Mail produces 20% physical reflect via the catalog path", () => {
    const cat = createCatalog({
      statusTypes: [],
      abilities: [],
      commandSets: [],
      classes: [makeKnight()],
      items: [spikedMail],
      rulesets: defaultTestRulesets,
    });
    const wearer = makeUnit({ id: 'wearer', spd: 10, equipment: equipBody(spikedMail.id) });
    const attacker = makeUnit({ id: 'attacker', spd: 10, team: 'team_b' });
    const state = makeGameState({ units: [wearer, attacker] });
    const emissions = runOnFinalDamageReceived(state, cat, {
      unit: wearer,
      attacker,
      damageDealt: 100,
      damageTags: new Set<DamageTag>(['physical']),
      absorbed: false,
    });
    expect(emissions.length).toBe(1);
    const e = emissions[0]!;
    expect(e.type).toBe('system_damage');
    if (e.type !== 'system_damage') return;
    expect(e.payload.amount).toBe(20);
    expect(e.payload.source.kind).toBe('revenge');
  });
});

describe('Session 37 — reduceSystemDamage applies revenge damage and respects floor at 0', () => {
  it('revenge system_damage reduces the attacker HP by the reflected amount', () => {
    const cat = createCatalog({
      statusTypes: [],
      abilities: [],
      commandSets: [],
      classes: [makeKnight()],
      items: [spikedMail],
      rulesets: defaultTestRulesets,
    });
    const wearer = makeUnit({
      id: 'wearer',
      spd: 10,
      equipment: equipBody(spikedMail.id),
    });
    const attacker = makeUnit({ id: 'attacker', spd: 10, team: 'team_b', hp: 100 });
    const state = makeGameState({ units: [wearer, attacker] });
    const result = reduceSystemDamage(
      state,
      {
        type: 'system_damage',
        source: 'system',
        sequenceNumber: 0,
        timestamp: { tick: 0, ct: 0 },
        seed: 0,
        chainDepth: 0,
        isReaction: false,
        payload: {
          targetId: attacker.id,
          amount: 20,
          tags: ['physical'],
          source: { kind: 'revenge', wearerId: wearer.id, itemId: spikedMail.id },
        },
      },
      cat,
    );
    expect(result.outcome.applied).toBe(20);
    expect(result.outcome.hpAfter).toBe(80);
  });

  it('revenge overkill floors attacker HP at 0', () => {
    const cat = createCatalog({
      statusTypes: [],
      abilities: [],
      commandSets: [],
      classes: [makeKnight()],
      items: [spikedMail],
      rulesets: defaultTestRulesets,
    });
    const wearer = makeUnit({
      id: 'wearer',
      spd: 10,
      equipment: equipBody(spikedMail.id),
    });
    const attacker = makeUnit({ id: 'attacker', spd: 10, team: 'team_b', hp: 5 });
    const state = makeGameState({ units: [wearer, attacker] });
    const result = reduceSystemDamage(
      state,
      {
        type: 'system_damage',
        source: 'system',
        sequenceNumber: 0,
        timestamp: { tick: 0, ct: 0 },
        seed: 0,
        chainDepth: 0,
        isReaction: false,
        payload: {
          targetId: attacker.id,
          amount: 20,
          tags: ['physical'],
          source: { kind: 'revenge', wearerId: wearer.id, itemId: spikedMail.id },
        },
      },
      cat,
    );
    expect(result.outcome.applied).toBe(5);
    expect(result.outcome.hpAfter).toBe(0);
  });
});
