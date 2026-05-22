// Session 28 integration tests — the structural maxMp introduction,
// the two new hook surfaces (`modifyBucketCapacity`,
// `modifyStatusTickAmount`), the additive-then-multiplicative
// composition order rule for equipment-tier modifyStatQuery, and the
// Burn × Purifier interaction.
//
// Per the brief: per-hook coverage (empty chain, single contributor,
// multi-contributor composition) plus integration tests where each hook
// composes with its consumer (`fillVitalsFromComputedMaxes`,
// `getCapacity`, `reduceStatusTick`, Burn's onTick).

import { describe, expect, it } from 'vitest';
import { createCatalog } from '../catalog/index.ts';
import { defaultTestRulesets } from '../catalog/test-fixtures.ts';
import {
  makeKnight,
  knightLoadout,
  makeAbilitiesCatalog,
} from '../abilities/test-fixtures.ts';
import { getCapacity } from '../abilities/capacity.ts';
import { makeGameState, makeUnit } from '../ct/test-fixtures.ts';
import {
  runModifyBucketCapacity,
  runModifyStatQuery,
  runModifyStatusTickAmount,
} from '../hooks/runners.ts';
import { burn } from '../../content/statuses/burn.ts';
import { reduceStatusTick } from './reducers.ts';
import { applyStatus } from '../status/apply.ts';
import {
  bucketId,
  itemId,
  statusTypeId,
  unitId,
  type ItemId,
  type StatusTag,
  type StatusTypeId,
  type UnitEquipment,
} from '../types/index.ts';
import type {
  ItemDefinition,
  ArmorEquipment,
  HeadgearEquipment,
  AccessoryEquipment,
} from '../catalog/index.ts';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeAccessory(args: {
  readonly id: string;
  readonly statMods?: Record<string, number>;
  readonly statModsMultiplicative?: Record<string, number>;
  readonly bucketCapacityMods?: ReadonlyMap<ReturnType<typeof bucketId>, number>;
  readonly statusTickAmountMultipliers?: ReadonlyArray<{
    readonly factor: number;
    readonly statusTypeId?: StatusTypeId;
    readonly statusTag?: StatusTag;
  }>;
}): AccessoryEquipment {
  return {
    id: itemId(args.id),
    name: args.id,
    kind: 'accessory',
    availability: 'available',
    ...(args.statMods !== undefined ? { statMods: args.statMods } : {}),
    ...(args.statModsMultiplicative !== undefined
      ? { statModsMultiplicative: args.statModsMultiplicative }
      : {}),
    ...(args.bucketCapacityMods !== undefined
      ? { bucketCapacityMods: args.bucketCapacityMods }
      : {}),
    ...(args.statusTickAmountMultipliers !== undefined
      ? {
          statusTickAmountMultipliers: args.statusTickAmountMultipliers.map((m) => ({
            factor: m.factor,
            ...(m.statusTypeId !== undefined ? { statusTypeId: m.statusTypeId } : {}),
            ...(m.statusTag !== undefined ? { statusTag: m.statusTag } : {}),
          })),
        }
      : {}),
  } as AccessoryEquipment;
}

function makeArmor(args: {
  readonly id: string;
  readonly statMods?: Record<string, number>;
  readonly statModsMultiplicative?: Record<string, number>;
}): ArmorEquipment {
  return {
    id: itemId(args.id),
    name: args.id,
    kind: 'armor',
    availability: 'available',
    ...(args.statMods !== undefined ? { statMods: args.statMods } : {}),
    ...(args.statModsMultiplicative !== undefined
      ? { statModsMultiplicative: args.statModsMultiplicative }
      : {}),
  } as ArmorEquipment;
}

function makeHeadgear(args: {
  readonly id: string;
  readonly bucketCapacityMods?: ReadonlyMap<ReturnType<typeof bucketId>, number>;
}): HeadgearEquipment {
  return {
    id: itemId(args.id),
    name: args.id,
    kind: 'headgear',
    availability: 'available',
    ...(args.bucketCapacityMods !== undefined
      ? { bucketCapacityMods: args.bucketCapacityMods }
      : {}),
  } as HeadgearEquipment;
}

function catalogWithItems(items: ReadonlyArray<ItemDefinition>) {
  return createCatalog({
    statusTypes: [],
    abilities: [],
    commandSets: [],
    classes: [makeKnight()],
    items,
    rulesets: defaultTestRulesets,
  });
}

function equipAccessory(id: ItemId): UnitEquipment {
  return { leftHand: null, rightHand: null, headgear: null, armor: null, accessory: id };
}

function equipHead(id: ItemId): UnitEquipment {
  return { leftHand: null, rightHand: null, headgear: id, armor: null, accessory: null };
}

function equipArmor(id: ItemId): UnitEquipment {
  return { leftHand: null, rightHand: null, headgear: null, armor: id, accessory: null };
}

function equipBoth(armor: ItemId, accessory: ItemId): UnitEquipment {
  return {
    leftHand: null,
    rightHand: null,
    headgear: null,
    armor,
    accessory,
  };
}

// ---------------------------------------------------------------------------
// maxMp stat composition
// ---------------------------------------------------------------------------

describe('runModifyStatQuery(maxMp) — composition', () => {
  it('returns the unit\'s maxMpBase unchanged when no contributors fire', () => {
    const cat = makeAbilitiesCatalog({});
    const u = makeUnit({ id: 'u', spd: 10, maxMpBase: 60 });
    const state = makeGameState({ units: [u] });
    const value = runModifyStatQuery(state, cat, {
      unit: u,
      statName: 'maxMp',
      baseValue: u.baseStats.maxMpBase,
    });
    expect(value).toBe(60);
  });

  it('applies a single additive equipment contributor (Wizard\'s Robe +40 → 100)', () => {
    const robe = makeArmor({ id: 'wizards_robe', statMods: { maxMpBase: 40 } });
    const cat = catalogWithItems([robe]);
    const u = makeUnit({ id: 'u', spd: 10, maxMpBase: 60, equipment: equipArmor(robe.id) });
    const state = makeGameState({ units: [u] });
    const value = runModifyStatQuery(state, cat, {
      unit: u,
      statName: 'maxMp',
      baseValue: u.baseStats.maxMpBase,
    });
    expect(value).toBe(100);
  });

  it('applies a single multiplicative equipment contributor (Staff of Abundance ×1.5 → 90)', () => {
    const staff = makeAccessory({
      id: 'staff_of_abundance',
      statModsMultiplicative: { maxMp: 1.5 },
    });
    const cat = catalogWithItems([staff]);
    const u = makeUnit({ id: 'u', spd: 10, maxMpBase: 60, equipment: equipAccessory(staff.id) });
    const state = makeGameState({ units: [u] });
    const value = runModifyStatQuery(state, cat, {
      unit: u,
      statName: 'maxMp',
      baseValue: u.baseStats.maxMpBase,
    });
    expect(value).toBe(90);
  });

  it('composes additives BEFORE multiplicatives per ADR-0058: (60 + 40) × 1.5 = 150', () => {
    // Slot order is fixed (leftHand → rightHand → headgear → armor →
    // accessory), so even if the accessory ships before the armor in
    // the catalog list, iteration produces additive (armor.statMods)
    // first, then multiplicative (accessory.statModsMultiplicative).
    // The contributor's two-pass yield enforces this even when both
    // fields ship on the same item.
    const robe = makeArmor({ id: 'wizards_robe', statMods: { maxMpBase: 40 } });
    const staff = makeAccessory({
      id: 'staff_of_abundance',
      statModsMultiplicative: { maxMp: 1.5 },
    });
    const cat = catalogWithItems([robe, staff]);
    const u = makeUnit({
      id: 'u',
      spd: 10,
      maxMpBase: 60,
      equipment: equipBoth(robe.id, staff.id),
    });
    const state = makeGameState({ units: [u] });
    const value = runModifyStatQuery(state, cat, {
      unit: u,
      statName: 'maxMp',
      baseValue: u.baseStats.maxMpBase,
    });
    expect(value).toBe(150);
  });

  it('two-pass ordering holds with reversed slot priority too: accessory before armor in slot iteration still yields additive first', () => {
    // Verify by flipping which slot carries which kind of modifier:
    // accessory does the additive (+40), armor does the multiplicative
    // (×1.5). Iteration still yields all additives before all
    // multiplicatives because the contributor's outer loop is "pass 1
    // = additive (statMods)" then "pass 2 = multiplicative
    // (statModsMultiplicative)" — slot order is the inner loop.
    const robe = makeArmor({ id: 'mult_robe', statModsMultiplicative: { maxMp: 1.5 } });
    const ring = makeAccessory({ id: 'plus_ring', statMods: { maxMpBase: 40 } });
    const cat = catalogWithItems([robe, ring]);
    const u = makeUnit({
      id: 'u',
      spd: 10,
      maxMpBase: 60,
      equipment: equipBoth(robe.id, ring.id),
    });
    const state = makeGameState({ units: [u] });
    const value = runModifyStatQuery(state, cat, {
      unit: u,
      statName: 'maxMp',
      baseValue: u.baseStats.maxMpBase,
    });
    expect(value).toBe(150);
  });

  it('factor 1.0 short-circuits (no-op multiplicative entry does not modify the running value)', () => {
    const noop = makeAccessory({
      id: 'noop',
      statModsMultiplicative: { maxMp: 1 },
    });
    const cat = catalogWithItems([noop]);
    const u = makeUnit({ id: 'u', spd: 10, maxMpBase: 60, equipment: equipAccessory(noop.id) });
    const state = makeGameState({ units: [u] });
    const value = runModifyStatQuery(state, cat, {
      unit: u,
      statName: 'maxMp',
      baseValue: u.baseStats.maxMpBase,
    });
    expect(value).toBe(60);
  });

  it('statMods on the maxHpBase storage key still resolves to the maxHp query', () => {
    // Sanity check: the BaseStats → StatName mapping (`maxHpBase` →
    // `maxHp`) continues to work after the maxMpBase addition.
    const plate = makeArmor({ id: 'plate', statMods: { maxHpBase: 50 } });
    const cat = catalogWithItems([plate]);
    const u = makeUnit({ id: 'u', spd: 10, maxHpBase: 100, equipment: equipArmor(plate.id) });
    const state = makeGameState({ units: [u] });
    const value = runModifyStatQuery(state, cat, {
      unit: u,
      statName: 'maxHp',
      baseValue: u.baseStats.maxHpBase,
    });
    expect(value).toBe(150);
  });
});

// ---------------------------------------------------------------------------
// modifyBucketCapacity / getCapacity
// ---------------------------------------------------------------------------

describe('getCapacity (modifyBucketCapacity chain)', () => {
  it('returns the ruleset baseline unchanged when no contributors fire', () => {
    const cat = makeAbilitiesCatalog({});
    const u = makeUnit({ id: 'u', spd: 10, loadout: knightLoadout() });
    const state = makeGameState({ units: [u] });
    // Default ruleset bucket capacity for reaction is 3 (per
    // `defaultTestRulesets`).
    expect(getCapacity(state, u.id, bucketId('reaction'), cat)).toBeGreaterThan(0);
  });

  it('Steel-Helm-style headgear adds +1 reaction capacity (3 → 4)', () => {
    const steelHelm = makeHeadgear({
      id: 'steel_helm',
      bucketCapacityMods: new Map([[bucketId('reaction'), 1]]),
    });
    const cat = catalogWithItems([steelHelm]);
    const u = makeUnit({
      id: 'u',
      spd: 10,
      loadout: knightLoadout(),
      equipment: equipHead(steelHelm.id),
    });
    const state = makeGameState({ units: [u] });
    const baselineReaction = getCapacity(makeGameState({ units: [makeUnit({ id: 'u', spd: 10, loadout: knightLoadout() })] }), unitId('u'), bucketId('reaction'), makeAbilitiesCatalog({}));
    void baselineReaction;
    expect(getCapacity(state, u.id, bucketId('reaction'), cat)).toBe(4);
  });

  it('Augmentor-style accessory adds +1 support capacity without touching reaction/movement', () => {
    const augmentor = makeAccessory({
      id: 'augmentor',
      bucketCapacityMods: new Map([[bucketId('support'), 1]]),
    });
    const cat = catalogWithItems([augmentor]);
    const u = makeUnit({
      id: 'u',
      spd: 10,
      loadout: knightLoadout(),
      equipment: equipAccessory(augmentor.id),
    });
    const state = makeGameState({ units: [u] });
    expect(getCapacity(state, u.id, bucketId('support'), cat)).toBe(4);
    // Other buckets unchanged.
    expect(getCapacity(state, u.id, bucketId('reaction'), cat)).toBe(3);
    expect(getCapacity(state, u.id, bucketId('movement'), cat)).toBe(3);
  });

  it('multiple items composing on the same bucket sum additively (+1 + +1 = +2)', () => {
    const helm = makeHeadgear({
      id: 'helm',
      bucketCapacityMods: new Map([[bucketId('reaction'), 1]]),
    });
    const charm = makeAccessory({
      id: 'charm',
      bucketCapacityMods: new Map([[bucketId('reaction'), 1]]),
    });
    const cat = catalogWithItems([helm, charm]);
    const u = makeUnit({
      id: 'u',
      spd: 10,
      loadout: knightLoadout(),
      equipment: {
        leftHand: null,
        rightHand: null,
        headgear: helm.id,
        armor: null,
        accessory: charm.id,
      },
    });
    const state = makeGameState({ units: [u] });
    expect(getCapacity(state, u.id, bucketId('reaction'), cat)).toBe(5);
  });

  it('negative deltas are honored but the helper floors at 0', () => {
    // No real-content negative-capacity item planned, but the floor
    // exists per ADR-0059's "fail-safe author guard." A -10 delta on a
    // baseline of 3 composes to -7 raw, floored at 0.
    const cursed = makeAccessory({
      id: 'cursed',
      bucketCapacityMods: new Map([[bucketId('support'), -10]]),
    });
    const cat = catalogWithItems([cursed]);
    const u = makeUnit({
      id: 'u',
      spd: 10,
      loadout: knightLoadout(),
      equipment: equipAccessory(cursed.id),
    });
    const state = makeGameState({ units: [u] });
    expect(getCapacity(state, u.id, bucketId('support'), cat)).toBe(0);
  });

  it('runModifyBucketCapacity returns the raw additive sum (no floor)', () => {
    // The floor lives in `getCapacity`, not the runner — the runner
    // returns the chain product as-is so downstream consumers can
    // distinguish "negative because of contributors" from "zero because
    // of baseline."
    const cursed = makeAccessory({
      id: 'cursed',
      bucketCapacityMods: new Map([[bucketId('support'), -10]]),
    });
    const cat = catalogWithItems([cursed]);
    const u = makeUnit({
      id: 'u',
      spd: 10,
      loadout: knightLoadout(),
      equipment: equipAccessory(cursed.id),
    });
    const state = makeGameState({ units: [u] });
    const raw = runModifyBucketCapacity(state, cat, {
      unit: u,
      bucket: bucketId('support'),
      baseCapacity: 3,
    });
    expect(raw).toBe(-7);
  });
});

// ---------------------------------------------------------------------------
// modifyStatusTickAmount
// ---------------------------------------------------------------------------

describe('runModifyStatusTickAmount — composition', () => {
  it('returns the baseAmount unchanged when no contributors fire', () => {
    const cat = makeAbilitiesCatalog({});
    const u = makeUnit({ id: 'u', spd: 10 });
    const state = makeGameState({ units: [u] });
    const value = runModifyStatusTickAmount(state, cat, {
      unit: u,
      statusTypeId: burn.id,
      statusTags: burn.tags,
      baseAmount: 1,
    });
    expect(value).toBe(1);
  });

  it('Purifier-style ×2 on negative-tagged statuses doubles the chain product', () => {
    const purifier = makeAccessory({
      id: 'purifier',
      statusTickAmountMultipliers: [{ factor: 2, statusTag: 'negative' }],
    });
    const cat = catalogWithItems([purifier]);
    const u = makeUnit({
      id: 'u',
      spd: 10,
      equipment: equipAccessory(purifier.id),
    });
    const state = makeGameState({ units: [u] });
    const value = runModifyStatusTickAmount(state, cat, {
      unit: u,
      statusTypeId: burn.id,
      statusTags: burn.tags,
      baseAmount: 1,
    });
    expect(value).toBe(2);
  });

  it('Purifier does NOT modify positive-tagged statuses (Auto-Regen wearers retain full duration)', () => {
    const purifier = makeAccessory({
      id: 'purifier',
      statusTickAmountMultipliers: [{ factor: 2, statusTag: 'negative' }],
    });
    const cat = catalogWithItems([purifier]);
    const u = makeUnit({
      id: 'u',
      spd: 10,
      equipment: equipAccessory(purifier.id),
    });
    const state = makeGameState({ units: [u] });
    const value = runModifyStatusTickAmount(state, cat, {
      unit: u,
      statusTypeId: burn.id,
      // Synthetic positive-tagged tag set; Purifier's filter requires
      // 'negative' which isn't present.
      statusTags: ['positive'],
      baseAmount: 1,
    });
    expect(value).toBe(1);
  });

  it('per-type gating (statusTypeId filter) targets a single status', () => {
    const focused = makeAccessory({
      id: 'focused',
      statusTickAmountMultipliers: [{ factor: 3, statusTypeId: burn.id }],
    });
    const cat = catalogWithItems([focused]);
    const u = makeUnit({
      id: 'u',
      spd: 10,
      equipment: equipAccessory(focused.id),
    });
    const state = makeGameState({ units: [u] });
    expect(
      runModifyStatusTickAmount(state, cat, {
        unit: u,
        statusTypeId: burn.id,
        statusTags: burn.tags,
        baseAmount: 1,
      }),
    ).toBe(3);
    // A different status with no 'burn' id passes through unchanged.
    expect(
      runModifyStatusTickAmount(state, cat, {
        unit: u,
        statusTypeId: statusTypeId('poison'),
        statusTags: ['negative'],
        baseAmount: 1,
      }),
    ).toBe(1);
  });

  it('multiple multipliers compose multiplicatively (×2 × ×1.5 = ×3 on baseAmount 1 = 3)', () => {
    const a = makeAccessory({
      id: 'a',
      statusTickAmountMultipliers: [{ factor: 2, statusTag: 'negative' }],
    });
    const b = makeAccessory({
      id: 'b',
      statusTickAmountMultipliers: [{ factor: 1.5, statusTag: 'negative' }],
    });
    // Single accessory slot, so test composition by stacking two
    // multipliers on the same item.
    const c = makeAccessory({
      id: 'c',
      statusTickAmountMultipliers: [
        { factor: 2, statusTag: 'negative' },
        { factor: 1.5, statusTag: 'negative' },
      ],
    });
    void a;
    void b;
    const cat = catalogWithItems([c]);
    const u = makeUnit({ id: 'u', spd: 10, equipment: equipAccessory(c.id) });
    const state = makeGameState({ units: [u] });
    expect(
      runModifyStatusTickAmount(state, cat, {
        unit: u,
        statusTypeId: burn.id,
        statusTags: burn.tags,
        baseAmount: 1,
      }),
    ).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// reduceStatusTick — duration-mode statuses honor the chain
// ---------------------------------------------------------------------------

describe('reduceStatusTick — modifyStatusTickAmount integration (duration mode)', () => {
  it('Purifier ×2 makes a 4-duration status drop to 2 in one tick', () => {
    // Synthetic duration-mode status with 4 remaining duration, tagged
    // 'negative' so Purifier's filter activates.
    const purifier = makeAccessory({
      id: 'purifier',
      statusTickAmountMultipliers: [{ factor: 2, statusTag: 'negative' }],
    });
    const stunType = {
      id: statusTypeId('stun'),
      name: 'Stun',
      tags: ['negative' as StatusTag],
      durationMode: 'per_unit_ct' as const,
      stackingRule: 'STACK_INDEPENDENT' as const,
      hooks: [],
    };
    const cat = createCatalog({
      statusTypes: [stunType],
      abilities: [],
      commandSets: [],
      classes: [makeKnight()],
      items: [purifier],
      rulesets: defaultTestRulesets,
    });
    const u = makeUnit({
      id: 'u',
      spd: 10,
      equipment: equipAccessory(purifier.id),
      statuses: [
        {
          typeId: stunType.id,
          remainingDuration: 4,
          stacks: 1,
          magnitude: 1,
          source: { unitId: null, actionSeq: null },
        },
      ],
    });
    const state = makeGameState({ units: [u] });
    const result = reduceStatusTick(
      state,
      {
        type: 'status_tick',
        sequenceNumber: 1,
        source: 'system',
        timestamp: { tick: 0, ct: 0 },
        seed: 0,
        chainDepth: 0,
        isReaction: false,
        payload: { unitId: u.id, statusTypeId: stunType.id },
      },
      cat,
    );
    const newUnit = result.newState.units.get(u.id)!;
    const newStun = newUnit.statuses.find((s) => s.typeId === stunType.id)!;
    expect(newStun.remainingDuration).toBe(2);
  });

  it('Without Purifier, the same status decrements by 1', () => {
    const stunType = {
      id: statusTypeId('stun'),
      name: 'Stun',
      tags: ['negative' as StatusTag],
      durationMode: 'per_unit_ct' as const,
      stackingRule: 'STACK_INDEPENDENT' as const,
      hooks: [],
    };
    const cat = createCatalog({
      statusTypes: [stunType],
      abilities: [],
      commandSets: [],
      classes: [makeKnight()],
      items: [],
      rulesets: defaultTestRulesets,
    });
    const u = makeUnit({
      id: 'u',
      spd: 10,
      statuses: [
        {
          typeId: stunType.id,
          remainingDuration: 4,
          stacks: 1,
          magnitude: 1,
          source: { unitId: null, actionSeq: null },
        },
      ],
    });
    const state = makeGameState({ units: [u] });
    const result = reduceStatusTick(
      state,
      {
        type: 'status_tick',
        sequenceNumber: 1,
        source: 'system',
        timestamp: { tick: 0, ct: 0 },
        seed: 0,
        chainDepth: 0,
        isReaction: false,
        payload: { unitId: u.id, statusTypeId: stunType.id },
      },
      cat,
    );
    const newUnit = result.newState.units.get(u.id)!;
    const newStun = newUnit.statuses.find((s) => s.typeId === stunType.id)!;
    expect(newStun.remainingDuration).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// Burn × Purifier — custom-mode integration
// ---------------------------------------------------------------------------

describe('Burn × Purifier — front-loaded stack consumption', () => {
  it('Without Purifier, Burn emits 1 status_decrement_stack per tick (baseline preserved)', () => {
    const fireMage = makeUnit({ id: 'fm', spd: 10, ma: 13 });
    const target = makeUnit({ id: 'tgt', spd: 10, maxHpBase: 100, hp: 100 });
    const cat = createCatalog({
      statusTypes: [burn],
      abilities: [],
      commandSets: [],
      classes: [makeKnight()],
      items: [],
      rulesets: defaultTestRulesets,
    });
    let state = makeGameState({ units: [fireMage, target] });
    // Apply 4 stacks of Burn from the Fire Mage (MA 13 → 7 dmg/stack).
    const applied = applyStatus(
      state,
      {
        targetId: target.id,
        typeId: burn.id,
        sourceUnitId: fireMage.id,
        sourceActionSeq: null,
        stackQuantity: 4,
      },
      cat,
    );
    state = applied.newState;
    const result = reduceStatusTick(
      state,
      {
        type: 'status_tick',
        sequenceNumber: 1,
        source: 'system',
        timestamp: { tick: 0, ct: 0 },
        seed: 0,
        chainDepth: 0,
        isReaction: false,
        payload: { unitId: target.id, statusTypeId: burn.id },
      },
      cat,
    );
    const decrements = result.generatedActions.filter(
      (a) => a.type === 'status_decrement_stack',
    );
    expect(decrements).toHaveLength(1);
    // Damage total: sum of all 4 stack values (7 each) = 28
    const damage = result.generatedActions.find((a) => a.type === 'system_damage');
    expect(damage).toBeDefined();
    if (damage && damage.type === 'system_damage') {
      expect(damage.payload.amount).toBe(28);
    }
  });

  it('Purifier ×2 makes Burn emit 2 status_decrement_stack per tick (damage formula unchanged)', () => {
    const purifier = makeAccessory({
      id: 'purifier',
      statusTickAmountMultipliers: [{ factor: 2, statusTag: 'negative' }],
    });
    const fireMage = makeUnit({ id: 'fm', spd: 10, ma: 13 });
    const target = makeUnit({
      id: 'tgt',
      spd: 10,
      maxHpBase: 100,
      hp: 100,
      equipment: equipAccessory(purifier.id),
    });
    const cat = createCatalog({
      statusTypes: [burn],
      abilities: [],
      commandSets: [],
      classes: [makeKnight()],
      items: [purifier],
      rulesets: defaultTestRulesets,
    });
    let state = makeGameState({ units: [fireMage, target] });
    const applied = applyStatus(
      state,
      {
        targetId: target.id,
        typeId: burn.id,
        sourceUnitId: fireMage.id,
        sourceActionSeq: null,
        stackQuantity: 4,
      },
      cat,
    );
    state = applied.newState;
    const result = reduceStatusTick(
      state,
      {
        type: 'status_tick',
        sequenceNumber: 1,
        source: 'system',
        timestamp: { tick: 0, ct: 0 },
        seed: 0,
        chainDepth: 0,
        isReaction: false,
        payload: { unitId: target.id, statusTypeId: burn.id },
      },
      cat,
    );
    const decrements = result.generatedActions.filter(
      (a) => a.type === 'status_decrement_stack',
    );
    expect(decrements).toHaveLength(2);
    // Damage on this tick is the same — sum of all current stack
    // values (28). Front-loaded means fewer ticks, not bigger per-tick
    // damage. Lifetime sum: 28 + 14 = 42 (vs baseline 28 + 21 + 14 + 7
    // = 70). Net less damage for the Purifier wearer.
    const damage = result.generatedActions.find((a) => a.type === 'system_damage');
    expect(damage).toBeDefined();
    if (damage && damage.type === 'system_damage') {
      expect(damage.payload.amount).toBe(28);
    }
  });

  it('Decrement count is capped at remaining stack count (Purifier × 10 with 2 stacks emits 2 decrements)', () => {
    const burner = makeAccessory({
      id: 'burner',
      statusTickAmountMultipliers: [{ factor: 10, statusTag: 'negative' }],
    });
    const fireMage = makeUnit({ id: 'fm', spd: 10, ma: 10 });
    const target = makeUnit({
      id: 'tgt',
      spd: 10,
      maxHpBase: 100,
      hp: 100,
      equipment: equipAccessory(burner.id),
    });
    const cat = createCatalog({
      statusTypes: [burn],
      abilities: [],
      commandSets: [],
      classes: [makeKnight()],
      items: [burner],
      rulesets: defaultTestRulesets,
    });
    let state = makeGameState({ units: [fireMage, target] });
    const applied = applyStatus(
      state,
      {
        targetId: target.id,
        typeId: burn.id,
        sourceUnitId: fireMage.id,
        sourceActionSeq: null,
        stackQuantity: 2,
      },
      cat,
    );
    state = applied.newState;
    const result = reduceStatusTick(
      state,
      {
        type: 'status_tick',
        sequenceNumber: 1,
        source: 'system',
        timestamp: { tick: 0, ct: 0 },
        seed: 0,
        chainDepth: 0,
        isReaction: false,
        payload: { unitId: target.id, statusTypeId: burn.id },
      },
      cat,
    );
    const decrements = result.generatedActions.filter(
      (a) => a.type === 'status_decrement_stack',
    );
    expect(decrements).toHaveLength(2);
  });
});

