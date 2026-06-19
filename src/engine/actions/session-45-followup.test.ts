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
// 2b. S50 — system_apply_status path threads sourceAbilityTags
// ===========================================================================
//
// The Wand of Lumen +1 Burn stack hook is *source-side*: it checks
// `sourceAbilityTags` on the application args. For direct ability casts
// the field is populated by `resolveAbilityEffect` from `args.ability.
// tags`. For passive-emitted applications (Ignition's onDamageDealt →
// Burn) and reaction-emitted applications (Smolder's apply_status →
// Burn), the application reaches `applyStatus` via `system_apply_
// status` — pre-S50 the reducer didn't thread `sourceAbilityTags`,
// the field defaulted to `[]`, and Wand of Lumen's `['fire']` gate
// silently failed. The fix threads `sourceAbilityTags` through the
// reducer.

import { reduceSystemApplyStatus } from './reducers.ts';
import { ignition } from '../../content/abilities/ignition.ts';
import type { Action, ProposedAction } from '@engine/index.ts';

function makeSystemApplyStatusAction(payload: {
  targetId: string;
  statusTypeId: string;
  sourceUnitId: string | null;
  stackQuantity?: number;
  sourceAbilityTags?: ReadonlyArray<string>;
}): Extract<Action, { type: 'system_apply_status' }> {
  return {
    type: 'system_apply_status',
    source: 'system',
    sequenceNumber: 1,
    timestamp: { tick: 0, ct: 0 },
    seed: 0,
    chainDepth: 0,
    isReaction: false,
    payload: {
      targetId: payload.targetId as never,
      statusTypeId: payload.statusTypeId as never,
      sourceUnitId: payload.sourceUnitId as never,
      ...(payload.stackQuantity !== undefined ? { stackQuantity: payload.stackQuantity } : {}),
      ...(payload.sourceAbilityTags !== undefined
        ? { sourceAbilityTags: payload.sourceAbilityTags }
        : {}),
    },
  };
}

describe('Wand of Lumen — system_apply_status path (S50 fix)', () => {
  it('reducer threads sourceAbilityTags through → Wand +1 stack fires (1 → 2)', () => {
    const caster = makeUnit({
      id: 'c',
      spd: 10,
      ma: 9,
      loadout: emptyLoadout(),
      equipment: equipRight('wand_of_lumen'),
    });
    const target = makeUnit({ id: 't', spd: 10, hp: 100, team: 'team_b' });
    const state = makeGameState({ units: [caster, target], map: flatMap(3, 3) });
    const action = makeSystemApplyStatusAction({
      targetId: target.id as unknown as string,
      statusTypeId: 'burn',
      sourceUnitId: caster.id as unknown as string,
      stackQuantity: 1,
      sourceAbilityTags: ['magical', 'fire'],
    });
    const { newState } = reduceSystemApplyStatus(state, action, catalog);
    const t = newState.units.get(target.id);
    const burn = t!.statuses.find((s) => s.typeId === statusTypeId('burn'));
    expect(burn?.stacks).toBe(2);
  });

  it('reducer with no sourceAbilityTags → Wand gate fails (pins the pre-S50 bug surface)', () => {
    // The pre-S50 emission path didn't populate sourceAbilityTags, so
    // the chain defaulted to `[]` and the Wand's `['fire']` predicate
    // failed silently. This test pins that failure mode so a future
    // regression (someone drops the threading) fails loud.
    const caster = makeUnit({
      id: 'c',
      spd: 10,
      ma: 9,
      loadout: emptyLoadout(),
      equipment: equipRight('wand_of_lumen'),
    });
    const target = makeUnit({ id: 't', spd: 10, hp: 100, team: 'team_b' });
    const state = makeGameState({ units: [caster, target], map: flatMap(3, 3) });
    const action = makeSystemApplyStatusAction({
      targetId: target.id as unknown as string,
      statusTypeId: 'burn',
      sourceUnitId: caster.id as unknown as string,
      stackQuantity: 1,
      // sourceAbilityTags deliberately omitted — reproduces the pre-
      // S50 emission shape.
    });
    const { newState } = reduceSystemApplyStatus(state, action, catalog);
    const t = newState.units.get(target.id);
    const burn = t!.statuses.find((s) => s.typeId === statusTypeId('burn'));
    expect(burn?.stacks).toBe(1);
  });

  it("Precision Fire's native Burn rider composes with Wand of Lumen (direct-cast path, no S50 fix needed)", () => {
    // Precision Fire's `effects.statusEffects` includes a (25%-base,
    // MA-scaled) Burn application. That path goes through `resolveAbilityEffect`,
    // not through `system_apply_status` — so it gets `sourceAbilityTags`
    // populated directly from `args.ability.tags`. The S50 fix didn't
    // touch this path (it's been working since the modifier shipped in
    // S45), but a future tag-rename or tag-strip on Precision Fire
    // would silently break composition. Pin the property: Precision
    // Fire's tags must include 'fire' so the Wand's gate passes.
    const precisionFire = catalog.getAbility(abilityId('precision_fire'));
    expect(precisionFire.tags).toContain('fire');

    // Exercise the path: an apply with `sourceAbilityTags: precision_
    // fire.tags` and a Wand-of-Lumen-equipped caster yields 2 stacks
    // from a 1-stack request (the native baseChance roll outcome). If
    // a future change drops the 'fire' tag from Precision Fire, this
    // assertion fails and the composition silently breaking gets
    // caught at test time.
    const caster = makeUnit({
      id: 'c',
      spd: 10,
      ma: 9,
      loadout: emptyLoadout(),
      equipment: equipRight('wand_of_lumen'),
    });
    const target = makeUnit({ id: 't', spd: 10, hp: 100, team: 'team_b' });
    const state = makeGameState({ units: [caster, target], map: flatMap(3, 3) });
    const r = applyStatus(
      state,
      {
        targetId: target.id,
        typeId: statusTypeId('burn'),
        sourceUnitId: caster.id,
        sourceActionSeq: 0,
        stackQuantity: 1,
        sourceAbilityTags: precisionFire.tags ?? [],
      },
      catalog,
    );
    const t = r.newState.units.get(target.id);
    const burn = t!.statuses.find((s) => s.typeId === statusTypeId('burn'));
    expect(burn?.stacks).toBe(2);
  });

  it('Ignition emits with sourceAbilityTags populated from its own ability tags', () => {
    // Pull Ignition's onDamageDealt handler off the registration and
    // invoke it with a synthesized args/ctx so we can inspect the
    // emitted system_apply_status payload directly. This pins the
    // contract that Ignition's emission carries source-ability
    // identity — the field the reducer (above) now threads through.
    const hook = ignition.hooks[0];
    expect(hook?.name).toBe('onDamageDealt');
    // Cast through `unknown` because the union of all hook handler
    // signatures doesn't structurally overlap with the onDamageDealt-
    // specific shape we need to invoke. The runtime contract is what
    // we're pinning — TS strict mode just needs the explicit two-step
    // cast to acknowledge we know what we're doing.
    const handler = hook?.handler as unknown as (
      args: {
        unit: { id: string };
        ctx: {
          attacker: { id: string };
          target: { id: string };
          damageTags: Set<string>;
          multipliers: ReadonlyArray<unknown>;
          hit: boolean;
          emittedActions?: ReadonlyArray<ProposedAction>;
        };
      },
      ctx: { ability: { tags?: ReadonlyArray<string> } },
    ) => { emittedActions?: ReadonlyArray<ProposedAction> };

    const result = handler(
      {
        unit: { id: 'c' },
        ctx: {
          attacker: { id: 'c' },
          target: { id: 't' },
          damageTags: new Set(['magical', 'fire']),
          multipliers: [],
          hit: true,
        },
      },
      { ability: { tags: ['fire'] } },
    );
    const emitted = result.emittedActions ?? [];
    expect(emitted).toHaveLength(1);
    const apply = emitted[0]!;
    expect(apply.type).toBe('system_apply_status');
    if (apply.type !== 'system_apply_status') return;
    expect(apply.payload.sourceAbilityTags).toEqual(['fire']);
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
