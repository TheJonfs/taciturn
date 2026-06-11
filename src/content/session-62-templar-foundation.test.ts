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
import { defaultTestRulesets } from '../engine/catalog/test-fixtures.ts';
import { makeGameState, makeUnit } from '../engine/ct/test-fixtures.ts';
import { applyStatus } from '../engine/status/apply.ts';
import {
  ACTIVE_BUCKET_IDS,
  PASSIVE_BUCKET_IDS,
} from '../engine/abilities/constants.ts';
import { loadDefaultCatalog } from './index.ts';
import { faithstrider } from './abilities/faithstrider.ts';
import { defender } from './items/defender.ts';
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
