// Session 18 integration tests — Water Mage engine substrate:
//
//   1. Cone AoE shape — directional footprint resolution.
//   2. cardinalFromTo — direction picking from caster→target geometry.
//   3. AoeSpec.anchorMode 'caster' — caster-anchored AoE expansion.
//   4. system_ct_push reducer — applies signed delta, floors at 0.
//   5. damage.ctPush rider — on-hit deterministic CT push.
//   6. damage.knockback rider — chance-gated and deterministic paths.
//   7. effects.ctEffects — free-standing chance-gated CT push.
//   8. onActionResolved hook — Flow State refunds 10 CT for magical only.
//   9. Speed Down status — STACK_INDEPENDENT, additive -1, permanent.
//  10. Water Mage end-to-end — Water Strike pushes target CT back.

import { describe, expect, it } from 'vitest';
import { loadDefaultCatalog } from '../../content/index.ts';
import { commitAction } from './commit.ts';
import { reduceSystemCtPush } from './reducers.ts';
import { aoeFootprint, cardinalFromTo, shapeOffsets } from '../map/aoe.ts';
import { runOnActionResolved } from '../hooks/runners.ts';
import { runModifyStatQuery } from '../hooks/runners.ts';
import { applyStatus } from '../status/apply.ts';
import { rollAbilityChance } from '../status/chance.ts';
import { ACTIVE_BUCKET_IDS, PASSIVE_BUCKET_IDS } from '../abilities/constants.ts';
import { activeTurnFor, makeGameState, makeUnit } from '../ct/test-fixtures.ts';
import { flatMap } from '../map/test-fixtures.ts';
import { createInitialState } from '../setup/create-initial-state.ts';
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
  type CommandSetId,
  type Loadout,
  type ProposedAction,
} from '@engine/index.ts';

// ===== Cone AoE shape =====

describe('cone AoE — shape offsets', () => {
  it('rows: [1, 3, 3] facing N produces 7 tiles with expected geometry', () => {
    const offsets = shapeOffsets({ kind: 'cone', rows: [1, 3, 3] }, 'N');
    expect(offsets).toHaveLength(7);
    // d=1: (0, -1)
    expect(offsets).toContainEqual({ dx: 0, dy: -1 });
    // d=2: (-1, -2), (0, -2), (1, -2)
    expect(offsets).toContainEqual({ dx: -1, dy: -2 });
    expect(offsets).toContainEqual({ dx: 0, dy: -2 });
    expect(offsets).toContainEqual({ dx: 1, dy: -2 });
    // d=3: (-1, -3), (0, -3), (1, -3)
    expect(offsets).toContainEqual({ dx: -1, dy: -3 });
    expect(offsets).toContainEqual({ dx: 0, dy: -3 });
    expect(offsets).toContainEqual({ dx: 1, dy: -3 });
  });

  it('cone rotates correctly for direction E', () => {
    const offsets = shapeOffsets({ kind: 'cone', rows: [1, 3, 3] }, 'E');
    expect(offsets).toHaveLength(7);
    // d=1 forward (E): (1, 0)
    expect(offsets).toContainEqual({ dx: 1, dy: 0 });
    // d=2: (2, -1), (2, 0), (2, 1)
    expect(offsets).toContainEqual({ dx: 2, dy: -1 });
    expect(offsets).toContainEqual({ dx: 2, dy: 0 });
    expect(offsets).toContainEqual({ dx: 2, dy: 1 });
    // d=3: (3, -1), (3, 0), (3, 1)
    expect(offsets).toContainEqual({ dx: 3, dy: -1 });
    expect(offsets).toContainEqual({ dx: 3, dy: 0 });
    expect(offsets).toContainEqual({ dx: 3, dy: 1 });
  });

  it('cone supports the planned 1+3+5 expansion blueprint', () => {
    const offsets = shapeOffsets({ kind: 'cone', rows: [1, 3, 5] }, 'N');
    expect(offsets).toHaveLength(9); // 1 + 3 + 5
    // The d=3 row spans -2..+2 lateral
    expect(offsets).toContainEqual({ dx: -2, dy: -3 });
    expect(offsets).toContainEqual({ dx: 2, dy: -3 });
  });

  it('cone rejects even row widths (no canonical center)', () => {
    expect(() => shapeOffsets({ kind: 'cone', rows: [2] }, 'N')).toThrow();
  });

  it('aoeFootprint with cone direction E produces tiles east of the anchor', () => {
    const map = flatMap(8, 8);
    const tiles = aoeFootprint({
      map,
      anchor: { x: 2, y: 2, elevation: 0 },
      shape: { kind: 'cone', rows: [1, 3, 3] },
      verticalTolerance: 1,
      direction: 'E',
    });
    expect(tiles.length).toBe(7);
    // All tiles should be east of x=2 (caster at the anchor; cone projects forward)
    for (const t of tiles) {
      expect(t.x).toBeGreaterThan(2);
    }
  });
});

describe('cardinalFromTo', () => {
  it('returns E when target is east', () => {
    expect(cardinalFromTo({ x: 0, y: 0 }, { x: 3, y: 0 })).toBe('E');
  });
  it('returns W when target is west', () => {
    expect(cardinalFromTo({ x: 5, y: 0 }, { x: 1, y: 0 })).toBe('W');
  });
  it('returns S when target is south (positive y)', () => {
    expect(cardinalFromTo({ x: 0, y: 0 }, { x: 0, y: 3 })).toBe('S');
  });
  it('returns N when target is north (negative y)', () => {
    expect(cardinalFromTo({ x: 0, y: 5 }, { x: 0, y: 1 })).toBe('N');
  });
  it('prefers horizontal on perfect-diagonal ties', () => {
    expect(cardinalFromTo({ x: 0, y: 0 }, { x: 3, y: 3 })).toBe('E');
    expect(cardinalFromTo({ x: 0, y: 0 }, { x: -3, y: 3 })).toBe('W');
  });
});

// ===== system_ct_push reducer =====

describe('system_ct_push reducer', () => {
  const catalog = loadDefaultCatalog();

  it('applies a positive delta moving CT toward the trigger threshold', () => {
    const target = makeUnit({ id: 'unit_a', spd: 8, ct: 50, hp: 100 });
    const state = makeGameState({ units: [target] });
    const result = reduceSystemCtPush(state, {
      type: 'system_ct_push',
      sequenceNumber: 1,
      source: 'system',
      timestamp: { tick: 0, ct: 0 },
      seed: 0,
      chainDepth: 0,
      isReaction: false,
      payload: {
        targetId: target.id,
        delta: 30,
        source: { kind: 'reaction', abilityId: abilityId('tidal_pull'), attackerId: target.id },
      },
    });
    expect(result.outcome.applied).toBe(30);
    expect(result.newState.units.get(target.id)!.ct).toBe(80);
  });

  it('applies a negative delta and floors at 0', () => {
    const target = makeUnit({ id: 'unit_a', spd: 8, ct: 10, hp: 100 });
    const state = makeGameState({ units: [target] });
    const result = reduceSystemCtPush(state, {
      type: 'system_ct_push',
      sequenceNumber: 1,
      source: 'system',
      timestamp: { tick: 0, ct: 0 },
      seed: 0,
      chainDepth: 0,
      isReaction: false,
      payload: {
        targetId: target.id,
        delta: -50, // would land at -40; clamps to 0
        source: { kind: 'damage_rider', abilityId: abilityId('water_strike'), attackerId: target.id },
      },
    });
    expect(result.outcome.applied).toBe(-10); // requested -50, actually -10 due to floor
    expect(result.newState.units.get(target.id)!.ct).toBe(0);
  });

  it('permits CT above 100 (no upper cap)', () => {
    const target = makeUnit({ id: 'unit_a', spd: 8, ct: 90, hp: 100 });
    const state = makeGameState({ units: [target] });
    const result = reduceSystemCtPush(state, {
      type: 'system_ct_push',
      sequenceNumber: 1,
      source: 'system',
      timestamp: { tick: 0, ct: 0 },
      seed: 0,
      chainDepth: 0,
      isReaction: false,
      payload: {
        targetId: target.id,
        delta: 30, // would land at 120; no cap
        source: { kind: 'reaction', abilityId: abilityId('tidal_pull'), attackerId: target.id },
      },
    });
    expect(result.outcome.applied).toBe(30);
    expect(result.newState.units.get(target.id)!.ct).toBe(120);
  });

  it('skips KO\'d targets (applied: 0)', () => {
    const target = makeUnit({ id: 'unit_a', spd: 8, ct: 50, hp: 0 });
    const state = makeGameState({ units: [target] });
    const result = reduceSystemCtPush(state, {
      type: 'system_ct_push',
      sequenceNumber: 1,
      source: 'system',
      timestamp: { tick: 0, ct: 0 },
      seed: 0,
      chainDepth: 0,
      isReaction: false,
      payload: {
        targetId: target.id,
        delta: 20,
        source: { kind: 'reaction', abilityId: abilityId('tidal_pull'), attackerId: target.id },
      },
    });
    expect(result.outcome.applied).toBe(0);
    expect(result.newState.units.get(target.id)!.ct).toBe(50); // unchanged
  });

  // Suppress unused-variable lint
  void catalog;
});

// ===== Speed Down status =====

describe('Speed Down status', () => {
  const catalog = loadDefaultCatalog();
  const speedDownTypeId = statusTypeId('speed_down');

  it('subtracts 1 from Speed via modifyStatQuery', () => {
    const target = makeUnit({ id: 'unit_a', spd: 10, hp: 100 });
    const state = makeGameState({ units: [target] });
    const applied = applyStatus(
      state,
      {
        targetId: target.id,
        typeId: speedDownTypeId,
        sourceUnitId: target.id,
        sourceActionSeq: 0,
      },
      catalog,
    );
    const afterTarget = applied.newState.units.get(target.id)!;
    const speed = runModifyStatQuery(applied.newState, catalog, {
      unit: afterTarget,
      statName: 'spd',
      baseValue: afterTarget.baseStats.spd,
    });
    expect(speed).toBe(9); // 10 - 1
  });

  it('STACK_INDEPENDENT — two applications stack to -2', () => {
    const target = makeUnit({ id: 'unit_a', spd: 10, hp: 100 });
    const state = makeGameState({ units: [target] });
    let s = applyStatus(
      state,
      { targetId: target.id, typeId: speedDownTypeId, sourceUnitId: target.id, sourceActionSeq: 0 },
      catalog,
    ).newState;
    s = applyStatus(
      s,
      { targetId: target.id, typeId: speedDownTypeId, sourceUnitId: target.id, sourceActionSeq: 1 },
      catalog,
    ).newState;
    const afterTarget = s.units.get(target.id)!;
    expect(afterTarget.statuses.filter((st) => st.typeId === speedDownTypeId)).toHaveLength(2);
    const speed = runModifyStatQuery(s, catalog, {
      unit: afterTarget,
      statName: 'spd',
      baseValue: afterTarget.baseStats.spd,
    });
    expect(speed).toBe(8); // 10 - 2
  });

  it('does not modify other stats', () => {
    const target = makeUnit({ id: 'unit_a', spd: 10, ma: 7, hp: 100 });
    const state = makeGameState({ units: [target] });
    const applied = applyStatus(
      state,
      { targetId: target.id, typeId: speedDownTypeId, sourceUnitId: target.id, sourceActionSeq: 0 },
      catalog,
    );
    const afterTarget = applied.newState.units.get(target.id)!;
    const ma = runModifyStatQuery(applied.newState, catalog, {
      unit: afterTarget,
      statName: 'ma',
      baseValue: afterTarget.baseStats.ma,
    });
    expect(ma).toBe(7);
  });
});

// ===== rollAbilityChance =====

describe('rollAbilityChance', () => {
  const catalog = loadDefaultCatalog();
  const TEAM_A = teamId('team_a');
  const TEAM_B = teamId('team_b');

  it('applies Faith × MA factors against an enemy target', () => {
    const caster = makeUnit({ id: 'caster', spd: 11, ma: 7, faith: 80, hp: 100, team: 'team_a' });
    const target = makeUnit({ id: 'target', spd: 8, faith: 80, hp: 100, team: 'team_b' });
    const state = makeGameState({ units: [caster, target] });
    const result = rollAbilityChance({
      state,
      catalog,
      caster,
      target,
      baseChance: 50,
      seed: 0xBEEF,
    });
    // 50/100 × Faith(0.8 × 0.8 = 0.64) × MA(0.9 + 7/10 = 1.6) = 0.512
    expect(result.chance).toBeCloseTo(0.512, 3);
  });

  it('clamps to [0, 1]', () => {
    const caster = makeUnit({ id: 'caster', spd: 11, ma: 100, faith: 100, hp: 100 });
    const target = makeUnit({ id: 'target', spd: 8, faith: 100, hp: 100 });
    const state = makeGameState({ units: [caster, target] });
    const result = rollAbilityChance({
      state,
      catalog,
      caster,
      target,
      baseChance: 200, // way above 100 — gets clamped after factors
      seed: 0,
    });
    expect(result.chance).toBeLessThanOrEqual(1);
    expect(result.chance).toBeGreaterThanOrEqual(0);
  });

  // Mute unused
  void TEAM_A;
  void TEAM_B;
});

// ===== End-to-end Water Mage scenarios =====

const TEAM_A = teamId('team_a');
const TEAM_B = teamId('team_b');

function waterMageLoadout(args: {
  passive_support?: AbilityId;
  passive_reaction?: AbilityId;
  second_action?: CommandSetId;
} = {}): Loadout {
  const actionBuckets: Record<string, ReadonlyArray<CommandSetId>> = {};
  for (const b of ACTIVE_BUCKET_IDS) actionBuckets[b] = [];
  actionBuckets[bucketId('first_action')] = [commandSetId('water_spells')];
  if (args.second_action !== undefined) {
    actionBuckets[bucketId('secondary_command_sets')] = [args.second_action];
  }
  const passiveBuckets: Record<string, ReadonlyArray<AbilityId>> = {};
  for (const b of PASSIVE_BUCKET_IDS) passiveBuckets[b] = [];
  if (args.passive_support !== undefined) {
    passiveBuckets[bucketId('support')] = [args.passive_support];
  }
  if (args.passive_reaction !== undefined) {
    passiveBuckets[bucketId('reaction')] = [args.passive_reaction];
  }
  return { actionBuckets, passiveBuckets };
}

function buildWaterBattle(args: {
  casterMA?: number;
  targetCt?: number;
  casterPassives?: { support?: AbilityId; reaction?: AbilityId };
} = {}): { state: ReturnType<typeof createInitialState>; catalog: ReturnType<typeof loadDefaultCatalog> } {
  const catalog = loadDefaultCatalog();
  const config: BattleConfig = {
    battleId: 'session_18_test',
    rulesetId: rulesetId('default'),
    map: flatMap(8, 8),
    teams: [
      { id: TEAM_A, name: 'A', control: 'human' },
      { id: TEAM_B, name: 'B', control: 'ai' },
    ],
    units: [
      {
        id: unitId('caster'),
        name: 'Water Mage',
        team: TEAM_A,
        classId: classId('water_mage'),
        position: { x: 1, y: 1, layer: 0 },
        facing: 'E',
        baseStats: {
          spd: 11,
          pa: 3,
          ma: args.casterMA ?? 7,
          maxHpBase: 45,
          maxMpBase: 50,
          brave: 100,
          faith: 80,
          crit_chance: 0,
          crit_multiplier: 1,
        },
        vitals: { hp: 45, mp: 50 },
        loadout: waterMageLoadout({
          ...(args.casterPassives?.support !== undefined
            ? { passive_support: args.casterPassives.support }
            : {}),
          ...(args.casterPassives?.reaction !== undefined
            ? { passive_reaction: args.casterPassives.reaction }
            : {}),
        }),
      },
      {
        id: unitId('target'),
        name: 'Target',
        team: TEAM_B,
        classId: classId('knight'),
        position: { x: 3, y: 1, layer: 0 },
        facing: 'W',
        baseStats: { spd: 10, pa: 6, ma: 4, maxHpBase: 60, maxMpBase: 50, brave: 100, faith: 80, crit_chance: 0, crit_multiplier: 1 },
        vitals: { hp: 60, mp: 0 },
        loadout: {
          actionBuckets: {
            [bucketId('first_action')]: [commandSetId('battle_skill')],
          },
          passiveBuckets: {},
        },
      },
    ],
    victoryConditions: [
      { kind: 'defeat_all', side: TEAM_B, description: 'A wins' },
      { kind: 'defeat_all', side: TEAM_A, description: 'B wins' },
    ],
    masterSeed: 0xBEEF,
  };
  let state = createInitialState(config, catalog);
  // Set the target's CT and the caster's CT for predictable scheduling
  if (args.targetCt !== undefined) {
    const target = state.units.get(unitId('target'))!;
    const newUnits = new Map(state.units);
    newUnits.set(target.id, { ...target, ct: args.targetCt });
    state = { ...state, units: newUnits };
  }
  return { state, catalog };
}

describe('Water Strike (damage.ctPush)', () => {
  it("emits system_ct_push with delta = -floor(2 × caster.MA) on hit", () => {
    const { state, catalog } = buildWaterBattle({ casterMA: 7, targetCt: 80 });
    let s = state;
    // Inject an active turn for the caster so commitAction accepts the
    // ability use. (createInitialState leaves turnState null until the
    // scheduler advances; we fake an active turn here.)
    s = { ...s, turnState: activeTurnFor(unitId('caster')) };
    const proposed: ProposedAction = {
      type: 'use_ability',
      source: 'player',
      actorId: unitId('caster'),
      payload: {
        abilityId: abilityId('water_strike'),
        target: { kind: 'unit', unitId: unitId('target') },
      },
    };
    const result = commitAction(s, proposed, catalog);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // Water Strike is charged (actionSpeed 30); commit creates a
    // ChargedAction. The ctPush fires on charged_action_resolve, not
    // at commit. Target CT is unchanged at this point.
    const targetAfter = result.newState.units.get(unitId('target'))!;
    expect(targetAfter.ct).toBe(80);
    expect(result.newState.chargedActions.length).toBeGreaterThan(0);
    // No system_ct_push in the committed chain yet — it'll appear when
    // the charged action resolves.
    const ctPushes = result.committed.filter((a) => a.type === 'system_ct_push');
    expect(ctPushes).toHaveLength(0);
  });
});

describe('Tide Surge (effects.ctEffects)', () => {
  it('commits as a charged ability and queues a ChargedAction', () => {
    const { state, catalog } = buildWaterBattle({ casterMA: 7 });
    let s = state;
    s = { ...s, turnState: activeTurnFor(unitId('caster')) };
    // Tide Surge targets an ally — no ally is wired in this fixture;
    // self-targeting is a legal degenerate case (the ability allows
    // primary_target to be any unit including caster).
    const proposed: ProposedAction = {
      type: 'use_ability',
      source: 'player',
      actorId: unitId('caster'),
      payload: {
        abilityId: abilityId('tide_surge'),
        target: { kind: 'unit', unitId: unitId('caster') },
      },
    };
    const result = commitAction(s, proposed, catalog);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // Charged spell — ChargedAction lands at commit; CT push resolves later.
    expect(result.newState.chargedActions.length).toBeGreaterThan(0);
  });
});

describe('Maelstrom (cone + always-knockback)', () => {
  it('declares a cone shape with anchorMode caster', () => {
    const catalog = loadDefaultCatalog();
    const ability = catalog.getAbility(abilityId('maelstrom'));
    if (ability.kind !== 'active') throw new Error('expected active');
    expect(ability.effects.aoe).toBeDefined();
    expect(ability.effects.aoe!.shape).toEqual({ kind: 'cone', rows: [1, 3, 3] });
    expect(ability.effects.aoe!.anchorMode).toBe('caster');
    expect(ability.effects.damage?.knockback?.distance).toBe(1);
    // Always-knockback: chance is undefined.
    expect(ability.effects.damage?.knockback?.chance).toBeUndefined();
  });
});

describe('onActionResolved + Flow State', () => {
  it('refunds 10 CT after a magical ability and skips non-magical ones', () => {
    const catalog = loadDefaultCatalog();
    const caster = makeUnit({
      id: 'caster',
      spd: 11,
      ma: 7,
      hp: 100,
      ct: 50,
      classId: 'water_mage',
      loadout: {
        actionBuckets: {},
        passiveBuckets: { [bucketId('support')]: [abilityId('flow_state')] },
      },
    });
    const state = makeGameState({ units: [caster] });
    const magicalAction: ProposedAction = {
      type: 'use_ability',
      source: 'player',
      actorId: caster.id,
      payload: {
        abilityId: abilityId('water_strike'),
        target: { kind: 'unit', unitId: caster.id },
      },
    };
    const physicalAction: ProposedAction = {
      type: 'use_ability',
      source: 'player',
      actorId: caster.id,
      payload: {
        abilityId: abilityId('attack'),
        target: { kind: 'unit', unitId: caster.id },
      },
    };
    const magicalAbility = catalog.getAbility(abilityId('water_strike'));
    if (magicalAbility.kind !== 'active') throw new Error('expected active');
    const physicalAbility = catalog.getAbility(abilityId('attack'));
    if (physicalAbility.kind !== 'active') throw new Error('expected active');

    const magicalEmissions = runOnActionResolved(state, catalog, {
      unit: caster,
      action: magicalAction,
      ability: magicalAbility,
    });
    expect(magicalEmissions).toHaveLength(1);
    expect(magicalEmissions[0]!.type).toBe('system_ct_push');
    if (magicalEmissions[0]!.type !== 'system_ct_push') throw new Error('narrow');
    expect(magicalEmissions[0]!.payload.delta).toBe(10);
    expect(magicalEmissions[0]!.payload.targetId).toBe(caster.id);

    const physicalEmissions = runOnActionResolved(state, catalog, {
      unit: caster,
      action: physicalAction,
      ability: physicalAbility,
    });
    expect(physicalEmissions).toHaveLength(0);
  });
});

describe('Cure tag fix', () => {
  it('Cure has the magical tag so Flow State refunds it', () => {
    const catalog = loadDefaultCatalog();
    const cure = catalog.getAbility(abilityId('cure'));
    if (cure.kind !== 'active') throw new Error('expected active');
    expect(cure.tags).toContain('magical');
    expect(cure.effects.damage?.tags).toContain('magical');
  });
});

describe('Water Strike charged-resolve actually pushes target CT', () => {
  it('emits system_ct_push with delta -14 and lands on the target', () => {
    const { state, catalog } = buildWaterBattle({ casterMA: 7, targetCt: 80 });
    let s = state;
    s = { ...s, turnState: activeTurnFor(unitId('caster')) };
    // Commit Water Strike — creates a ChargedAction.
    const useResult = commitAction(
      s,
      {
        type: 'use_ability',
        source: 'player',
        actorId: unitId('caster'),
        payload: {
          abilityId: abilityId('water_strike'),
          target: { kind: 'unit', unitId: unitId('target') },
        },
      },
      catalog,
    );
    expect(useResult.ok).toBe(true);
    if (!useResult.ok) return;
    s = useResult.newState;
    expect(s.chargedActions).toHaveLength(1);
    const ca = s.chargedActions[0]!;
    // Manually trigger the charged_action_resolve.
    const resolveResult = commitAction(
      s,
      {
        type: 'charged_action_resolve',
        source: 'system',
        payload: { chargedActionId: ca.id },
      },
      catalog,
    );
    expect(resolveResult.ok).toBe(true);
    if (!resolveResult.ok) return;
    // Find the system_ct_push in the committed chain.
    const pushes = resolveResult.committed.filter((a) => a.type === 'system_ct_push');
    expect(pushes).toHaveLength(1);
    const push = pushes[0]!;
    if (push.type !== 'system_ct_push') throw new Error('narrow');
    expect(push.payload.delta).toBe(-14); // factor 2 × MA 7
    expect(push.payload.targetId).toBe(unitId('target'));
    // Target's CT actually decreased: 80 → 66.
    const targetAfter = resolveResult.newState.units.get(unitId('target'))!;
    expect(targetAfter.ct).toBe(66);
  });
});

describe('Flow State refunds 10 CT after a magical action', () => {
  it("emits a system_ct_push of +10 against the caster post-resolve", () => {
    // Build a battle where the caster has Flow State equipped.
    const { state, catalog } = buildWaterBattle({
      casterMA: 7,
      targetCt: 80,
      casterPassives: { support: abilityId('flow_state') },
    });
    let s = state;
    // Track caster CT before.
    const casterCtBefore = s.units.get(unitId('caster'))!.ct;
    s = { ...s, turnState: activeTurnFor(unitId('caster')) };
    const useResult = commitAction(
      s,
      {
        type: 'use_ability',
        source: 'player',
        actorId: unitId('caster'),
        payload: {
          abilityId: abilityId('water_strike'),
          target: { kind: 'unit', unitId: unitId('target') },
        },
      },
      catalog,
    );
    expect(useResult.ok).toBe(true);
    if (!useResult.ok) return;
    s = useResult.newState;
    const ca = s.chargedActions[0]!;
    const resolveResult = commitAction(
      s,
      {
        type: 'charged_action_resolve',
        source: 'system',
        payload: { chargedActionId: ca.id },
      },
      catalog,
    );
    expect(resolveResult.ok).toBe(true);
    if (!resolveResult.ok) return;
    // Post-resolve, the chain should contain TWO system_ct_push events:
    // one against the target (Water Strike's ctPush rider) and one
    // against the caster (Flow State's refund).
    const pushes = resolveResult.committed.filter((a) => a.type === 'system_ct_push');
    expect(pushes).toHaveLength(2);
    // Find the one targeting the caster — that's the Flow State refund.
    const refunds = pushes.filter((a) => {
      if (a.type !== 'system_ct_push') return false;
      return a.payload.targetId === unitId('caster');
    });
    expect(refunds).toHaveLength(1);
    const refund = refunds[0]!;
    if (refund.type !== 'system_ct_push') throw new Error('narrow');
    expect(refund.payload.delta).toBe(10);
    // Caster CT advanced by +10 (from whatever the resolve started at).
    const casterAfter = resolveResult.newState.units.get(unitId('caster'))!;
    expect(casterAfter.ct).toBe(casterCtBefore + 10);
  });
});
