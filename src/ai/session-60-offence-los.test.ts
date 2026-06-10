// S60 — the arc→straight_line cut (ADR-0097) and the offence-side LoS gate
// (B2). Two concerns in one file:
//
//   1. Content guard — the seven spells Chris flipped are `straight_line`;
//      the attacks left as `arc` (bow Charged Attack, the area detonators)
//      and the melee basic Attack are unchanged. A regression fence around
//      the cut roster.
//
//   2. Offence-side LoS (B2) — the AI's reach check (`positionInAbilityRange`)
//      now mirrors validate.ts: a `straight_line` shot needs an unbroken
//      sightline, an `arc` shot lobs over. Before the fix the AI valued a
//      blocked straight_line shot as if it landed, then dropped its WHOLE
//      offence plan when the winner failed `canCommitAction` (it did not fall
//      back to a reachable shot). These tests pin both halves: a blocked shot
//      is declined, and a second valid target is chosen instead of collapsing.

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
import { decideBasicAi } from './basic.ts';

// Real content under test — the flipped seven and a sample of the unchanged.
import { lightningStrike } from '@content/abilities/lightning-strike.ts';
import { fireStrike } from '@content/abilities/fire-strike.ts';
import { waterStrike } from '@content/abilities/water-strike.ts';
import { stormCaller } from '@content/abilities/storm-caller.ts';
import { chainLightning } from '@content/abilities/chain-lightning.ts';
import { fireStorm } from '@content/abilities/fire-storm.ts';
import { flameLance } from '@content/abilities/flame-lance.ts';
import { chargedAttack } from '@content/abilities/charged-attack.ts';
import { earthQuake } from '@content/abilities/earth-quake.ts';
import { maelstrom } from '@content/abilities/maelstrom.ts';
import { attack } from '@content/abilities/attack.ts';

function rangeModeOf(ability: ActiveAbilityDefinition): string | undefined {
  const t = ability.targeting;
  return 'rangeMode' in t ? t.rangeMode : undefined;
}

describe('S60 content cut (ADR-0097) — flipped roster', () => {
  it('the seven cut abilities are now straight_line', () => {
    for (const a of [
      lightningStrike,
      fireStrike,
      waterStrike,
      stormCaller,
      chainLightning,
      fireStorm,
      flameLance,
    ]) {
      expect(rangeModeOf(a)).toBe('straight_line');
    }
  });

  it('the bow and area detonators stay arc; melee stays melee', () => {
    expect(rangeModeOf(chargedAttack)).toBe('arc');
    expect(rangeModeOf(earthQuake)).toBe('arc');
    expect(rangeModeOf(maelstrom)).toBe('arc');
    expect(rangeModeOf(attack)).toBe('melee');
  });
});

// ============================================================
// B2 — offence-side LoS gate
// ============================================================

const TEAM_A = teamId('team_a');
const TEAM_B = teamId('team_b');
const MAGE = classId('s60_mage');
const FIRST = bucketId('first_action');
const SPELLS = commandSetId('s60_spells');
const BOLT_LOS = abilityId('s60_bolt_los'); // straight_line
const BOLT_ARC = abilityId('s60_bolt_arc'); // arc (contrast)

const aiTestRulesets = [makeTestRuleset({ damagePipelineStages: DEFAULT_TEST_DAMAGE_PIPELINE })];

// A single-target physical bolt, range 4. One straight_line, one arc —
// identical but for the trajectory, so a side-by-side blocked shot isolates
// the gate. Physical (no 'weapon' tag) so damage comes from PA alone, no
// equipment needed — deterministic at accuracy 100.
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

const EMPTY_EQUIP: UnitEquipment = {
  leftHand: null,
  rightHand: null,
  headgear: null,
  armor: null,
  accessory: null,
};

interface Placement {
  readonly id: string;
  readonly team: string;
  readonly x: number;
  readonly y: number;
  readonly hp?: number;
}

interface BuildOpts {
  readonly width: number;
  readonly height: number;
  readonly placements: ReadonlyArray<Placement>;
  readonly activeId: string;
  readonly barriers?: ReadonlyArray<{ x: number; y: number }>;
  readonly canMove?: boolean;
  // Which bolts the caster carries. Default both; narrowed to one to isolate
  // a single trajectory (so the other doesn't cover for a blocked shot).
  readonly members?: ReadonlyArray<AbilityId>;
}

function buildBattle(opts: BuildOpts): { state: GameState; catalog: Catalog } {
  const members = opts.members ?? [BOLT_LOS, BOLT_ARC];
  const spells: CommandSetDefinition = {
    id: SPELLS,
    name: 'S60 Spells',
    members: [...members],
    baseCost: 1,
    availability: 'hidden',
  };
  const mage: ClassDefinition = {
    id: MAGE,
    name: 'S60 Mage',
    movement: { moveRange: 4, jump: 9, terrainCosts: new Map(), canEnter: new Set(['ground']) },
    evasion: { front: 0, side: 0, back: 0 },
    firstActionCommandSet: SPELLS,
    freeAbilities: new Set(),
    equipmentSlots: { leftHand: true, rightHand: true, headgear: true, armor: true, accessory: true },
    dominantStat: 'pa',
  };
  const catalog = createCatalog({
    statusTypes: [],
    abilities: [bolt(BOLT_LOS, 'straight_line'), bolt(BOLT_ARC, 'arc')],
    commandSets: [spells],
    classes: [mage],
    items: [],
    rulesets: aiTestRulesets,
  });
  const barrierAt = new Set((opts.barriers ?? []).map((b) => `${b.x},${b.y}`));
  const tiles: Tile[] = [];
  for (let y = 0; y < opts.height; y++) {
    for (let x = 0; x < opts.width; x++) {
      const base: Tile = { x, y, layer: 0, elevation: 0, terrain: 'ground', properties: [] };
      tiles.push(
        barrierAt.has(`${x},${y}`)
          ? { ...base, barrier: { hp: 50, ttl: 5, ownerId: unitId('s60_barrier_owner') } }
          : base,
      );
    }
  }
  const config: BattleConfig = {
    battleId: 's60_offence_los',
    rulesetId: rulesetId('default'),
    map: { width: opts.width, height: opts.height, tiles },
    teams: [
      { id: TEAM_A, name: 'A', control: 'human' },
      { id: TEAM_B, name: 'B', control: 'ai' },
    ],
    units: opts.placements.map((p) => ({
      id: unitId(p.id),
      name: p.id,
      team: teamId(p.team),
      classId: MAGE,
      position: { x: p.x, y: p.y, layer: 0 },
      facing: 'E',
      equipment: EMPTY_EQUIP,
      baseStats: {
        spd: 10,
        pa: 10,
        ma: 4,
        maxHpBase: 100,
        maxMpBase: 30,
        brave: 70,
        faith: 70,
        crit_chance: 0,
        crit_multiplier: 1,
      },
      vitals: { hp: p.hp ?? 100, mp: 30 },
      loadout: { actionBuckets: { [FIRST]: [SPELLS] }, passiveBuckets: {} },
    })),
    victoryConditions: [
      { kind: 'defeat_all', side: TEAM_B, description: 'Defeat all enemies' },
      { kind: 'defeat_all', side: TEAM_A, description: 'Defeat all enemies' },
    ],
    masterSeed: 1,
  };
  const initialState = createInitialState(config, catalog);
  const state: GameState = {
    ...initialState,
    turnState: {
      unitId: unitId(opts.activeId),
      budget: { movesAvailable: opts.canMove ? 1 : 0, actsAvailable: 1 },
      consumed: { movesConsumed: 0, actsConsumed: 0 },
      reactionsUsedThisTurn: new Map(),
    },
  };
  return { state, catalog };
}

// Helpers reading the AI decision.
function abilityTargetUnit(state: GameState, catalog: Catalog): string {
  const d = decideBasicAi(state, catalog);
  if (d.kind !== 'commit') throw new Error(`expected commit, got ${d.kind}`);
  if (d.action.type !== 'use_ability') throw new Error(`expected use_ability, got ${d.action.type}`);
  const target = d.action.payload.target;
  if (target.kind !== 'unit') throw new Error(`expected unit target, got ${target.kind}`);
  return target.unitId;
}

function decisionType(state: GameState, catalog: Catalog): string {
  const d = decideBasicAi(state, catalog);
  return d.kind === 'commit' ? d.action.type : d.kind;
}

describe('S60 B2 — AI offence respects straight_line LoS', () => {
  it('open straight_line shot: the AI fires (LoS clear)', () => {
    const { state, catalog } = buildBattle({
      width: 5,
      height: 1,
      placements: [
        { id: 'caster_b', team: 'team_b', x: 0, y: 0 },
        { id: 'enemy_a', team: 'team_a', x: 3, y: 0 },
      ],
      activeId: 'caster_b',
      members: [BOLT_LOS],
    });
    expect(abilityTargetUnit(state, catalog)).toBe('enemy_a');
  });

  it('blocked straight_line shot, no move: the AI declines (does not fire through the wall)', () => {
    // Caster (0,0), enemy (3,0); a barrier at (2,0) sits on the Bresenham path
    // and breaks the level same-elevation sightline (inclusive barrier bound).
    const { state, catalog } = buildBattle({
      width: 5,
      height: 1,
      placements: [
        { id: 'caster_b', team: 'team_b', x: 0, y: 0 },
        { id: 'enemy_a', team: 'team_a', x: 3, y: 0 },
      ],
      activeId: 'caster_b',
      barriers: [{ x: 2, y: 0 }],
      members: [BOLT_LOS],
    });
    expect(decisionType(state, catalog)).toBe('end-turn');
  });

  it('blocked arc shot, no move: the AI still fires (arc lobs over the wall)', () => {
    const { state, catalog } = buildBattle({
      width: 5,
      height: 1,
      placements: [
        { id: 'caster_b', team: 'team_b', x: 0, y: 0 },
        { id: 'enemy_a', team: 'team_a', x: 3, y: 0 },
      ],
      activeId: 'caster_b',
      barriers: [{ x: 2, y: 0 }],
      members: [BOLT_ARC],
    });
    expect(abilityTargetUnit(state, catalog)).toBe('enemy_a');
  });

  it('regression — does not collapse: a blocked high-value target is skipped for a reachable one', () => {
    // enemy_blocked at (3,0) behind the barrier is the juicier target (low HP
    // → high killValue), so pre-fix it topped the ranking and the whole plan
    // collapsed when canCommitAction rejected the through-wall shot. enemy_open
    // at (0,2) has clear LoS. Post-fix the AI fires at the reachable one.
    const { state, catalog } = buildBattle({
      width: 5,
      height: 3,
      placements: [
        { id: 'caster_b', team: 'team_b', x: 0, y: 0 },
        { id: 'enemy_blocked', team: 'team_a', x: 3, y: 0, hp: 5 },
        { id: 'enemy_open', team: 'team_a', x: 0, y: 2, hp: 100 },
      ],
      activeId: 'caster_b',
      barriers: [{ x: 2, y: 0 }],
      members: [BOLT_LOS],
    });
    expect(abilityTargetUnit(state, catalog)).toBe('enemy_open');
  });

  it('move-to-LoS: blocked in place but a clear firing tile exists → the AI repositions', () => {
    // Standing at (0,0) the straight_line shot at (3,0) is blocked by the
    // barrier at (2,0); moving off the row (e.g. to y=1) opens the lane. With
    // move budget the joint planner returns the Move leg of a move+shoot plan.
    const { state, catalog } = buildBattle({
      width: 5,
      height: 2,
      placements: [
        { id: 'caster_b', team: 'team_b', x: 0, y: 0 },
        { id: 'enemy_a', team: 'team_a', x: 3, y: 0 },
      ],
      activeId: 'caster_b',
      barriers: [{ x: 2, y: 0 }],
      canMove: true,
      members: [BOLT_LOS],
    });
    expect(decisionType(state, catalog)).toBe('move');
  });
});
