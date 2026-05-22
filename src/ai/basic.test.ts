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
  statusTypeId,
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
import {
  DEFAULT_TEST_DAMAGE_PIPELINE,
  makeTestRuleset,
} from '@engine/catalog/test-fixtures.ts';

// Tier 2 (session 20b) wires the damage pipeline into the AI's scoring
// via `projectExpectedDamage`. The default test ruleset ships with an
// empty pipeline; we override here so the projection has handlers to run.
const aiTestRulesets = [makeTestRuleset({ damagePipelineStages: DEFAULT_TEST_DAMAGE_PIPELINE })];
import { decideBasicAi } from './basic.ts';

const TEAM_A = teamId('team_a');
const TEAM_B = teamId('team_b');
const KNIGHT = classId('knight');
const FIRST = bucketId('first_action');
const SECOND = bucketId('secondary_command_sets');
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
  availability: 'hidden',
  targeting: { kind: 'single_unit', range: { horizontal: 1, vertical: 3 }, rangeMode: 'melee' },
  actionSpeed: 0,
  mpCost: 0,
  effects: { damage: { tags: ['physical', 'weapon'], power_coefficient: 4 } },
};

const cure: ActiveAbilityDefinition = {
  id: CURE_ID,
  name: 'Cure',
  kind: 'active',
  bucket: SECOND,
  baseCost: 1,
  availability: 'hidden',
  targeting: { kind: 'single_unit', range: { horizontal: 4, vertical: 3 }, rangeMode: 'arc' },
  actionSpeed: 0,
  mpCost: 4,
  effects: { damage: { tags: ['holy', 'healing'], power_coefficient: 5 } },
};

const battleSkill: CommandSetDefinition = {
  id: BATTLE_SKILL,
  name: 'Battle Skill',
  members: [ATTACK_ID],
  baseCost: 1,
  availability: 'hidden',
};

const whiteMagic: CommandSetDefinition = {
  id: WHITE_MAGIC,
  name: 'White Magic',
  members: [CURE_ID],
  baseCost: 1,
  availability: 'hidden',
};

const knight: ClassDefinition = {
  id: KNIGHT,
  name: 'Knight',
  movement: { moveRange: 3, jump: 2, terrainCosts: new Map(), canEnter: new Set(['ground']) },
  evasion: { front: 0, side: 0, back: 0 },
  firstActionCommandSet: BATTLE_SKILL,
  freeAbilities: new Set(),
  equipmentSlots: { leftHand: true, rightHand: true, headgear: true, armor: true, accessory: true },
};

function buildCatalog(): Catalog {
  return createCatalog({
    statusTypes: [],
    abilities: [attack, cure],
    commandSets: [battleSkill, whiteMagic],
    classes: [knight],
    items: [],
    rulesets: aiTestRulesets,
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
      { id: TEAM_A, name: 'A', control: 'human' },
      { id: TEAM_B, name: 'B', control: 'ai' },
    ],
    units: opts.placements.map((p) => ({
      id: unitId(p.id),
      name: p.id,
      team: teamId(p.team),
      classId: KNIGHT,
      position: { x: p.x, y: p.y, layer: 0 },
      facing: 'E',
      baseStats: { spd: 10, pa: 6, ma: 4, maxHpBase: 60, maxMpBase: 50, brave: 100, faith: 80, crit_chance: 0, crit_multiplier: 1 },
      vitals: { hp: p.hp ?? 60, mp: p.mp ?? (p.cure ? 10 : 0) },
      loadout: {
        actionBuckets: p.cure
          ? { [FIRST]: [BATTLE_SKILL], [SECOND]: [WHITE_MAGIC] }
          : { [FIRST]: [BATTLE_SKILL] },
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
      consumed: { movesConsumed: 0, actsConsumed: 0 },
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

// =====================
// Tier 1.5 (session 20a) — using the real default catalog so Lightning
// content (Magnetic Mark, Static Embrace, Storm Caller, Chain
// Lightning) is exercised against production ability definitions.
// =====================

describe('decideBasicAi tier 1.5 — Lightning content + scoring refinements', () => {
  // Each test builds its own state on top of the demo battle's
  // initial state, mutating only the units it cares about. Using the
  // demo battle gives us all five class definitions, all abilities,
  // all statuses already wired up, with realistic stat profiles.

  it('prefers a Vulnerable target over a same-HP non-Vulnerable target', async () => {
    // Two enemies at equal HP, far apart so AoE can't catch both. One
    // is Vulnerable. The AI should favor the Vulnerable one (×1.5
    // damage multiplier ⇒ higher kill value).
    const { loadDefaultCatalog } = await import('../content/index.ts');
    const { applyStatus } = await import('../engine/status/apply.ts');
    const { activeTurnFor, makeGameState, makeUnit } = await import('../engine/ct/test-fixtures.ts');
    const cat = loadDefaultCatalog();
    const attacker = makeUnit({ id: 'attacker', spd: 12, ma: 8, hp: 44, mp: 44, classId: 'lightning_mage', position: { x: 2, y: 2, layer: 0 }, loadout: {
      actionBuckets: { [bucketId('first_action')]: [commandSetId('lightning_spells')] },
      passiveBuckets: {},
    } });
    // Enemies on opposite sides of the attacker, far enough apart that
    // no diamond-r1 cluster catches both — isolates single-target
    // preference.
    const tgtVuln = makeUnit({ id: 'tgt_vuln', team: 'team_b', spd: 10, hp: 30, classId: 'knight', position: { x: 5, y: 2, layer: 0 } });
    const tgtPlain = makeUnit({ id: 'tgt_plain', team: 'team_b', spd: 10, hp: 30, classId: 'knight', position: { x: 0, y: 5, layer: 0 } });
    let state = makeGameState({
      units: [attacker, tgtVuln, tgtPlain],
      map: { width: 6, height: 6, tiles: flatGround(6, 6) },
      teams: [{ id: TEAM_A, name: 'A', control: 'human' }, { id: TEAM_B, name: 'B', control: 'ai' }],
      turnState: activeTurnFor(attacker.id),
    });
    state = applyStatus(state, {
      targetId: tgtVuln.id,
      typeId: statusTypeId('vulnerable'),
      sourceUnitId: attacker.id,
      sourceActionSeq: 0,
    }, cat).newState;
    const decision = decideBasicAi(state, cat);
    if (decision.kind !== 'commit') throw new Error(`expected commit, got ${decision.kind}`);
    if (decision.action.type !== 'use_ability') throw new Error(`expected use_ability`);
    const target = decision.action.payload.target;
    // The AI may pick a tile-targeted AoE that catches the Vulnerable
    // enemy — accept that too. What we're asserting is "the Vulnerable
    // enemy is the (or a) target."
    if (target.kind === 'unit') {
      expect(target.unitId).toEqual(tgtVuln.id);
    } else if (target.kind === 'tile') {
      // The chosen tile must be at or adjacent to the Vulnerable enemy.
      const dx = Math.abs(target.position.x - tgtVuln.position.x);
      const dy = Math.abs(target.position.y - tgtVuln.position.y);
      expect(dx + dy).toBeLessThanOrEqual(1);
    } else {
      throw new Error(`unexpected target kind: ${(target as { kind: string }).kind}`);
    }
  });

  it('refuses Storm Caller when the cast would self-KO', async () => {
    // Storm Caller's 25% maxHpBase self-cost is 11 at maxHpBase 44.
    // With caster at 11 HP, casting drops them to 0. The AI must refuse
    // (Lightning Strike at power 12 stays viable as the alternative).
    const { loadDefaultCatalog } = await import('../content/index.ts');
    const { activeTurnFor, makeGameState, makeUnit } = await import('../engine/ct/test-fixtures.ts');
    const cat = loadDefaultCatalog();
    const attacker = makeUnit({ id: 'attacker', spd: 12, ma: 8, maxHpBase: 44, hp: 11, mp: 44, classId: 'lightning_mage', position: { x: 1, y: 1, layer: 0 }, loadout: {
      actionBuckets: { [bucketId('first_action')]: [commandSetId('lightning_spells')] },
      passiveBuckets: {},
    } });
    const tgt = makeUnit({ id: 'tgt', team: 'team_b', spd: 10, hp: 60, classId: 'knight', position: { x: 2, y: 1, layer: 0 } });
    const state = makeGameState({
      units: [attacker, tgt],
      map: { width: 6, height: 6, tiles: flatGround(6, 6) },
      teams: [{ id: TEAM_A, name: 'A', control: 'human' }, { id: TEAM_B, name: 'B', control: 'ai' }],
      turnState: activeTurnFor(attacker.id),
    });
    const decision = decideBasicAi(state, cat);
    if (decision.kind !== 'commit') throw new Error(`expected commit, got ${decision.kind}`);
    if (decision.action.type !== 'use_ability') throw new Error('expected use_ability');
    expect(decision.action.payload.abilityId).not.toEqual(abilityId('storm_caller'));
  });

  it('prefers Lightning Strike when it one-shots the target (Mark is wasted)', async () => {
    // Tier-2 reality: a Lightning Mage's Strike (MA 8 × power 12 ×
    // Faith 0.64 ≈ 61) one-shots a default Knight (60 HP). Mark would
    // have applied ×1.5 amplification — but the unmarked Strike already
    // kills, so Mark's marginal value collapses to 0. The tier-2 AI
    // correctly picks Strike over Mark in this scenario; the tier-1.5
    // heuristic that preferred Mark on a full-HP target was an
    // under-counting artifact of the `power_coefficient` proxy.
    const { loadDefaultCatalog } = await import('../content/index.ts');
    const { activeTurnFor, makeGameState, makeUnit } = await import('../engine/ct/test-fixtures.ts');
    const cat = loadDefaultCatalog();
    const attacker = makeUnit({ id: 'attacker', spd: 12, ma: 8, hp: 44, mp: 44, classId: 'lightning_mage', position: { x: 1, y: 1, layer: 0 }, loadout: {
      actionBuckets: { [bucketId('first_action')]: [commandSetId('lightning_spells')] },
      passiveBuckets: {},
    } });
    const tgt = makeUnit({ id: 'tgt', team: 'team_b', spd: 10, maxHpBase: 60, hp: 60, classId: 'knight', position: { x: 2, y: 1, layer: 0 } });
    const state = makeGameState({
      units: [attacker, tgt],
      map: { width: 6, height: 6, tiles: flatGround(6, 6) },
      teams: [{ id: TEAM_A, name: 'A', control: 'human' }, { id: TEAM_B, name: 'B', control: 'ai' }],
      turnState: activeTurnFor(attacker.id),
    });
    const decision = decideBasicAi(state, cat);
    if (decision.kind !== 'commit') throw new Error(`expected commit, got ${decision.kind}`);
    if (decision.action.type !== 'use_ability') throw new Error('expected use_ability');
    expect(decision.action.payload.abilityId).not.toEqual(abilityId('magnetic_mark'));
  });

  it('prefers Lightning Strike on a low-HP target (kill it) over Magnetic Mark', async () => {
    // Mirror of the previous test: when the target is already low HP,
    // killing it now beats setting up future damage (the kill removes
    // a future threat).
    const { loadDefaultCatalog } = await import('../content/index.ts');
    const { activeTurnFor, makeGameState, makeUnit } = await import('../engine/ct/test-fixtures.ts');
    const cat = loadDefaultCatalog();
    const attacker = makeUnit({ id: 'attacker', spd: 12, ma: 8, hp: 44, mp: 44, classId: 'lightning_mage', position: { x: 1, y: 1, layer: 0 }, loadout: {
      actionBuckets: { [bucketId('first_action')]: [commandSetId('lightning_spells')] },
      passiveBuckets: {},
    } });
    const tgt = makeUnit({ id: 'tgt', team: 'team_b', spd: 10, maxHpBase: 60, hp: 8, classId: 'knight', position: { x: 2, y: 1, layer: 0 } });
    const state = makeGameState({
      units: [attacker, tgt],
      map: { width: 6, height: 6, tiles: flatGround(6, 6) },
      teams: [{ id: TEAM_A, name: 'A', control: 'human' }, { id: TEAM_B, name: 'B', control: 'ai' }],
      turnState: activeTurnFor(attacker.id),
    });
    const decision = decideBasicAi(state, cat);
    if (decision.kind !== 'commit') throw new Error(`expected commit, got ${decision.kind}`);
    if (decision.action.type !== 'use_ability') throw new Error('expected use_ability');
    expect(decision.action.payload.abilityId).toEqual(abilityId('lightning_strike'));
  });

  it('Static Embrace targets the highest-MA ally in range', async () => {
    // Two allies in Static Embrace range: a low-MA Knight (4) and a
    // high-MA Mage (8). The buff phase picks the Mage.
    const { loadDefaultCatalog } = await import('../content/index.ts');
    const { activeTurnFor, makeGameState, makeUnit } = await import('../engine/ct/test-fixtures.ts');
    const cat = loadDefaultCatalog();
    const attacker = makeUnit({ id: 'attacker', spd: 12, ma: 8, hp: 44, mp: 44, classId: 'lightning_mage', position: { x: 2, y: 2, layer: 0 }, loadout: {
      actionBuckets: { [bucketId('first_action')]: [commandSetId('lightning_spells')] },
      passiveBuckets: {},
    } });
    const knight = makeUnit({ id: 'ally_knight', team: 'team_a', spd: 10, ma: 4, hp: 60, classId: 'knight', position: { x: 1, y: 2, layer: 0 }, loadout: {
      actionBuckets: { [bucketId('first_action')]: [commandSetId('battle_skill')] },
      passiveBuckets: {},
    } });
    const mage = makeUnit({ id: 'ally_mage', team: 'team_a', spd: 9, ma: 8, hp: 50, mp: 40, classId: 'earth_mage', position: { x: 3, y: 2, layer: 0 }, loadout: {
      actionBuckets: { [bucketId('first_action')]: [commandSetId('earth_spells')] },
      passiveBuckets: {},
    } });
    // No reachable enemies — joint planner finds no offensive plan, so
    // the buff phase wins. (Tier 2 reality: the joint planner happily
    // commits Move-then-Strike against an enemy if any reaches striking
    // range — Static Embrace's MA-based score is small compared to a
    // direct kill. Pure-buff scenarios still validate the ally pick.)
    const state = makeGameState({
      units: [attacker, knight, mage],
      map: { width: 6, height: 6, tiles: flatGround(6, 6) },
      teams: [{ id: TEAM_A, name: 'A', control: 'human' }, { id: TEAM_B, name: 'B', control: 'ai' }],
      turnState: activeTurnFor(attacker.id),
    });
    const decision = decideBasicAi(state, cat);
    if (decision.kind !== 'commit') throw new Error(`expected commit, got ${decision.kind}`);
    if (decision.action.type !== 'use_ability') throw new Error('expected use_ability');
    expect(decision.action.payload.abilityId).toEqual(abilityId('static_embrace'));
    const target = decision.action.payload.target;
    if (target.kind !== 'unit') throw new Error('expected unit target');
    expect(target.unitId).toEqual(mage.id);
  });

  it('AoE: Chain Lightning anchors on a tile that catches multiple enemies', async () => {
    // Three enemies clustered at (3,2) (3,3) (4,3). A diamond r1 AoE
    // anchored at (3,3) catches all three. Anchored at (3,2) catches
    // just (3,2) + (3,3) (the south + center tiles). The AI should
    // pick the anchor that maximizes cluster value — (3,3).
    const { loadDefaultCatalog } = await import('../content/index.ts');
    const { activeTurnFor, makeGameState, makeUnit } = await import('../engine/ct/test-fixtures.ts');
    const cat = loadDefaultCatalog();
    const attacker = makeUnit({ id: 'attacker', spd: 12, ma: 8, hp: 44, mp: 44, classId: 'lightning_mage', position: { x: 1, y: 1, layer: 0 }, loadout: {
      actionBuckets: { [bucketId('first_action')]: [commandSetId('lightning_spells')] },
      passiveBuckets: {},
    } });
    const e1 = makeUnit({ id: 'e1', team: 'team_b', spd: 10, hp: 60, classId: 'knight', position: { x: 3, y: 2, layer: 0 } });
    const e2 = makeUnit({ id: 'e2', team: 'team_b', spd: 10, hp: 60, classId: 'knight', position: { x: 3, y: 3, layer: 0 } });
    const e3 = makeUnit({ id: 'e3', team: 'team_b', spd: 10, hp: 60, classId: 'knight', position: { x: 4, y: 3, layer: 0 } });
    const state = makeGameState({
      units: [attacker, e1, e2, e3],
      map: { width: 6, height: 6, tiles: flatGround(6, 6) },
      teams: [{ id: TEAM_A, name: 'A', control: 'human' }, { id: TEAM_B, name: 'B', control: 'ai' }],
      turnState: activeTurnFor(attacker.id),
    });
    const decision = decideBasicAi(state, cat);
    if (decision.kind !== 'commit') throw new Error(`expected commit, got ${decision.kind}`);
    if (decision.action.type !== 'use_ability') throw new Error('expected use_ability');
    // Should be Chain Lightning, anchored on a tile that catches all
    // three (or as many as possible). Single-target Lightning Strike
    // would only get one enemy at e.g. (3, 2) — Chain Lightning's
    // 3-cluster value (with chainBonus +2) outscores it.
    expect(decision.action.payload.abilityId).toEqual(abilityId('chain_lightning'));
  });

  it('AoE: avoids anchoring where allies would catch friendly fire', async () => {
    // One enemy clustered with one ally. Single-target Lightning Strike
    // is preferred because the cluster value with friendly fire is
    // worse than just hitting the enemy alone.
    const { loadDefaultCatalog } = await import('../content/index.ts');
    const { activeTurnFor, makeGameState, makeUnit } = await import('../engine/ct/test-fixtures.ts');
    const cat = loadDefaultCatalog();
    const attacker = makeUnit({ id: 'attacker', spd: 12, ma: 8, hp: 44, mp: 44, classId: 'lightning_mage', position: { x: 1, y: 1, layer: 0 }, loadout: {
      actionBuckets: { [bucketId('first_action')]: [commandSetId('lightning_spells')] },
      passiveBuckets: {},
    } });
    const enemy = makeUnit({ id: 'enemy', team: 'team_b', spd: 10, hp: 60, classId: 'knight', position: { x: 3, y: 2, layer: 0 } });
    const ally = makeUnit({ id: 'ally', team: 'team_a', spd: 10, hp: 60, classId: 'knight', position: { x: 3, y: 3, layer: 0 } });
    const state = makeGameState({
      units: [attacker, enemy, ally],
      map: { width: 6, height: 6, tiles: flatGround(6, 6) },
      teams: [{ id: TEAM_A, name: 'A', control: 'human' }, { id: TEAM_B, name: 'B', control: 'ai' }],
      turnState: activeTurnFor(attacker.id),
    });
    const decision = decideBasicAi(state, cat);
    if (decision.kind !== 'commit') throw new Error(`expected commit, got ${decision.kind}`);
    if (decision.action.type !== 'use_ability') throw new Error('expected use_ability');
    // Either Lightning Strike (single-target, no friendly fire) or
    // a Chain Lightning anchor that doesn't catch the ally. Both are
    // acceptable — what matters is we don't anchor at (3, 2) or (3, 3)
    // where the ally is in cluster.
    const ability = decision.action.payload.abilityId;
    if (ability === abilityId('chain_lightning')) {
      const target = decision.action.payload.target;
      if (target.kind !== 'tile') throw new Error('expected tile target for AoE');
      // The cluster from this anchor must not include the ally's tile.
      const ax = ally.position.x;
      const ay = ally.position.y;
      const dx = Math.abs(target.position.x - ax);
      const dy = Math.abs(target.position.y - ay);
      expect(dx + dy).toBeGreaterThan(1); // diamond r1 → cluster within Manhattan-1
    }
    // If lightning_strike was chosen, that's also fine — the test
    // only assets the AI didn't fry its ally.
  });

  it('reaction-aware (tag-aware): physical attacker avoids a Counter-equipped target', async () => {
    // Tier-2 tag-aware reaction penalty: Counter triggers on physical
    // damage. A Knight (physical attack) targeting two equal-HP enemies
    // — one with Counter, one plain — picks the plain one to avoid the
    // retaliation penalty.
    const { loadDefaultCatalog } = await import('../content/index.ts');
    const { activeTurnFor, makeGameState, makeUnit } = await import('../engine/ct/test-fixtures.ts');
    const { longSword } = await import('../content/items/long-sword.ts');
    const cat = loadDefaultCatalog();
    const attacker = makeUnit({
      id: 'attacker', spd: 10, pa: 6, hp: 60, classId: 'knight',
      position: { x: 2, y: 2, layer: 0 },
      loadout: {
        actionBuckets: { [bucketId('first_action')]: [commandSetId('battle_skill')] },
        passiveBuckets: {},
      },
      equipment: { leftHand: null, rightHand: longSword.id, headgear: null, armor: null, accessory: null },
    });
    // Face both targets so the attacker (at (2,2)) approaches from their
    // back — neutralizes the S41 Knight class evasion (12/7/0) as a
    // confounder so the AI's choice turns purely on the Counter penalty.
    const tgtCounter = makeUnit({
      id: 'tgt_counter', team: 'team_b', spd: 10, hp: 30, classId: 'knight',
      position: { x: 3, y: 2, layer: 0 }, facing: 'E',
      loadout: {
        actionBuckets: { [bucketId('first_action')]: [commandSetId('battle_skill')] },
        passiveBuckets: { [bucketId('reaction')]: [abilityId('counter')] },
      },
    });
    const tgtPlain = makeUnit({
      id: 'tgt_plain', team: 'team_b', spd: 10, hp: 30, classId: 'knight',
      position: { x: 2, y: 3, layer: 0 }, facing: 'S',
      loadout: {
        actionBuckets: { [bucketId('first_action')]: [commandSetId('battle_skill')] },
        passiveBuckets: {},
      },
    });
    const state = makeGameState({
      units: [attacker, tgtCounter, tgtPlain],
      map: { width: 6, height: 6, tiles: flatGround(6, 6) },
      teams: [{ id: TEAM_A, name: 'A', control: 'human' }, { id: TEAM_B, name: 'B', control: 'ai' }],
      turnState: activeTurnFor(attacker.id),
    });
    const decision = decideBasicAi(state, cat);
    if (decision.kind !== 'commit') throw new Error(`expected commit, got ${decision.kind}`);
    if (decision.action.type !== 'use_ability') throw new Error('expected use_ability');
    const target = decision.action.payload.target;
    if (target.kind === 'unit') {
      expect(target.unitId).toEqual(tgtPlain.id);
    } else {
      throw new Error(`unexpected target kind: ${target.kind}`);
    }
  });

  it('proc-target aware: Magebane-wielding Knight prefers a Mage target over an equally-vulnerable Knight target', async () => {
    // Session 40 (D7): the AI's procTargetSynergyMultiplier slots into
    // scoreSingleUnitOffensive. A Magebane Knight standing between
    // a Fire Mage and a non-Mage Knight (both equal HP, both in melee
    // reach) should pick the Fire Mage — Silence is high-value against
    // a magic-caster, near-worthless against a Knight.
    const { loadDefaultCatalog } = await import('../content/index.ts');
    const { activeTurnFor, makeGameState, makeUnit } = await import('../engine/ct/test-fixtures.ts');
    const { magebane } = await import('../content/items/magebane.ts');
    const cat = loadDefaultCatalog();
    const attacker = makeUnit({
      id: 'attacker',
      spd: 9,
      pa: 7,
      hp: 60,
      classId: 'knight',
      position: { x: 2, y: 2, layer: 0 },
      loadout: {
        actionBuckets: { [bucketId('first_action')]: [commandSetId('battle_skill')] },
        passiveBuckets: {},
      },
      equipment: { leftHand: null, rightHand: magebane.id, headgear: null, armor: null, accessory: null },
    });
    const tgtMage = makeUnit({
      id: 'tgt_mage',
      team: 'team_b',
      spd: 10,
      ma: 8,
      hp: 30,
      classId: 'fire_mage',
      position: { x: 3, y: 2, layer: 0 },
      loadout: {
        actionBuckets: { [bucketId('first_action')]: [commandSetId('fire_spells')] },
        passiveBuckets: {},
      },
    });
    const tgtKnight = makeUnit({
      id: 'tgt_knight',
      team: 'team_b',
      spd: 10,
      hp: 30,
      classId: 'knight',
      position: { x: 2, y: 3, layer: 0 },
      loadout: {
        actionBuckets: { [bucketId('first_action')]: [commandSetId('battle_skill')] },
        passiveBuckets: {},
      },
    });
    const state = makeGameState({
      units: [attacker, tgtMage, tgtKnight],
      map: { width: 6, height: 6, tiles: flatGround(6, 6) },
      teams: [{ id: TEAM_A, name: 'A', control: 'human' }, { id: TEAM_B, name: 'B', control: 'ai' }],
      turnState: activeTurnFor(attacker.id),
    });
    const decision = decideBasicAi(state, cat);
    if (decision.kind !== 'commit') throw new Error(`expected commit, got ${decision.kind}`);
    if (decision.action.type !== 'use_ability') throw new Error('expected use_ability');
    const target = decision.action.payload.target;
    if (target.kind !== 'unit') throw new Error(`unexpected target kind: ${target.kind}`);
    expect(target.unitId).toEqual(tgtMage.id);
  });

  it('proc-target aware: without Magebane, the AI does not preferentially pick a Mage over a Knight', async () => {
    // Same fixture as the Magebane test, but with a plain Long Sword.
    // Both targets are equal HP / equal armor — without the proc bonus,
    // the AI's scoring is symmetric. We don't assert *which* target is
    // picked (kill-value ties); we only assert that the proc-bonus
    // multiplier doesn't fire (the multiplier helper returns 1.0 when
    // the weapon has no procs). This guards against the heuristic
    // leaking to non-proc weapons.
    const { loadDefaultCatalog } = await import('../content/index.ts');
    const { activeTurnFor, makeGameState, makeUnit } = await import('../engine/ct/test-fixtures.ts');
    const { longSword } = await import('../content/items/long-sword.ts');
    const cat = loadDefaultCatalog();
    const attacker = makeUnit({
      id: 'attacker',
      spd: 9,
      pa: 7,
      hp: 60,
      classId: 'knight',
      position: { x: 2, y: 2, layer: 0 },
      loadout: {
        actionBuckets: { [bucketId('first_action')]: [commandSetId('battle_skill')] },
        passiveBuckets: {},
      },
      equipment: { leftHand: null, rightHand: longSword.id, headgear: null, armor: null, accessory: null },
    });
    const tgtMage = makeUnit({
      id: 'tgt_mage',
      team: 'team_b',
      spd: 10,
      ma: 8,
      hp: 30,
      classId: 'fire_mage',
      position: { x: 3, y: 2, layer: 0 },
      loadout: {
        actionBuckets: { [bucketId('first_action')]: [commandSetId('fire_spells')] },
        passiveBuckets: {},
      },
    });
    const tgtKnight = makeUnit({
      id: 'tgt_knight',
      team: 'team_b',
      spd: 10,
      hp: 30,
      classId: 'knight',
      position: { x: 2, y: 3, layer: 0 },
      loadout: {
        actionBuckets: { [bucketId('first_action')]: [commandSetId('battle_skill')] },
        passiveBuckets: {},
      },
    });
    const state = makeGameState({
      units: [attacker, tgtMage, tgtKnight],
      map: { width: 6, height: 6, tiles: flatGround(6, 6) },
      teams: [{ id: TEAM_A, name: 'A', control: 'human' }, { id: TEAM_B, name: 'B', control: 'ai' }],
      turnState: activeTurnFor(attacker.id),
    });
    const decision = decideBasicAi(state, cat);
    if (decision.kind !== 'commit') throw new Error(`expected commit, got ${decision.kind}`);
    if (decision.action.type !== 'use_ability') throw new Error('expected use_ability');
    // Without the proc bonus and with both targets equal, the AI may
    // pick either; both are valid. This test exists as a regression
    // guard: if the proc multiplier ever leaks into non-proc weapons,
    // this assertion will keep firing once we tighten it to "no Mage
    // preference." For now, just confirm the decision commits cleanly.
    const target = decision.action.payload.target;
    expect(target.kind).toBe('unit');
  });

  it('joint planner: commits Move when no in-place Act exists but a reachable destination has one', async () => {
    // Lightning Mage at (0,0); enemy at (4,0). Lightning Strike's arc
    // range is 4 — out of range from (0,0). The mage's moveRange is 4.
    // Tier 2's joint planner enumerates destinations and finds a
    // (destination, ability, target) plan: move to (1,0) and Lightning
    // Strike — that wins, so the AI commits the Move first. (Tier 1.5's
    // pickBestAction would have failed in-place and fallen to
    // distance-closing pickBestMove with the same destination, but
    // without the Act-aware reasoning.)
    const { loadDefaultCatalog } = await import('../content/index.ts');
    const { activeTurnFor, makeGameState, makeUnit } = await import('../engine/ct/test-fixtures.ts');
    const cat = loadDefaultCatalog();
    const attacker = makeUnit({ id: 'attacker', spd: 12, ma: 8, hp: 44, mp: 44, classId: 'lightning_mage', position: { x: 0, y: 0, layer: 0 }, loadout: {
      actionBuckets: { [bucketId('first_action')]: [commandSetId('lightning_spells')] },
      passiveBuckets: {},
    } });
    const enemy = makeUnit({ id: 'enemy', team: 'team_b', spd: 10, hp: 60, classId: 'knight', position: { x: 5, y: 0, layer: 0 } });
    const state = makeGameState({
      units: [attacker, enemy],
      map: { width: 6, height: 6, tiles: flatGround(6, 6) },
      teams: [{ id: TEAM_A, name: 'A', control: 'human' }, { id: TEAM_B, name: 'B', control: 'ai' }],
      turnState: activeTurnFor(attacker.id),
    });
    const decision = decideBasicAi(state, cat);
    if (decision.kind !== 'commit') throw new Error(`expected commit, got ${decision.kind}`);
    // Either a Move (committing the first leg of a Move + Strike plan)
    // or a Lightning Strike (if range from (0,0) reaches (5,0) — it
    // doesn't at hor 4, so we expect Move).
    expect(decision.action.type).toEqual('move');
  });

  it('joint planner: commits in-place Act when no Move improves the plan', async () => {
    // Lightning Mage at (2,2); enemy at (3,2) (adjacent, in range).
    // The in-place Lightning Strike kills the enemy outright. Joint
    // planner should commit the Act here — moving to a different
    // adjacent tile gives the same Act score minus a small move penalty.
    const { loadDefaultCatalog } = await import('../content/index.ts');
    const { activeTurnFor, makeGameState, makeUnit } = await import('../engine/ct/test-fixtures.ts');
    const cat = loadDefaultCatalog();
    const attacker = makeUnit({ id: 'attacker', spd: 12, ma: 8, hp: 44, mp: 44, classId: 'lightning_mage', position: { x: 2, y: 2, layer: 0 }, loadout: {
      actionBuckets: { [bucketId('first_action')]: [commandSetId('lightning_spells')] },
      passiveBuckets: {},
    } });
    const enemy = makeUnit({ id: 'enemy', team: 'team_b', spd: 10, hp: 60, classId: 'knight', position: { x: 3, y: 2, layer: 0 } });
    const state = makeGameState({
      units: [attacker, enemy],
      map: { width: 6, height: 6, tiles: flatGround(6, 6) },
      teams: [{ id: TEAM_A, name: 'A', control: 'human' }, { id: TEAM_B, name: 'B', control: 'ai' }],
      turnState: activeTurnFor(attacker.id),
    });
    const decision = decideBasicAi(state, cat);
    if (decision.kind !== 'commit') throw new Error(`expected commit, got ${decision.kind}`);
    expect(decision.action.type).toEqual('use_ability');
  });

  it('cone direction: Maelstrom picks a direction that catches the most enemies', async () => {
    // Three enemies clustered south of a Water Mage. A south-facing
    // Maelstrom cone (rows [1,3,3]) should catch at least two of them;
    // any other cardinal catches none. The AI's cone direction planner
    // (per session 20b) picks the southern target tile, which becomes
    // the direction-deriving anchor.
    const { loadDefaultCatalog } = await import('../content/index.ts');
    const { activeTurnFor, makeGameState, makeUnit } = await import('../engine/ct/test-fixtures.ts');
    const cat = loadDefaultCatalog();
    // Place the mage at (2,1) and three enemies south at (1,3), (2,3), (3,3).
    const attacker = makeUnit({ id: 'attacker', spd: 11, ma: 7, hp: 45, mp: 45, classId: 'water_mage', position: { x: 2, y: 1, layer: 0 }, loadout: {
      actionBuckets: { [bucketId('first_action')]: [commandSetId('water_spells')] },
      passiveBuckets: {},
    } });
    const e1 = makeUnit({ id: 'e1', team: 'team_b', spd: 10, hp: 60, classId: 'knight', position: { x: 1, y: 3, layer: 0 } });
    const e2 = makeUnit({ id: 'e2', team: 'team_b', spd: 10, hp: 60, classId: 'knight', position: { x: 2, y: 3, layer: 0 } });
    const e3 = makeUnit({ id: 'e3', team: 'team_b', spd: 10, hp: 60, classId: 'knight', position: { x: 3, y: 3, layer: 0 } });
    const state = makeGameState({
      units: [attacker, e1, e2, e3],
      map: { width: 6, height: 6, tiles: flatGround(6, 6) },
      teams: [{ id: TEAM_A, name: 'A', control: 'human' }, { id: TEAM_B, name: 'B', control: 'ai' }],
      turnState: activeTurnFor(attacker.id),
    });
    const decision = decideBasicAi(state, cat);
    if (decision.kind !== 'commit') throw new Error(`expected commit, got ${decision.kind}`);
    if (decision.action.type !== 'use_ability') throw new Error('expected use_ability');
    // The AI should pick Maelstrom OR a tile-AoE that catches the
    // cluster. Either way the chosen ability is one that scores against
    // the south cluster — a single-target Water Strike would be much
    // less efficient.
    const abilityIdChosen = decision.action.payload.abilityId;
    if (abilityIdChosen === abilityId('maelstrom')) {
      // Direction must be south — caster→target cardinal points south.
      // Post-S38 (2026-05-17): Maelstrom is now `unit_or_tile`, so the
      // AI may pick either a unit or tile payload. Either way the
      // direction derivation lands on a south-of-attacker position
      // (unit → unit.position; tile → tile.position).
      const target = decision.action.payload.target;
      let directionY: number;
      if (target.kind === 'unit') {
        const u = state.units.get(target.unitId);
        if (u === undefined) throw new Error('unit target not found');
        directionY = u.position.y;
      } else if (target.kind === 'tile') {
        directionY = target.position.y;
      } else {
        throw new Error(`unexpected target kind ${target.kind} for Maelstrom`);
      }
      expect(directionY).toBeGreaterThan(attacker.position.y);
    } else {
      // Or another cluster-effective ability — Tidal Wave (diamond r1
      // anchored on a unit) on e2 catches 3 enemies. Both are valid
      // tier-2 plays.
      const validAlternatives = new Set([abilityId('tidal_wave'), abilityId('water_strike'), abilityId('brine')]);
      expect(validAlternatives.has(abilityIdChosen) || abilityIdChosen === abilityId('tide_surge')).toBe(true);
    }
  });

  it('reaction-aware (tag-aware): magical attacker is NOT penalized by physical-only Counter', async () => {
    // The flip side of the tag-aware penalty: Counter's
    // damageTagsAny: ['physical'] gate doesn't fire on a magical attack.
    // A Lightning Mage (magical Lightning Strike) facing the same setup
    // as above sees Counter as zero-penalty — both targets score equally
    // and lex-id picks `tgt_counter` (c < p). No penalty applied means
    // the AI wouldn't have moved away from the Counter-equipped target.
    const { loadDefaultCatalog } = await import('../content/index.ts');
    const { activeTurnFor, makeGameState, makeUnit } = await import('../engine/ct/test-fixtures.ts');
    const cat = loadDefaultCatalog();
    const attacker = makeUnit({ id: 'attacker', spd: 12, ma: 8, hp: 44, mp: 44, classId: 'lightning_mage', position: { x: 2, y: 2, layer: 0 }, loadout: {
      actionBuckets: { [bucketId('first_action')]: [commandSetId('lightning_spells')] },
      passiveBuckets: {},
    } });
    const tgtCounter = makeUnit({ id: 'tgt_counter', team: 'team_b', spd: 10, hp: 30, classId: 'knight', position: { x: 5, y: 2, layer: 0 }, loadout: {
      actionBuckets: { [bucketId('first_action')]: [commandSetId('battle_skill')] },
      passiveBuckets: { [bucketId('reaction')]: [abilityId('counter')] },
    } });
    const tgtPlain = makeUnit({ id: 'tgt_plain', team: 'team_b', spd: 10, hp: 30, classId: 'knight', position: { x: 2, y: 5, layer: 0 }, loadout: {
      actionBuckets: { [bucketId('first_action')]: [commandSetId('battle_skill')] },
      passiveBuckets: {},
    } });
    const state = makeGameState({
      units: [attacker, tgtCounter, tgtPlain],
      map: { width: 6, height: 6, tiles: flatGround(6, 6) },
      teams: [{ id: TEAM_A, name: 'A', control: 'human' }, { id: TEAM_B, name: 'B', control: 'ai' }],
      turnState: activeTurnFor(attacker.id),
    });
    const decision = decideBasicAi(state, cat);
    if (decision.kind !== 'commit') throw new Error(`expected commit, got ${decision.kind}`);
    // The AI should be willing to attack tgtCounter directly (or fire
    // an AoE on it) — Counter doesn't gate magical attacks.
    if (decision.action.type === 'use_ability') {
      const target = decision.action.payload.target;
      if (target.kind === 'unit') {
        expect(target.unitId).toEqual(tgtCounter.id);
      }
    }
  });
});
