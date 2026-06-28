// Session 76 integration tests — the Monk class + its net-new substrate.
//
//   1. Barehanded WP=PA — the basic punch resolves as PA² (weapon-tagged);
//      a Fist (no 'weapon' tag) stays at PA × coefficient (no explosion);
//      without Barehanded the punch falls to the unarmed PA × 1.
//   2. Counterpunch Strike — PA × 4 (not the punch's PA²).
//   3. Stance resistance — fox_stance grants +50 Fire / −50 Earth via
//      modifyResistance.
//   4. Stance set / replace / clear — Foxfire sets Fox; Serpent's Coil
//      replaces it with Serpent; Chakra clears to neutral.
//   5. Chakra — heals the caster (PA-scaled, no Faith) and emits a
//      system_mp_restore for PA × mp-coefficient.
//   6. Bear's Heave — relocates the throwee to the chosen destination tile.
//   7. Serpent's Coil — emits a self system_ct_push of Speed × 2 on a hit.
//   8. Vigilance — lifts evasion on every facing by floor(PA / 2).

import { describe, expect, it } from 'vitest';
import { loadDefaultCatalog } from '../../content/index.ts';
import { runDamagePipeline } from '../damage/pipeline.ts';
import { defaultDamageHandlers } from '../damage/default-handlers.ts';
import { applyStatus } from '../status/apply.ts';
import { runModifyResistance, runModifyEvasion } from '../hooks/index.ts';
import { makeGameState, makeUnit, activeTurnFor } from '../ct/test-fixtures.ts';
import { flatMap } from '../map/test-fixtures.ts';
import { reduceUseAbility } from './reducers.ts';
import { decideBasicAi } from '../../ai/basic.ts';
import {
  abilityId,
  bucketId,
  commandSetId,
  statusTypeId,
  unitId,
  type AbilityId,
  type ActiveAbilityDefinition,
  type AbilityTarget,
  type Action,
  type Loadout,
  type Position,
  type Unit,
  type UnitEquipment,
} from '@engine/index.ts';

const catalog = loadDefaultCatalog();

const expectActive = (id: AbilityId): ActiveAbilityDefinition => {
  const a = catalog.getAbility(id);
  if (a.kind !== 'active') throw new Error(`expected active: ${id}`);
  return a;
};

const EMPTY_HANDS: UnitEquipment = {
  leftHand: null,
  rightHand: null,
  headgear: null,
  armor: null,
  accessory: null,
};

// Full Monk loadout: Martial Arts on First Action + the three innate passives.
const MONK_LOADOUT: Loadout = {
  actionBuckets: { [bucketId('first_action')]: [commandSetId('martial_arts')] },
  passiveBuckets: {
    [bucketId('support')]: [abilityId('barehanded')],
    [bucketId('reaction')]: [abilityId('counterpunch')],
    [bucketId('movement')]: [abilityId('vigilance')],
  },
};

function makeMonk(overrides: Partial<Parameters<typeof makeUnit>[0]> = {}): Unit {
  return makeUnit({
    id: 'monk',
    spd: 10,
    pa: 9,
    ma: 4,
    maxHpBase: 190,
    maxMpBase: 26,
    hp: 190,
    mp: 26,
    classId: 'monk',
    loadout: MONK_LOADOUT,
    equipment: EMPTY_HANDS,
    position: { x: 0, y: 0, layer: 0 },
    ...overrides,
  });
}

function useAbility(
  actorId: string,
  ability: AbilityId,
  target: AbilityTarget,
): Extract<Action, { type: 'use_ability' }> {
  return {
    type: 'use_ability',
    sequenceNumber: 1,
    source: 'player',
    timestamp: { tick: 0, ct: 0 },
    seed: 4242,
    chainDepth: 0,
    isReaction: false,
    actorId: unitId(actorId),
    payload: { abilityId: ability, target },
  };
}

// ===== 1. Barehanded WP=PA =====

describe('Barehanded WP=PA', () => {
  it('basic punch resolves as PA² when both hands are empty (weapon-tagged)', () => {
    const monk = makeMonk();
    const target = makeUnit({ id: 'target', spd: 8, hp: 200, maxHpBase: 200 });
    const state = makeGameState({ units: [monk, target], map: flatMap(4, 4) });
    const ctx = runDamagePipeline({
      state,
      catalog,
      attacker: monk,
      target,
      ability: expectActive(abilityId('attack')),
      sourceActionSeq: 0,
      seed: 0xabc,
      registry: defaultDamageHandlers,
    });
    // PA 9 × WP(=PA 9) × coefficient 1.0 = 81.
    expect(ctx.baseDamage).toBe(81);
  });

  it('falls to the unarmed WP=1 (PA × 1) without Barehanded equipped', () => {
    // No loadout → EMPTY_LOADOUT → Barehanded isn't equipped, so its
    // modifyWeaponPower hook never registers and WP stays the unarmed 1.
    const monk = makeUnit({
      id: 'monk',
      spd: 10,
      pa: 9,
      classId: 'monk',
      equipment: EMPTY_HANDS,
      hp: 190,
      maxHpBase: 190,
    });
    const target = makeUnit({ id: 'target', spd: 8, hp: 200, maxHpBase: 200 });
    const state = makeGameState({ units: [monk, target], map: flatMap(4, 4) });
    const ctx = runDamagePipeline({
      state,
      catalog,
      attacker: monk,
      target,
      ability: expectActive(abilityId('attack')),
      sourceActionSeq: 0,
      seed: 0xabc,
      registry: defaultDamageHandlers,
    });
    expect(ctx.baseDamage).toBe(9); // 9 × 1 × 1.0
  });

  it('a Fist (no weapon tag) stays at PA × coefficient — no PA² explosion', () => {
    const monk = makeMonk();
    const target = makeUnit({ id: 'target', spd: 8, hp: 200, maxHpBase: 200 });
    const state = makeGameState({ units: [monk, target], map: flatMap(4, 4) });
    const ctx = runDamagePipeline({
      state,
      catalog,
      attacker: monk,
      target,
      ability: expectActive(abilityId('foxfire')),
      sourceActionSeq: 0,
      seed: 0xabc,
      registry: defaultDamageHandlers,
    });
    // PA 9 × WP 1 × coefficient 3 = 27 (Barehanded's WP=PA never fires — the
    // Fist isn't 'weapon'-tagged).
    expect(ctx.baseDamage).toBe(27);
  });

  it("a Fist's element tag is reduced by the target's resistance", () => {
    const monk = makeMonk();
    const resistant = makeUnit({
      id: 'target',
      spd: 8,
      hp: 200,
      maxHpBase: 200,
      resistances: new Map([['fire', 50]]),
    });
    const state = makeGameState({ units: [monk, resistant], map: flatMap(4, 4) });
    const ctx = runDamagePipeline({
      state,
      catalog,
      attacker: monk,
      target: resistant,
      ability: expectActive(abilityId('foxfire')),
      sourceActionSeq: 0,
      seed: 0xabc,
      registry: defaultDamageHandlers,
    });
    // 27 base × (1 − 50/100) = ~13.5 before variance. The fire resistance
    // multiplier is present.
    expect(ctx.multipliers.some((m) => m.factor === 0.5)).toBe(true);
  });
});

// ===== 1b. Barehanded + Two Weapons → punch twice =====

describe('Barehanded + Two Weapons', () => {
  function dualFistMonk(): Unit {
    return makeUnit({
      id: 'monk',
      spd: 10,
      pa: 9,
      mp: 26,
      maxMpBase: 26,
      classId: 'monk',
      equipment: EMPTY_HANDS,
      hp: 190,
      maxHpBase: 190,
      position: { x: 0, y: 0, layer: 0 },
      loadout: {
        actionBuckets: { [bucketId('first_action')]: [commandSetId('martial_arts')] },
        passiveBuckets: {
          [bucketId('support')]: [abilityId('barehanded'), abilityId('two_weapons')],
        },
      },
    });
  }

  it('a Barehanded dual-wielder swings the basic punch twice (two empty fists = two weapons)', () => {
    const monk = dualFistMonk();
    const target = makeUnit({ id: 'target', spd: 8, hp: 400, maxHpBase: 400, position: { x: 1, y: 0, layer: 0 } });
    const state = makeGameState({ units: [monk, target], map: flatMap(4, 4), turnState: activeTurnFor(monk.id) });
    const result = reduceUseAbility(
      state,
      useAbility('monk', abilityId('attack'), { kind: 'unit', unitId: target.id }),
      catalog,
    );
    // Two fist swings against the same target.
    expect(result.outcome.perTargetResults).toHaveLength(2);
  });

  it('Barehanded alone (no Two Weapons) swings once', () => {
    const monk = makeMonk({ position: { x: 0, y: 0, layer: 0 } });
    const target = makeUnit({ id: 'target', spd: 8, hp: 400, maxHpBase: 400, position: { x: 1, y: 0, layer: 0 } });
    const state = makeGameState({ units: [monk, target], map: flatMap(4, 4), turnState: activeTurnFor(monk.id) });
    const result = reduceUseAbility(
      state,
      useAbility('monk', abilityId('attack'), { kind: 'unit', unitId: target.id }),
      catalog,
    );
    expect(result.outcome.perTargetResults).toHaveLength(1);
  });
});

// ===== 2. Counterpunch Strike =====

describe('Counterpunch Strike', () => {
  it('hits for PA × 4 (not the punch PA²)', () => {
    const monk = makeMonk();
    const target = makeUnit({ id: 'target', spd: 8, hp: 200, maxHpBase: 200 });
    const state = makeGameState({ units: [monk, target], map: flatMap(4, 4) });
    const ctx = runDamagePipeline({
      state,
      catalog,
      attacker: monk,
      target,
      ability: expectActive(abilityId('counterpunch_strike')),
      sourceActionSeq: 0,
      seed: 0xabc,
      registry: defaultDamageHandlers,
    });
    expect(ctx.baseDamage).toBe(36); // 9 × 1 × 4
  });
});

// ===== 3. Stance resistance =====

describe('Stance resistance', () => {
  it('Fox Stance grants +50 Fire / −50 Earth via modifyResistance', () => {
    const monk = makeMonk();
    let state = makeGameState({ units: [monk], map: flatMap(4, 4) });
    state = applyStatus(
      state,
      { targetId: monk.id, typeId: statusTypeId('fox_stance'), sourceUnitId: monk.id, sourceActionSeq: 0 },
      catalog,
    ).newState;
    const live = state.units.get(monk.id)!;
    expect(runModifyResistance(state, catalog, { unit: live, tag: 'fire', baseValue: 0 })).toBe(50);
    expect(runModifyResistance(state, catalog, { unit: live, tag: 'earth', baseValue: 0 })).toBe(-50);
    // An unrelated element is untouched.
    expect(runModifyResistance(state, catalog, { unit: live, tag: 'water', baseValue: 0 })).toBe(0);
  });
});

// ===== 4. Stance set / replace / clear =====

describe('Stance set / replace / clear', () => {
  const hasStance = (u: Unit, id: string): boolean =>
    u.statuses.some((s) => s.typeId === statusTypeId(id));

  it('Foxfire sets Fox Stance; Serpent’s Coil replaces it; Chakra clears it', () => {
    const monk = makeMonk({ position: { x: 0, y: 0, layer: 0 } });
    const enemy = makeUnit({
      id: 'enemy',
      team: 'team_b',
      spd: 8,
      hp: 200,
      maxHpBase: 200,
      position: { x: 1, y: 0, layer: 0 },
    });
    const base = makeGameState({
      units: [monk, enemy],
      map: flatMap(6, 6),
      turnState: activeTurnFor(monk.id),
    });

    // Foxfire → Fox Stance.
    const afterFox = reduceUseAbility(
      base,
      useAbility('monk', abilityId('foxfire'), { kind: 'unit', unitId: enemy.id }),
      catalog,
    ).newState;
    expect(hasStance(afterFox.units.get(monk.id)!, 'fox_stance')).toBe(true);

    // Serpent's Coil → replaces with Serpent Stance (Fox gone).
    const afterSerpent = reduceUseAbility(
      { ...afterFox, turnState: activeTurnFor(monk.id) },
      useAbility('monk', abilityId('serpents_coil'), { kind: 'unit', unitId: enemy.id }),
      catalog,
    ).newState;
    const m2 = afterSerpent.units.get(monk.id)!;
    expect(hasStance(m2, 'serpent_stance')).toBe(true);
    expect(hasStance(m2, 'fox_stance')).toBe(false);

    // Chakra → clears to neutral.
    const afterChakra = reduceUseAbility(
      { ...afterSerpent, turnState: activeTurnFor(monk.id) },
      useAbility('monk', abilityId('chakra'), { kind: 'self' }),
      catalog,
    ).newState;
    const m3 = afterChakra.units.get(monk.id)!;
    expect(m3.statuses.some((s) => catalog.getStatusType(s.typeId).exclusivityGroup === 'stance')).toBe(
      false,
    );
  });
});

// ===== 5. Chakra heal + MP restore =====

describe('Chakra', () => {
  it('heals the caster (PA-scaled) and emits a system_mp_restore for PA × coefficient', () => {
    const monk = makeMonk({ hp: 100, mp: 0, position: { x: 2, y: 2, layer: 0 } });
    const base = makeGameState({
      units: [monk],
      map: flatMap(6, 6),
      turnState: activeTurnFor(monk.id),
    });
    const result = reduceUseAbility(
      base,
      useAbility('monk', abilityId('chakra'), { kind: 'self' }),
      catalog,
    );
    // HP heal: PA 9 × coefficient 4 = 36, applied in-state (100 → 136).
    expect(result.newState.units.get(monk.id)!.vitals.hp).toBe(136);
    // MP restore: PA 9 × coefficient 2 = 18, emitted as a system_mp_restore.
    const mp = result.generatedActions.find((a) => a.type === 'system_mp_restore');
    expect(mp).toBeDefined();
    expect((mp as Extract<Action, { type: 'system_mp_restore' }>).payload.amount).toBe(18);
  });
});

// ===== 6. Bear's Heave =====

describe("Bear's Heave", () => {
  it('relocates the throwee to the chosen destination tile', () => {
    const monk = makeMonk({ position: { x: 0, y: 0, layer: 0 } });
    const enemy = makeUnit({
      id: 'enemy',
      team: 'team_b',
      spd: 8,
      hp: 100,
      position: { x: 1, y: 0, layer: 0 },
    });
    const dest: Position = { x: 3, y: 0, layer: 0 }; // Manhattan 2 from the throwee
    const base = makeGameState({
      units: [monk, enemy],
      map: flatMap(6, 6),
      turnState: activeTurnFor(monk.id),
    });
    const result = reduceUseAbility(
      base,
      useAbility('monk', abilityId('bears_heave'), {
        kind: 'grapple_throw',
        unitId: enemy.id,
        destination: dest,
      }),
      catalog,
    );
    expect(result.newState.units.get(enemy.id)!.position).toEqual(dest);
    // Bear Stance is set on the caster.
    expect(
      result.newState.units.get(monk.id)!.statuses.some((s) => s.typeId === statusTypeId('bear_stance')),
    ).toBe(true);
  });
});

// ===== 7. Serpent's Coil self-CT refund =====

describe("Serpent's Coil", () => {
  it('emits a self system_ct_push of Speed × 2 on a landed hit', () => {
    const monk = makeMonk({ position: { x: 0, y: 0, layer: 0 } });
    const enemy = makeUnit({
      id: 'enemy',
      team: 'team_b',
      spd: 8,
      hp: 200,
      maxHpBase: 200,
      position: { x: 1, y: 0, layer: 0 },
    });
    const base = makeGameState({
      units: [monk, enemy],
      map: flatMap(6, 6),
      turnState: activeTurnFor(monk.id),
    });
    const result = reduceUseAbility(
      base,
      useAbility('monk', abilityId('serpents_coil'), { kind: 'unit', unitId: enemy.id }),
      catalog,
    );
    const push = result.generatedActions.find(
      (a) => a.type === 'system_ct_push',
    ) as Extract<Action, { type: 'system_ct_push' }> | undefined;
    expect(push).toBeDefined();
    expect(push!.payload.targetId).toBe(monk.id);
    expect(push!.payload.delta).toBe(20); // Speed 10 × factor 2
  });
});

// ===== AI basic competence (no crash; uses Fists / Chakra) =====

describe('Monk — basic AI', () => {
  it('commits an offensive action against an adjacent enemy (and never crashes on grapple_throw)', () => {
    const monk = makeMonk({ position: { x: 1, y: 1, layer: 0 } });
    const enemy = makeUnit({
      id: 'enemy',
      team: 'team_b',
      spd: 8,
      hp: 100,
      maxHpBase: 100,
      position: { x: 2, y: 1, layer: 0 },
    });
    const state = makeGameState({
      units: [monk, enemy],
      map: flatMap(6, 6),
      turnState: activeTurnFor(monk.id),
    });
    const decision = decideBasicAi(state, catalog);
    expect(decision.kind).toBe('commit');
  });

  it('casts Chakra on itself when badly wounded with no reachable enemy', () => {
    const monk = makeMonk({ hp: 40, position: { x: 0, y: 0, layer: 0 } });
    // Enemy parked far away — unreachable this turn, so no offensive option.
    const enemy = makeUnit({
      id: 'enemy',
      team: 'team_b',
      spd: 8,
      hp: 100,
      position: { x: 5, y: 5, layer: 0 },
    });
    const state = makeGameState({
      units: [monk, enemy],
      map: flatMap(6, 6),
      turnState: activeTurnFor(monk.id),
    });
    const decision = decideBasicAi(state, catalog);
    expect(decision.kind).toBe('commit');
    expect(
      decision.kind === 'commit' && decision.action.type === 'use_ability'
        ? decision.action.payload.abilityId
        : null,
    ).toBe(abilityId('chakra'));
  });
});

// ===== 8. Vigilance =====

describe('Vigilance', () => {
  it('lifts evasion on every facing by floor(PA / 2)', () => {
    const monk = makeMonk(); // PA 9 → +4
    const attacker = makeUnit({ id: 'enemy', team: 'team_b', spd: 8 });
    const state = makeGameState({ units: [monk, attacker], map: flatMap(4, 4) });
    for (const facing of ['front', 'side', 'back'] as const) {
      expect(
        runModifyEvasion(state, catalog, { unit: monk, attacker, baseEvasion: 10, facing }),
      ).toBe(14);
    }
  });
});
