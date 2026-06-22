// Session 72 integration tests — Enchanter chunk 1 (Auramancy actives).
//
// Covers:
//   1. Buff chance tuning — the three Auramancy buffs (baseChance 97) land
//      ~90% net on a default-Faith (70) ally at the Enchanter's MA 10, climb
//      toward always-on as MA is buffed, and drop on a low-Faith ally.
//   2. The timed buff statuses (quickening / protect_cast / shell_cast):
//      per_unit_ct duration, REFRESH, polarity 'buff' (so Steal Buffs lifts
//      them — the Thief loop), distinct from the permanent equipment forms.
//   3. End-to-end Haste: an Enchanter casts enchant_haste on an ally cluster;
//      the charged action resolves and the ally gains quickening (Speed ×1.5),
//      from a non-equipment source (stealable).
//   4. End-to-end Esuna: cleanse removes negative statuses (Blind) from an
//      ally in the AoE but leaves committed stat-downs (PA Down, remedyImmune)
//      and buffs (quickening) alone — mirroring Remedy's cleanse set.

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
import { computeSpeed } from '../ct/speed.ts';
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
  type BattleConfig,
  type ClassDefinition,
  type CommandSetDefinition,
  type CommandSetId,
  type GameState,
  type Loadout,
} from '@engine/index.ts';

const TEAM_A = teamId('team_a');
const TEAM_B = teamId('team_b');

// Temporary Auramancy set + Enchanter class for the end-to-end casts. The
// real registration lands in chunk 3; this local catalog extension lets the
// four chunk-1 actives be cast through the loadout/validate/charged-resolve
// path now without preempting the chunk-3 ids.
const TEST_AURAMANCY: CommandSetDefinition = {
  id: commandSetId('test_auramancy'),
  name: 'Auramancy (test)',
  members: [
    abilityId('enchant_haste'),
    abilityId('enchant_protect'),
    abilityId('enchant_shell'),
    abilityId('esuna'),
  ],
  baseCost: 1,
  availability: 'available',
};

const TEST_ENCHANTER: ClassDefinition = {
  id: classId('test_enchanter'),
  name: 'Enchanter (test)',
  movement: {
    moveRange: 3,
    jump: 2,
    terrainCosts: new Map(),
    canEnter: new Set(['ground']),
  },
  evasion: { front: 6, side: 4, back: 0 },
  equipmentSlots: {
    leftHand: true,
    rightHand: true,
    headgear: true,
    armor: true,
    accessory: true,
  },
  firstActionCommandSet: commandSetId('test_auramancy'),
  freeAbilities: new Set([abilityId('attack')]),
  dominantStat: 'ma',
  defaultGender: 'female',
};

function makeTestCatalog() {
  return createCatalog({
    statusTypes,
    abilities,
    commandSets: [...commandSets, TEST_AURAMANCY],
    classes: [...classes, TEST_ENCHANTER],
    items,
    rulesets,
  });
}

function enchanterLoadout(): Loadout {
  const actionBuckets: Record<string, ReadonlyArray<CommandSetId>> = {};
  for (const b of ACTIVE_BUCKET_IDS) actionBuckets[b] = [];
  actionBuckets[bucketId('first_action')] = [commandSetId('test_auramancy')];
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
        classId: classId('test_enchanter'),
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
