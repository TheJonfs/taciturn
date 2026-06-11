// Session 62 — Step 3 heal hooks (ADR-0101): Emissary (caster-side
// outgoing-healing ×1.25 via `modifyOutgoingHealing`) and Unified Calling
// (recipient-side +PA MP on a one-time heal via `onHealingReceived`).
//
// Coverage: the two runners in isolation, Emissary's pipeline multiplier,
// and an end-to-end instant heal where a caster WITH Emissary heals a target
// WITH Unified Calling — the target heals 1.25× and gains its PA in MP.

import { describe, expect, it } from 'vitest';
import { createCatalog } from '../catalog/index.ts';
import {
  DEFAULT_TEST_DAMAGE_PIPELINE,
  makeTestRuleset,
} from '../catalog/test-fixtures.ts';
import { makeGameState, makeUnit } from '../ct/test-fixtures.ts';
import { flatMap } from '../map/test-fixtures.ts';
import { runDamagePipeline } from '../damage/pipeline.ts';
import { defaultDamageHandlers } from '../damage/default-handlers.ts';
import { runModifyOutgoingHealing, runOnHealingReceived } from '../hooks/runners.ts';
import { ACTIVE_BUCKET_IDS, PASSIVE_BUCKET_IDS } from '../abilities/constants.ts';
import { commitAction } from './commit.ts';
import {
  abilityId,
  bucketId,
  classId,
  commandSetId,
  unitId,
  type AbilityId,
  type ActiveAbilityDefinition,
  type ClassDefinition,
  type CommandSetDefinition,
  type Loadout,
} from '@engine/index.ts';
import { emissary } from '../../content/abilities/emissary.ts';
import { unifiedCalling } from '../../content/abilities/unified-calling.ts';

// --- Fixtures ---

function knightClass(free: ReadonlyArray<string> = []): ClassDefinition {
  return {
    id: classId('knight'),
    name: 'Knight',
    movement: { moveRange: 3, jump: 2, terrainCosts: new Map(), canEnter: new Set(['ground']) },
    evasion: { front: 0, side: 0, back: 0 },
    equipmentSlots: { leftHand: true, rightHand: true, headgear: true, armor: true, accessory: true },
    firstActionCommandSet: commandSetId('white_magic'),
    freeAbilities: new Set(free.map(abilityId)),
    dominantStat: 'ma',
  };
}

// Instant single-target heal (actionSpeed 0) so the end-to-end test resolves
// on commit without the charged-action dance. power 4.
function instantHeal(): ActiveAbilityDefinition {
  return {
    id: abilityId('test_heal'),
    name: 'Test Heal',
    kind: 'active',
    bucket: bucketId('first_action'),
    baseCost: 1,
    availability: 'hidden',
    tags: ['magical', 'healing'],
    targeting: { kind: 'single_unit', range: { horizontal: 4, vertical: 99 }, rangeMode: 'arc' },
    actionSpeed: 0,
    mpCost: 0,
    effects: { damage: { tags: ['magical', 'healing'], power_coefficient: 4 } },
  };
}

function healCommandSet(): CommandSetDefinition {
  return {
    id: commandSetId('white_magic'),
    name: 'White Magic',
    members: [abilityId('test_heal')],
    baseCost: 1,
    availability: 'hidden',
  };
}

function loadout(args: {
  readonly firstAction?: string;
  readonly support?: ReadonlyArray<AbilityId>;
  readonly reaction?: ReadonlyArray<AbilityId>;
}): Loadout {
  const actionBuckets: Record<string, ReadonlyArray<ReturnType<typeof commandSetId>>> = {};
  for (const b of ACTIVE_BUCKET_IDS) actionBuckets[b] = [];
  if (args.firstAction) actionBuckets[bucketId('first_action')] = [commandSetId(args.firstAction)];
  const passiveBuckets: Record<string, ReadonlyArray<AbilityId>> = {};
  for (const b of PASSIVE_BUCKET_IDS) passiveBuckets[b] = [];
  if (args.support) passiveBuckets[bucketId('support')] = args.support;
  if (args.reaction) passiveBuckets[bucketId('reaction')] = args.reaction;
  return { actionBuckets, passiveBuckets };
}

function turnFor(id: string) {
  return {
    unitId: unitId(id),
    budget: { movesAvailable: 1, actsAvailable: 1 },
    consumed: { movesConsumed: 0, actsConsumed: 0 },
    reactionsUsedThisTurn: new Map(),
  };
}

function ruleset() {
  return makeTestRuleset({ damagePipelineStages: DEFAULT_TEST_DAMAGE_PIPELINE });
}

function catalogWith(free: ReadonlyArray<string>) {
  return createCatalog({
    statusTypes: [],
    abilities: [instantHeal(), emissary, unifiedCalling],
    commandSets: [healCommandSet()],
    classes: [knightClass(free)],
    items: [],
    rulesets: [ruleset()],
  });
}

// --- Emissary ---

describe('Emissary — outgoing-healing multiplier', () => {
  it('runModifyOutgoingHealing returns 1.25 with Emissary, 1 without', () => {
    const cat = catalogWith(['emissary']);
    const withEm = makeUnit({ id: 'h', spd: 8, loadout: loadout({ support: [emissary.id] }) });
    const without = makeUnit({ id: 'p', spd: 8, loadout: loadout({}) });
    const state = makeGameState({ units: [withEm, without] });
    expect(runModifyOutgoingHealing(state, cat, { unit: withEm, baseValue: 1 })).toBeCloseTo(1.25);
    expect(runModifyOutgoingHealing(state, cat, { unit: without, baseValue: 1 })).toBe(1);
  });

  it('multiplies pipeline healing ×1.25 (composes at the finalize fold)', () => {
    const cat = catalogWith(['emissary']);
    // base = MA 5 × power 4 × faith(100×100=1) = 20; Emissary → 25.
    const caster = makeUnit({ id: 'c', spd: 8, ma: 5, faith: 100, loadout: loadout({ support: [emissary.id] }) });
    const target = makeUnit({ id: 't', spd: 8, faith: 100, hp: 10, maxHpBase: 100 });
    const state = makeGameState({ units: [caster, target] });
    const ctx = runDamagePipeline({
      state, catalog: cat, attacker: caster, target,
      ability: instantHeal(), sourceActionSeq: 0, seed: 0,
      registry: defaultDamageHandlers,
    });
    expect(ctx.baseDamage).toBeCloseTo(20);
    expect(ctx.multipliers.some((m) => m.source === 'emissary' && m.factor === 1.25)).toBe(true);
    expect(ctx.finalDamage).toBe(25);
  });
});

// --- Unified Calling ---

describe('Unified Calling — on-heal MP restore', () => {
  it('runOnHealingReceived emits a system_mp_restore of the recipient PA', () => {
    const cat = catalogWith(['unified_calling']);
    const uc = makeUnit({ id: 'u', spd: 8, pa: 6, loadout: loadout({ reaction: [unifiedCalling.id] }) });
    const plain = makeUnit({ id: 'p', spd: 8, pa: 6, loadout: loadout({}) });
    const state = makeGameState({ units: [uc, plain] });
    const emitted = runOnHealingReceived(state, cat, { unit: uc, amount: 12 });
    expect(emitted).toHaveLength(1);
    expect(emitted[0]?.type).toBe('system_mp_restore');
    if (emitted[0]?.type === 'system_mp_restore') {
      expect(emitted[0].payload.targetId).toBe(uc.id);
      expect(emitted[0].payload.amount).toBe(6);
    }
    expect(runOnHealingReceived(state, cat, { unit: plain, amount: 12 })).toHaveLength(0);
  });
});

// --- End-to-end: Emissary caster heals a Unified Calling target ---

describe('Heal hooks end-to-end (instant ability heal)', () => {
  it('Emissary caster heals 1.25×; the Unified Calling target gains its PA in MP', () => {
    const cat = catalogWith(['emissary', 'unified_calling']);
    const healer = makeUnit({
      id: 'healer', team: 'team_a', spd: 8, ma: 5, faith: 100, mp: 10,
      loadout: loadout({ firstAction: 'white_magic', support: [emissary.id] }),
      position: { x: 0, y: 0, layer: 0 },
    });
    const ally = makeUnit({
      id: 'ally', team: 'team_a', spd: 8, pa: 6, faith: 100,
      hp: 10, maxHpBase: 100, mp: 0, maxMpBase: 50,
      loadout: loadout({ reaction: [unifiedCalling.id] }),
      position: { x: 1, y: 0, layer: 0 },
    });
    const state = makeGameState({
      units: [healer, ally], map: flatMap(5, 5), turnState: turnFor('healer'),
    });
    const r = commitAction(state, {
      type: 'use_ability', source: 'player', actorId: healer.id,
      payload: { abilityId: abilityId('test_heal'), target: { kind: 'unit', unitId: ally.id } },
    }, cat);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const healed = r.newState.units.get(ally.id)!;
    // HP: 10 + (MA 5 × power 4 × faith 1 × Emissary 1.25) = 10 + 25 = 35.
    expect(healed.vitals.hp).toBe(35);
    // MP: Unified Calling restored PA 6 (from 0).
    expect(healed.vitals.mp).toBe(6);
  });
});
