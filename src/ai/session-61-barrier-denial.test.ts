// S61 — Barrier denial (Worldcraft Tier B, the half deferred from S57/S59).
// ADR-0098. The AI Terraformer screens its most-threatened ally with a wall,
// scored as NET coverage-delta: the reduction in expected incoming damage to
// the protected ally MINUS the barrier's cost to the AI team's own offense
// (a barrier blocks both teams). These tests pin the behaviors that matter:
//
//   - it builds a screening wall when one protects a threatened ally;
//   - the wall lands on the threat's sightline (it actually screens);
//   - it declines when there's nothing to protect (no speculative walls);
//   - it declines when the wall would mostly sever the AI's own kill shot
//     (net-negative — the self-walling guard, D4);
//   - it declines an ineffective wall (adjacent melee — nothing to screen);
//   - it declines against an ARC threat (which lobs over the wall) — the
//     LoS-delta dependency that the S60 arc→straight_line cut created.

import { describe, expect, it } from 'vitest';
import {
  abilityId,
  bucketId,
  classId,
  commandSetId,
  createCatalog,
  createInitialState,
  rulesetId,
  teamId,
  unitId,
  type AbilityId,
  type ActiveAbilityDefinition,
  type BattleConfig,
  type Catalog,
  type ClassDefinition,
  type CommandSetDefinition,
  type GameState,
  type Tile,
  type UnitEquipment,
} from '@engine/index.ts';
import { DEFAULT_TEST_DAMAGE_PIPELINE, makeTestRuleset } from '@engine/catalog/test-fixtures.ts';
import { decideBasicAi, type BasicAiDecision } from './basic.ts';
import { barrier as barrierAbility } from '@content/abilities/worldcraft/barrier.ts';

const BARRIER = barrierAbility.id;

const TEAM_AI = teamId('team_b'); // the AI side (Terraformer + ally)
const TEAM_FOE = teamId('team_a');
const FIRST = bucketId('first_action');

const TERRAFORMER = classId('s61_terraformer');
const SHOOTER = classId('s61_shooter');
const ARC_SHOOTER = classId('s61_arc_shooter');
const MELEE = classId('s61_melee');
const CIVILIAN = classId('s61_civilian');

const WORLDCRAFT_SET = commandSetId('s61_worldcraft');
const BOLT_LOS_SET = commandSetId('s61_bolt_los_set');
const BOLT_ARC_SET = commandSetId('s61_bolt_arc_set');
const SWORD_SET = commandSetId('s61_sword_set');
const NOOP_SET = commandSetId('s61_noop_set');

const BOLT_LOS = abilityId('s61_bolt_los');
const BOLT_ARC = abilityId('s61_bolt_arc');
const SWORD = abilityId('s61_sword');

const aiTestRulesets = [makeTestRuleset({ damagePipelineStages: DEFAULT_TEST_DAMAGE_PIPELINE })];

function bolt(id: AbilityId, rangeMode: 'straight_line' | 'arc'): ActiveAbilityDefinition {
  return {
    id,
    name: id,
    kind: 'active',
    bucket: FIRST,
    baseCost: 1,
    availability: 'hidden',
    targeting: { kind: 'single_unit', range: { horizontal: 4, vertical: 99 }, rangeMode },
    actionSpeed: 0,
    mpCost: 0,
    hitRoll: { accuracy: 100 },
    effects: { damage: { tags: ['physical'], power_coefficient: 8 } },
  };
}

const sword: ActiveAbilityDefinition = {
  id: SWORD,
  name: SWORD,
  kind: 'active',
  bucket: FIRST,
  baseCost: 1,
  availability: 'hidden',
  targeting: { kind: 'single_unit', range: { horizontal: 1, vertical: 3 }, rangeMode: 'melee' },
  actionSpeed: 0,
  mpCost: 0,
  hitRoll: { accuracy: 100 },
  effects: { damage: { tags: ['physical'], power_coefficient: 8 } },
};

function set(id: typeof WORLDCRAFT_SET, members: ReadonlyArray<AbilityId>): CommandSetDefinition {
  return { id, name: id, members: [...members], baseCost: 1, availability: 'hidden' };
}

function klass(id: typeof TERRAFORMER, firstSet: typeof WORLDCRAFT_SET): ClassDefinition {
  return {
    id,
    name: id,
    // moveRange 0 pins the threat geometry: each unit threatens only from where
    // it stands, so the protected ally and the screened lane are deterministic.
    movement: { moveRange: 0, jump: 9, terrainCosts: new Map(), canEnter: new Set(['ground']) },
    evasion: { front: 0, side: 0, back: 0 },
    firstActionCommandSet: firstSet,
    freeAbilities: new Set(),
    equipmentSlots: { leftHand: true, rightHand: true, headgear: true, armor: true, accessory: true },
    dominantStat: 'pa',
  };
}

const EMPTY_EQUIP: UnitEquipment = {
  leftHand: null,
  rightHand: null,
  headgear: null,
  armor: null,
  accessory: null,
};

interface Placement {
  readonly id: string;
  readonly team: typeof TEAM_AI;
  readonly classId: typeof TERRAFORMER;
  readonly commandSet: typeof WORLDCRAFT_SET;
  readonly x: number;
  readonly y: number;
  readonly hp?: number;
  readonly maxHp?: number;
}

function buildBattle(opts: {
  width: number;
  height: number;
  placements: ReadonlyArray<Placement>;
  activeId: string;
}): { state: GameState; catalog: Catalog } {
  const catalog = createCatalog({
    statusTypes: [],
    abilities: [bolt(BOLT_LOS, 'straight_line'), bolt(BOLT_ARC, 'arc'), sword, barrierAbility],
    commandSets: [
      set(WORLDCRAFT_SET, [BARRIER]),
      set(BOLT_LOS_SET, [BOLT_LOS]),
      set(BOLT_ARC_SET, [BOLT_ARC]),
      set(SWORD_SET, [SWORD]),
      set(NOOP_SET, []),
    ],
    classes: [
      klass(TERRAFORMER, WORLDCRAFT_SET),
      klass(SHOOTER, BOLT_LOS_SET),
      klass(ARC_SHOOTER, BOLT_ARC_SET),
      klass(MELEE, SWORD_SET),
      klass(CIVILIAN, NOOP_SET),
    ],
    items: [],
    rulesets: aiTestRulesets,
  });
  const tiles: Tile[] = [];
  for (let y = 0; y < opts.height; y++) {
    for (let x = 0; x < opts.width; x++) {
      tiles.push({ x, y, layer: 0, elevation: 0, terrain: 'ground', properties: [] });
    }
  }
  const config: BattleConfig = {
    battleId: 's61_barrier_denial',
    rulesetId: rulesetId('default'),
    map: { width: opts.width, height: opts.height, tiles },
    teams: [
      { id: TEAM_FOE, name: 'A', control: 'human' },
      { id: TEAM_AI, name: 'B', control: 'ai' },
    ],
    units: opts.placements.map((p) => ({
      id: unitId(p.id),
      name: p.id,
      team: p.team,
      classId: p.classId,
      position: { x: p.x, y: p.y, layer: 0 },
      facing: 'E',
      equipment: EMPTY_EQUIP,
      baseStats: {
        spd: 10,
        pa: 10,
        ma: 4,
        maxHpBase: p.maxHp ?? 100,
        maxMpBase: 30,
        brave: 70,
        faith: 70,
        crit_chance: 0,
        crit_multiplier: 1,
      },
      vitals: { hp: p.hp ?? (p.maxHp ?? 100), mp: 30 },
      loadout: { actionBuckets: { [FIRST]: [p.commandSet] }, passiveBuckets: {} },
    })),
    victoryConditions: [
      { kind: 'defeat_all', side: TEAM_AI, description: 'Defeat all enemies' },
      { kind: 'defeat_all', side: TEAM_FOE, description: 'Defeat all enemies' },
    ],
    masterSeed: 1,
  };
  const initialState = createInitialState(config, catalog);
  const state: GameState = {
    ...initialState,
    turnState: {
      unitId: unitId(opts.activeId),
      budget: { movesAvailable: 1, actsAvailable: 1 },
      consumed: { movesConsumed: 0, actsConsumed: 0 },
      reactionsUsedThisTurn: new Map(),
    },
  };
  return { state, catalog };
}

function barrierCast(d: BasicAiDecision): ReadonlyArray<{ x: number; y: number; layer: number }> | null {
  if (d.kind !== 'commit') return null;
  if (d.action.type !== 'use_ability') return null;
  if (d.action.payload.abilityId !== BARRIER) return null;
  const target = d.action.payload.target;
  if (target.kind !== 'tile_set') return null;
  return target.positions;
}

// Common roles. The AI Terraformer sits off the threat axis (south) so it is
// not itself the most-threatened unit — the protected ally is unambiguous.
const terraformer = (x: number, y: number): Placement => ({
  id: 'terra', team: TEAM_AI, classId: TERRAFORMER, commandSet: WORLDCRAFT_SET, x, y,
});

describe('S61 Barrier denial (ADR-0098)', () => {
  it('builds a screening wall on the threat sightline to protect a threatened ally', () => {
    // Ally (2,3) is shot by a straight_line archer at (6,3) along row y=3.
    // The Terraformer at (2,5) walls the lane. The East screen at x=3 (one tile
    // beyond the ally toward the threat) crosses the sightline at (3,3).
    const { state, catalog } = buildBattle({
      width: 7,
      height: 7,
      placements: [
        terraformer(2, 5),
        { id: 'ally', team: TEAM_AI, classId: CIVILIAN, commandSet: NOOP_SET, x: 2, y: 3 },
        { id: 'foe', team: TEAM_FOE, classId: SHOOTER, commandSet: BOLT_LOS_SET, x: 6, y: 3 },
      ],
      activeId: 'terra',
    });
    const positions = barrierCast(decideBasicAi(state, catalog));
    expect(positions).not.toBeNull();
    // The chosen wall sits on the enemy→ally sightline (the screen tile (3,3)).
    expect(positions!.some((p) => p.x === 3 && p.y === 3)).toBe(true);
  });

  it('declines when no ally faces any incoming threat (no speculative walls)', () => {
    // The foe is out of range/LoS of every ally → nothing to protect.
    const { state, catalog } = buildBattle({
      width: 7,
      height: 7,
      placements: [
        terraformer(2, 5),
        { id: 'ally', team: TEAM_AI, classId: CIVILIAN, commandSet: NOOP_SET, x: 2, y: 3 },
        { id: 'foe', team: TEAM_FOE, classId: SHOOTER, commandSet: BOLT_LOS_SET, x: 6, y: 6 },
      ],
      activeId: 'terra',
    });
    expect(barrierCast(decideBasicAi(state, catalog))).toBeNull();
  });

  it('declines a wall that would mostly sever the AI team’s own kill shot (net-negative)', () => {
    // The ally is itself a straight_line shooter trading fire with a near-dead
    // foe (hp 5 → high killValue). A screen on the lane protects the ally a
    // little but walls off the team’s far more valuable kill shot → net < 0.
    const { state, catalog } = buildBattle({
      width: 7,
      height: 7,
      placements: [
        terraformer(2, 5),
        { id: 'ally', team: TEAM_AI, classId: SHOOTER, commandSet: BOLT_LOS_SET, x: 2, y: 3, hp: 100 },
        { id: 'foe', team: TEAM_FOE, classId: SHOOTER, commandSet: BOLT_LOS_SET, x: 6, y: 3, hp: 5 },
      ],
      activeId: 'terra',
    });
    expect(barrierCast(decideBasicAi(state, catalog))).toBeNull();
  });

  it('declines an ineffective wall — an adjacent melee threat has nothing to screen', () => {
    // The foe is already adjacent to the ally with a melee swing (no LoS gate,
    // no approach to block) → no screen reduces incoming → gain 0 → decline.
    const { state, catalog } = buildBattle({
      width: 7,
      height: 7,
      placements: [
        terraformer(2, 5),
        { id: 'ally', team: TEAM_AI, classId: CIVILIAN, commandSet: NOOP_SET, x: 2, y: 3 },
        { id: 'foe', team: TEAM_FOE, classId: MELEE, commandSet: SWORD_SET, x: 3, y: 3 },
      ],
      activeId: 'terra',
    });
    expect(barrierCast(decideBasicAi(state, catalog))).toBeNull();
  });

  it('declines against an arc threat — it lobs over the wall (the LoS-delta dependency)', () => {
    // Identical to the positive case but the foe’s bolt is ARC: arcTargetable
    // ignores barriers, so the wall blocks nothing → gain 0 → decline. This is
    // exactly why the S60 arc→straight_line cut was the prerequisite.
    const { state, catalog } = buildBattle({
      width: 7,
      height: 7,
      placements: [
        terraformer(2, 5),
        { id: 'ally', team: TEAM_AI, classId: CIVILIAN, commandSet: NOOP_SET, x: 2, y: 3 },
        { id: 'foe', team: TEAM_FOE, classId: ARC_SHOOTER, commandSet: BOLT_ARC_SET, x: 6, y: 3 },
      ],
      activeId: 'terra',
    });
    expect(barrierCast(decideBasicAi(state, catalog))).toBeNull();
  });
});
