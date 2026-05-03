// Tests for commitAction — the action lifecycle wrapper.
// See docs/design/action-resolution.md ("Action lifecycle").

import {
  knightLoadout,
  makeAbilitiesCatalog,
  makeActive,
  makeKnight,
} from '../abilities/test-fixtures.ts';
import { activeTurnFor, makeGameState, makeUnit } from '../ct/test-fixtures.ts';
import { flatMap } from '../map/test-fixtures.ts';
import { makeStatusInstance, makeStatusType } from '../status/test-fixtures.ts';
import { statusHook } from '../status/index.ts';
import {
  abilityId,
  commandSetId,
  rulesetId,
  unitId,
  type ProposedAction,
} from '../types/index.ts';
import { commitAction } from './commit.ts';
import { createCatalog } from '../catalog/index.ts';
import { defaultTestRulesets, makeTestRuleset } from '../catalog/test-fixtures.ts';

function move(actorId: string, x: number, y: number): ProposedAction {
  return {
    type: 'move',
    source: 'player',
    actorId: unitId(actorId),
    payload: { destination: { x, y, layer: 0 } },
  };
}

function waitAction(actorId: string): ProposedAction {
  return {
    type: 'wait',
    source: 'player',
    actorId: unitId(actorId),
    payload: {},
  };
}

describe('commitAction — root validation', () => {
  it('returns ok=false on invalid root with the validation reason', () => {
    const cat = makeAbilitiesCatalog({});
    const u = makeUnit({ id: 'u1', spd: 10, loadout: knightLoadout() });
    // No turnState set → "no turn in progress" failure.
    const state = makeGameState({ units: [u], map: flatMap(3, 3) });
    const result = commitAction(state, move('u1', 1, 0), cat);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.stage).toBe('validation');
    expect(result.reason).toMatch(/no turn/i);
  });
});

describe('commitAction — successful commit', () => {
  it('appends the action with its outcome to the log', () => {
    const cat = makeAbilitiesCatalog({});
    const u = makeUnit({ id: 'u1', spd: 10, loadout: knightLoadout() });
    const state = makeGameState({
      units: [u],
      map: flatMap(3, 3),
      turnState: activeTurnFor(u.id),
    });
    const result = commitAction(state, move('u1', 1, 0), cat);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.newState.actionLog).toHaveLength(1);
    const logged = result.newState.actionLog[0]!;
    expect(logged.type).toBe('move');
    expect(logged.outcome).toBeDefined();
    expect(logged.sequenceNumber).toBe(0);
  });

  it('advances rng.nextSeq', () => {
    const cat = makeAbilitiesCatalog({});
    const u = makeUnit({ id: 'u1', spd: 10, loadout: knightLoadout() });
    const state = makeGameState({
      units: [u],
      map: flatMap(3, 3),
      turnState: activeTurnFor(u.id),
    });
    const result = commitAction(state, waitAction('u1'), cat);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.newState.rng.nextSeq).toBe(1);
  });

  it('seeds each action via deriveActionSeed(masterSeed, sequenceNumber)', () => {
    const cat = makeAbilitiesCatalog({});
    const u = makeUnit({ id: 'u1', spd: 10, loadout: knightLoadout() });
    const state = makeGameState({
      units: [u],
      map: flatMap(3, 3),
      turnState: activeTurnFor(u.id),
      masterSeed: 1234,
    });
    const r1 = commitAction(state, waitAction('u1'), cat);
    const r2 = commitAction(state, waitAction('u1'), cat);
    expect(r1.ok && r2.ok).toBe(true);
    if (!r1.ok || !r2.ok) return;
    // Same masterSeed + same sequenceNumber → same seed.
    expect(r1.committed[0]!.seed).toBe(r2.committed[0]!.seed);
  });
});

describe('commitAction — chain processing', () => {
  it('processes status_tick actions emitted by turn_start', () => {
    const poison = makeStatusType({ id: 'poison', stackingRule: 'REFRESH' });
    const cat = createCatalog({
      statusTypes: [poison],
      abilities: [],
      commandSets: [{ id: commandSetId('battle_skill'), name: 'Battle Skill', members: [], baseCost: 1 }],
      classes: [makeKnight()],
      items: [],
      rulesets: defaultTestRulesets,
    });
    const u = makeUnit({
      id: 'u1',
      spd: 10,
      loadout: knightLoadout(),
      statuses: [makeStatusInstance({ typeId: 'poison', remainingDuration: 3 })],
    });
    const state = makeGameState({ units: [u], map: flatMap(3, 3) });
    const result = commitAction(
      state,
      { type: 'turn_start', source: 'system', payload: { unitId: u.id } },
      cat,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // Two committed: turn_start root + status_tick child.
    expect(result.committed).toHaveLength(2);
    expect(result.committed[0]!.type).toBe('turn_start');
    expect(result.committed[1]!.type).toBe('status_tick');
    // Chain bookkeeping: the child knows its parent's seq and is depth 1.
    expect(result.committed[1]!.parentActionSeq).toBe(result.committed[0]!.sequenceNumber);
    expect(result.committed[1]!.chainDepth).toBe(1);
    // Status duration ticked from 3 to 2.
    expect(result.newState.units.get(u.id)!.statuses[0]!.remainingDuration).toBe(2);
  });
});

describe('commitAction — onActionAttempted hook', () => {
  it('blocks an action when a status hook returns blocked', () => {
    const stop = makeStatusType({
      id: 'stop',
      stackingRule: 'REFRESH',
      hooks: [
        statusHook('onActionAttempted', () => ({ kind: 'blocked' as const, reason: 'stopped' })),
      ],
    });
    const cat = createCatalog({
      statusTypes: [stop],
      abilities: [],
      commandSets: [{ id: commandSetId('battle_skill'), name: 'Battle Skill', members: [], baseCost: 1 }],
      classes: [makeKnight()],
      items: [],
      rulesets: defaultTestRulesets,
    });
    const u = makeUnit({
      id: 'u1',
      spd: 10,
      loadout: knightLoadout(),
      statuses: [makeStatusInstance({ typeId: 'stop' })],
    });
    const state = makeGameState({
      units: [u],
      map: flatMap(3, 3),
      turnState: activeTurnFor(u.id),
    });
    const result = commitAction(state, move('u1', 1, 0), cat);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.stage).toBe('hook_blocked');
    expect(result.reason).toBe('stopped');
  });

  it('replaces an action when a status hook returns replaced', () => {
    // A "Berserk-like" status that replaces every action with a Wait.
    const berserk = makeStatusType({
      id: 'berserk',
      stackingRule: 'REFRESH',
      hooks: [
        statusHook('onActionAttempted', (args) => ({
          kind: 'replaced' as const,
          with: {
            type: 'wait' as const,
            source: 'player' as const,
            actorId: args.unit.id,
            payload: {},
          },
        })),
      ],
    });
    const cat = createCatalog({
      statusTypes: [berserk],
      abilities: [],
      commandSets: [{ id: commandSetId('battle_skill'), name: 'Battle Skill', members: [], baseCost: 1 }],
      classes: [makeKnight()],
      items: [],
      rulesets: defaultTestRulesets,
    });
    const u = makeUnit({
      id: 'u1',
      spd: 10,
      loadout: knightLoadout(),
      statuses: [makeStatusInstance({ typeId: 'berserk' })],
    });
    const state = makeGameState({
      units: [u],
      map: flatMap(3, 3),
      turnState: activeTurnFor(u.id),
    });
    const result = commitAction(state, move('u1', 1, 0), cat);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.committed).toHaveLength(1);
    expect(result.committed[0]!.type).toBe('wait');
  });
});

describe('commitAction — turn cycle integration', () => {
  it('runs a turn_start → move → wait → turn_end cycle', () => {
    const cat = makeAbilitiesCatalog({});
    const u = makeUnit({
      id: 'u1',
      spd: 10,
      ct: 100,
      loadout: knightLoadout(),
      position: { x: 0, y: 0, layer: 0 },
    });
    let state = makeGameState({ units: [u], map: flatMap(5, 5) });

    // 1. Turn start.
    let r = commitAction(
      state,
      { type: 'turn_start', source: 'system', payload: { unitId: u.id } },
      cat,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    state = r.newState;
    expect(state.turnState).not.toBeNull();

    // 2. Move.
    r = commitAction(state, move('u1', 1, 0), cat);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    state = r.newState;
    expect(state.units.get(u.id)!.position).toEqual({ x: 1, y: 0, layer: 0 });

    // 3. Wait.
    r = commitAction(state, waitAction('u1'), cat);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    state = r.newState;

    // 4. Turn end.
    r = commitAction(
      state,
      { type: 'turn_end', source: 'system', payload: { unitId: u.id } },
      cat,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    state = r.newState;
    expect(state.turnState).toBeNull();
    // Wait fires the cheap CT cost; CT goes from 100 → 80.
    expect(state.units.get(u.id)!.ct).toBe(80);
  });
});

describe('commitAction — chain depth cap', () => {
  it('throws when the chain depth exceeds the rulesets cap', () => {
    // Build a custom ruleset with a tiny chain cap (0). Any generated
    // child action will exceed it, so reduceTurnStart's status_tick
    // emission trips the cap.
    const ruleset = makeTestRuleset();
    const tinyRuleset = {
      ...ruleset,
      chainTermination: { ...ruleset.chainTermination, chainDepthCap: 0 },
    };
    const poison = makeStatusType({ id: 'poison', stackingRule: 'REFRESH' });
    const cat = createCatalog({
      statusTypes: [poison],
      abilities: [],
      commandSets: [{ id: commandSetId('battle_skill'), name: 'Battle Skill', members: [], baseCost: 1 }],
      classes: [makeKnight()],
      items: [],
      rulesets: [tinyRuleset],
    });
    const u = makeUnit({
      id: 'u1',
      spd: 10,
      loadout: knightLoadout(),
      statuses: [makeStatusInstance({ typeId: 'poison', remainingDuration: 3 })],
    });
    const state = makeGameState({ units: [u], map: flatMap(3, 3) });
    expect(() =>
      commitAction(
        state,
        { type: 'turn_start', source: 'system', payload: { unitId: u.id } },
        cat,
      ),
    ).toThrow(/chain depth/);
  });
});

// Keep imports tidy.
void rulesetId;
void abilityId;
void makeActive;
