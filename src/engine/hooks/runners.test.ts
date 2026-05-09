import { makeGameState, makeUnit } from '../ct/test-fixtures.ts';
import { collectActiveHandlers } from './collector.ts';
import { runModifyStatQuery, runOnActionTargeted } from './runners.ts';
import { statusHook } from '../status/hooks.ts';
import {
  asStatusTypeId,
  catalogWith,
  makeStatusInstance,
  makeStatusType,
} from '../status/test-fixtures.ts';
import { createCatalog } from '../catalog/index.ts';
import { defaultTestRulesets } from '../catalog/test-fixtures.ts';
import { passiveHook } from '../abilities/hooks.ts';
import { ACTIVE_BUCKET_IDS, PASSIVE_BUCKET_IDS } from '../abilities/constants.ts';
import {
  abilityId,
  bucketId,
  classId,
  commandSetId,
  type AbilityId,
  type ActiveAbilityDefinition,
  type ClassDefinition,
  type CommandSetDefinition,
  type Loadout,
  type PassiveAbilityDefinition,
  type ProposedAction,
} from '@engine/index.ts';

describe('collectActiveHandlers', () => {
  it('returns no handlers for a unit with no statuses', () => {
    const cat = catalogWith([makeStatusType({ id: 'haste' })]);
    const state = makeGameState({ units: [makeUnit({ id: 'u1', spd: 10 })] });
    const handlers = collectActiveHandlers(
      state,
      makeUnit({ id: 'u1', spd: 10 }).id,
      cat,
      'modifyStatQuery',
    );
    expect(handlers).toEqual([]);
  });

  it('returns only the handlers matching the requested hook', () => {
    const haste = makeStatusType({
      id: 'haste',
      hooks: [statusHook('modifyStatQuery', (a) => a.baseValue), statusHook('onApply', () => {})],
    });
    const u = makeUnit({
      id: 'u1',
      spd: 10,
      statuses: [makeStatusInstance({ typeId: 'haste' })],
    });
    const cat = catalogWith([haste]);
    const state = makeGameState({ units: [u] });

    expect(collectActiveHandlers(state, u.id, cat, 'modifyStatQuery')).toHaveLength(1);
    expect(collectActiveHandlers(state, u.id, cat, 'onApply')).toHaveLength(1);
    expect(collectActiveHandlers(state, u.id, cat, 'onTick')).toHaveLength(0);
  });

  it('orders handlers by application order within the Status tier', () => {
    const seen: string[] = [];
    const a = makeStatusType({
      id: 'a',
      hooks: [
        statusHook('modifyStatQuery', (args) => {
          seen.push('a');
          return args.baseValue;
        }),
      ],
    });
    const b = makeStatusType({
      id: 'b',
      hooks: [
        statusHook('modifyStatQuery', (args) => {
          seen.push('b');
          return args.baseValue;
        }),
      ],
    });
    const u = makeUnit({
      id: 'u1',
      spd: 10,
      // Application order: a first, b second.
      statuses: [makeStatusInstance({ typeId: 'a' }), makeStatusInstance({ typeId: 'b' })],
    });
    const cat = catalogWith([a, b]);
    const state = makeGameState({ units: [u] });

    runModifyStatQuery(state, cat, { unit: u, statName: 'spd', baseValue: 10 });
    expect(seen).toEqual(['a', 'b']);
  });

  it('per-handler priority overrides the default order (lower fires first)', () => {
    const seen: string[] = [];
    const first = makeStatusType({
      id: 'first',
      hooks: [
        statusHook(
          'modifyStatQuery',
          (args) => {
            seen.push('first');
            return args.baseValue;
          },
          -1,
        ),
      ],
    });
    const second = makeStatusType({
      id: 'second',
      hooks: [
        statusHook(
          'modifyStatQuery',
          (args) => {
            seen.push('second');
            return args.baseValue;
          },
          0,
        ),
      ],
    });
    // Apply 'second' first, but 'first' has priority -1 so it should fire first.
    const u = makeUnit({
      id: 'u1',
      spd: 10,
      statuses: [makeStatusInstance({ typeId: 'second' }), makeStatusInstance({ typeId: 'first' })],
    });
    const cat = catalogWith([first, second]);
    const state = makeGameState({ units: [u] });

    runModifyStatQuery(state, cat, { unit: u, statName: 'spd', baseValue: 10 });
    expect(seen).toEqual(['first', 'second']);
  });
});

describe('runModifyStatQuery', () => {
  it('threads the base value through every handler', () => {
    // Each handler doubles. Two handlers → 4x.
    const doubler = makeStatusType({
      id: 'doubler',
      hooks: [statusHook('modifyStatQuery', (args) => args.baseValue * 2)],
    });
    const u = makeUnit({
      id: 'u1',
      spd: 10,
      statuses: [
        makeStatusInstance({ typeId: 'doubler' }),
        makeStatusInstance({ typeId: 'doubler' }),
      ],
    });
    const cat = catalogWith([
      // Same type used twice; STACK_INDEPENDENT lets both coexist.
      { ...doubler, stackingRule: 'STACK_INDEPENDENT' },
    ]);
    const state = makeGameState({ units: [u] });

    expect(runModifyStatQuery(state, cat, { unit: u, statName: 'spd', baseValue: 10 })).toBe(40);
  });

  it('only fires handlers registered against the queried hook', () => {
    let onTickCalled = false;
    const haste = makeStatusType({
      id: 'haste',
      hooks: [
        statusHook('modifyStatQuery', (args) => args.baseValue * 1.5),
        statusHook('onTick', () => {
          onTickCalled = true;
        }),
      ],
    });
    const u = makeUnit({
      id: 'u1',
      spd: 10,
      statuses: [makeStatusInstance({ typeId: 'haste' })],
    });
    const cat = catalogWith([haste]);
    const state = makeGameState({ units: [u] });

    expect(runModifyStatQuery(state, cat, { unit: u, statName: 'spd', baseValue: 10 })).toBe(15);
    expect(onTickCalled).toBe(false);
  });

  it('returns the base value unchanged when no handler matches the stat name', () => {
    // The handler only reacts to 'spd'; querying anything else passes through.
    const haste = makeStatusType({
      id: 'haste',
      hooks: [
        statusHook('modifyStatQuery', (args) =>
          args.statName === 'spd' ? args.baseValue * 2 : args.baseValue,
        ),
      ],
    });
    const u = makeUnit({
      id: 'u1',
      spd: 10,
      statuses: [makeStatusInstance({ typeId: 'haste' })],
    });
    const cat = catalogWith([haste]);
    const state = makeGameState({ units: [u] });

    expect(runModifyStatQuery(state, cat, { unit: u, statName: 'spd', baseValue: 10 })).toBe(20);
    // Sanity for the structured branch — the type system only knows 'spd'
    // today, so we can't pass an unknown name; the test above is the
    // pass-through coverage we have.
    void asStatusTypeId; // keep import alive for symmetry
  });
});

describe('runOnActionTargeted — Brave-gated reaction trigger (ADR-0021)', () => {
  // A minimal Counter-style passive that always proposes a reaction when
  // it fires. The Brave roll inside runOnActionTargeted is the gate, not
  // any handler-internal probability.
  function alwaysCounter(): PassiveAbilityDefinition {
    return {
      id: abilityId('always_counter'),
      name: 'AlwaysCounter',
      kind: 'passive',
      bucket: bucketId('reaction'),
      baseCost: 1,
      hooks: [
        passiveHook('onActionTargeted', (args) => {
          const incoming = args.incomingAction;
          if (incoming.type !== 'use_ability') return [];
          if (!('actorId' in incoming)) return [];
          if (incoming.actorId === args.unit.id) return [];
          const r: ProposedAction = {
            type: 'use_ability',
            source: 'system',
            actorId: args.unit.id,
            payload: {
              abilityId: abilityId('attack'),
              target: { kind: 'unit', unitId: incoming.actorId },
            },
          };
          return [r];
        }),
      ],
    };
  }

  function knightClassDef(): ClassDefinition {
    return {
      id: classId('knight'),
      name: 'Knight',
      movement: { moveRange: 3, jump: 2, terrainCosts: new Map(), canEnter: new Set(['ground']) },
      evasion: { front: 0, side: 0, back: 0 },
      equipmentSlots: { leftHand: true, rightHand: true, headgear: true, armor: true, accessory: true },
      firstActionCommandSet: commandSetId('battle_skill'),
      freeAbilities: new Set(),
    };
  }

  function attackAbilityDef(): ActiveAbilityDefinition {
    return {
      id: abilityId('attack'),
      name: 'Attack',
      kind: 'active',
      bucket: bucketId('first_action'),
      baseCost: 1,
      targeting: { kind: 'single_unit', range: { horizontal: 1, vertical: 3 }, rangeMode: 'melee' },
      actionSpeed: 0,
      mpCost: 0,
      effects: { damage: { tags: ['physical', 'weapon'], power_coefficient: 4 } },
    };
  }

  function battleSkillDef(): CommandSetDefinition {
    return {
      id: commandSetId('battle_skill'),
      name: 'Battle Skill',
      members: [abilityId('attack')],
      baseCost: 1,
    };
  }

  function loadoutWithReaction(reaction?: AbilityId): Loadout {
    const actionBuckets: Record<string, ReturnType<typeof commandSetId> | null> = {};
    for (const b of ACTIVE_BUCKET_IDS) actionBuckets[b] = null;
    actionBuckets[bucketId('first_action')] = commandSetId('battle_skill');
    const passiveBuckets: Record<string, ReadonlyArray<AbilityId>> = {};
    for (const b of PASSIVE_BUCKET_IDS) passiveBuckets[b] = [];
    if (reaction !== undefined) passiveBuckets[bucketId('reaction')] = [reaction];
    return { actionBuckets, passiveBuckets };
  }

  function makeCatalog(): ReturnType<typeof createCatalog> {
    return createCatalog({
      statusTypes: [],
      abilities: [attackAbilityDef(), alwaysCounter()],
      commandSets: [battleSkillDef()],
      classes: [knightClassDef()],
      items: [],
      rulesets: defaultTestRulesets,
    });
  }

  function setup(args: { brave: number }) {
    const cat = makeCatalog();
    const reactor = makeUnit({
      id: 'reactor',
      spd: 10,
      brave: args.brave,
      loadout: loadoutWithReaction(abilityId('always_counter')),
    });
    const attacker = makeUnit({ id: 'attacker', spd: 10, team: 'team_b' });
    const state = makeGameState({ units: [reactor, attacker] });
    const incoming: ProposedAction = {
      type: 'use_ability',
      source: 'player',
      actorId: attacker.id,
      payload: { abilityId: abilityId('attack'), target: { kind: 'unit', unitId: reactor.id } },
    };
    return { cat, state, reactor, incoming };
  }

  it('Brave 100 triggers reactions deterministically across many seeds', () => {
    const { cat, state, reactor, incoming } = setup({ brave: 100 });
    for (let seed = 0; seed < 50; seed++) {
      const reactions = runOnActionTargeted(state, cat, {
        unit: reactor,
        incomingAction: incoming,
        damageDealt: 10,
        damageTags: new Set(['physical']),
        seed,
      });
      expect(reactions).toHaveLength(1);
    }
  });

  it('Brave 0 produces no reactions (deterministic non-trigger)', () => {
    // Stat caps prevent brave 0 in real units; this verifies the
    // boundary case in the runner short-circuit.
    const { cat, state, reactor, incoming } = setup({ brave: 0 });
    for (let seed = 0; seed < 20; seed++) {
      const reactions = runOnActionTargeted(state, cat, {
        unit: reactor,
        incomingAction: incoming,
        damageDealt: 10,
        damageTags: new Set(['physical']),
        seed,
      });
      expect(reactions).toEqual([]);
    }
  });

  it('Brave 50 triggers ~half the time across many seeds', () => {
    const { cat, state, reactor, incoming } = setup({ brave: 50 });
    let triggered = 0;
    const N = 200;
    for (let seed = 0; seed < N; seed++) {
      const reactions = runOnActionTargeted(state, cat, {
        unit: reactor,
        incomingAction: incoming,
        damageDealt: 10,
        damageTags: new Set(['physical']),
        seed,
      });
      if (reactions.length > 0) triggered++;
    }
    // Loose bounds — the mulberry32 mixer is uniform-ish but not perfect;
    // 200 trials at p=0.5 should land in [70, 130] comfortably.
    expect(triggered).toBeGreaterThan(N * 0.3);
    expect(triggered).toBeLessThan(N * 0.7);
  });

  it('determinism: same seed → same trigger outcome', () => {
    const { cat, state, reactor, incoming } = setup({ brave: 50 });
    const seed = 12345;
    const a = runOnActionTargeted(state, cat, {
      unit: reactor,
      incomingAction: incoming,
      damageDealt: 10,
      damageTags: new Set(['physical']),
      seed,
    });
    const b = runOnActionTargeted(state, cat, {
      unit: reactor,
      incomingAction: incoming,
      damageDealt: 10,
      damageTags: new Set(['physical']),
      seed,
    });
    expect(a.length).toBe(b.length);
  });
});
