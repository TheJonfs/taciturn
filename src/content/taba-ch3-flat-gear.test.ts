// TABA M3 Stage 2c — Ch3 flat-batch gear (armor / accessories /
// stat-stick weapons).
//
// Three pieces carry first-consumer mechanics, tested end-to-end here:
//   - Katana: ×2 on `crit_multiplier` through the multiplicative stat
//     chain (the brief's "crit-magnitude prerequisite" that the audit
//     found already live — ADR-0032's stat read).
//   - Abjurer's Codex: `resistanceFromMaTags` — composed MA added to
//     elemental resistances (stat-scaled modifyResistance arm).
//   - Talisman of Endurance: `incomingStatusStatShrugs` —
//     × (1 − max(PA, MA)/100) on incoming negative-status land chance.
//   - Mirror Shield: `magicalReflectPercent` — the magical arm of the
//     generalized reflect contributor.
// The rest is lineup conformance for the flat definitions.

import { describe, expect, it } from 'vitest';
import { loadDefaultCatalog } from './index.ts';
import { itemId, statusTypeId, unitId } from '@engine/index.ts';
import type { UnitEquipment } from '@engine/index.ts';
import {
  runModifyIncomingStatusApplicationChance,
  runModifyResistance,
  runModifyStatQuery,
} from '../engine/hooks/runners.ts';
import { collectActiveHandlers } from '../engine/hooks/collector.ts';
import { makeGameState, makeUnit } from '../engine/ct/test-fixtures.ts';
import { abjurersCodex } from './items/abjurers-codex.ts';
import { commandCap } from './items/command-cap.ts';
import { crystalPlate } from './items/crystal-plate.ts';
import { expertsTunic } from './items/experts-tunic.ts';
import { katana } from './items/katana.ts';
import { mainGauche } from './items/main-gauche.ts';
import { manaeaterBlade } from './items/manaeater-blade.ts';
import { masterBow } from './items/master-bow.ts';
import { masterworkMail } from './items/masterwork-mail.ts';
import { mirrorShield } from './items/mirror-shield.ts';
import { mithrilChain } from './items/mithril-chain.ts';
import { senseisGi } from './items/senseis-gi.ts';
import { sniperBow } from './items/sniper-bow.ts';
import { stealthSuit } from './items/stealth-suit.ts';
import { talismanOfEndurance } from './items/talisman-of-endurance.ts';
import { titansHelm } from './items/titans-helm.ts';
import { wingedBoots } from './items/winged-boots.ts';
import { worldstave } from './items/worldstave.ts';

const cat = loadDefaultCatalog();

const ALL = [
  katana, manaeaterBlade, masterBow, sniperBow, mainGauche, worldstave,
  crystalPlate, masterworkMail, mithrilChain, senseisGi, expertsTunic,
  stealthSuit, titansHelm, commandCap, mirrorShield, abjurersCodex,
  talismanOfEndurance, wingedBoots,
];

const wearing = (slots: Partial<Record<keyof UnitEquipment, string>>): UnitEquipment => ({
  leftHand: slots.leftHand ? itemId(slots.leftHand) : null,
  rightHand: slots.rightHand ? itemId(slots.rightHand) : null,
  headgear: slots.headgear ? itemId(slots.headgear) : null,
  armor: slots.armor ? itemId(slots.armor) : null,
  accessory: slots.accessory ? itemId(slots.accessory) : null,
});

describe('TABA Ch3 flat gear — scoping invariant', () => {
  it("every Ch3-new item is 'hidden' (TABA-scoped, invisible to Mage War)", () => {
    for (const item of ALL) {
      expect(item.availability, String(item.id)).toBe('hidden');
    }
  });
});

describe('Katana — crit magnitude ×2 (1.5 → 3.0)', () => {
  it('doubles the wielder-queried crit_multiplier (content base 1.5 → 3.0)', () => {
    const wielder = makeUnit({ id: 'w', spd: 10, equipment: wearing({ rightHand: 'katana' }) });
    const state = makeGameState({ units: [wielder] });
    // Content classes author crit_multiplier 1.5 (ADR-0032); the test
    // fixture's base is 1, so drive the chain with the content value.
    const multiplier = runModifyStatQuery(state, cat, {
      unit: state.units.get(unitId('w'))!,
      statName: 'crit_multiplier',
      baseValue: 1.5,
    });
    expect(multiplier).toBe(3);
  });
});

describe("Abjurer's Codex — MA added to elemental resistances", () => {
  it('adds the composed MA to each element (fire shown), not to non-elements', () => {
    const mage = makeUnit({ id: 'm', spd: 10, ma: 12, equipment: wearing({ leftHand: 'abjurers_codex' }) });
    const state = makeGameState({ units: [mage] });
    const unit = state.units.get(unitId('m'))!;
    expect(runModifyResistance(state, cat, { unit, tag: 'fire', baseValue: 0 })).toBe(12);
    expect(runModifyResistance(state, cat, { unit, tag: 'water', baseValue: 10 })).toBe(22);
    expect(runModifyResistance(state, cat, { unit, tag: 'holy', baseValue: 0 })).toBe(0);
  });
});

describe('Talisman of Endurance — stat-scaled status shrug', () => {
  const scenario = (pa: number, ma: number) => {
    const wearer = makeUnit({ id: 'w', spd: 10, pa, ma, equipment: wearing({ leftHand: 'talisman_of_endurance' }) });
    const caster = makeUnit({ id: 'c', spd: 10, position: { x: 1, y: 0, layer: 0 } });
    const state = makeGameState({ units: [wearer, caster] });
    return { state, wearer: state.units.get(unitId('w'))!, caster: state.units.get(unitId('c'))! };
  };

  it('multiplies incoming negative-status chance by (1 − max(PA, MA)/100)', () => {
    const { state, wearer, caster } = scenario(10, 30);
    const chance = runModifyIncomingStatusApplicationChance(state, cat, {
      target: wearer,
      caster,
      statusType: cat.getStatusType(statusTypeId('stop')),
      ability: null,
      baseChance: 0.5,
    });
    expect(chance).toBeCloseTo(0.5 * (1 - 0.3), 10);
  });

  it('leaves positive statuses untouched (negative-tag gate)', () => {
    const { state, wearer, caster } = scenario(10, 30);
    const chance = runModifyIncomingStatusApplicationChance(state, cat, {
      target: wearer,
      caster,
      statusType: cat.getStatusType(statusTypeId('protect_cast')),
      ability: null,
      baseChance: 0.95,
    });
    expect(chance).toBeCloseTo(0.95, 10);
  });
});

describe('Mirror Shield — magical reflect (generalized reflect contributor)', () => {
  const reflectArgs = (state: ReturnType<typeof makeGameState>, tags: ReadonlyArray<string>) => ({
    unit: state.units.get(unitId('w'))!,
    attacker: state.units.get(unitId('a'))!,
    target: state.units.get(unitId('w'))!,
    damageDealt: 100,
    damageTags: new Set(tags),
    absorbed: false,
  });

  const build = () => {
    const wearer = makeUnit({ id: 'w', spd: 10, equipment: wearing({ leftHand: 'mirror_shield' }) });
    const attacker = makeUnit({ id: 'a', spd: 10, position: { x: 1, y: 0, layer: 0 } });
    return makeGameState({ units: [wearer, attacker] });
  };

  it('reflects 20% of a magical hit back as magical revenge damage', () => {
    const state = build();
    const handlers = collectActiveHandlers(state, unitId('w'), cat, 'onFinalDamageReceived');
    expect(handlers.length).toBeGreaterThan(0);
    const results = handlers.map((h) => h.invoke(reflectArgs(state, ['magical']) as never));
    const emitted = results.flatMap((r) => (r as { emittedActions?: unknown[] }).emittedActions ?? []);
    expect(emitted).toHaveLength(1);
    expect(emitted[0]).toMatchObject({
      type: 'system_damage',
      payload: { targetId: unitId('a'), amount: 20, tags: ['magical'] },
    });
  });

  it('does not reflect physical hits (the tag gate)', () => {
    const state = build();
    const handlers = collectActiveHandlers(state, unitId('w'), cat, 'onFinalDamageReceived');
    const results = handlers.map((h) => h.invoke(reflectArgs(state, ['physical']) as never));
    const emitted = results.flatMap((r) => (r as { emittedActions?: unknown[] }).emittedActions ?? []);
    expect(emitted).toHaveLength(0);
  });
});

describe('TABA Ch3 flat gear — lineup conformance', () => {
  it('weapons match the lineup numbers', () => {
    expect([katana.wp, katana.accuracy]).toEqual([11, 95]);
    expect([manaeaterBlade.wp, manaeaterBlade.statModsMultiplicative]).toEqual([14, { maxMp: 0.5 }]);
    expect([masterBow.wp, masterBow.accuracy, masterBow.statMods]).toEqual([11, 40, { spd: -1 }]);
    expect([sniperBow.wp, sniperBow.accuracy]).toEqual([7, 80]);
    expect([mainGauche.wp, mainGauche.evasionMods]).toEqual([6, { front: 20, side: 15, back: 10 }]);
    expect([worldstave.wp, worldstave.statMods]).toEqual([8, { pa: 2, ma: 2 }]);
  });

  it('bodies match the lineup numbers (Stealth Suit authored trimmed — no resist)', () => {
    expect(crystalPlate.statMods).toEqual({ maxHpBase: 200, spd: -1 });
    expect([...(crystalPlate.resistanceMods ?? new Map())].every(([, v]) => v === 33)).toBe(true);
    expect(masterworkMail.physicalReflectPercent).toBe(33);
    expect(masterworkMail.statMods).toEqual({ maxHpBase: 140, pa: 1 });
    expect(mithrilChain.statMods).toEqual({ maxHpBase: 120, maxMpBase: 20, ma: 2 });
    expect(senseisGi.statMods).toEqual({ maxHpBase: 130, pa: 2, spd: 1 });
    expect(expertsTunic.mpCostMultipliers).toEqual([0.75]);
    expect(stealthSuit.resistanceMods).toBeUndefined();
    expect(stealthSuit.movementMods).toEqual({ moveRange: 1, jump: 1 });
  });

  it('heads / off-hands / accessory match the lineup numbers', () => {
    expect(titansHelm.evasionMods).toEqual({ front: 10, side: 10, back: 5 });
    expect([...(commandCap.bucketCapacityMods ?? new Map())].map(([k, v]) => [String(k), v])).toEqual([
      ['secondary_command_sets', 1],
    ]);
    expect(commandCap.statMods).toEqual({ maxHpBase: 10, maxMpBase: 10, spd: -2 });
    expect(mirrorShield.magicalReflectPercent).toBe(20);
    expect(abjurersCodex.resistanceFromMaTags).toEqual(['fire', 'water', 'earth', 'lightning']);
    expect(talismanOfEndurance.incomingStatusStatShrugs).toEqual([{ statusTag: 'negative' }]);
    expect(wingedBoots.movementMods).toEqual({ moveRange: 1, jump: 5 });
  });
});
