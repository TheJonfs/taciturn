// TABA M3 Stage 4 — the Ch3 effect items: six lineup confirms + the
// rider weapons + the four element-specialist robes, each driven
// through its real seam with the default catalog.

import { describe, expect, it } from 'vitest';
import { loadDefaultCatalog } from './index.ts';
import {
  abilityId,
  classId,
  commitAction,
  computeAbilityRange,
  getCapacity,
  bucketId,
  itemId,
  statusTypeId,
  unitId,
  validateLoadout,
} from '@engine/index.ts';
import type { ProposedAction, UnitEquipment } from '@engine/index.ts';
import {
  runModifyActionSpeed,
  runModifyResistance,
  runModifySpellPower,
  runOnActionResolved,
} from '../engine/hooks/runners.ts';
import { collectActiveHandlers } from '../engine/hooks/collector.ts';
import { runDamagePipeline } from '../engine/damage/pipeline.ts';
import { defaultDamageHandlers } from '../engine/damage/default-handlers.ts';
import { activeTurnFor, makeGameState, makeUnit } from '../engine/ct/test-fixtures.ts';
import { makeStatusInstance } from '../engine/status/test-fixtures.ts';
import { flatMap } from '../engine/map/test-fixtures.ts';
import { attack } from './abilities/attack.ts';
import { powerAttack } from './abilities/power-attack.ts';
import { enchantProtect } from './abilities/enchant-protect.ts';
import { earthStrike } from './abilities/earth-strike.ts';
import { waterStrike } from './abilities/water-strike.ts';
import { spikedMaul } from './items/spiked-maul.ts';
import { gaiasAxe } from './items/gaias-axe.ts';
import { scouringWand } from './items/scouring-wand.ts';
import { prismWand } from './items/prism-wand.ts';

const cat = loadDefaultCatalog();

const holding = (id: string, slot: keyof UnitEquipment = 'rightHand'): UnitEquipment => ({
  leftHand: null,
  rightHand: null,
  headgear: null,
  armor: null,
  accessory: null,
  [slot]: itemId(id),
});

describe('Estoc — melee reach 2 (weapon-range fork confirm)', () => {
  it('the basic Attack reaches 2 tiles with the Estoc, 1 with a Long Sword', () => {
    const duelist = makeUnit({ id: 'd', spd: 10, equipment: holding('estoc') });
    const knight = makeUnit({ id: 'k', spd: 10, equipment: holding('long_sword'), position: { x: 1, y: 0, layer: 0 } });
    const state = makeGameState({ units: [duelist, knight] });
    expect(computeAbilityRange(state, cat, unitId('d'), attack).horizontal).toBe(2);
    expect(computeAbilityRange(state, cat, unitId('k'), attack).horizontal).toBe(1);
  });
});

describe('Trident — command-set-scoped action speed (confirm)', () => {
  it('+5 only on Templar Arts members', () => {
    const templar = makeUnit({ id: 't', spd: 10, equipment: holding('trident') });
    const state = makeGameState({ units: [templar] });
    const unit = state.units.get(unitId('t'))!;
    const templarArts = cat.getCommandSet(
      cat.getClass(cat.classes().find((c) => String(c.id) === 'templar')!.id).firstActionCommandSet,
    );
    const memberAbility = cat.getAbility(templarArts.members[0]!);
    if (memberAbility.kind !== 'active') throw new Error('fixture: expected an active member');
    const memberSpeed = runModifyActionSpeed(state, cat, {
      unit,
      ability: memberAbility,
      baseActionSpeed: memberAbility.actionSpeed,
    });
    expect(memberSpeed).toBe(memberAbility.actionSpeed + 5);
    // A non-member magical cast is untouched.
    const otherSpeed = runModifyActionSpeed(state, cat, {
      unit,
      ability: enchantProtect,
      baseActionSpeed: enchantProtect.actionSpeed,
    });
    expect(otherSpeed).toBe(enchantProtect.actionSpeed);
  });
});

describe('Spiked Maul — reaction bucket capacity −3 → 0 (ruled cost)', () => {
  it('drives the wielder’s reaction capacity from 3 to 0 (clamped)', () => {
    const bruiser = makeUnit({ id: 'b', spd: 10, equipment: holding('spiked_maul') });
    const bare = makeUnit({ id: 'x', spd: 10, position: { x: 1, y: 0, layer: 0 } });
    const state = makeGameState({ units: [bruiser, bare] });
    expect(getCapacity(state, unitId('x'), bucketId('reaction'), cat)).toBe(3);
    expect(getCapacity(state, unitId('b'), bucketId('reaction'), cat)).toBe(0);
  });

  it('content pin: WP 20 stands (Chris’s ruling), variance band intact', () => {
    expect(spikedMaul.wp).toBe(20);
    expect([...(spikedMaul.bucketCapacityMods ?? new Map())].map(([k, v]) => [String(k), v])).toEqual([
      ['reaction', -3],
    ]);
  });

  // The capacity budget is COST-weighted and class-innate abilities cost 0
  // (`getCost` → freeAbilities), so the maul's capacity-0 keeps the class-
  // innate reaction and blocks only IMPORTS — exactly the design intent
  // ("only their class-innate reaction, no others"). These pin that
  // semantics, including the Steel Helm partial-offset (net capacity 1 →
  // innate + one cost-1 import).
  const knightWith = (id: string, weaponId: string, headId: string | null, reactions: ReadonlyArray<string>) =>
    makeUnit({
      id, spd: 10,
      classId: 'knight',
      equipment: {
        leftHand: null,
        rightHand: itemId(weaponId),
        headgear: headId === null ? null : itemId(headId),
        armor: null,
        accessory: null,
      },
      loadout: {
        actionBuckets: { [bucketId('first_action')]: [cat.getClass(classId('knight')).firstActionCommandSet] },
        passiveBuckets: { [bucketId('reaction')]: reactions.map((r) => abilityId(r)) },
      },
    });

  it('capacity 0 still admits the class-INNATE reaction (Counter is free-in-class)', () => {
    const knight = knightWith('k', 'spiked_maul', null, ['counter']);
    const state = makeGameState({ units: [knight] });
    expect(validateLoadout(state, unitId('k'), knight.loadout, cat).ok).toBe(true);
  });

  it('capacity 0 rejects any IMPORTED reaction (cost ≥ 1)', () => {
    const knight = knightWith('k', 'spiked_maul', null, ['cornered_focus']);
    const state = makeGameState({ units: [knight] });
    const result = validateLoadout(state, unitId('k'), knight.loadout, cat);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.violations.some((v) => v.kind === 'over_capacity')).toBe(true);
    }
  });

  it('maul + Steel Helm nets capacity 1: innate Counter + one cost-1 import fits', () => {
    const knight = knightWith('k', 'spiked_maul', 'steel_helm', ['counter', 'cornered_focus']);
    const state = makeGameState({ units: [knight] });
    expect(getCapacity(state, unitId('k'), bucketId('reaction'), cat)).toBe(1);
    expect(validateLoadout(state, unitId('k'), knight.loadout, cat).ok).toBe(true);
  });
});

describe("Gaia's Axe — earth-imbued physical (Flametongue-pattern confirm)", () => {
  it('content pin: earth weapon tag + self +50 earth res', () => {
    expect(gaiasAxe.tags).toEqual(['axe', 'earth']);
    expect(gaiasAxe.resistanceMods?.get('earth')).toBe(50);
    expect(gaiasAxe.wp).toBe(16);
  });
});

describe('Scoured — unbounded all-element res shred (ruled)', () => {
  it('two stacks read as −66 on every element, no floor', () => {
    const victim = makeUnit({
      id: 'v', spd: 10,
      statuses: [makeStatusInstance({ typeId: 'scoured', magnitude: 2, remainingDuration: null })],
    });
    const state = makeGameState({ units: [victim] });
    const unit = state.units.get(unitId('v'))!;
    for (const tag of ['fire', 'water', 'earth', 'lightning'] as const) {
      expect(runModifyResistance(state, cat, { unit, tag, baseValue: 0 })).toBe(-66);
    }
    // Five stacks: −165 — deep-negative scaling is the accepted trap.
    const deep = makeUnit({
      id: 'w', spd: 10, position: { x: 1, y: 0, layer: 0 },
      statuses: [makeStatusInstance({ typeId: 'scoured', magnitude: 5, remainingDuration: null })],
    });
    const state2 = makeGameState({ units: [deep] });
    expect(
      runModifyResistance(state2, cat, { unit: state2.units.get(unitId('w'))!, tag: 'fire', baseValue: 0 }),
    ).toBe(-165);
  });

  it('content pin: the wand procs the shred at 100% on landed physical hits', () => {
    expect(scouringWand.attackProcs).toEqual([
      { chance: 1, abilityId: abilityId('apply_scoured_proc') },
    ]);
  });
});

describe('Epee — PA-worth CT refund on a resolved basic attack', () => {
  const scenario = () => {
    const duelist = makeUnit({ id: 'd', spd: 10, pa: 8, equipment: holding('epee') });
    return makeGameState({ units: [duelist] });
  };
  const resolvedAction: ProposedAction = {
    type: 'use_ability',
    source: 'player',
    actorId: unitId('d'),
    payload: { abilityId: abilityId('attack'), target: { kind: 'unit', unitId: unitId('d') } },
  };

  it('emits a +PA system_ct_push after a basic attack, once per action', () => {
    const state = scenario();
    const emissions = runOnActionResolved(state, cat, {
      unit: state.units.get(unitId('d'))!,
      action: resolvedAction,
      ability: attack,
    });
    expect(emissions).toHaveLength(1);
    expect(emissions[0]).toMatchObject({
      type: 'system_ct_push',
      payload: { targetId: unitId('d'), delta: 8 },
    });
  });

  it('skill casts (Power Attack) refund nothing — basicAttack gates it', () => {
    const state = scenario();
    const emissions = runOnActionResolved(state, cat, {
      unit: state.units.get(unitId('d'))!,
      action: resolvedAction,
      ability: powerAttack,
    });
    expect(emissions).toHaveLength(0);
  });
});

describe('Terra Robe — +1 MA per earth spell, once per action', () => {
  const scenario = () => {
    const mage = makeUnit({ id: 'm', spd: 10, equipment: holding('terra_robe', 'armor') });
    return makeGameState({ units: [mage] });
  };
  const cast = (ability: typeof earthStrike): ReadonlyArray<ProposedAction> => {
    const state = scenario();
    return runOnActionResolved(state, cat, {
      unit: state.units.get(unitId('m'))!,
      action: {
        type: 'use_ability',
        source: 'player',
        actorId: unitId('m'),
        payload: { abilityId: ability.id, target: { kind: 'unit', unitId: unitId('m') } },
      },
      ability,
    });
  };

  it('an earth-damage cast grants exactly one Terra Attunement stack', () => {
    const emissions = cast(earthStrike);
    expect(emissions).toHaveLength(1);
    expect(emissions[0]).toMatchObject({
      type: 'system_apply_status',
      payload: { targetId: unitId('m'), statusTypeId: statusTypeId('terra_attunement') },
    });
  });

  it('a water cast grants nothing (damageTagAll gate)', () => {
    expect(cast(waterStrike)).toHaveLength(0);
  });
});

describe('Void Robe — lightning damage marks Vulnerable (spell-proc seam)', () => {
  const invokeDealt = (tags: ReadonlyArray<string>) => {
    const mage = makeUnit({ id: 'm', spd: 10, equipment: holding('void_robe', 'armor') });
    const foe = makeUnit({ id: 'f', spd: 10, team: 'team_b', position: { x: 1, y: 0, layer: 0 } });
    const state = makeGameState({ units: [mage, foe] });
    const handlers = collectActiveHandlers(state, unitId('m'), cat, 'onDamageDealt');
    const ctx = {
      attacker: state.units.get(unitId('m'))!,
      target: state.units.get(unitId('f'))!,
      sourceActionSeq: 0,
      sourceAbilityId: abilityId('attack'),
      damageTags: new Set(tags),
      baseDamage: 50,
      multipliers: [],
      additives: [],
      variance: { min: 1, max: 1 },
      hit: true,
      targetCount: 1,
      actionSeed: 42,
      scenarioTier: 1,
    };
    return handlers
      .map((h) => h.invoke({ unit: state.units.get(unitId('m'))!, ctx } as never))
      .flatMap((r) => (r as { emittedActions?: ReadonlyArray<ProposedAction> }).emittedActions ?? []);
  };

  it('fires void_vulnerable_proc against the victim on lightning damage', () => {
    const emitted = invokeDealt(['magical', 'lightning']);
    expect(emitted).toHaveLength(1);
    expect(emitted[0]).toMatchObject({
      type: 'use_ability',
      payload: { abilityId: abilityId('void_vulnerable_proc'), target: { kind: 'unit', unitId: unitId('f') } },
    });
  });

  it('stays quiet on fire damage (tag gate)', () => {
    expect(invokeDealt(['magical', 'fire'])).toHaveLength(0);
  });
});

describe('Moon Robe — ×1.5 water spell power (multiplicative SP seam)', () => {
  it('multiplies water-tagged spell power and nothing else', () => {
    const mage = makeUnit({ id: 'm', spd: 10, equipment: holding('moon_robe', 'armor') });
    const state = makeGameState({ units: [mage] });
    const unit = state.units.get(unitId('m'))!;
    const water = runModifySpellPower(state, cat, {
      unit, ability: waterStrike, targetCount: 1, baseValue: 5,
    });
    expect(water).toBe(7.5);
    const earth = runModifySpellPower(state, cat, {
      unit, ability: earthStrike, targetCount: 1, baseValue: 5,
    });
    expect(earth).toBe(5);
  });

  // Ch3-brief playtest fix. The pre-fix wiring seeded the SP chain with 0
  // and ADDED the result to the coefficient, so the robe's factor
  // multiplied only the other riders' deltas — ×1.0 alone (68→68 in the
  // playtest report), and a target-dependent smear when an additive rider
  // happened to be equipped. These pin the intended compose: the factor
  // scales the REAL Spell Power, so on-vs-off is exactly ×1.5 through the
  // full pipeline for EVERY target; resistance composes after.
  const castWaterAt = (robed: boolean, targetEquipment?: UnitEquipment): number => {
    // Bare-armored control (a Linen Robe control would smuggle in its MA +2
    // and skew the ratio); the robe's own statMods are HP/MP only, so
    // on-vs-off isolates the SP factor.
    const mage = makeUnit({
      id: 'm', spd: 10, ma: 10, faith: 100,
      ...(robed ? { equipment: holding('moon_robe', 'armor') } : {}),
    });
    const target = makeUnit({
      id: 't', spd: 10, hp: 500, maxHpBase: 500, faith: 100,
      position: { x: 1, y: 0, layer: 0 },
      ...(targetEquipment !== undefined ? { equipment: targetEquipment } : {}),
    });
    const state = makeGameState({ units: [mage, target] });
    return (
      runDamagePipeline({
        state,
        catalog: cat,
        attacker: state.units.get(unitId('m'))!,
        target: state.units.get(unitId('t'))!,
        ability: waterStrike,
        sourceActionSeq: 0,
        seed: 12345,
        registry: defaultDamageHandlers,
      }).finalDamage ?? -1
    );
  };

  it('full pipeline: ×1.5 with NO additive SP rider equipped (the playtest 68→68 case)', () => {
    const off = castWaterAt(false);
    const on = castWaterAt(true);
    expect(on).toBe(off * 1.5); // MA 10 × SP 8 → 80; robed → 120
  });

  it('full pipeline: on-vs-off stays exactly ×1.5 against a water-resistant target', () => {
    const warded = holding('mantle_of_protection', 'armor');
    const off = castWaterAt(false, warded);
    const on = castWaterAt(true, warded);
    expect(off).toBeLessThan(castWaterAt(false)); // the resist is real
    expect(on).toBe(off * 1.5); // …and orthogonal to the robe
  });
});

describe('Prism Wand — the four utilities on any elemental spell', () => {
  it('content pin: every rider gates on the four-element list', () => {
    const elems = ['fire', 'water', 'earth', 'lightning'];
    expect(prismWand.abilityRangeModifiers?.[0]?.tagFilter).toEqual(elems);
    expect(prismWand.aoeVerticalToleranceModifiers?.[0]?.tagFilter).toEqual(elems);
    expect(prismWand.actionSpeedModifiers?.[0]?.tagFilter).toEqual(elems);
    expect(prismWand.spellPowerModifiers?.[0]?.tagFilter).toEqual(elems);
    expect(prismWand.statusApplicationStackCountModifiers?.[0]?.sourceAbilityTagAny).toEqual(elems);
  });
});

describe('Palliative Pike — ally-only heal pulse around the wielder', () => {
  it('the proc-fired pulse heals the adjacent ally, skips the adjacent enemy and the wielder', () => {
    const wielder = makeUnit({
      id: 'w', spd: 10, ma: 10, hp: 60, maxHpBase: 100,
      equipment: holding('palliative_pike'),
      position: { x: 2, y: 2, layer: 0 },
    });
    const ally = makeUnit({ id: 'ally', spd: 10, hp: 50, maxHpBase: 100, position: { x: 2, y: 3, layer: 0 } });
    const foe = makeUnit({ id: 'foe', spd: 10, hp: 50, maxHpBase: 100, team: 'team_b', position: { x: 2, y: 1, layer: 0 } });
    const state = makeGameState({
      units: [wielder, ally, foe],
      map: flatMap(5, 5),
      turnState: activeTurnFor(unitId('w')),
      masterSeed: 1,
    });
    // Fire the pulse exactly as the attackProcs rider emits it.
    const pulse: ProposedAction = {
      type: 'use_ability',
      source: 'system',
      actorId: unitId('w'),
      payload: {
        abilityId: abilityId('palliative_pulse'),
        target: { kind: 'self' },
        riderSource: { kind: 'equipment_proc', itemId: itemId('palliative_pike') },
      },
    };
    const r = commitAction(state, pulse, cat);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const after = r.newState;
    // Heal = MA 10 × 4 (noFaithScaling, no variance) = 40.
    expect(after.units.get(unitId('ally'))!.vitals.hp).toBe(90);
    expect(after.units.get(unitId('foe'))!.vitals.hp).toBe(50); // allies_only skips enemies
    expect(after.units.get(unitId('w'))!.vitals.hp).toBe(60); // excludeCaster default
  });
});
