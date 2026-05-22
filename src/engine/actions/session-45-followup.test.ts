// Session 45 follow-up — three new items + the new
// `modifyStatusApplicationStackCount` hook (ADR-0084) that the Wand of
// Lumen consumes.
//
//   1. Mantle of Protection: +25 resistance across 6 tags, +25 evasion
//      across all 3 facings — composed via the existing
//      `modifyResistance` / `modifyEvasion` chains.
//   2. Wand of Lumen: the apply-shift ability (`+Earth / −Water` shift)
//      mirrors the Wand of the Depths / Deepwood content shape; the
//      `+1 Burn stack` rider routes through the new hook end-to-end on
//      a fire-tagged application (Spark), and stays gated on both
//      `statusTypeId: burn` AND `sourceAbilityTagAll: ['fire']`.
//   3. Ironfoot: −1 Move / −1 Jump / −1 Speed, +1 PA / +1 MA, +1
//      Movement capacity — composes through the standard stat /
//      movement / bucket hooks.

import { describe, expect, it } from 'vitest';
import {
  abilityId,
  bucketId,
  itemId,
  runModifyBucketCapacity,
  runModifyEvasion,
  runModifyResistance,
  runModifyStatQuery,
  statusTypeId,
  type AbilityId,
  type DamageTag,
  type Loadout,
  type UnitEquipment,
} from '@engine/index.ts';
import { loadDefaultCatalog } from '../../content/index.ts';
import { applyStatus } from '../status/apply.ts';
import { makeGameState, makeUnit } from '../ct/test-fixtures.ts';
import { ACTIVE_BUCKET_IDS, PASSIVE_BUCKET_IDS } from '../abilities/constants.ts';
import { flatMap } from '../map/test-fixtures.ts';
import { wandOfLumen } from '../../content/items/wand-of-lumen.ts';
import { wandOfLumenApplyShift } from '../../content/abilities/wand-of-lumen-apply-shift.ts';

const catalog = loadDefaultCatalog();

function equipAccessory(id: string): UnitEquipment {
  return { leftHand: null, rightHand: null, headgear: null, armor: null, accessory: itemId(id) };
}
function equipRight(id: string): UnitEquipment {
  return { leftHand: null, rightHand: itemId(id), headgear: null, armor: null, accessory: null };
}
function emptyLoadout(): Loadout {
  const actionBuckets: Record<string, ReadonlyArray<ReturnType<typeof abilityId>>> = {};
  for (const b of ACTIVE_BUCKET_IDS) actionBuckets[b] = [];
  const passiveBuckets: Record<string, ReadonlyArray<AbilityId>> = {};
  for (const b of PASSIVE_BUCKET_IDS) passiveBuckets[b] = [];
  return { actionBuckets, passiveBuckets } as unknown as Loadout;
}

// ===========================================================================
// 1. Mantle of Protection
// ===========================================================================

describe('Mantle of Protection', () => {
  const u = makeUnit({ id: 'u', spd: 10, loadout: emptyLoadout(), equipment: equipAccessory('mantle_of_protection') });
  const state = makeGameState({ units: [u], map: flatMap(3, 3) });

  it('adds +25 resistance across all six elemental + spiritual tags', () => {
    for (const tag of ['fire', 'water', 'earth', 'lightning', 'holy', 'dark'] as const) {
      expect(runModifyResistance(state, catalog, { unit: u, tag: tag as DamageTag, baseValue: 0 })).toBe(25);
    }
  });

  it('does not touch tags it does not declare (poison, dot, weapon-category)', () => {
    for (const tag of ['poison', 'dot', 'sword', 'bow'] as const) {
      expect(runModifyResistance(state, catalog, { unit: u, tag: tag as DamageTag, baseValue: 0 })).toBe(0);
    }
  });

  it('adds +25 to each evasion facing', () => {
    const attacker = makeUnit({ id: 'a', spd: 10 });
    for (const facing of ['front', 'side', 'back'] as const) {
      const ev = runModifyEvasion(state, catalog, { unit: u, attacker, baseEvasion: 0, facing });
      expect(ev).toBe(25);
    }
  });
});

// ===========================================================================
// 2. Wand of Lumen — apply-shift content + +1 Burn stack hook
// ===========================================================================

describe('Wand of Lumen — apply-shift content', () => {
  it('declares the +Earth / −Water shift the apply-shift ability fires on hit', () => {
    expect(wandOfLumen.attackProcs).toEqual([{ chance: 1.0, abilityId: abilityId('wand_of_lumen_apply_shift') }]);
    const status = wandOfLumenApplyShift.effects.statusEffects?.[0];
    expect(status?.typeId).toBe(statusTypeId('tagged_resistance_shift'));
    expect(status?.customState?.['tagDeltas']).toEqual({ earth: 25, water: -25 });
    expect(status?.applyAlways).toBe(true);
  });
});

describe('Wand of Lumen — +1 Burn stack hook (ADR-0084)', () => {
  function applyBurn(stackQty: number, sourceAbilityTags: ReadonlyArray<string>, wielderEquip: UnitEquipment) {
    const caster = makeUnit({ id: 'c', spd: 10, ma: 9, loadout: emptyLoadout(), equipment: wielderEquip });
    const target = makeUnit({ id: 't', spd: 10, hp: 100 });
    const state = makeGameState({ units: [caster, target], map: flatMap(3, 3) });
    const r = applyStatus(
      state,
      {
        targetId: target.id,
        typeId: statusTypeId('burn'),
        sourceUnitId: caster.id,
        sourceActionSeq: 0,
        stackQuantity: stackQty,
        sourceAbilityTags,
      },
      catalog,
    );
    return { ...r, targetId: target.id };
  }

  it('a Lumen wielder casting a fire-tagged ability gets +1 stack (Spark 2 → 3)', () => {
    const r = applyBurn(2, ['magical', 'fire'], equipRight('wand_of_lumen'));
    const t = r.newState.units.get(r.targetId);
    const burn = t!.statuses.find((s) => s.typeId === statusTypeId('burn'));
    expect(burn?.stacks).toBe(3);
    const stackDamages = (burn?.customState as { stackDamages?: number[] } | undefined)?.stackDamages;
    expect(stackDamages?.length).toBe(3);
  });

  it('no Lumen → no bonus stack (Spark 2 → 2)', () => {
    const r = applyBurn(2, ['magical', 'fire'], { leftHand: null, rightHand: null, headgear: null, armor: null, accessory: null });
    const t = r.newState.units.get(r.targetId);
    const burn = t!.statuses.find((s) => s.typeId === statusTypeId('burn'));
    expect(burn?.stacks).toBe(2);
  });

  it('non-fire ability with Lumen equipped does not bump stack count', () => {
    // Same caster, same wand, but the application's source ability is
    // not fire-tagged — the modifier's `sourceAbilityTagAll: ['fire']`
    // gate fails.
    const r = applyBurn(2, ['magical', 'water'], equipRight('wand_of_lumen'));
    const t = r.newState.units.get(r.targetId);
    const burn = t!.statuses.find((s) => s.typeId === statusTypeId('burn'));
    expect(burn?.stacks).toBe(2);
  });

  it('Lumen on a non-Burn status does not bump (e.g. Poison from a fire-tagged ability)', () => {
    // The modifier gates on `statusTypeId: burn`, so applying Poison
    // (negative-tagged but not Burn) with a fire ability + Lumen does
    // not add a stack.
    const caster = makeUnit({ id: 'c', spd: 10, ma: 9, loadout: emptyLoadout(), equipment: equipRight('wand_of_lumen') });
    const target = makeUnit({ id: 't', spd: 10, hp: 100 });
    const state = makeGameState({ units: [caster, target], map: flatMap(3, 3) });
    const r = applyStatus(
      state,
      {
        targetId: target.id,
        typeId: statusTypeId('poison'),
        sourceUnitId: caster.id,
        sourceActionSeq: 0,
        stackQuantity: 1,
        sourceAbilityTags: ['magical', 'fire'],
      },
      catalog,
    );
    const t = r.newState.units.get(target.id);
    const poison = t!.statuses.find((s) => s.typeId === statusTypeId('poison'));
    // Poison may be REFRESH (single instance) — either way, no extra
    // stack should be added; assert the count is exactly the requested 1.
    expect(poison?.stacks ?? 1).toBe(1);
  });
});

// ===========================================================================
// 3. Ironfoot
// ===========================================================================

describe('Ironfoot', () => {
  const u = makeUnit({
    id: 'u', spd: 10, pa: 5, ma: 4, loadout: emptyLoadout(),
    equipment: equipAccessory('ironfoot'),
  });
  const state = makeGameState({ units: [u], map: flatMap(3, 3) });

  it('−1 Speed, +1 PA, +1 MA via statMods', () => {
    expect(runModifyStatQuery(state, catalog, { unit: u, statName: 'spd', baseValue: 10 })).toBe(9);
    expect(runModifyStatQuery(state, catalog, { unit: u, statName: 'pa', baseValue: 5 })).toBe(6);
    expect(runModifyStatQuery(state, catalog, { unit: u, statName: 'ma', baseValue: 4 })).toBe(5);
  });

  it('−1 Move, −1 Jump via movementMods', () => {
    expect(runModifyStatQuery(state, catalog, { unit: u, statName: 'moveRange', baseValue: 4 })).toBe(3);
    expect(runModifyStatQuery(state, catalog, { unit: u, statName: 'jump', baseValue: 3 })).toBe(2);
  });

  it('+1 Movement bucket capacity', () => {
    const cap = runModifyBucketCapacity(state, catalog, { unit: u, bucket: bucketId('movement'), baseCapacity: 3 });
    expect(cap).toBe(4);
  });

  it('does not touch other buckets', () => {
    const reactionCap = runModifyBucketCapacity(state, catalog, { unit: u, bucket: bucketId('reaction'), baseCapacity: 3 });
    expect(reactionCap).toBe(3);
  });
});
