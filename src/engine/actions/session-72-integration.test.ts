// Session 72 integration tests — Enchanter (chunks 1–3).
//
// Chunk 3 (class wiring): the enchanter class registers with Auramancy as its
// First Action set + the RSM free kit; the buff→steal loop closes (an
// Enchanter casts Haste on an ally → a Thief's Steal Buffs lifts it).
//
// Chunk 1 (Auramancy actives):
//   1. Buff chance tuning — the three Auramancy buffs (baseChance 95) land
//      ~88% (≈90%) net on a default-Faith (70) ally at the Enchanter's MA 10,
//      climb toward always-on as MA is buffed, and drop on a low-Faith ally.
//   2. The timed buff statuses (quickening / protect_cast / shell_cast):
//      per_unit_ct duration, REFRESH, polarity 'buff' (so Steal Buffs lifts
//      them — the Thief loop), distinct from the permanent equipment forms.
//   3. End-to-end Haste: an Enchanter casts enchant_haste on an ally cluster;
//      the charged action resolves and the ally gains quickening (Speed ×1.5),
//      from a non-equipment source (stealable).
//   4. End-to-end Esuna: cleanse removes negative statuses (Blind) from an
//      ally in the AoE but leaves committed stat-downs (PA Down, remedyImmune)
//      and buffs (quickening) alone — mirroring Remedy's cleanse set.
//
// Chunk 2 (RSM):
//   5. Resistance Save — +10 to each elemental resistance per magical hit,
//      uncapped STACK_ADDITIVE accumulation; reaction magical-gated.
//   6. Short Charge — proportional charge speedup (×1.33, floored); instants
//      stay instant.
//   7. Float — water move-cost negation + fall-damage immunity, no elevation
//      effect.
//   8. Aura Mastery (ADR-0122) — the caster-side buff-magnitude amplifier (×1.33,
//      kind-aware), flagged statuses only, equipment/unflagged applies excluded.

import { describe, expect, it } from 'vitest';
import {
  abilities,
  classes,
  commandSets,
  items,
  rulesets,
  statusTypes,
} from '../../content/index.ts';
import { createCatalog } from '../catalog/index.ts';
import { createInitialState } from '../setup/create-initial-state.ts';
import { commitAction } from './commit.ts';
import { advanceToNextEvent } from '../turn/scheduler.ts';
import { computeStatusChance } from '../status/chance.ts';
import { applyStatus } from '../status/apply.ts';
import { computeBaseActionSpeed, computeSpeed } from '../ct/speed.ts';
import { runModifyResistance, runModifySystemDamage } from '../hooks/runners.ts';
import { computeMovementProfile } from '../map/movement-profile.ts';
import { activeTurnFor, makeGameState, makeUnit } from '../ct/test-fixtures.ts';
import {
  ACTIVE_BUCKET_IDS,
  PASSIVE_BUCKET_IDS,
} from '../abilities/constants.ts';
import { flatMap } from '../map/test-fixtures.ts';
import {
  abilityId,
  bucketId,
  classId,
  commandSetId,
  rulesetId,
  statusTypeId,
  teamId,
  unitId,
  type AbilityId,
  type ActiveAbilityDefinition,
  type AbilityDefinition,
  type BattleConfig,
  type CommandSetId,
  type GameState,
  type Loadout,
  type SystemDamageSource,
} from '@engine/index.ts';

const TEAM_A = teamId('team_a');
const TEAM_B = teamId('team_b');

// The real catalog — chunk 3 registered the `enchanter` class + `auramancy`
// command set, so the end-to-end casts run against production content.
function makeTestCatalog() {
  return createCatalog({ statusTypes, abilities, commandSets, classes, items, rulesets });
}

function enchanterLoadout(): Loadout {
  const actionBuckets: Record<string, ReadonlyArray<CommandSetId>> = {};
  for (const b of ACTIVE_BUCKET_IDS) actionBuckets[b] = [];
  actionBuckets[bucketId('first_action')] = [commandSetId('auramancy')];
  const passiveBuckets: Record<string, ReadonlyArray<AbilityId>> = {};
  for (const b of PASSIVE_BUCKET_IDS) passiveBuckets[b] = [];
  return { actionBuckets, passiveBuckets };
}

// Caster (Enchanter, MA 10, Faith 70) at (1,1); ally (Faith 70) adjacent at
// (2,1) so a diamond-r1 AoE anchored on the ally catches both.
function buildEnchanterBattle() {
  const catalog = makeTestCatalog();
  const config: BattleConfig = {
    battleId: 'session_72_test',
    rulesetId: rulesetId('default'),
    map: flatMap(8, 8),
    teams: [
      { id: TEAM_A, name: 'A', control: 'human' },
      { id: TEAM_B, name: 'B', control: 'ai' },
    ],
    units: [
      {
        id: unitId('caster'),
        name: 'Enchanter',
        team: TEAM_A,
        classId: classId('enchanter'),
        position: { x: 1, y: 1, layer: 0 },
        facing: 'E',
        baseStats: {
          spd: 10,
          pa: 3,
          ma: 10,
          maxHpBase: 103,
          maxMpBase: 40,
          brave: 70,
          faith: 70,
          crit_chance: 0,
          crit_multiplier: 1,
        },
        vitals: { hp: 103, mp: 40 },
        loadout: enchanterLoadout(),
      },
      {
        id: unitId('ally'),
        name: 'Ally',
        team: TEAM_A,
        classId: classId('knight'),
        position: { x: 2, y: 1, layer: 0 },
        facing: 'W',
        baseStats: {
          spd: 8,
          pa: 10,
          ma: 4,
          maxHpBase: 100,
          maxMpBase: 20,
          brave: 70,
          faith: 70,
          crit_chance: 0,
          crit_multiplier: 1,
        },
        vitals: { hp: 100, mp: 20 },
        loadout: {
          actionBuckets: { [bucketId('first_action')]: [commandSetId('battle_skill')] },
          passiveBuckets: {},
        },
      },
      {
        // A distant enemy so neither defeat_all condition fires at battle
        // start (an all-team_a board would decide instantly and the
        // scheduler would never advance the charge). Far from the AoE.
        id: unitId('enemy'),
        name: 'Enemy',
        team: TEAM_B,
        classId: classId('knight'),
        position: { x: 7, y: 7, layer: 0 },
        facing: 'N',
        baseStats: {
          spd: 8,
          pa: 10,
          ma: 4,
          maxHpBase: 100,
          maxMpBase: 20,
          brave: 70,
          faith: 70,
          crit_chance: 0,
          crit_multiplier: 1,
        },
        vitals: { hp: 100, mp: 20 },
        loadout: {
          actionBuckets: { [bucketId('first_action')]: [commandSetId('battle_skill')] },
          passiveBuckets: {},
        },
      },
    ],
    victoryConditions: [
      { kind: 'defeat_all', side: TEAM_B, description: 'A wins' },
      { kind: 'defeat_all', side: TEAM_A, description: 'B wins' },
    ],
    masterSeed: 0xA11A,
  };
  return { state: createInitialState(config, catalog), catalog };
}

type CastTarget =
  | { readonly kind: 'unit'; readonly unitId: ReturnType<typeof unitId> }
  | { readonly kind: 'tile'; readonly position: { x: number; y: number; layer: number } };

// Drive a charged cast forward through the scheduler until the
// `charged_action_resolve` lands and commits. Other units' turn_starts that
// arrive first are skipped (turn_end'd) so the scheduler keeps advancing.
function castAndResolve(
  startState: ReturnType<typeof createInitialState>,
  catalog: ReturnType<typeof makeTestCatalog>,
  ability: AbilityId,
  target: CastTarget,
) {
  const caster = unitId('caster');
  let s: GameState = { ...startState, turnState: activeTurnFor(caster) };
  const cast = commitAction(
    s,
    { type: 'use_ability', source: 'player', actorId: caster, payload: { abilityId: ability, target } },
    catalog,
  );
  expect(cast.ok).toBe(true);
  if (!cast.ok) throw new Error('cast rejected');
  s = cast.newState;
  // End the caster's turn if the charged cast didn't already (some paths
  // auto-end after a charged action) so the scheduler can advance the charge.
  if (s.turnState !== null) {
    const end = commitAction(s, { type: 'turn_end', source: 'system', payload: { unitId: s.turnState.unitId } }, catalog);
    if (end.ok) s = end.newState;
  }
  for (let i = 0; i < 80; i++) {
    const sched = advanceToNextEvent(s, catalog);
    if (sched === null) break;
    s = sched.newState;
    const r = commitAction(s, sched.proposed, catalog);
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error('scheduler commit rejected');
    s = r.newState;
    if (sched.proposed.type === 'charged_action_resolve') break;
    // Skip any other unit's turn so the scheduler keeps advancing the charge.
    if (s.turnState !== null) {
      const e = commitAction(
        s,
        { type: 'turn_end', source: 'system', payload: { unitId: s.turnState.unitId } },
        catalog,
      );
      if (e.ok) s = e.newState;
    }
  }
  return s;
}

// ===== 1. Buff chance tuning =====

describe('Auramancy buff chance — baseChance 95', () => {
  const catalog = createCatalog({ statusTypes, abilities, commandSets, classes, items, rulesets });
  const haste = catalog.getStatusType(statusTypeId('quickening'));

  function chanceFor(opts: { casterMa: number; targetFaith: number }): number {
    const caster = makeUnit({ id: 'c', spd: 10, ma: opts.casterMa, faith: 70, team: 'team_a' });
    const target = makeUnit({ id: 't', spd: 8, faith: opts.targetFaith, team: 'team_a', position: { x: 1, y: 0, layer: 0 } });
    const state = makeGameState({ units: [caster, target] });
    return computeStatusChance({
      state,
      catalog,
      caster,
      target,
      statusType: haste,
      ability: null,
      baseChance: 95,
    });
  }

  it('lands ~88% (≈90%) on a default-Faith (70) ally at MA 10', () => {
    const p = chanceFor({ casterMa: 10, targetFaith: 70 });
    expect(p).toBeGreaterThan(0.86);
    expect(p).toBeLessThan(0.91);
  });

  it('climbs toward always-on as MA is buffed (MA 12)', () => {
    const p = chanceFor({ casterMa: 12, targetFaith: 70 });
    expect(p).toBeGreaterThan(0.96);
  });

  it('drops sharply on a low-Faith (40) ally', () => {
    const p = chanceFor({ casterMa: 10, targetFaith: 40 });
    expect(p).toBeLessThan(0.6);
    expect(p).toBeGreaterThan(0.45);
  });
});

// ===== 2. Timed buff status properties =====

describe('timed cast-buff statuses', () => {
  const catalog = createCatalog({ statusTypes, abilities, commandSets, classes, items, rulesets });

  it('quickening / protect_cast / shell_cast are per_unit_ct, REFRESH, polarity buff', () => {
    for (const id of ['quickening', 'protect_cast', 'shell_cast']) {
      const t = catalog.getStatusType(statusTypeId(id));
      expect(t.durationMode).toBe('per_unit_ct');
      expect(t.stackingRule).toBe('REFRESH');
      expect(t.aiHints?.polarity).toBe('buff');
    }
  });

  it('are distinct from the permanent equipment-grant forms', () => {
    expect(catalog.getStatusType(statusTypeId('haste')).durationMode).toBe('permanent_per_unit_ct');
    expect(catalog.getStatusType(statusTypeId('quickening')).durationMode).toBe('per_unit_ct');
  });
});

// ===== 3. End-to-end Haste =====

describe('enchant_haste end-to-end', () => {
  it('resolves and grants the ally quickening (Speed ×1.5) from a non-equipment source', () => {
    const { state, catalog } = buildEnchanterBattle();
    const s = castAndResolve(state, catalog, abilityId('enchant_haste'), {
      kind: 'unit',
      unitId: unitId('ally'),
    });
    const ally = s.units.get(unitId('ally'))!;
    const q = ally.statuses.find((i) => i.typeId === statusTypeId('quickening'));
    expect(q).toBeDefined();
    // Non-equipment source ⇒ Steal Buffs can lift it (the Thief loop).
    expect(q!.source.kind).not.toBe('equipment');
    // Speed scales: base 8 × 1.5 = 12.
    expect(computeSpeed(s, ally.id, catalog)).toBe(12);
  });
});

// ===== 4. End-to-end Esuna =====

describe('esuna end-to-end', () => {
  it('cleanses Blind but leaves PA Down (remedyImmune) and quickening (buff) alone', () => {
    const { state, catalog } = buildEnchanterBattle();
    // Seed the ally with a curable debuff, a committed stat-down, and a buff.
    let s = state;
    const ally = unitId('ally');
    s = applyStatus(s, { targetId: ally, typeId: statusTypeId('blind'), sourceUnitId: unitId('caster'), sourceActionSeq: null, duration: 4 }, catalog).newState;
    s = applyStatus(s, { targetId: ally, typeId: statusTypeId('pa_down'), sourceUnitId: unitId('caster'), sourceActionSeq: null, magnitude: 1 }, catalog).newState;
    s = applyStatus(s, { targetId: ally, typeId: statusTypeId('quickening'), sourceUnitId: unitId('caster'), sourceActionSeq: null, duration: 6 }, catalog).newState;

    const after = castAndResolve(s, catalog, abilityId('esuna'), { kind: 'unit', unitId: ally });
    const statuses = after.units.get(ally)!.statuses.map((i) => i.typeId);
    expect(statuses).not.toContain(statusTypeId('blind')); // cleansed
    expect(statuses).toContain(statusTypeId('pa_down')); // remedyImmune — kept
    expect(statuses).toContain(statusTypeId('quickening')); // buff — kept
  });
});

// ===== Chunk 2 — RSM =====

const catalog2 = createCatalog({ statusTypes, abilities, commandSets, classes, items, rulesets });

// Narrow a catalog ability to its active form (the chunk-2 Short Charge
// tests only pass actives — attack / enchant_haste / earth_cataclysm).
function asActive(a: AbilityDefinition): ActiveAbilityDefinition {
  if (a.kind !== 'active') throw new Error(`expected active ability, got ${a.kind}`);
  return a;
}

function passiveLoadout(bucket: string, abilityIds: ReadonlyArray<AbilityId>): Loadout {
  const actionBuckets: Record<string, ReadonlyArray<CommandSetId>> = {};
  for (const b of ACTIVE_BUCKET_IDS) actionBuckets[b] = [];
  const passiveBuckets: Record<string, ReadonlyArray<AbilityId>> = {};
  for (const b of PASSIVE_BUCKET_IDS) passiveBuckets[b] = [];
  passiveBuckets[bucket] = abilityIds;
  return { actionBuckets, passiveBuckets };
}

describe('Resistance Save', () => {
  it('grants +10 to each elemental resistance, leaves physical alone, and accumulates uncapped', () => {
    let u = makeUnit({ id: 'u', spd: 10, team: 'team_a' });
    let s = makeGameState({ units: [u] });
    // One magical hit's worth.
    s = applyStatus(s, { targetId: u.id, typeId: statusTypeId('resistance_save'), sourceUnitId: u.id, sourceActionSeq: null, magnitude: 10 }, catalog2).newState;
    u = s.units.get(u.id)!;
    for (const tag of ['earth', 'water', 'fire', 'lightning'] as const) {
      expect(runModifyResistance(s, catalog2, { unit: u, tag, baseValue: 0 })).toBe(10);
    }
    // Not an elemental tag — untouched.
    expect(runModifyResistance(s, catalog2, { unit: u, tag: 'physical', baseValue: 0 })).toBe(0);
    // A second hit: STACK_ADDITIVE sums onto one instance → +20, uncapped.
    s = applyStatus(s, { targetId: u.id, typeId: statusTypeId('resistance_save'), sourceUnitId: u.id, sourceActionSeq: null, magnitude: 10 }, catalog2).newState;
    u = s.units.get(u.id)!;
    expect(u.statuses.filter((i) => i.typeId === statusTypeId('resistance_save'))).toHaveLength(1);
    expect(runModifyResistance(s, catalog2, { unit: u, tag: 'fire', baseValue: 0 })).toBe(20);
  });

  it('reaction is gated on magical (not physical) damage', () => {
    const ability = catalog2.getAbility(abilityId('resistance_save'));
    expect(ability.kind).toBe('passive');
    if (ability.kind !== 'passive') return;
    const cond = ability.reactionFields?.triggerCondition;
    expect(cond?.type).toBe('damage_received');
    if (cond?.type !== 'damage_received') return;
    expect(cond.damageTagsAny).toContain('magical');
    expect(cond.damageTagsNone).toContain('healing');
  });
});

describe('Short Charge', () => {
  const s = makeGameState({
    units: [makeUnit({ id: 'caster', spd: 10, ma: 10, loadout: passiveLoadout(bucketId('support'), [abilityId('short_charge')]) })],
  });
  const caster = s.units.get(unitId('caster'))!;

  it('speeds a basic charge (actSpd 30 → 39) and an ultimate (18 → 23) proportionally', () => {
    // enchant_haste is actionSpeed 30; earth_cataclysm is 18. ×1.33 floored.
    expect(computeBaseActionSpeed(s, catalog2, caster, asActive(catalog2.getAbility(abilityId('enchant_haste'))))).toBe(39);
    expect(computeBaseActionSpeed(s, catalog2, caster, asActive(catalog2.getAbility(abilityId('earth_cataclysm'))))).toBe(23);
  });

  it('leaves instant abilities instant (0 stays 0)', () => {
    expect(computeBaseActionSpeed(s, catalog2, caster, asActive(catalog2.getAbility(abilityId('attack'))))).toBe(0);
  });
});

describe('Float', () => {
  const s = makeGameState({
    units: [makeUnit({ id: 'f', spd: 10, loadout: passiveLoadout(bucketId('movement'), [abilityId('float')]) })],
  });
  const u = s.units.get(unitId('f'))!;

  it('negates water move-cost (shallow 2 → 1, deep 3 → 1), ground unchanged', () => {
    const profile = computeMovementProfile(s, u.id, catalog2);
    expect(profile.terrainCosts.get('water_shallow')).toBe(1);
    expect(profile.terrainCosts.get('water_deep')).toBe(1);
    // Ground untouched — defaults to cost 1 (Float is water-only).
    expect(profile.terrainCosts.get('ground') ?? 1).toBe(1);
  });

  it('is immune to fall damage but not other system damage', () => {
    const falling: SystemDamageSource = { kind: 'falling', unitId: u.id, dropDistance: 4 };
    expect(runModifySystemDamage(s, catalog2, { unit: u, source: falling, tags: new Set(['physical']), baseAmount: 40 })).toBe(0);
    const poison: SystemDamageSource = { kind: 'status_tick', statusTypeId: statusTypeId('poison'), unitId: u.id };
    expect(runModifySystemDamage(s, catalog2, { unit: u, source: poison, tags: new Set(['poison']), baseAmount: 10 })).toBe(10);
  });

  it('has no elevation effect (Jump unchanged from class baseline)', () => {
    const withFloat = computeMovementProfile(s, u.id, catalog2).jump;
    const plain = computeMovementProfile(
      makeGameState({ units: [makeUnit({ id: 'p', spd: 10 })] }),
      unitId('p'),
      catalog2,
    ).jump;
    expect(withFloat).toBe(plain);
  });
});

// ===== Chunk 3 — class wiring + buff→steal loop =====

describe('Enchanter class wiring', () => {
  const catalog = makeTestCatalog();

  it('registers the enchanter class with Auramancy + the RSM free kit', () => {
    const cls = catalog.getClass(classId('enchanter'));
    expect(cls.firstActionCommandSet).toBe(commandSetId('auramancy'));
    expect(cls.dominantStat).toBe('ma');
    for (const a of ['attack', 'resistance_save', 'short_charge', 'float']) {
      expect(cls.freeAbilities.has(abilityId(a))).toBe(true);
    }
    // Auramancy holds the four actives.
    const set = catalog.getCommandSet(commandSetId('auramancy'));
    expect(set.members).toEqual([
      abilityId('enchant_haste'),
      abilityId('enchant_protect'),
      abilityId('enchant_shell'),
      abilityId('esuna'),
    ]);
  });
});

// The buff economy loop (brief acceptance): an Enchanter buffs an ally, then a
// Thief's Steal Buffs lifts the cast buff off them. Builds a real battle with
// the production enchanter + thief classes.
describe('buff → steal loop (Enchanter buffs, Thief steals)', () => {
  function buildLoopBattle() {
    const catalog = makeTestCatalog();
    const config: BattleConfig = {
      battleId: 'session_72_loop',
      rulesetId: rulesetId('default'),
      map: flatMap(8, 8),
      teams: [
        { id: TEAM_A, name: 'A', control: 'human' },
        { id: TEAM_B, name: 'B', control: 'ai' },
      ],
      units: [
        {
          id: unitId('ench'), name: 'Enchanter', team: TEAM_A, classId: classId('enchanter'),
          position: { x: 1, y: 1, layer: 0 }, facing: 'E',
          baseStats: { spd: 10, pa: 3, ma: 10, maxHpBase: 103, maxMpBase: 40, brave: 70, faith: 70, crit_chance: 0, crit_multiplier: 1 },
          vitals: { hp: 103, mp: 40 }, loadout: enchanterLoadout(),
        },
        {
          // Ally to receive the buff (also where the Thief stands adjacent).
          // Brave 1 so the Thief's contest sits at the 95% cap (deterministic
          // steal at the chosen seed — the Thief-test idiom).
          id: unitId('ally'), name: 'Ally', team: TEAM_A, classId: classId('knight'),
          position: { x: 2, y: 1, layer: 0 }, facing: 'W',
          baseStats: { spd: 8, pa: 10, ma: 4, maxHpBase: 100, maxMpBase: 20, brave: 1, faith: 70, crit_chance: 0, crit_multiplier: 1 },
          vitals: { hp: 100, mp: 20 },
          loadout: { actionBuckets: { [bucketId('first_action')]: [commandSetId('battle_skill')] }, passiveBuckets: {} },
        },
        {
          // Enemy Thief in straight-line range of the ally (4h × 3v).
          id: unitId('thief'), name: 'Thief', team: TEAM_B, classId: classId('thief'),
          position: { x: 4, y: 1, layer: 0 }, facing: 'W',
          baseStats: { spd: 11, pa: 7, ma: 3, maxHpBase: 90, maxMpBase: 28, brave: 100, faith: 70, crit_chance: 0, crit_multiplier: 1 },
          vitals: { hp: 90, mp: 28 },
          loadout: { actionBuckets: { [bucketId('first_action')]: [commandSetId('thief_arts')] }, passiveBuckets: {} },
        },
      ],
      victoryConditions: [
        { kind: 'defeat_all', side: TEAM_B, description: 'A wins' },
        { kind: 'defeat_all', side: TEAM_A, description: 'B wins' },
      ],
      masterSeed: 7,
    };
    return { state: createInitialState(config, catalog), catalog };
  }

  it('a cast-sourced Haste on an ally is stolen away by the Thief', () => {
    const { state, catalog } = buildLoopBattle();
    // The Enchanter's real charged Haste cast is covered by the chunk-1
    // end-to-end test; here we seed the cast result deterministically — a
    // `quickening` sourced from the Enchanter (non-equipment ⇒ stealable) —
    // and focus on closing the loop through Steal Buffs (itself a probabilistic
    // contest, so the apply side is set up deterministically).
    let s = applyStatus(
      state,
      { targetId: unitId('ally'), typeId: statusTypeId('quickening'), sourceUnitId: unitId('ench'), sourceActionSeq: null, duration: 6 },
      catalog,
    ).newState;
    expect(s.units.get(unitId('ally'))!.statuses.some((i) => i.typeId === statusTypeId('quickening'))).toBe(true);

    // Thief steals buffs off the ally. Brave 100 vs the Brave-1 ally → contest
    // at the 95% cap; seed 7 lands it (the Thief-class-test idiom).
    s = { ...s, turnState: activeTurnFor(unitId('thief')) };
    const steal = commitAction(
      s,
      { type: 'use_ability', source: 'player', actorId: unitId('thief'), payload: { abilityId: abilityId('steal_buffs'), target: { kind: 'unit', unitId: unitId('ally') } } },
      catalog,
    );
    expect(steal.ok).toBe(true);
    if (!steal.ok) return;
    s = steal.newState;

    // The buff left the ally and now rides the Thief.
    expect(s.units.get(unitId('ally'))!.statuses.some((i) => i.typeId === statusTypeId('quickening'))).toBe(false);
    expect(s.units.get(unitId('thief'))!.statuses.some((i) => i.typeId === statusTypeId('quickening'))).toBe(true);
  });
});

// ===== Aura Mastery — buff amplifier (ADR-0122) =====

describe('Aura Mastery (buff-magnitude amplifier, ×1.33)', () => {
  const catalog = makeTestCatalog();

  // Apply `typeId` from a caster (optionally carrying Aura Mastery) to a target;
  // return the magnitude baked into the resulting instance.
  function magOf(
    typeId: ReturnType<typeof statusTypeId>,
    opts: { aura: boolean; duration?: number; sourceKind?: 'unit' | 'equipment' },
  ): number | undefined {
    const caster = makeUnit({
      id: 'caster',
      spd: 10,
      ...(opts.aura ? { loadout: passiveLoadout(bucketId('support'), [abilityId('aura_mastery')]) } : {}),
    });
    const target = makeUnit({ id: 'target', spd: 10 });
    const applied = applyStatus(
      makeGameState({ units: [caster, target] }),
      {
        targetId: target.id,
        typeId,
        sourceUnitId: caster.id,
        sourceActionSeq: null,
        ...(opts.duration !== undefined ? { duration: opts.duration } : {}),
        ...(opts.sourceKind !== undefined ? { sourceKind: opts.sourceKind } : {}),
      },
      catalog,
    ).newState;
    return target_magnitude(applied, typeId);
  }
  function target_magnitude(
    state: ReturnType<typeof makeGameState>,
    typeId: ReturnType<typeof statusTypeId>,
  ): number | undefined {
    return state.units.get(unitId('target'))!.statuses.find((i) => i.typeId === typeId)?.magnitude;
  }

  it('scales additive-magnitude buffs by ×1.33', () => {
    expect(magOf(statusTypeId('shell_cast'), { aura: true, duration: 6 })).toBeCloseTo(66.5);
    expect(magOf(statusTypeId('protect_cast'), { aura: true, duration: 6 })).toBeCloseTo(66.5);
    expect(magOf(statusTypeId('crit_modifier'), { aura: true })).toBeCloseTo(26.6);
    expect(magOf(statusTypeId('engineered_defenses'), { aura: true })).toBeCloseTo(1.33);
    expect(magOf(statusTypeId('regen'), { aura: true, duration: 6 })).toBeCloseTo(1.33);
  });

  it('scales a multiplier-magnitude buff (Haste) on its bonus: 1.5 → 1.665', () => {
    expect(magOf(statusTypeId('quickening'), { aura: true, duration: 6 })).toBeCloseTo(1.665);
  });

  it('leaves non-amplifiable buffs, equipment-variant buffs, and equipment-source applies alone', () => {
    expect(magOf(statusTypeId('pa_up'), { aura: true })).toBe(1); // flat stat-point buff — not flagged
    expect(magOf(statusTypeId('haste'), { aura: true })).toBe(1.5); // equipment Haste variant — not flagged
    expect(magOf(statusTypeId('shell_cast'), { aura: false, duration: 6 })).toBe(50); // no amplifier on caster
    // Even a flagged status, applied via the equipment path, is gated out:
    expect(magOf(statusTypeId('shell_cast'), { aura: true, duration: 6, sourceKind: 'equipment' })).toBe(50);
  });
});
