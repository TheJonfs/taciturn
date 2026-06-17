// Session 45 — Hunter kit integration tests against the real default
// catalog: class definition, native R/S/M (Updraft / Eagle Eye / High
// Jump), Marksmanship (Pin Down formula, Charged Attack damage + charge),
// the Longbow's height-delta damage end-to-end, the Riptide Bow's
// PA-scaled CT-push proc, and cross-class bow inheritance.
//
// The pure substrate (variance band resolution, range fork, two-handed
// slotting, selfMove) is covered in
// engine/actions/session-45-substrate.test.ts; this file exercises the
// content wired on top of it.

import { describe, expect, it } from 'vitest';
import {
  abilityId,
  bucketId,
  classId,
  commandSetId,
  computeMovementProfile,
  itemId,
  runModifyStatQuery,
  statusTypeId,
  type AbilityId,
  type GameState,
  type Loadout,
  type Tile,
  type UnitEquipment,
} from '@engine/index.ts';
import { loadDefaultCatalog } from '../index.ts';
import { computeStatusChance } from '../../engine/status/chance.ts';
import { applyStatus } from '../../engine/status/apply.ts';
import { computeOutgoingHitChance } from '../../engine/damage/hit-chance.ts';
import { runDamagePipeline } from '../../engine/damage/pipeline.ts';
import { defaultDamageHandlers } from '../../engine/damage/default-handlers.ts';
import { reduceUseAbility } from '../../engine/actions/reducers.ts';
import { expectActiveAbility } from '../../engine/actions/validate.ts';
import { makeGameState, makeUnit, activeTurnFor } from '../../engine/ct/test-fixtures.ts';
import { ACTIVE_BUCKET_IDS, PASSIVE_BUCKET_IDS } from '../../engine/abilities/constants.ts';
import { flatMap } from '../../engine/map/test-fixtures.ts';
import { classBaselineStats } from '../classes/baseline-stats.ts';
import { hunter } from '../classes/hunter.ts';
import { slow } from '../statuses/slow.ts';

const catalog = loadDefaultCatalog();

function loadoutWith(bucket: string, passives: ReadonlyArray<AbilityId>): Loadout {
  const actionBuckets: Record<string, ReadonlyArray<ReturnType<typeof commandSetId>>> = {};
  for (const b of ACTIVE_BUCKET_IDS) actionBuckets[b] = [];
  const passiveBuckets: Record<string, ReadonlyArray<AbilityId>> = {};
  for (const b of PASSIVE_BUCKET_IDS) passiveBuckets[b] = [];
  passiveBuckets[bucket] = passives;
  return { actionBuckets, passiveBuckets };
}

function equipRight(id: string): UnitEquipment {
  return { leftHand: null, rightHand: itemId(id), headgear: null, armor: null, accessory: null };
}

// 2-wide map; tile (0,0) at aElev, (1,0) at bElev.
function elevMap(aElev: number, bElev: number): GameState['map'] {
  const tile = (x: number, elevation: number): Tile => ({
    x, y: 0, layer: 0, elevation, terrain: 'ground', properties: [],
  });
  return { width: 2, height: 1, tiles: [tile(0, aElev), tile(1, bElev)] };
}

// ===========================================================================
// Class definition
// ===========================================================================

describe('Hunter class definition', () => {
  it('baseline stats (S68): HP 116 / MP 28 / PA 7 / MA 5 / Speed 10', () => {
    expect(classBaselineStats.get(classId('hunter'))!).toEqual({
      maxHpBase: 116, maxMpBase: 28, pa: 7, ma: 5, spd: 10,
    });
  });

  it('evasion 6 / 3 / 0 and base move 3 / jump 3 (S46 tuning: Move -1)', () => {
    expect(hunter.evasion).toEqual({ front: 6, side: 3, back: 0 });
    expect(hunter.movement.moveRange).toBe(3);
    expect(hunter.movement.jump).toBe(3);
  });

  it('native free R/S/M: Updraft, Eagle Eye, High Jump (+ attack)', () => {
    for (const id of ['attack', 'updraft', 'eagle_eye', 'high_jump']) {
      expect(hunter.freeAbilities.has(abilityId(id))).toBe(true);
    }
  });

  it('first-action command set is Marksmanship (Pin Down / Charged Attack / Scramble)', () => {
    expect(hunter.firstActionCommandSet).toBe(commandSetId('marksmanship'));
    expect(catalog.getCommandSet(commandSetId('marksmanship')).members).toEqual([
      abilityId('pin_down'),
      abilityId('charged_attack'),
      abilityId('scramble'),
    ]);
  });
});

// ===========================================================================
// Native R/S/M
// ===========================================================================

describe('High Jump (Movement)', () => {
  it('adds +2 jump and leaves moveRange untouched', () => {
    const u = makeUnit({
      id: 'u', spd: 9, classId: 'hunter',
      loadout: loadoutWith(bucketId('movement'), [abilityId('high_jump')]),
    });
    const state = makeGameState({ units: [u], map: flatMap(3, 3) });
    expect(runModifyStatQuery(state, catalog, { unit: u, statName: 'jump', baseValue: 3 })).toBe(5);
    expect(runModifyStatQuery(state, catalog, { unit: u, statName: 'moveRange', baseValue: 4 })).toBe(4);
  });

  it('a primary Hunter with High Jump reaches jump 5 via the movement profile', () => {
    const u = makeUnit({
      id: 'u', spd: 9, classId: 'hunter',
      loadout: loadoutWith(bucketId('movement'), [abilityId('high_jump')]),
    });
    const state = makeGameState({ units: [u], map: flatMap(3, 3) });
    expect(computeMovementProfile(state, u.id, catalog).jump).toBe(5);
  });
});

describe('Updraft (Reaction → accumulating Jump status)', () => {
  it('each application adds +1 jump and accumulates onto a single instance', () => {
    const u = makeUnit({ id: 'u', spd: 9, classId: 'hunter' });
    let state = makeGameState({ units: [u], map: flatMap(3, 3) });
    const apply = () => {
      state = applyStatus(
        state,
        { targetId: u.id, typeId: statusTypeId('updraft'), sourceUnitId: null, sourceActionSeq: null, magnitude: 1 },
        catalog,
      ).newState;
    };
    apply();
    expect(computeMovementProfile(state, u.id, catalog).jump).toBe(4); // base 3 + 1
    apply();
    const after = state.units.get(u.id)!;
    expect(after.statuses.filter((s) => s.typeId === statusTypeId('updraft'))).toHaveLength(1);
    expect(computeMovementProfile(state, u.id, catalog).jump).toBe(5); // base 3 + 2
  });
});

describe('Eagle Eye (Support → ×2 physical hit chance)', () => {
  function hitChance(passives: ReadonlyArray<AbilityId>): number {
    const attacker = makeUnit({
      id: 'a', spd: 9, pa: 6, classId: 'hunter', position: { x: 0, y: 0, layer: 0 },
      loadout: loadoutWith(bucketId('support'), passives),
      equipment: equipRight('longbow'),
    });
    const target = makeUnit({ id: 't', spd: 9, hp: 100, classId: 'knight', position: { x: 1, y: 0, layer: 0 } });
    const state = makeGameState({ units: [attacker, target], map: flatMap(3, 3) });
    return computeOutgoingHitChance({
      state, catalog, attacker, target, ability: expectActiveAbility(catalog, abilityId('attack')),
    });
  }

  it('doubles the bow shot hit chance (the evasion/elevation factors cancel in the ratio)', () => {
    const bare = hitChance([]);
    const eagle = hitChance([abilityId('eagle_eye')]);
    expect(eagle).toBeCloseTo(bare * 2, 5);
  });
});

// ===========================================================================
// Marksmanship — Pin Down
// ===========================================================================

describe('Pin Down (Slow applier, Brave-and-Speed formula)', () => {
  it('applies Slow via the Brave-and-Speed formula at baseChance 50', () => {
    // S50 retune (two passes): divisor 20 → 30 → 40.
    // 0.5 × (cb/100) × (tb/100) × (0.9 + cspd/40)
    // Hunter Speed 9, Brave 70 caster vs Brave 70 target:
    // 0.5 × 0.7 × 0.7 × (0.9 + 9/40) = 0.5 × 0.49 × 1.125 = 0.275625
    const caster = makeUnit({ id: 'c', spd: 9, brave: 70, faith: 70 });
    const target = makeUnit({ id: 't', spd: 9, brave: 70, faith: 70, position: { x: 1, y: 0, layer: 0 } });
    const state = makeGameState({ units: [caster, target], map: flatMap(3, 3) });
    const chance = computeStatusChance({
      state, catalog, caster, target,
      statusType: catalog.getStatusType(statusTypeId('slow')),
      ability: null,
      baseChance: 50,
      factors: { brave: true, speed: true },
    });
    expect(chance).toBeCloseTo(0.275625, 5);
  });

  it('Slow is a multiplicative Speed debuff, timed, and Remedy-clearable', () => {
    expect(slow.durationMode).toBe('per_unit_ct');
    expect(slow.remedyImmune).not.toBe(true);
    const u = makeUnit({ id: 'u', spd: 10 });
    let state = makeGameState({ units: [u], map: flatMap(3, 3) });
    state = applyStatus(
      state,
      { targetId: u.id, typeId: statusTypeId('slow'), sourceUnitId: null, sourceActionSeq: null, magnitude: 0.5, duration: 4 },
      catalog,
    ).newState;
    // 10 × 0.5 = 5 (Slow halves Speed).
    expect(runModifyStatQuery(state, catalog, { unit: state.units.get(u.id)!, statName: 'spd', baseValue: 10 })).toBe(5);
  });
});

// ===========================================================================
// Marksmanship — Charged Attack
// ===========================================================================

describe('Charged Attack', () => {
  it('is a charged ability — committing it spawns a ChargedAction', () => {
    const attacker = makeUnit({
      id: 'a', spd: 9, pa: 6, classId: 'hunter', position: { x: 0, y: 0, layer: 0 },
      // S48: Charged Attack picked up an MP cost (6 MP, parity with
      // Power Attack); the fixture needs MP available so the commit
      // doesn't fail validation. The test makes no assertion that
      // tracks MP balance, so 50 is just a comfortable head-room.
      mp: 50,
      loadout: { actionBuckets: { [bucketId('first_action')]: [commandSetId('marksmanship')], [bucketId('secondary_command_sets')]: [] }, passiveBuckets: {} },
      equipment: equipRight('longbow'),
    });
    const target = makeUnit({ id: 't', spd: 9, hp: 100, classId: 'knight', position: { x: 3, y: 0, layer: 0 } });
    const state = makeGameState({ units: [attacker, target], map: flatMap(6, 6), turnState: activeTurnFor(attacker.id) });
    const r = reduceUseAbility(
      state,
      {
        type: 'use_ability', source: 'player', actorId: attacker.id,
        payload: { abilityId: abilityId('charged_attack'), target: { kind: 'unit', unitId: target.id } },
        sequenceNumber: 0, seed: 1, timestamp: { tick: 0, ct: 0 }, chainDepth: 0, isReaction: false,
      },
      catalog,
    );
    expect(r.outcome.chargedActionId).toBeDefined();
  });

  it('deals PA × WP × 2.0 × variance damage (same elevation → ×1.0) — S48 coefficient bump', () => {
    const attacker = makeUnit({ id: 'a', spd: 9, pa: 6, classId: 'hunter', position: { x: 0, y: 0, layer: 0 }, equipment: equipRight('longbow') });
    const target = makeUnit({ id: 't', spd: 9, hp: 200, maxHpBase: 200, classId: 'knight', position: { x: 1, y: 0, layer: 0 } });
    const state = makeGameState({ units: [attacker, target], map: elevMap(0, 0) });
    // base = PA 6 × WP 7 × coeff 2.0 = 84; variance 1.0 at equal elevation.
    const r = runDamagePipeline({
      state, catalog, attacker, target,
      ability: expectActiveAbility(catalog, abilityId('charged_attack')),
      sourceActionSeq: 0, seed: 1, registry: defaultDamageHandlers,
    });
    expect(r.finalDamage).toBe(84);
  });
});

// ===========================================================================
// Longbow — height-delta damage end-to-end
// ===========================================================================

describe('Longbow height-delta damage (basic Attack)', () => {
  function damage(aElev: number, bElev: number): number {
    const attacker = makeUnit({ id: 'a', spd: 9, pa: 6, classId: 'hunter', position: { x: 0, y: 0, layer: 0 }, equipment: equipRight('longbow') });
    const target = makeUnit({ id: 't', spd: 9, hp: 500, maxHpBase: 500, classId: 'knight', position: { x: 1, y: 0, layer: 0 } });
    const state = makeGameState({ units: [attacker, target], map: elevMap(aElev, bElev) });
    return runDamagePipeline({
      state, catalog, attacker, target,
      ability: expectActiveAbility(catalog, abilityId('attack')),
      sourceActionSeq: 0, seed: 1, registry: defaultDamageHandlers,
    }).finalDamage ?? -1;
  }

  it('same elevation → PA 6 × WP 7 × 1.0 = 42', () => {
    expect(damage(0, 0)).toBe(42);
  });

  it('shooting down 5 → ×2.0 = 84', () => {
    expect(damage(5, 0)).toBe(84);
  });

  it('shooting up 5 → ×0 = 0 (no damage from far below)', () => {
    expect(damage(0, 5)).toBe(0);
  });
});

// ===========================================================================
// Riptide Bow — PA-scaled CT-push proc (Undertow)
// ===========================================================================

describe('Riptide Bow / Undertow CT-push', () => {
  it('Undertow pushes the target CT back by floor(3 × wielder PA), scaled on PA not MA', () => {
    const attacker = makeUnit({ id: 'a', spd: 9, pa: 6, ma: 3, classId: 'hunter', position: { x: 0, y: 0, layer: 0 } });
    const target = makeUnit({ id: 't', spd: 9, hp: 100, classId: 'knight', ct: 80, position: { x: 1, y: 0, layer: 0 } });
    const state = makeGameState({ units: [attacker, target], map: flatMap(3, 3), turnState: activeTurnFor(attacker.id) });
    const r = reduceUseAbility(
      state,
      {
        type: 'use_ability', source: 'player', actorId: attacker.id,
        payload: { abilityId: abilityId('undertow'), target: { kind: 'unit', unitId: target.id } },
        sequenceNumber: 0, seed: 1, timestamp: { tick: 0, ct: 0 }, chainDepth: 0, isReaction: false,
      },
      catalog,
    );
    const push = r.generatedActions.find((a) => a.type === 'system_ct_push');
    expect(push).toBeDefined();
    // PA 6 × factor -3 = -18 (CT back); MA 3 would have given -9.
    expect((push as { payload: { delta: number } }).payload.delta).toBe(-18);
  });

  it('the Riptide Bow declares a 30% Undertow proc', () => {
    const bow = catalog.getItem(itemId('riptide_bow'));
    expect(bow.kind).toBe('weapon');
    if (bow.kind !== 'weapon') return;
    expect(bow.attackProcs).toEqual([{ chance: 0.3, abilityId: abilityId('undertow') }]);
  });
});

// ===========================================================================
// Cross-class bow inheritance
// ===========================================================================

describe('Cross-class bow use', () => {
  it('a Knight wielding a Longbow inherits its 2-5 range on the basic Attack', async () => {
    const { computeAbilityRange } = await import('../../engine/abilities/range.ts');
    const knight = makeUnit({ id: 'k', spd: 9, classId: 'knight', equipment: equipRight('longbow') });
    const state = makeGameState({ units: [knight], map: flatMap(8, 8) });
    const view = computeAbilityRange(state, catalog, knight.id, expectActiveAbility(catalog, abilityId('attack')));
    expect(view.horizontal).toBe(5);
    expect(view.minHorizontal).toBe(2);
  });

  it('Eagle Eye doubles a Knight cross-classer’s bow hit chance too', () => {
    const mk = (passives: ReadonlyArray<AbilityId>) => {
      const a = makeUnit({
        id: 'a', spd: 9, pa: 11, classId: 'knight', position: { x: 0, y: 0, layer: 0 },
        loadout: loadoutWith(bucketId('support'), passives),
        equipment: equipRight('longbow'),
      });
      const t = makeUnit({ id: 't', spd: 9, hp: 100, classId: 'knight', position: { x: 1, y: 0, layer: 0 } });
      const state = makeGameState({ units: [a, t], map: flatMap(3, 3) });
      return computeOutgoingHitChance({ state, catalog, attacker: a, target: t, ability: expectActiveAbility(catalog, abilityId('attack')) });
    };
    expect(mk([abilityId('eagle_eye')])).toBeCloseTo(mk([]) * 2, 5);
  });
});
