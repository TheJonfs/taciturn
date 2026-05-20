// Session 17c integration tests — exercises the engine pieces that
// land alongside Knight expansion + equipment integration:
//
//   1. Equipment integration:
//      - WP read from equipped weapon → physical damage formula.
//      - Weapon accuracy → evasion check (per-ability hitRoll override).
//      - Weapon tag composition (sword tags merge into damage tags).
//      - statMods stat boost (Strength Ring +1 PA).
//      - statusGrants status apply at battle start (Boots of Haste).
//      - MaxHP fill (Iron Helm + Iron Mail → vitals.hp = computed max).
//      - Equipment-sourced statuses immune to in-battle removal.
//      - Slot validation errors at createInitialState.
//   2. modifyEvasion hook (Bulwark Stance front-evade boost).
//   3. Damage Reduction passive (25% physical reduction).
//   4. Bulwark Stance (move/jump -1, maxHp +20%, front evade +10).
//   5. Power Attack (1.5× coefficient).
//   6. Stasis Sword (Brave_factor + MA_factor for Stop application).
//   7. Taunt (applyAlways, source-anchored Taunted) + source-KO sweep.
//   8. PA_factor throws NotYetImplementedError.
//   9. Renderer assertNever follow-up (smoke).

import { describe, expect, it } from 'vitest';
import { loadDefaultCatalog } from '../../content/index.ts';
import { applyStatus } from '../status/apply.ts';
import { removeStatus } from '../status/remove.ts';
import { rollStatusChance, NotYetImplementedError } from '../status/chance.ts';
import { runDamagePipeline } from '../damage/pipeline.ts';
import { defaultDamageHandlers } from '../damage/default-handlers.ts';
import { commitAction } from './commit.ts';
import {
  ACTIVE_BUCKET_IDS,
  PASSIVE_BUCKET_IDS,
} from '../abilities/constants.ts';
import { activeTurnFor, makeGameState, makeUnit } from '../ct/test-fixtures.ts';
import { flatMap } from '../map/test-fixtures.ts';
import { getEquippedWeapon, validateSlotItem } from '../items/equipment.ts';
import { runModifyEvasion, runModifyStatQuery } from '../hooks/runners.ts';
import {
  createInitialState,
  BattleConfigError,
  runPreBattlePhase,
} from '../setup/create-initial-state.ts';
import {
  abilityId,
  bucketId,
  classId,
  commandSetId,
  itemId,
  rulesetId,
  statusTypeId,
  teamId,
  unitId,
  type AbilityId,
  type BattleConfig,
  type BucketId,
  type CommandSetId,
  type Loadout,
  type ProposedAction,
  type UnitEquipment,
  type WeaponEquipment,
} from '@engine/index.ts';

// --- Fixture builders ---

function flatBattleMap() {
  return flatMap(8, 8);
}

function knightLoadout(args: {
  passive_support?: AbilityId;
  passive_movement?: AbilityId;
  passive_reaction?: AbilityId;
} = {}): Loadout {
  const actionBuckets: Record<string, ReadonlyArray<CommandSetId>> = {};
  for (const b of ACTIVE_BUCKET_IDS) actionBuckets[b] = [];
  actionBuckets[bucketId('first_action')] = [commandSetId('battle_skill')];
  const passiveBuckets: Record<string, ReadonlyArray<AbilityId>> = {};
  for (const b of PASSIVE_BUCKET_IDS) passiveBuckets[b] = [];
  if (args.passive_support !== undefined) {
    passiveBuckets[bucketId('support')] = [args.passive_support];
  }
  if (args.passive_movement !== undefined) {
    passiveBuckets[bucketId('movement')] = [args.passive_movement];
  }
  if (args.passive_reaction !== undefined) {
    passiveBuckets[bucketId('reaction')] = [args.passive_reaction];
  }
  return { actionBuckets, passiveBuckets };
}

const TEAM_A = teamId('team_a');
const TEAM_B = teamId('team_b');

function buildBattle(args: {
  knightEquipment?: UnitEquipment;
  knightLoadout?: Loadout;
  knightStats?: { spd?: number; pa?: number; ma?: number; maxHpBase?: number; maxMpBase?: number; brave?: number; faith?: number };
  // Optionally provide explicit vitals; otherwise they fill from
  // computed maxes per ADR-0028.
  knightVitals?: { hp: number; mp: number };
}): { state: ReturnType<typeof createInitialState>; catalog: ReturnType<typeof loadDefaultCatalog> } {
  const catalog = loadDefaultCatalog();
  const knightStats = {
    spd: 10,
    pa: 5,
    ma: 4,
    maxHpBase: 60,
    maxMpBase: 50,
    brave: 100,
    faith: 80,
    crit_chance: 0,
    crit_multiplier: 1,
    ...args.knightStats,
  };
  const config: BattleConfig = {
    battleId: 'session_17c_test',
    rulesetId: rulesetId('default'),
    map: flatBattleMap(),
    teams: [
      { id: TEAM_A, name: 'A' },
      { id: TEAM_B, name: 'B' },
    ],
    units: [
      {
        id: unitId('blue_knight'),
        name: 'Blue Knight',
        team: TEAM_A,
        classId: classId('knight'),
        position: { x: 1, y: 1, layer: 0 },
        facing: 'E',
        baseStats: knightStats,
        ...(args.knightVitals !== undefined ? { vitals: args.knightVitals } : {}),
        loadout: args.knightLoadout ?? knightLoadout(),
        ...(args.knightEquipment !== undefined ? { equipment: args.knightEquipment } : {}),
      },
      {
        id: unitId('red_knight'),
        name: 'Red Knight',
        team: TEAM_B,
        classId: classId('knight'),
        position: { x: 2, y: 1, layer: 0 },
        facing: 'W',
        baseStats: knightStats,
        ...(args.knightVitals !== undefined ? { vitals: args.knightVitals } : {}),
        loadout: knightLoadout(),
        equipment: {
          leftHand: null,
          rightHand: itemId('long_sword'),
          headgear: null,
          armor: null,
          accessory: null,
        },
      },
    ],
    victoryConditions: [
      { kind: 'defeat_all', side: TEAM_B, description: 'Defeat all enemies' },
      { kind: 'defeat_all', side: TEAM_A, description: 'Defeat all enemies' },
    ],
    masterSeed: 0xC0FFEE,
  };
  // Per ADR-0071 (Session 32): equipment status grants apply via the
  // orchestrator's pre-battle phase as logged `system_apply_status`
  // actions. These tests assert the post-pre-battle-phase state — same
  // shape pre-S32 saw at `createInitialState` exit. Equivalence is
  // verified by the structural-equivalence pipeline test elsewhere.
  const rawState = createInitialState(config, catalog);
  const state = runPreBattlePhase(rawState, config, catalog);
  return { state, catalog };
}

const LONG_SWORD_EQUIPMENT: UnitEquipment = {
  leftHand: null,
  rightHand: itemId('long_sword'),
  headgear: null,
  armor: null,
  accessory: null,
};

// ===== Equipment integration =====

describe('equipment — getEquippedWeapon', () => {
  it('returns the right-hand weapon when present', () => {
    const { state, catalog } = buildBattle({ knightEquipment: LONG_SWORD_EQUIPMENT });
    const knight = state.units.get(unitId('blue_knight'))!;
    const weapon = getEquippedWeapon(knight, catalog);
    expect(weapon?.id).toBe(itemId('long_sword'));
  });

  it('falls back to left-hand when right-hand is empty', () => {
    const { state, catalog } = buildBattle({
      knightEquipment: {
        leftHand: itemId('long_sword'),
        rightHand: null,
        headgear: null,
        armor: null,
        accessory: null,
      },
    });
    const knight = state.units.get(unitId('blue_knight'))!;
    const weapon = getEquippedWeapon(knight, catalog);
    expect(weapon?.id).toBe(itemId('long_sword'));
  });

  it('returns null when both hands are empty', () => {
    const { state, catalog } = buildBattle({});
    const knight = state.units.get(unitId('blue_knight'))!;
    expect(getEquippedWeapon(knight, catalog)).toBeNull();
  });
});

describe('equipment — slot validation', () => {
  it('throws when an equipment id is not in the catalog', () => {
    expect(() =>
      buildBattle({
        knightEquipment: {
          leftHand: null,
          rightHand: itemId('not_a_real_item'),
          headgear: null,
          armor: null,
          accessory: null,
        },
      }),
    ).toThrow(BattleConfigError);
  });

  it('rejects an armor item placed in a hand slot', () => {
    expect(() =>
      buildBattle({
        knightEquipment: {
          leftHand: null,
          rightHand: itemId('iron_mail'),
          headgear: null,
          armor: null,
          accessory: null,
        },
      }),
    ).toThrow();
  });

  it('validateSlotItem permits weapons in either hand', () => {
    const longSword: WeaponEquipment = {
      id: itemId('test_weapon'),
      name: 'Test Weapon',
      kind: 'weapon',
      wp: 1,
      accuracy: 100,
    };
    expect(() => validateSlotItem('leftHand', longSword)).not.toThrow();
    expect(() => validateSlotItem('rightHand', longSword)).not.toThrow();
  });
});

describe('equipment — physical damage uses WP', () => {
  it('PA × WP × power_coefficient with Long Sword (WP=8) and basic Attack (coef=1.0)', () => {
    const { state, catalog } = buildBattle({
      knightEquipment: LONG_SWORD_EQUIPMENT,
      knightStats: { pa: 5 },
      knightVitals: { hp: 60, mp: 0 },
    });
    const attacker = state.units.get(unitId('blue_knight'))!;
    const target = state.units.get(unitId('red_knight'))!;
    const ability = catalog.getAbility(abilityId('attack'));
    if (ability.kind !== 'active') throw new Error('expected active');
    const ctx = runDamagePipeline({
      state,
      catalog,
      attacker,
      target,
      ability,
      sourceActionSeq: 0,
      seed: 0,
      registry: defaultDamageHandlers,
    });
    // PA(5) × WP(8) × power_coefficient(1.0) × variance(rolled) at seed 0.
    // Variance band 0.9-1.1 → finalDamage in [36, 44].
    expect(ctx.baseDamage).toBe(40);
    expect(ctx.finalDamage).toBeGreaterThanOrEqual(36);
    expect(ctx.finalDamage).toBeLessThanOrEqual(44);
  });

  it('Power Attack (1.5×) deals 1.5× the basic Attack damage', () => {
    const { state, catalog } = buildBattle({
      knightEquipment: LONG_SWORD_EQUIPMENT,
      knightStats: { pa: 5 },
    });
    const attacker = state.units.get(unitId('blue_knight'))!;
    const target = state.units.get(unitId('red_knight'))!;
    const ability = catalog.getAbility(abilityId('power_attack'));
    if (ability.kind !== 'active') throw new Error('expected active');
    const ctx = runDamagePipeline({
      state,
      catalog,
      attacker,
      target,
      ability,
      sourceActionSeq: 0,
      seed: 0,
      registry: defaultDamageHandlers,
    });
    // PA(5) × WP(8) × power_coefficient(1.5) = 60.
    expect(ctx.baseDamage).toBe(60);
  });

  it('unarmed (no weapon) defaults to WP=1 — much smaller damage', () => {
    const { state, catalog } = buildBattle({});
    const attacker = state.units.get(unitId('blue_knight'))!;
    const target = state.units.get(unitId('red_knight'))!;
    const ability = catalog.getAbility(abilityId('attack'));
    if (ability.kind !== 'active') throw new Error('expected active');
    const ctx = runDamagePipeline({
      state,
      catalog,
      attacker,
      target,
      ability,
      sourceActionSeq: 0,
      seed: 0,
      registry: defaultDamageHandlers,
    });
    // PA(5) × WP(1) × 1.0 = 5.
    expect(ctx.baseDamage).toBe(5);
  });
});

describe('equipment — Strength Ring stat mod', () => {
  it('+1 PA composes additively into modifyStatQuery', () => {
    const { state, catalog } = buildBattle({
      knightEquipment: {
        leftHand: null,
        rightHand: null,
        headgear: null,
        armor: null,
        accessory: itemId('strength_ring'),
      },
      knightStats: { pa: 5 },
    });
    const knight = state.units.get(unitId('blue_knight'))!;
    const pa = runModifyStatQuery(state, catalog, {
      unit: knight,
      statName: 'pa',
      baseValue: knight.baseStats.pa,
    });
    expect(pa).toBe(6);
  });
});

describe('equipment — Boots of Haste status grant', () => {
  it('applies Haste at battle start with kind: equipment source', () => {
    const { state } = buildBattle({
      knightEquipment: {
        leftHand: null,
        rightHand: null,
        headgear: null,
        armor: null,
        accessory: itemId('boots_of_haste'),
      },
    });
    const knight = state.units.get(unitId('blue_knight'))!;
    const haste = knight.statuses.find((s) => s.typeId === statusTypeId('haste'));
    expect(haste).toBeDefined();
    expect(haste?.source.kind).toBe('equipment');
    expect(haste?.source.equipmentId).toBe(itemId('boots_of_haste'));
  });

  it('Hasted unit has 1.5× Speed', () => {
    const { state, catalog } = buildBattle({
      knightEquipment: {
        leftHand: null,
        rightHand: null,
        headgear: null,
        armor: null,
        accessory: itemId('boots_of_haste'),
      },
      knightStats: { spd: 10 },
    });
    const knight = state.units.get(unitId('blue_knight'))!;
    const spd = runModifyStatQuery(state, catalog, {
      unit: knight,
      statName: 'spd',
      baseValue: knight.baseStats.spd,
    });
    expect(spd).toBe(15);
  });

  it('removeStatus on equipment-sourced Haste is a silent no-op', () => {
    const { state, catalog } = buildBattle({
      knightEquipment: {
        leftHand: null,
        rightHand: null,
        headgear: null,
        armor: null,
        accessory: itemId('boots_of_haste'),
      },
    });
    const knight = state.units.get(unitId('blue_knight'))!;
    const result = removeStatus(state, { targetId: knight.id, typeId: statusTypeId('haste') }, catalog);
    expect(result.removed).toHaveLength(0);
    const post = result.newState.units.get(knight.id)!;
    expect(post.statuses.some((s) => s.typeId === statusTypeId('haste'))).toBe(true);
  });

  it('removeStatus with force: true does remove equipment-sourced instances', () => {
    const { state, catalog } = buildBattle({
      knightEquipment: {
        leftHand: null,
        rightHand: null,
        headgear: null,
        armor: null,
        accessory: itemId('boots_of_haste'),
      },
    });
    const knight = state.units.get(unitId('blue_knight'))!;
    const result = removeStatus(state, { targetId: knight.id, typeId: statusTypeId('haste'), force: true }, catalog);
    expect(result.removed).toHaveLength(1);
  });
});

describe('equipment — Iron Helm + Iron Mail HP fill', () => {
  it('vitals.hp fills from computed max when placement omits vitals', () => {
    const { state, catalog } = buildBattle({
      knightEquipment: {
        leftHand: null,
        rightHand: null,
        headgear: itemId('iron_helm'),
        armor: itemId('iron_mail'),
        accessory: null,
      },
      knightStats: { maxHpBase: 60 },
    });
    const knight = state.units.get(unitId('blue_knight'))!;
    // Base 60 + Iron Helm 20 + Iron Mail 30 = 110.
    expect(knight.vitals.hp).toBe(110);
    const maxHp = runModifyStatQuery(state, catalog, {
      unit: knight,
      statName: 'maxHp',
      baseValue: knight.baseStats.maxHpBase,
    });
    expect(maxHp).toBe(110);
  });

  it('explicit placement.vitals overrides the auto-fill', () => {
    const { state } = buildBattle({
      knightEquipment: {
        leftHand: null,
        rightHand: null,
        headgear: itemId('iron_helm'),
        armor: itemId('iron_mail'),
        accessory: null,
      },
      knightStats: { maxHpBase: 60 },
      knightVitals: { hp: 30, mp: 5 },
    });
    const knight = state.units.get(unitId('blue_knight'))!;
    expect(knight.vitals.hp).toBe(30); // explicit, not the 110 max.
  });
});

describe('equipment — weapon tag composition', () => {
  it('long_sword tags merge into ctx.damageTags when ability declares weapon', () => {
    const { state, catalog } = buildBattle({
      knightEquipment: LONG_SWORD_EQUIPMENT,
    });
    const attacker = state.units.get(unitId('blue_knight'))!;
    const target = state.units.get(unitId('red_knight'))!;
    const ability = catalog.getAbility(abilityId('attack'));
    if (ability.kind !== 'active') throw new Error('expected active');
    const ctx = runDamagePipeline({
      state,
      catalog,
      attacker,
      target,
      ability,
      sourceActionSeq: 0,
      seed: 0,
      registry: defaultDamageHandlers,
    });
    expect(ctx.damageTags.has('sword')).toBe(true);
    expect(ctx.damageTags.has('physical')).toBe(true);
    expect(ctx.damageTags.has('weapon')).toBe(true);
  });
});

// ===== modifyEvasion + Bulwark Stance =====

describe('Bulwark Stance — passive composition', () => {
  it('-1 Move and -1 Jump compose through modifyStatQuery', () => {
    const { state, catalog } = buildBattle({
      knightLoadout: knightLoadout({ passive_movement: abilityId('bulwark_stance') }),
    });
    const knight = state.units.get(unitId('blue_knight'))!;
    const move = runModifyStatQuery(state, catalog, {
      unit: knight,
      statName: 'moveRange',
      baseValue: 3, // knight base
    });
    const jump = runModifyStatQuery(state, catalog, {
      unit: knight,
      statName: 'jump',
      baseValue: 2,
    });
    expect(move).toBe(2);
    expect(jump).toBe(1);
  });

  it('+20% MaxHP composes through modifyStatQuery', () => {
    const { state, catalog } = buildBattle({
      knightLoadout: knightLoadout({ passive_movement: abilityId('bulwark_stance') }),
      knightStats: { maxHpBase: 60 },
    });
    const knight = state.units.get(unitId('blue_knight'))!;
    const maxHp = runModifyStatQuery(state, catalog, {
      unit: knight,
      statName: 'maxHp',
      baseValue: knight.baseStats.maxHpBase,
    });
    // 60 × 1.2 = 72.
    expect(maxHp).toBe(72);
  });

  it('+10 Front Evade fires only on front facing through modifyEvasion', () => {
    const { state, catalog } = buildBattle({
      knightLoadout: knightLoadout({ passive_movement: abilityId('bulwark_stance') }),
    });
    const defender = state.units.get(unitId('blue_knight'))!;
    const attacker = state.units.get(unitId('red_knight'))!;
    expect(
      runModifyEvasion(state, catalog, {
        unit: defender,
        attacker,
        baseEvasion: 0,
        facing: 'front',
      }),
    ).toBe(10);
    expect(
      runModifyEvasion(state, catalog, {
        unit: defender,
        attacker,
        baseEvasion: 0,
        facing: 'side',
      }),
    ).toBe(0);
    expect(
      runModifyEvasion(state, catalog, {
        unit: defender,
        attacker,
        baseEvasion: 0,
        facing: 'back',
      }),
    ).toBe(0);
  });
});

// ===== Damage Reduction =====

describe('Damage Reduction passive', () => {
  it('reduces incoming physical damage by 25%', () => {
    const { state, catalog } = buildBattle({
      knightEquipment: LONG_SWORD_EQUIPMENT,
      knightStats: { pa: 5 },
      knightLoadout: knightLoadout({ passive_support: abilityId('damage_reduction') }),
    });
    // Red Knight attacks Blue Knight (which has Damage Reduction).
    const attacker = state.units.get(unitId('red_knight'))!;
    const target = state.units.get(unitId('blue_knight'))!;
    const ability = catalog.getAbility(abilityId('attack'));
    if (ability.kind !== 'active') throw new Error('expected active');
    const ctx = runDamagePipeline({
      state,
      catalog,
      attacker,
      target,
      ability,
      sourceActionSeq: 0,
      // Use a seed where variance lands mid-band so the assertion is
      // stable. With min=0.9, max=1.1, the multiplier output for the
      // pipeline's seed-mixer at seed 0 is the same on every run.
      seed: 0,
      registry: defaultDamageHandlers,
    });
    // Final damage should be ~75% of unmodified. PA 5 × WP 4 × 1.0 = 20.
    // Variance applies, then × 0.75 from Damage Reduction.
    // We can't predict variance exactly; assert the multiplier is in
    // the multipliers list.
    expect(ctx.multipliers.some((m) => m.source === 'damage_reduction' && m.factor === 0.75)).toBe(true);
  });

  it('does not reduce magical damage', () => {
    const { state, catalog } = buildBattle({
      knightLoadout: knightLoadout({ passive_support: abilityId('damage_reduction') }),
    });
    const attacker = state.units.get(unitId('red_knight'))!;
    const target = state.units.get(unitId('blue_knight'))!;
    const ability = catalog.getAbility(abilityId('bolt')); // magical
    if (ability.kind !== 'active') throw new Error('expected active');
    const ctx = runDamagePipeline({
      state,
      catalog,
      attacker,
      target,
      ability,
      sourceActionSeq: 0,
      seed: 0,
      registry: defaultDamageHandlers,
    });
    expect(ctx.multipliers.some((m) => m.source === 'damage_reduction')).toBe(false);
  });
});

// ===== Stasis Sword (Brave_factor) =====

describe('Stasis Sword — Brave_factor + MA_factor for Stop application', () => {
  it('applyAlways + factors are independent — Stasis Sword uses formula', () => {
    const catalog = loadDefaultCatalog();
    const stopType = catalog.getStatusType(statusTypeId('stop'));
    const stasisSword = catalog.getAbility(abilityId('stasis_sword'));
    if (stasisSword.kind !== 'active') throw new Error('expected active');
    // baseChance 50, factors { brave: true, ma: true }.
    // Brave 100/100 → factor 1.0. MA 4 → factor 0.9 + 0.4 = 1.3.
    // Pre-modifier: 0.5 × 1.0 × 1.3 = 0.65.
    const { state } = buildBattle({
      knightStats: { brave: 100, ma: 4 },
    });
    const caster = state.units.get(unitId('blue_knight'))!;
    const target = state.units.get(unitId('red_knight'))!;
    const result = rollStatusChance({
      state,
      catalog,
      caster,
      target,
      statusType: stopType,
      ability: stasisSword,
      baseChance: 50,
      seed: 0,
      factors: { brave: true, ma: true },
    });
    expect(result.chance).toBeCloseTo(0.65, 5);
  });

  it('PA factor throws NotYetImplementedError', () => {
    const catalog = loadDefaultCatalog();
    const { state } = buildBattle({});
    const caster = state.units.get(unitId('blue_knight'))!;
    const target = state.units.get(unitId('red_knight'))!;
    expect(() =>
      rollStatusChance({
        state,
        catalog,
        caster,
        target,
        statusType: catalog.getStatusType(statusTypeId('stop')),
        ability: null,
        baseChance: 50,
        seed: 0,
        factors: { pa: true },
      }),
    ).toThrow(NotYetImplementedError);
  });

  it('default factors preserve Earth (Faith × MA) shape', () => {
    const catalog = loadDefaultCatalog();
    const { state } = buildBattle({
      knightStats: { faith: 100, ma: 4 },
    });
    const caster = state.units.get(unitId('blue_knight'))!;
    const target = state.units.get(unitId('red_knight'))!;
    const result = rollStatusChance({
      state,
      catalog,
      caster,
      target,
      statusType: catalog.getStatusType(statusTypeId('movement_debuff')),
      ability: null,
      baseChance: 50,
      seed: 0,
      // factors omitted — defaults to { faith: true, ma: true }
    });
    // buildBattle applies knightStats to both knights, so caster.faith
    // = target.faith = 100. Faith_factor = 1.0 × 1.0 = 1.0. MA_factor
    // = 0.9 + 4/10 = 1.3. Pre-modifier: 0.5 × 1.0 × 1.3 = 0.65.
    expect(result.chance).toBeCloseTo(0.65, 5);
  });

  it('applyAlways: true bypasses formula, sets chance to 1', () => {
    const catalog = loadDefaultCatalog();
    const { state } = buildBattle({
      knightStats: { faith: 1, ma: 1, brave: 1 }, // all bad
    });
    const caster = state.units.get(unitId('blue_knight'))!;
    const target = state.units.get(unitId('red_knight'))!;
    const result = rollStatusChance({
      state,
      catalog,
      caster,
      target,
      statusType: catalog.getStatusType(statusTypeId('taunted')),
      ability: null,
      baseChance: 0, // ignored
      seed: 0,
      applyAlways: true,
    });
    expect(result.chance).toBe(1);
    expect(result.applied).toBe(true);
  });
});

// ===== Source-KO sweep =====

describe('source-KO status sweep — Taunted', () => {
  it('Taunted auto-removes when its source unit KOs', () => {
    // Set up: Red Knight is Taunted by Blue Knight (low HP). When Red
    // Knight attacks Blue Knight and KOs them, the Taunted status on
    // Red Knight should auto-remove.
    const catalog = loadDefaultCatalog();
    const config: BattleConfig = {
      battleId: 'taunt_ko_test',
      rulesetId: rulesetId('default'),
      map: flatMap(8, 8),
      teams: [
        { id: TEAM_A, name: 'A' },
        { id: TEAM_B, name: 'B' },
      ],
      units: [
        {
          id: unitId('blue_knight'),
          name: 'Blue',
          team: TEAM_A,
          classId: classId('knight'),
          position: { x: 1, y: 1, layer: 0 },
          facing: 'E',
          baseStats: { spd: 10, pa: 50, ma: 4, maxHpBase: 60, maxMpBase: 50, brave: 100, faith: 80, crit_chance: 0, crit_multiplier: 1 },
          vitals: { hp: 1, mp: 0 },
          loadout: knightLoadout(),
          equipment: LONG_SWORD_EQUIPMENT,
        },
        {
          id: unitId('red_knight'),
          name: 'Red',
          team: TEAM_B,
          classId: classId('knight'),
          position: { x: 2, y: 1, layer: 0 },
          facing: 'W',
          baseStats: { spd: 10, pa: 50, ma: 4, maxHpBase: 60, maxMpBase: 50, brave: 100, faith: 80, crit_chance: 0, crit_multiplier: 1 },
          vitals: { hp: 60, mp: 0 },
          loadout: knightLoadout(),
          equipment: LONG_SWORD_EQUIPMENT,
        },
      ],
      victoryConditions: [
        { kind: 'defeat_all', side: TEAM_B, description: 'A wins' },
        { kind: 'defeat_all', side: TEAM_A, description: 'B wins' },
      ],
      masterSeed: 1,
    };
    let state = createInitialState(config, catalog);
    // Apply Taunted to red_knight, sourced from blue_knight.
    const applied = applyStatus(
      state,
      {
        targetId: unitId('red_knight'),
        typeId: statusTypeId('taunted'),
        sourceUnitId: unitId('blue_knight'),
        sourceActionSeq: null,
        duration: 12,
      },
      catalog,
    );
    state = applied.newState;
    expect(
      state.units.get(unitId('red_knight'))!.statuses.some((s) => s.typeId === statusTypeId('taunted')),
    ).toBe(true);
    // Now have red_knight attack blue_knight (1 HP) — this should KO blue.
    const stateWithTurn = {
      ...state,
      turnState: activeTurnFor(unitId('red_knight')),
    };
    const action: ProposedAction = {
      type: 'use_ability',
      source: 'controller',
      actorId: unitId('red_knight'),
      payload: {
        abilityId: abilityId('attack'),
        target: { kind: 'unit', unitId: unitId('blue_knight') },
      },
    };
    const result = commitAction(stateWithTurn, action, catalog);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // Blue KO'd?
    const blueAfter = result.newState.units.get(unitId('blue_knight'))!;
    expect(blueAfter.vitals.hp).toBe(0);
    // Taunted removed from red_knight via the source-KO sweep?
    const redAfter = result.newState.units.get(unitId('red_knight'))!;
    expect(redAfter.statuses.some((s) => s.typeId === statusTypeId('taunted'))).toBe(false);
  });

  it('Taunted does NOT auto-remove if its source is still alive', () => {
    const { state, catalog } = buildBattle({});
    const applied = applyStatus(
      state,
      {
        targetId: unitId('red_knight'),
        typeId: statusTypeId('taunted'),
        sourceUnitId: unitId('blue_knight'),
        sourceActionSeq: null,
        duration: 12,
      },
      catalog,
    );
    expect(
      applied.newState.units.get(unitId('red_knight'))!.statuses.some(
        (s) => s.typeId === statusTypeId('taunted'),
      ),
    ).toBe(true);
  });
});

// ===== Smoke: Power Attack and Taunt commit cleanly =====

describe('Knight ability commits — smoke', () => {
  it('Power Attack commits and deducts MP', () => {
    const { state, catalog } = buildBattle({
      knightEquipment: LONG_SWORD_EQUIPMENT,
      knightStats: { pa: 5 },
      knightVitals: { hp: 60, mp: 10 },
    });
    const stateWithTurn = {
      ...state,
      turnState: activeTurnFor(unitId('blue_knight')),
    };
    const action: ProposedAction = {
      type: 'use_ability',
      source: 'controller',
      actorId: unitId('blue_knight'),
      payload: {
        abilityId: abilityId('power_attack'),
        target: { kind: 'unit', unitId: unitId('red_knight') },
      },
    };
    const result = commitAction(stateWithTurn, action, catalog);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const post = result.newState.units.get(unitId('blue_knight'))!;
    expect(post.vitals.mp).toBe(4); // 10 − 6 (S41 Power Attack MP bump: 4 → 6)
  });

  it('Taunt commits and applies the Taunted status with applyAlways', () => {
    const { state, catalog } = buildBattle({
      knightVitals: { hp: 60, mp: 10 },
      // Faith / MA are minimal; without applyAlways the formula would
      // depress chance significantly, but the spec sets applyAlways: true.
      knightStats: { faith: 1, ma: 1 },
    });
    const stateWithTurn = {
      ...state,
      turnState: activeTurnFor(unitId('blue_knight')),
    };
    const action: ProposedAction = {
      type: 'use_ability',
      source: 'controller',
      actorId: unitId('blue_knight'),
      payload: {
        abilityId: abilityId('taunt'),
        target: { kind: 'unit', unitId: unitId('red_knight') },
      },
    };
    const result = commitAction(stateWithTurn, action, catalog);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const target = result.newState.units.get(unitId('red_knight'))!;
    expect(target.statuses.some((s) => s.typeId === statusTypeId('taunted'))).toBe(true);
  });
});
