// Unit tests for decideBasicAi. The AI is a pure function of
// (state, catalog), so each test builds a small focused state and
// asserts the decision shape directly. Integration with the orchestrator
// (full battle to completion) is tested in
// `src/app/controllers/ai-controller.integration.test.ts`.

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
  type ActiveAbilityDefinition,
  type BattleConfig,
  type Catalog,
  type ClassDefinition,
  type CommandSetDefinition,
  type GameState,
  type ProposedAction,
  type Tile,
  type UnitId,
} from '@engine/index.ts';
import { defaultTestRulesets } from '@engine/catalog/test-fixtures.ts';
import { decideBasicAi } from './basic.ts';

const TEAM_A = teamId('team_a');
const TEAM_B = teamId('team_b');
const KNIGHT = classId('knight');
const FIRST = bucketId('first_action');
const SECOND = bucketId('second_action');
const ATTACK_ID = abilityId('attack');
const CURE_ID = abilityId('cure');
const BATTLE_SKILL = commandSetId('battle_skill');
const WHITE_MAGIC = commandSetId('white_magic');

function flatGround(width: number, height: number): Tile[] {
  const tiles: Tile[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      tiles.push({ x, y, layer: 0, elevation: 0, terrain: 'ground', properties: [] });
    }
  }
  return tiles;
}

const attack: ActiveAbilityDefinition = {
  id: ATTACK_ID,
  name: 'Attack',
  kind: 'active',
  bucket: FIRST,
  baseCost: 1,
  targeting: { kind: 'single_unit', range: { horizontal: 1, vertical: 3 }, rangeMode: 'melee' },
  chargeTicks: 0,
  mpCost: 0,
  effects: { damage: { tags: ['physical', 'weapon'], power: 4 } },
};

const cure: ActiveAbilityDefinition = {
  id: CURE_ID,
  name: 'Cure',
  kind: 'active',
  bucket: SECOND,
  baseCost: 1,
  targeting: { kind: 'single_unit', range: { horizontal: 4, vertical: 3 }, rangeMode: 'arc' },
  chargeTicks: 0,
  mpCost: 4,
  effects: { damage: { tags: ['holy', 'healing'], power: 5 } },
};

const battleSkill: CommandSetDefinition = {
  id: BATTLE_SKILL,
  name: 'Battle Skill',
  members: [ATTACK_ID],
  baseCost: 1,
};

const whiteMagic: CommandSetDefinition = {
  id: WHITE_MAGIC,
  name: 'White Magic',
  members: [CURE_ID],
  baseCost: 1,
};

const knight: ClassDefinition = {
  id: KNIGHT,
  name: 'Knight',
  movement: { moveRange: 3, jump: 2, terrainCosts: new Map(), canEnter: new Set(['ground']) },
  firstActionCommandSet: BATTLE_SKILL,
  freeAbilities: new Set(),
};

function buildCatalog(): Catalog {
  return createCatalog({
    statusTypes: [],
    abilities: [attack, cure],
    commandSets: [battleSkill, whiteMagic],
    classes: [knight],
    items: [],
    rulesets: defaultTestRulesets,
  });
}

interface BuildOpts {
  readonly width?: number;
  readonly height?: number;
  readonly placements: ReadonlyArray<{
    readonly id: string;
    readonly team: string;
    readonly x: number;
    readonly y: number;
    readonly hp?: number;
    readonly mp?: number;
    // When true, this unit also has White Magic (Cure) on second_action
    // and enough MP to cast it. Defaults to false to match the original
    // session-12 fixture (Attack-only Knights).
    readonly cure?: boolean;
  }>;
  // Which placement to grant the active turn (by id). Defaults to placements[0].
  readonly activeId?: string;
}

function buildBattle(opts: BuildOpts): { state: GameState; catalog: Catalog } {
  const width = opts.width ?? 6;
  const height = opts.height ?? 6;
  const catalog = buildCatalog();
  const config: BattleConfig = {
    battleId: 'ai_test',
    rulesetId: rulesetId('default'),
    map: { width, height, tiles: flatGround(width, height) },
    teams: [
      { id: TEAM_A, name: 'A' },
      { id: TEAM_B, name: 'B' },
    ],
    units: opts.placements.map((p) => ({
      id: unitId(p.id),
      name: p.id,
      team: teamId(p.team),
      classId: KNIGHT,
      position: { x: p.x, y: p.y, layer: 0 },
      facing: 'E',
      baseStats: { spd: 10, pa: 6, ma: 4, maxHpBase: 60 },
      vitals: { hp: p.hp ?? 60, mp: p.mp ?? (p.cure ? 10 : 0) },
      loadout: {
        actionBuckets: p.cure
          ? { [FIRST]: BATTLE_SKILL, [SECOND]: WHITE_MAGIC }
          : { [FIRST]: BATTLE_SKILL },
        passiveBuckets: {},
      },
    })),
    victoryConditions: [
      { kind: 'defeat_all', side: TEAM_B, description: 'Defeat all enemies' },
      { kind: 'defeat_all', side: TEAM_A, description: 'Defeat all enemies' },
    ],
    masterSeed: 1,
  };
  const initialState = createInitialState(config, catalog);
  // Force an active turn for the named unit so we don't have to advance
  // CT in tests. (Determinism: the AI never inspects rng.)
  const activeId = opts.activeId ?? opts.placements[0]!.id;
  const state: GameState = {
    ...initialState,
    turnState: {
      unitId: unitId(activeId),
      budget: { movesAvailable: 1, actsAvailable: 1 },
      consumed: { movesConsumed: 0, actsConsumed: 0, waited: false },
      reactionsUsedThisTurn: new Map(),
    },
  };
  return { state, catalog };
}

type UseAbilityAction = Extract<ProposedAction, { type: 'use_ability' }>;
type MoveAction = Extract<ProposedAction, { type: 'move' }>;

function expectAttack(decision: ReturnType<typeof decideBasicAi>): UseAbilityAction {
  if (decision.kind !== 'commit') throw new Error(`expected commit, got ${decision.kind}`);
  if (decision.action.type !== 'use_ability') {
    throw new Error(`expected use_ability, got ${decision.action.type}`);
  }
  return decision.action;
}

function expectMove(decision: ReturnType<typeof decideBasicAi>): MoveAction {
  if (decision.kind !== 'commit') throw new Error(`expected commit, got ${decision.kind}`);
  if (decision.action.type !== 'move') {
    throw new Error(`expected move, got ${decision.action.type}`);
  }
  return decision.action;
}

function targetUnitId(action: UseAbilityAction): UnitId {
  if (action.payload.target.kind !== 'unit') throw new Error('not a unit target');
  return action.payload.target.unitId;
}

describe('decideBasicAi', () => {
  it('ends the turn when no turn is in progress', () => {
    const { state, catalog } = buildBattle({
      placements: [
        { id: 'a', team: 'team_a', x: 0, y: 0 },
        { id: 'b', team: 'team_b', x: 5, y: 5 },
      ],
    });
    const noTurn: GameState = { ...state, turnState: null };
    expect(decideBasicAi(noTurn, catalog)).toEqual({ kind: 'end-turn' });
  });

  it('ends the turn when no living enemies remain', () => {
    const { state, catalog } = buildBattle({
      placements: [
        { id: 'a', team: 'team_a', x: 0, y: 0 },
        { id: 'b', team: 'team_b', x: 5, y: 5, hp: 0 },
      ],
    });
    expect(decideBasicAi(state, catalog)).toEqual({ kind: 'end-turn' });
  });

  it('attacks an adjacent enemy', () => {
    const { state, catalog } = buildBattle({
      placements: [
        { id: 'a', team: 'team_a', x: 1, y: 1 },
        { id: 'b', team: 'team_b', x: 2, y: 1 },
      ],
    });
    const action = expectAttack(decideBasicAi(state, catalog));
    expect(targetUnitId(action)).toEqual(unitId('b'));
    expect(action.actorId).toEqual(unitId('a'));
  });

  it('targets the lowest-HP enemy among multiple in range', () => {
    const { state, catalog } = buildBattle({
      placements: [
        { id: 'attacker', team: 'team_a', x: 1, y: 1 },
        { id: 'healthy', team: 'team_b', x: 0, y: 1, hp: 60 },
        { id: 'wounded', team: 'team_b', x: 2, y: 1, hp: 12 },
      ],
    });
    const action = expectAttack(decideBasicAi(state, catalog));
    expect(targetUnitId(action)).toEqual(unitId('wounded'));
  });

  it('breaks lowest-HP ties by lex-id', () => {
    const { state, catalog } = buildBattle({
      placements: [
        { id: 'attacker', team: 'team_a', x: 1, y: 1 },
        { id: 'b_zed', team: 'team_b', x: 0, y: 1, hp: 20 },
        { id: 'a_aaa', team: 'team_b', x: 2, y: 1, hp: 20 },
      ],
    });
    const action = expectAttack(decideBasicAi(state, catalog));
    expect(targetUnitId(action)).toEqual(unitId('a_aaa'));
  });

  it('moves toward an enemy when none are in attack range', () => {
    const { state, catalog } = buildBattle({
      placements: [
        { id: 'a', team: 'team_a', x: 0, y: 0 },
        { id: 'b', team: 'team_b', x: 5, y: 0 },
      ],
    });
    const action = expectMove(decideBasicAi(state, catalog));
    // Knight movement: moveRange 3 + Move+1 (none equipped here) = 3.
    // With closest enemy at x=5 from x=0 the AI should land on x=3, y=0.
    expect(action.payload.destination).toEqual({ x: 3, y: 0, layer: 0 });
  });

  it('prefers a destination that puts the lowest-HP enemy in range', () => {
    // Two enemies. Healthy enemy is east at (3, 0); wounded enemy is
    // south at (0, 3). From (0, 0) with moveRange 3 both can be put
    // into melee range from different destinations: (2, 0) for the
    // healthy enemy, (0, 2) for the wounded one. The AI should choose
    // (0, 2) to set up a kill on the wounded enemy.
    const { state, catalog } = buildBattle({
      placements: [
        { id: 'attacker', team: 'team_a', x: 0, y: 0 },
        { id: 'healthy', team: 'team_b', x: 3, y: 0, hp: 60 },
        { id: 'wounded', team: 'team_b', x: 0, y: 3, hp: 8 },
      ],
    });
    const action = expectMove(decideBasicAi(state, catalog));
    expect(action.payload.destination).toEqual({ x: 0, y: 2, layer: 0 });
  });

  it('ends the turn when no Act and no useful move is available', () => {
    // Burn the actor's Move + Act budgets, place the only enemy out of
    // reach. Even with no offensive options the AI should stay put;
    // the orchestrator handles the final turn_end.
    const { state, catalog } = buildBattle({
      placements: [
        { id: 'a', team: 'team_a', x: 0, y: 0 },
        { id: 'b', team: 'team_b', x: 5, y: 5 },
      ],
    });
    const exhausted: GameState = {
      ...state,
      turnState: {
        ...state.turnState!,
        budget: { movesAvailable: 0, actsAvailable: 0 },
      },
    };
    expect(decideBasicAi(exhausted, catalog)).toEqual({ kind: 'end-turn' });
  });

  it('moves when Act is exhausted but a Move remains', () => {
    const { state, catalog } = buildBattle({
      placements: [
        { id: 'a', team: 'team_a', x: 0, y: 0 },
        { id: 'b', team: 'team_b', x: 4, y: 0 },
      ],
    });
    const noActs: GameState = {
      ...state,
      turnState: {
        ...state.turnState!,
        budget: { movesAvailable: 1, actsAvailable: 0 },
      },
    };
    const action = expectMove(decideBasicAi(noActs, catalog));
    // Should still walk toward the enemy, ending up adjacent at (3, 0).
    expect(action.payload.destination).toEqual({ x: 3, y: 0, layer: 0 });
  });

  it('attacks instead of moving when an enemy is already in range', () => {
    // Both Move and Act available but the enemy is right next to us —
    // attacking is strictly better than wasting the Move first.
    const { state, catalog } = buildBattle({
      placements: [
        { id: 'a', team: 'team_a', x: 1, y: 1 },
        { id: 'b', team: 'team_b', x: 1, y: 2 },
      ],
    });
    const action = expectAttack(decideBasicAi(state, catalog));
    expect(targetUnitId(action)).toEqual(unitId('b'));
  });

  it('is deterministic — same state and catalog yield the same decision', () => {
    const { state, catalog } = buildBattle({
      placements: [
        { id: 'a', team: 'team_a', x: 1, y: 1 },
        { id: 'b1', team: 'team_b', x: 0, y: 1, hp: 20 },
        { id: 'b2', team: 'team_b', x: 2, y: 1, hp: 20 },
      ],
    });
    const first = decideBasicAi(state, catalog);
    const second = decideBasicAi(state, catalog);
    expect(first).toEqual(second);
  });

  it('heals a wounded ally over attacking when both options exist', () => {
    // Healer is in cure range of a wounded ally and in attack range of
    // an enemy. Phase ordering puts heal first.
    const { state, catalog } = buildBattle({
      placements: [
        { id: 'healer', team: 'team_a', x: 1, y: 1, cure: true },
        { id: 'wounded', team: 'team_a', x: 2, y: 1, hp: 20 },
        { id: 'enemy', team: 'team_b', x: 0, y: 1 },
      ],
    });
    const action = expectAttack(decideBasicAi(state, catalog));
    expect(action.payload.abilityId).toEqual(CURE_ID);
    expect(targetUnitId(action)).toEqual(unitId('wounded'));
  });

  it('targets the most-wounded ally among multiple', () => {
    const { state, catalog } = buildBattle({
      placements: [
        { id: 'healer', team: 'team_a', x: 1, y: 1, cure: true },
        { id: 'lightly_hurt', team: 'team_a', x: 2, y: 1, hp: 28 },
        { id: 'badly_hurt', team: 'team_a', x: 0, y: 1, hp: 10 },
      ],
    });
    const action = expectAttack(decideBasicAi(state, catalog));
    expect(action.payload.abilityId).toEqual(CURE_ID);
    expect(targetUnitId(action)).toEqual(unitId('badly_hurt'));
  });

  it('self-heals when the actor is the most-wounded ally in range', () => {
    const { state, catalog } = buildBattle({
      placements: [
        { id: 'healer', team: 'team_a', x: 1, y: 1, hp: 12, cure: true },
        // Healthy ally in range — wouldn't be a heal target.
        { id: 'fine', team: 'team_a', x: 2, y: 1, hp: 60 },
      ],
    });
    const action = expectAttack(decideBasicAi(state, catalog));
    expect(action.payload.abilityId).toEqual(CURE_ID);
    expect(targetUnitId(action)).toEqual(unitId('healer'));
  });

  it('does not heal an ally above the wound threshold', () => {
    // 31/60 hp = ~0.52 ratio; just over the 0.5 threshold. Ally is not
    // considered "wounded enough" — fall through to attacking.
    const { state, catalog } = buildBattle({
      placements: [
        { id: 'healer', team: 'team_a', x: 1, y: 1, cure: true },
        { id: 'mostly_fine', team: 'team_a', x: 2, y: 1, hp: 31 },
        { id: 'enemy', team: 'team_b', x: 0, y: 1 },
      ],
    });
    const action = expectAttack(decideBasicAi(state, catalog));
    expect(action.payload.abilityId).toEqual(ATTACK_ID);
    expect(targetUnitId(action)).toEqual(unitId('enemy'));
  });

  it('falls through to attacking when MP is too low for a heal', () => {
    const { state, catalog } = buildBattle({
      placements: [
        { id: 'healer', team: 'team_a', x: 1, y: 1, cure: true, mp: 0 },
        { id: 'wounded', team: 'team_a', x: 2, y: 1, hp: 20 },
        { id: 'enemy', team: 'team_b', x: 0, y: 1 },
      ],
    });
    const action = expectAttack(decideBasicAi(state, catalog));
    expect(action.payload.abilityId).toEqual(ATTACK_ID);
    expect(targetUnitId(action)).toEqual(unitId('enemy'));
  });

  it('does not consider enemy units as heal targets', () => {
    // Wounded enemy + no enemies in attack range from current position.
    // The AI must not "heal" the enemy; it should fall through to
    // moving toward an attack opportunity.
    const { state, catalog } = buildBattle({
      placements: [
        { id: 'healer', team: 'team_a', x: 0, y: 0, cure: true },
        { id: 'wounded_enemy', team: 'team_b', x: 2, y: 0, hp: 5 },
      ],
    });
    const decision = decideBasicAi(state, catalog);
    expect(decision.kind).toEqual('commit');
    if (decision.kind !== 'commit') return;
    expect(decision.action.type).toEqual('move');
  });

  it('does not move toward a wounded ally when no enemies remain', () => {
    // Wounded ally is out of cure range. No enemies on the field. The
    // current heuristic does not implement move-to-heal, so the AI
    // ends the turn rather than chasing the heal target.
    const { state, catalog } = buildBattle({
      placements: [
        { id: 'healer', team: 'team_a', x: 0, y: 0, cure: true },
        { id: 'wounded', team: 'team_a', x: 5, y: 5, hp: 10 },
      ],
    });
    expect(decideBasicAi(state, catalog)).toEqual({ kind: 'end-turn' });
  });

  it('ends the turn when KO\'d mid-turn (defensive guard)', () => {
    // The orchestrator handles mid-turn KOs of the active unit, but the
    // controller-side guard returns end-turn so the controller is
    // honest standalone.
    const { state, catalog } = buildBattle({
      placements: [
        { id: 'a', team: 'team_a', x: 1, y: 1, hp: 0 },
        { id: 'b', team: 'team_b', x: 2, y: 1 },
      ],
    });
    expect(decideBasicAi(state, catalog)).toEqual({ kind: 'end-turn' });
  });
});
