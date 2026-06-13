// Session 62 — Templar arc foundation. Two shippable-whole pieces:
//   1. Faithstrider — the Templar's Movement passive (+1 moveRange, +10
//      faith), the Bravestrider-shaped dual-axis stat mod.
//   2. Defender — the second Knight Sword, granting Auto-Protect (a
//      permanent `protect` status via equipment statusGrants).
//
// Behavioural contracts only; composition with the full reducer / battle
// start is covered by the engine hook + statusGrants tests (session-29).

import { describe, expect, it } from 'vitest';
import {
  abilityId,
  bucketId,
  classId,
  commandSetId,
  itemId,
  statusTypeId,
  runModifyResistance,
  runModifyStatQuery,
  type AbilityId,
  type ClassDefinition,
  type CommandSetDefinition,
  type Loadout,
} from '@engine/index.ts';
import { createCatalog } from '../engine/catalog/index.ts';
import {
  DEFAULT_TEST_DAMAGE_PIPELINE,
  defaultTestRulesets,
  makeTestRuleset,
} from '../engine/catalog/test-fixtures.ts';
import { makeGameState, makeUnit } from '../engine/ct/test-fixtures.ts';
import { applyStatus } from '../engine/status/apply.ts';
import { runDamagePipeline } from '../engine/damage/pipeline.ts';
import { defaultDamageHandlers } from '../engine/damage/default-handlers.ts';
import {
  ACTIVE_BUCKET_IDS,
  PASSIVE_BUCKET_IDS,
} from '../engine/abilities/constants.ts';
import { loadDefaultCatalog } from './index.ts';
import { cure } from './abilities/cure.ts';
import { raise } from './abilities/raise.ts';
import { jump } from './abilities/jump.ts';
import { faithstrider } from './abilities/faithstrider.ts';
import { monkeygrip } from './abilities/monkeygrip.ts';
import { emissary } from './abilities/emissary.ts';
import { unifiedCalling } from './abilities/unified-calling.ts';
import { defender } from './items/defender.ts';
import { lance } from './items/lance.ts';
import { impHalberd } from './items/imp-halberd.ts';
import { protect } from './statuses/protect.ts';

// ---------------------------------------------------------------------------
// Faithstrider — self-contained catalog (mirrors movement-abilities.test.ts)
// ---------------------------------------------------------------------------

function knightClass(freeAbilities: ReadonlyArray<string>): ClassDefinition {
  return {
    id: classId('knight'),
    name: 'Knight',
    movement: { moveRange: 3, jump: 2, terrainCosts: new Map(), canEnter: new Set(['ground']) },
    evasion: { front: 0, side: 0, back: 0 },
    equipmentSlots: { leftHand: true, rightHand: true, headgear: true, armor: true, accessory: true },
    firstActionCommandSet: commandSetId('battle_skill'),
    freeAbilities: new Set(freeAbilities.map(abilityId)),
    dominantStat: 'pa',
  };
}

function battleSkillSet(): CommandSetDefinition {
  return {
    id: commandSetId('battle_skill'),
    name: 'Battle Skill',
    members: [],
    baseCost: 1,
    availability: 'hidden',
  };
}

function loadoutWith(bucket: string, passives: ReadonlyArray<AbilityId>): Loadout {
  const actionBuckets: Record<string, ReadonlyArray<ReturnType<typeof commandSetId>>> = {};
  for (const b of ACTIVE_BUCKET_IDS) actionBuckets[b] = [];
  const passiveBuckets: Record<string, ReadonlyArray<AbilityId>> = {};
  for (const b of PASSIVE_BUCKET_IDS) passiveBuckets[b] = [];
  passiveBuckets[bucket] = passives;
  return { actionBuckets, passiveBuckets };
}

function faithstriderCatalog() {
  return createCatalog({
    statusTypes: [],
    abilities: [faithstrider],
    commandSets: [battleSkillSet()],
    classes: [knightClass(['faithstrider'])],
    items: [],
    rulesets: defaultTestRulesets,
  });
}

describe('Faithstrider (Templar Movement passive)', () => {
  const cat = faithstriderCatalog();
  const unit = makeUnit({
    id: 'u',
    spd: 8,
    loadout: loadoutWith(bucketId('movement'), [faithstrider.id]),
  });
  const state = makeGameState({ units: [unit] });

  it('grants +1 moveRange', () => {
    expect(
      runModifyStatQuery(state, cat, { unit, statName: 'moveRange', baseValue: 2 }),
    ).toBe(3);
  });

  it('grants +10 faith', () => {
    expect(
      runModifyStatQuery(state, cat, { unit, statName: 'faith', baseValue: 80 }),
    ).toBe(90);
  });

  it('leaves unrelated stats (spd, pa) untouched', () => {
    expect(runModifyStatQuery(state, cat, { unit, statName: 'spd', baseValue: 8 })).toBe(8);
    expect(runModifyStatQuery(state, cat, { unit, statName: 'pa', baseValue: 6 })).toBe(6);
  });

  it('is a cost-2 Movement passive (parity with Bravestrider)', () => {
    expect(faithstrider.bucket).toBe(bucketId('movement'));
    expect(faithstrider.baseCost).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Defender — Knight Sword granting Auto-Protect
// ---------------------------------------------------------------------------

describe('Defender (second Knight Sword, Auto-Protect)', () => {
  it('is a two-handed WP-11 Brave-variance sword', () => {
    expect(defender.kind).toBe('weapon');
    if (defender.kind !== 'weapon') return;
    expect(defender.wp).toBe(11);
    expect(defender.accuracy).toBe(95);
    expect(defender.twoHanded).toBe(true);
    expect(defender.tags).toContain('sword');
    expect(defender.physicalVariance).toEqual({ kind: 'attacker_brave', spread: 0.05 });
  });

  it('grants the permanent Protect status via statusGrants', () => {
    expect(defender.statusGrants).toContain(statusTypeId('protect'));
  });

  it('is registered in the default catalog', () => {
    const cat = loadDefaultCatalog();
    expect(cat.hasItem(itemId('defender'))).toBe(true);
    expect(cat.getItem(itemId('defender')).name).toBe('Defender');
  });

  it("Defender's granted Protect reduces physical damage 50% (and not magical)", () => {
    // Drive the assertion off the item's own wiring: the status Defender
    // grants is exactly what reduces incoming physical.
    const grantedTypeId = defender.statusGrants![0]!;
    const cat = createCatalog({
      statusTypes: [protect],
      abilities: [],
      commandSets: [],
      classes: [knightClass([])],
      items: [],
      rulesets: defaultTestRulesets,
    });
    const u = makeUnit({ id: 'u', spd: 8 });
    let state = makeGameState({ units: [u] });
    const applied = applyStatus(
      state,
      { targetId: u.id, typeId: grantedTypeId, sourceUnitId: null, sourceActionSeq: null },
      cat,
    );
    state = applied.newState;
    const target = state.units.get(u.id)!;
    expect(target.statuses[0]?.typeId).toBe(statusTypeId('protect'));
    expect(target.statuses[0]?.magnitude).toBe(50);
    expect(runModifyResistance(state, cat, { unit: target, tag: 'physical', baseValue: 0 })).toBe(50);
    expect(runModifyResistance(state, cat, { unit: target, tag: 'magical', baseValue: 0 })).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Cure — S62 rework of the S13 placeholder into the spec'd AoE heal
// ---------------------------------------------------------------------------

describe('Cure (Templar AoE heal — S62 rework)', () => {
  it('is a charged AoE heal: actionSpeed 40, MP 8, power 8', () => {
    expect(cure.kind).toBe('active');
    if (cure.kind !== 'active') return;
    expect(cure.actionSpeed).toBe(40); // > 0 ⇒ charged
    expect(cure.mpCost).toBe(8);
    expect(cure.effects.damage?.power_coefficient).toBe(8);
    expect(cure.tags).toEqual(expect.arrayContaining(['magical', 'holy', 'healing']));
  });

  it('targets a unit or tile and blooms a 1-square diamond that includes the caster', () => {
    if (cure.kind !== 'active') return;
    expect(cure.targeting.kind).toBe('unit_or_tile');
    // S65: diamond r1 (same 5-tile footprint as the old cross r1, but Aether
    // Bloom now expands it to a proper diamond r2 rather than a thin cross r2).
    expect(cure.effects.aoe?.shape).toEqual({ kind: 'diamond', radius: 1 });
    // excludeCaster false → self-Cure loop; vertical tolerance 1 (Chris, S62).
    expect(cure.effects.aoe?.excludeCaster).toBe(false);
    expect(cure.effects.aoe?.verticalTolerance).toBe(1);
  });

  it('heals MA × 8 × faithFactor (symmetric caster×target faith)', () => {
    // faith 80 / 80 → factor 0.64; MA 6 → 6 × 8 × 0.64 = 30.72.
    const cat = createCatalog({
      statusTypes: [],
      abilities: [cure],
      commandSets: [],
      classes: [knightClass(['cure'])],
      items: [],
      rulesets: [makeTestRuleset({ damagePipelineStages: DEFAULT_TEST_DAMAGE_PIPELINE })],
    });
    const healer = makeUnit({ id: 'h', spd: 8, ma: 6 });
    const ally = makeUnit({ id: 'a', spd: 8, hp: 10, maxHpBase: 100 });
    const state = makeGameState({ units: [healer, ally] });
    const ctx = runDamagePipeline({
      state,
      catalog: cat,
      attacker: healer,
      target: ally,
      ability: cure,
      sourceActionSeq: 0,
      seed: 0,
      registry: defaultDamageHandlers,
    });
    expect(ctx.baseDamage).toBeCloseTo(30.72);
  });
});

// ---------------------------------------------------------------------------
// Raise — single-target spell revival (S62). End-to-end charged revive is
// covered in src/engine/actions/session-62-raise.test.ts; here: the spec
// fields and the heal-amount formula.
// ---------------------------------------------------------------------------

describe('Raise (Templar spell revival — S62)', () => {
  it('is a charged single-target revive: removeKO, power 10, SP 30, MP 12', () => {
    expect(raise.kind).toBe('active');
    if (raise.kind !== 'active') return;
    expect(raise.effects.removeKO).toBe(true);
    expect(raise.effects.damage?.power_coefficient).toBe(10);
    expect(raise.effects.damage?.tags).toContain('healing');
    expect(raise.actionSpeed).toBe(30);
    expect(raise.mpCost).toBe(12);
    expect(raise.targeting.kind).toBe('single_unit');
    // No AoE — scope is a single ally, matching Phoenix Down.
    expect(raise.effects.aoe).toBeUndefined();
  });

  it('heals MA × 10 × faithFactor on top of the revive (power 10 > Cure 8)', () => {
    // faith 80 / 80 → 0.64; MA 6 → 6 × 10 × 0.64 = 38.4.
    const cat = createCatalog({
      statusTypes: [],
      abilities: [raise],
      commandSets: [],
      classes: [knightClass(['raise'])],
      items: [],
      rulesets: [makeTestRuleset({ damagePipelineStages: DEFAULT_TEST_DAMAGE_PIPELINE })],
    });
    const healer = makeUnit({ id: 'h', spd: 8, ma: 6 });
    const ally = makeUnit({ id: 'a', spd: 8, hp: 10, maxHpBase: 100 });
    const state = makeGameState({ units: [healer, ally] });
    const ctx = runDamagePipeline({
      state,
      catalog: cat,
      attacker: healer,
      target: ally,
      ability: raise,
      sourceActionSeq: 0,
      seed: 0,
      registry: defaultDamageHandlers,
    });
    expect(ctx.baseDamage).toBeCloseTo(38.4);
  });
});

// ---------------------------------------------------------------------------
// Monkeygrip — Support passive that relaxes the two-handed equip rule.
// The real createInitialState behavior is in
// src/engine/setup/session-62-monkeygrip.test.ts; here: the declarative
// capability flag and the budget shape.
// ---------------------------------------------------------------------------

describe('Monkeygrip (Templar Support passive — S62)', () => {
  it('declares relaxesTwoHandedGrip and carries no runtime hook', () => {
    expect(monkeygrip.kind).toBe('passive');
    if (monkeygrip.kind !== 'passive') return;
    expect(monkeygrip.relaxesTwoHandedGrip).toBe(true);
    expect(monkeygrip.hooks).toHaveLength(0); // declarative, not a runtime hook
  });

  it('is a cost-2 Support passive', () => {
    expect(monkeygrip.bucket).toBe(bucketId('support'));
    expect(monkeygrip.baseCost).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Emissary + Unified Calling — Step 3 innates (ADR-0101). Behavior is in
// src/engine/actions/session-62-heal-hooks.test.ts; here: the budget shapes.
// ---------------------------------------------------------------------------

describe('Emissary + Unified Calling (Step 3 innates — S62)', () => {
  it('Emissary is a cost-1 Support passive', () => {
    expect(emissary.bucket).toBe(bucketId('support'));
    expect(emissary.baseCost).toBe(1);
  });

  it('Unified Calling is a cost-1 Reaction passive', () => {
    expect(unifiedCalling.bucket).toBe(bucketId('reaction'));
    expect(unifiedCalling.baseCost).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Lance + Imp Halberd — the Lance weapon class (pierces). Pierce behavior is
// in src/engine/actions/session-62-lance-pierce.test.ts; here: the stat lines.
// ---------------------------------------------------------------------------

describe('Lance + Imp Halberd (Lance weapon class — S62)', () => {
  it('Lance: WP 10, two-handed, H2/V4, pierces, static variance', () => {
    if (lance.kind !== 'weapon') return;
    expect(lance.wp).toBe(10);
    expect(lance.twoHanded).toBe(true);
    expect(lance.accuracy).toBe(95);
    expect(lance.pierces).toBe(true);
    expect(lance.range).toEqual({ min: 1, max: 2, vertical: 4 });
    expect(lance.tags).toContain('lance');
    expect(lance.physicalVariance).toEqual({ kind: 'static', min: 0.9, max: 1.1 });
  });

  it('Imp Halberd: WP 8, pierces, MA +1 (the variant trade)', () => {
    if (impHalberd.kind !== 'weapon') return;
    expect(impHalberd.wp).toBe(8);
    expect(impHalberd.pierces).toBe(true);
    expect(impHalberd.statMods).toEqual({ ma: 1 });
  });
});

// ---------------------------------------------------------------------------
// Jump — the Dragoon off-field leap. Behavior is in
// src/engine/actions/session-62-jump.test.ts; here: the spec fields.
// ---------------------------------------------------------------------------

describe('Jump (Dragoon off-field leap — S62)', () => {
  it('is a charged tile-targeted leap: jumpLeap, 3×Speed rate, lanceBonus, H6/V6, MP 6', () => {
    if (jump.kind !== 'active') return;
    expect(jump.effects.jumpLeap).toBe(true);
    expect(jump.chargeSpeedFromUnitSpeed).toBe(3);
    expect(jump.actionSpeed).toBeGreaterThan(0); // charged
    expect(jump.mpCost).toBe(6);
    expect(jump.targeting.kind).toBe('tile'); // dodge window
    if (jump.targeting.kind === 'tile') {
      expect(jump.targeting.range).toEqual({ horizontal: 6, vertical: 6 });
    }
    expect(jump.effects.damage?.lanceBonus).toBe(true);
    expect(jump.effects.damage?.power_coefficient).toBe(1);
  });
});
