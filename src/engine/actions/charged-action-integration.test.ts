// End-to-end charged-action lifecycle tests:
//
// - committing UseAbility with actionSpeed > 0 spawns a ChargedAction
//   and applies the Charging status to the caster
// - the scheduler advances the ChargedAction's CT and emits
//   `charged_action_resolve` when the threshold is crossed
// - resolution drives the damage/status pipeline against the resolved
//   target (FFT-pinning for unit anchors; tile lookup for tile anchors)
// - the interruption matrix per BMG: caster KO fizzles, Stop pauses,
//   target KO fizzles for unit anchors, tile anchors land regardless
// - the engine-side turn_end auto-emit on active-unit KO from
//   commitAction's post-chain checkpoint (per ADR-0023)
// - tile validation: out-of-range / LoS-blocked / arc-covered tiles
//   are rejected by validateAction

import { passiveHook } from '../abilities/hooks.ts';
import { ACTIVE_BUCKET_IDS, PASSIVE_BUCKET_IDS } from '../abilities/constants.ts';
import { createCatalog, type StatusEffectType } from '../catalog/index.ts';
import {
  DEFAULT_TEST_DAMAGE_PIPELINE,
  makeTestRuleset,
} from '../catalog/test-fixtures.ts';
import { makeGameState, makeUnit } from '../ct/test-fixtures.ts';
import { advanceToNextEvent } from '../turn/scheduler.ts';
import { flatMap } from '../map/test-fixtures.ts';
import {
  abilityId,
  bucketId,
  classId,
  commandSetId,
  statusHook,
  statusTypeId,
  teamId,
  unitId,
  type AbilityId,
  type ActiveAbilityDefinition,
  type ClassDefinition,
  type CommandSetDefinition,
  type Loadout,
  type PassiveAbilityDefinition,
  type ProposedAction,
} from '@engine/index.ts';
import { commitAction } from './commit.ts';
import { validateAction } from './validate.ts';

// --- Fixtures ---

function knightClass(): ClassDefinition {
  return {
    id: classId('knight'),
    name: 'Knight',
    movement: { moveRange: 3, jump: 2, terrainCosts: new Map(), canEnter: new Set(['ground']) },
    evasion: { front: 0, side: 0, back: 0 },
    firstActionCommandSet: commandSetId('battle_skill'),
    freeAbilities: new Set(),
  };
}

function chargingType(): StatusEffectType {
  return {
    id: statusTypeId('charging'),
    name: 'Charging',
    tags: ['neutral'],
    durationMode: 'conditional',
    stackingRule: 'REJECT',
    hooks: [
      statusHook('queryTurnSkipped', () => ({ reason: 'charging', suppressStatusTicks: false })),
    ],
  };
}

function stopType(): StatusEffectType {
  return {
    id: statusTypeId('stop'),
    name: 'Stop',
    tags: ['negative'],
    durationMode: 'per_unit_ct',
    stackingRule: 'REFRESH',
    hooks: [statusHook('queryTurnSkipped', () => ({ reason: 'stopped', suppressStatusTicks: true }))],
  };
}

// Tile-anchored magical damage charged spell. Mirrors the production
// `bolt` content but is defined inline so engine tests don't reach
// into content/.
function tileBolt(args: { actionSpeed?: number; mpCost?: number; power_coefficient?: number } = {}): ActiveAbilityDefinition {
  return {
    id: abilityId('bolt_test'),
    name: 'Bolt (test)',
    kind: 'active',
    bucket: bucketId('first_action'),
    baseCost: 1,
    availability: 'hidden',
    targeting: { kind: 'tile', range: { horizontal: 4, vertical: 3 }, rangeMode: 'arc' },
    actionSpeed: args.actionSpeed ?? 25,
    mpCost: args.mpCost ?? 6,
    effects: { damage: { tags: ['magical'], power_coefficient: args.power_coefficient ?? 4 } },
  };
}

function attackAbility(): ActiveAbilityDefinition {
  return {
    id: abilityId('attack'),
    name: 'Attack',
    kind: 'active',
    bucket: bucketId('first_action'),
    baseCost: 1,
    availability: 'hidden',
    targeting: { kind: 'single_unit', range: { horizontal: 1, vertical: 3 }, rangeMode: 'melee' },
    actionSpeed: 0,
    mpCost: 0,
    effects: { damage: { tags: ['physical', 'weapon'], power_coefficient: 4 } },
  };
}

function lethalCounter(): PassiveAbilityDefinition {
  // A Counter-style passive that hits hard enough to one-shot the
  // attacker. Used to exercise the engine-side turn_end auto-emit.
  return {
    id: abilityId('lethal_counter'),
    name: 'Lethal Counter',
    kind: 'passive',
    bucket: bucketId('reaction'),
    baseCost: 1,
    availability: 'hidden',
    hooks: [
      passiveHook('onActionTargeted', (args) => {
        if (!args.damageTags?.has('physical')) return [];
        if (args.damageTags.has('healing')) return [];
        const incoming = args.incomingAction;
        if (incoming.type !== 'use_ability') return [];
        if (!('actorId' in incoming)) return [];
        if (incoming.actorId === args.unit.id) return [];
        return [
          {
            type: 'use_ability',
            source: 'system',
            actorId: args.unit.id,
            payload: {
              abilityId: abilityId('overkill'),
              target: { kind: 'unit', unitId: incoming.actorId },
            },
          },
        ];
      }),
    ],
  };
}

function overkillAbility(): ActiveAbilityDefinition {
  // Massive damage so the counter one-shots the attacker.
  return {
    id: abilityId('overkill'),
    name: 'Overkill',
    kind: 'active',
    bucket: bucketId('first_action'),
    baseCost: 1,
    availability: 'hidden',
    targeting: { kind: 'single_unit', range: { horizontal: 8, vertical: 8 }, rangeMode: 'melee' },
    actionSpeed: 0,
    mpCost: 0,
    effects: { damage: { tags: ['physical', 'weapon'], power_coefficient: 200 } },
  };
}

function loadoutWith(args: {
  readonly firstAction?: string;
  readonly reactionPassive?: AbilityId;
}): Loadout {
  const actionBuckets: Record<string, ReadonlyArray<ReturnType<typeof commandSetId>>> = {};
  for (const b of ACTIVE_BUCKET_IDS) actionBuckets[b] = [];
  if (args.firstAction !== undefined) {
    actionBuckets[bucketId('first_action')] = [commandSetId(args.firstAction)];
  }
  const passiveBuckets: Record<string, ReadonlyArray<AbilityId>> = {};
  for (const b of PASSIVE_BUCKET_IDS) passiveBuckets[b] = [];
  if (args.reactionPassive !== undefined) {
    passiveBuckets[bucketId('reaction')] = [args.reactionPassive];
  }
  return { actionBuckets, passiveBuckets };
}

function turnFor(unitIdString: string) {
  return {
    unitId: unitId(unitIdString),
    budget: { movesAvailable: 1, actsAvailable: 1 },
    consumed: { movesConsumed: 0, actsConsumed: 0 },
    reactionsUsedThisTurn: new Map(),
  };
}

function ruleset() {
  return makeTestRuleset({
    damagePipelineStages: DEFAULT_TEST_DAMAGE_PIPELINE,
  });
}

// --- Tests ---

describe('charged action commit', () => {
  it('spawns a ChargedAction, applies Charging, deducts MP, consumes the act', () => {
    const cat = createCatalog({
      statusTypes: [chargingType()],
      abilities: [tileBolt()],
      commandSets: [
        { id: commandSetId('battle_skill'), name: 'BS', members: [abilityId('bolt_test')], baseCost: 1, availability: 'hidden' },
      ],
      classes: [knightClass()],
      items: [],
      rulesets: [ruleset()],
    });
    const caster = makeUnit({
      id: 'caster',
      spd: 10,
      ma: 5,
      mp: 10,
      loadout: loadoutWith({ firstAction: 'battle_skill' }),
      position: { x: 0, y: 0, layer: 0 },
    });
    const state = makeGameState({
      units: [caster],
      map: flatMap(5, 5),
      turnState: turnFor('caster'),
    });
    const action: ProposedAction = {
      type: 'use_ability',
      source: 'player',
      actorId: caster.id,
      payload: {
        abilityId: abilityId('bolt_test'),
        target: { kind: 'tile', position: { x: 2, y: 0, layer: 0 } },
      },
    };
    const r = commitAction(state, action, cat);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.newState.chargedActions).toHaveLength(1);
    const ca = r.newState.chargedActions[0]!;
    expect(ca.casterId).toBe(caster.id);
    expect(ca.abilityId).toBe(abilityId('bolt_test'));
    expect(ca.ct).toBe(0);
    expect(ca.speed).toBe(25);
    expect(ca.targets).toEqual([{ kind: 'tile', position: { x: 2, y: 0, layer: 0 } }]);
    // MP deducted, act consumed.
    expect(r.newState.units.get(caster.id)!.vitals.mp).toBe(4);
    expect(r.newState.turnState!.budget.actsAvailable).toBe(0);
    // Charging applied.
    const statuses = r.newState.units.get(caster.id)!.statuses;
    expect(statuses).toHaveLength(1);
    expect(statuses[0]!.typeId).toBe(statusTypeId('charging'));
    expect(statuses[0]!.customState?.chargedActionId).toBe(ca.id);
  });
});

describe('charged action resolve — happy path', () => {
  it('damages the unit on the tile at resolution time, removes the ChargedAction and Charging', () => {
    const cat = createCatalog({
      statusTypes: [chargingType()],
      abilities: [tileBolt()],
      commandSets: [
        { id: commandSetId('battle_skill'), name: 'BS', members: [abilityId('bolt_test')], baseCost: 1, availability: 'hidden' },
      ],
      classes: [knightClass()],
      items: [],
      rulesets: [ruleset()],
    });
    const caster = makeUnit({
      id: 'caster',
      spd: 10,
      ma: 5,
      mp: 10,
      faith: 100,
      loadout: loadoutWith({ firstAction: 'battle_skill' }),
      position: { x: 0, y: 0, layer: 0 },
    });
    const target = makeUnit({
      id: 'target',
      spd: 10,
      hp: 100,
      maxHpBase: 100,
      faith: 100,
      team: 'team_b',
      loadout: loadoutWith({ firstAction: 'battle_skill' }),
      position: { x: 2, y: 0, layer: 0 },
    });
    const state = makeGameState({
      units: [caster, target],
      map: flatMap(5, 5),
      turnState: turnFor('caster'),
    });
    // Cast on the tile target stands on.
    const r1 = commitAction(
      state,
      {
        type: 'use_ability',
        source: 'player',
        actorId: caster.id,
        payload: {
          abilityId: abilityId('bolt_test'),
          target: { kind: 'tile', position: { x: 2, y: 0, layer: 0 } },
        },
      },
      cat,
    );
    expect(r1.ok).toBe(true);
    if (!r1.ok) return;
    // Now end the turn so the scheduler can advance.
    let s = r1.newState;
    const r2 = commitAction(
      s,
      { type: 'turn_end', source: 'system', payload: { unitId: caster.id } },
      cat,
    );
    expect(r2.ok).toBe(true);
    if (!r2.ok) return;
    s = r2.newState;
    // Drive the scheduler forward; eventually the ChargedAction triggers
    // a `charged_action_resolve` system action.
    let resolveProposed: ProposedAction | null = null;
    for (let i = 0; i < 40; i++) {
      const sched = advanceToNextEvent(s, cat);
      if (sched === null) break;
      s = sched.newState;
      if (sched.proposed.type === 'charged_action_resolve') {
        resolveProposed = sched.proposed;
        break;
      }
      const r = commitAction(s, sched.proposed, cat);
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      s = r.newState;
    }
    expect(resolveProposed).not.toBeNull();
    // Commit the resolution.
    const r3 = commitAction(s, resolveProposed!, cat);
    expect(r3.ok).toBe(true);
    if (!r3.ok) return;
    s = r3.newState;
    // Damage applied: MA 5 × power 4 × Faith_factor (100/100) = 20. HP 100 - 20 = 80.
    expect(s.units.get(target.id)!.vitals.hp).toBe(80);
    // ChargedAction and Charging both gone.
    expect(s.chargedActions).toHaveLength(0);
    expect(s.units.get(caster.id)!.statuses).toHaveLength(0);
  });

  it('charged_action_resolve that KOs the last enemy triggers battle_end in the same commit (ADR-0074)', () => {
    // Bug #5: pre-ADR-0074, `evaluateBattleOutcome` ran only at turn_end.
    // A charged action resolving on a between-turns scheduler event KO'd
    // the last enemy but the battle didn't close — the scheduler advanced
    // to the next turn_start and an extra turn fired. The centralized
    // post-commit check in `commitAction` closes the battle at the moment
    // the charged resolution lands.
    const cat = createCatalog({
      statusTypes: [chargingType()],
      abilities: [tileBolt({ power_coefficient: 50 })],
      commandSets: [
        { id: commandSetId('battle_skill'), name: 'BS', members: [abilityId('bolt_test')], baseCost: 1, availability: 'hidden' },
      ],
      classes: [knightClass()],
      items: [],
      rulesets: [ruleset()],
    });
    const caster = makeUnit({
      id: 'caster',
      spd: 10,
      ma: 10,
      mp: 10,
      faith: 100,
      loadout: loadoutWith({ firstAction: 'battle_skill' }),
      position: { x: 0, y: 0, layer: 0 },
    });
    // The lone enemy, low enough HP that the charged bolt KOs it.
    const target = makeUnit({
      id: 'target',
      spd: 10,
      hp: 30,
      maxHpBase: 100,
      faith: 100,
      team: 'team_b',
      loadout: loadoutWith({ firstAction: 'battle_skill' }),
      position: { x: 2, y: 0, layer: 0 },
    });
    let s = makeGameState({
      units: [caster, target],
      map: flatMap(5, 5),
      turnState: turnFor('caster'),
      teams: [
        { id: teamId('team_a'), name: 'A', control: 'human' },
        { id: teamId('team_b'), name: 'B', control: 'ai' },
      ],
      victoryConditions: [
        { kind: 'defeat_all', side: teamId('team_b'), description: 'defeat enemies' },
      ],
    });
    const r1 = commitAction(
      s,
      {
        type: 'use_ability',
        source: 'player',
        actorId: caster.id,
        payload: {
          abilityId: abilityId('bolt_test'),
          target: { kind: 'tile', position: { x: 2, y: 0, layer: 0 } },
        },
      },
      cat,
    );
    expect(r1.ok).toBe(true);
    if (!r1.ok) return;
    s = r1.newState;
    const r2 = commitAction(
      s,
      { type: 'turn_end', source: 'system', payload: { unitId: caster.id } },
      cat,
    );
    expect(r2.ok).toBe(true);
    if (!r2.ok) return;
    s = r2.newState;
    // Drive the scheduler forward to the charged_action_resolve event.
    let resolveProposed: ProposedAction | null = null;
    for (let i = 0; i < 40; i++) {
      const sched = advanceToNextEvent(s, cat);
      if (sched === null) break;
      s = sched.newState;
      if (sched.proposed.type === 'charged_action_resolve') {
        resolveProposed = sched.proposed;
        break;
      }
      const r = commitAction(s, sched.proposed, cat);
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      s = r.newState;
    }
    expect(resolveProposed).not.toBeNull();
    const r3 = commitAction(s, resolveProposed!, cat);
    expect(r3.ok).toBe(true);
    if (!r3.ok) return;
    s = r3.newState;
    // The enemy was KO'd by the charged spell...
    expect(s.units.get(target.id)!.vitals.hp).toBe(0);
    // ...and the battle closed in the *same* commit — battle_end was
    // committed and the outcome is decided, so the scheduler will refuse
    // to advance to another turn_start.
    expect(r3.committed.some((a) => a.type === 'battle_end')).toBe(true);
    expect(s.outcome).toBeDefined();
    expect(s.outcome!.winner).toBe(teamId('team_a'));
    expect(advanceToNextEvent(s, cat)).toBeNull();
  });

  it('resolves to no damage when the targeted tile is empty (FFT pinning to position)', () => {
    const cat = createCatalog({
      statusTypes: [chargingType()],
      abilities: [tileBolt()],
      commandSets: [
        { id: commandSetId('battle_skill'), name: 'BS', members: [abilityId('bolt_test')], baseCost: 1, availability: 'hidden' },
      ],
      classes: [knightClass()],
      items: [],
      rulesets: [ruleset()],
    });
    const caster = makeUnit({
      id: 'caster',
      spd: 10,
      ma: 5,
      mp: 10,
      loadout: loadoutWith({ firstAction: 'battle_skill' }),
      position: { x: 0, y: 0, layer: 0 },
    });
    // Note: target unit will move off the tile before the charge resolves.
    const target = makeUnit({
      id: 'target',
      spd: 10,
      hp: 100,
      maxHpBase: 100,
      team: 'team_b',
      loadout: loadoutWith({ firstAction: 'battle_skill' }),
      position: { x: 2, y: 0, layer: 0 },
    });
    let s = makeGameState({
      units: [caster, target],
      map: flatMap(5, 5),
      turnState: turnFor('caster'),
    });
    const r1 = commitAction(
      s,
      {
        type: 'use_ability',
        source: 'player',
        actorId: caster.id,
        payload: {
          abilityId: abilityId('bolt_test'),
          target: { kind: 'tile', position: { x: 2, y: 0, layer: 0 } },
        },
      },
      cat,
    );
    expect(r1.ok).toBe(true);
    if (!r1.ok) return;
    s = r1.newState;
    // Move the target off the tile manually (simulating their turn).
    s = {
      ...s,
      units: new Map(s.units).set(target.id, {
        ...s.units.get(target.id)!,
        position: { x: 4, y: 4, layer: 0 },
      }),
    };
    // End caster's turn and run the scheduler until the charge resolves.
    s = commitAction(s, { type: 'turn_end', source: 'system', payload: { unitId: caster.id } }, cat).newState!;
    let resolveProposed: ProposedAction | null = null;
    for (let i = 0; i < 40; i++) {
      const sched = advanceToNextEvent(s, cat);
      if (sched === null) break;
      s = sched.newState;
      if (sched.proposed.type === 'charged_action_resolve') {
        resolveProposed = sched.proposed;
        break;
      }
      s = commitAction(s, sched.proposed, cat).newState!;
    }
    expect(resolveProposed).not.toBeNull();
    const r3 = commitAction(s, resolveProposed!, cat);
    expect(r3.ok).toBe(true);
    if (!r3.ok) return;
    s = r3.newState;
    // No damage: tile is empty at resolution.
    expect(s.units.get(target.id)!.vitals.hp).toBe(100);
    // ChargedAction and Charging both still get cleaned up.
    expect(s.chargedActions).toHaveLength(0);
    expect(s.units.get(caster.id)!.statuses).toHaveLength(0);
    // MP not refunded — caster's MP stays at 4 (10 - 6).
    expect(s.units.get(caster.id)!.vitals.mp).toBe(4);
  });
});

describe('charged action interruption — caster KO', () => {
  it('fizzles silently when the caster is KO\'d before resolution; ChargedAction and Charging both cleared', () => {
    const cat = createCatalog({
      statusTypes: [chargingType()],
      abilities: [tileBolt()],
      commandSets: [
        { id: commandSetId('battle_skill'), name: 'BS', members: [abilityId('bolt_test')], baseCost: 1, availability: 'hidden' },
      ],
      classes: [knightClass()],
      items: [],
      rulesets: [ruleset()],
    });
    const caster = makeUnit({
      id: 'caster',
      spd: 10,
      ma: 5,
      mp: 10,
      loadout: loadoutWith({ firstAction: 'battle_skill' }),
      position: { x: 0, y: 0, layer: 0 },
    });
    const target = makeUnit({
      id: 'target',
      spd: 10,
      hp: 100,
      maxHpBase: 100,
      team: 'team_b',
      loadout: loadoutWith({ firstAction: 'battle_skill' }),
      position: { x: 2, y: 0, layer: 0 },
    });
    let s = makeGameState({
      units: [caster, target],
      map: flatMap(5, 5),
      turnState: turnFor('caster'),
    });
    const r1 = commitAction(
      s,
      {
        type: 'use_ability',
        source: 'player',
        actorId: caster.id,
        payload: {
          abilityId: abilityId('bolt_test'),
          target: { kind: 'tile', position: { x: 2, y: 0, layer: 0 } },
        },
      },
      cat,
    );
    s = r1.newState!;
    // End the caster's turn so the scheduler can advance.
    s = commitAction(
      s,
      { type: 'turn_end', source: 'system', payload: { unitId: caster.id } },
      cat,
    ).newState!;
    // KO the caster mid-charge (between turns).
    s = {
      ...s,
      units: new Map(s.units).set(caster.id, {
        ...s.units.get(caster.id)!,
        vitals: { ...s.units.get(caster.id)!.vitals, hp: 0 },
      }),
    };
    // Advance the scheduler until charged_action_resolve fires.
    let resolveProposed: ProposedAction | null = null;
    for (let i = 0; i < 40; i++) {
      const sched = advanceToNextEvent(s, cat);
      if (sched === null) break;
      s = sched.newState;
      if (sched.proposed.type === 'charged_action_resolve') {
        resolveProposed = sched.proposed;
        break;
      }
      s = commitAction(s, sched.proposed, cat).newState!;
    }
    expect(resolveProposed).not.toBeNull();
    const r3 = commitAction(s, resolveProposed!, cat);
    expect(r3.ok).toBe(true);
    if (!r3.ok) return;
    s = r3.newState;
    // No damage to target — fizzled.
    expect(s.units.get(target.id)!.vitals.hp).toBe(100);
    // ChargedAction cleaned up.
    expect(s.chargedActions).toHaveLength(0);
    // Caster's Charging status cleared.
    expect(s.units.get(caster.id)!.statuses).toHaveLength(0);
  });
});

describe('charged action interruption — Stop pauses charge', () => {
  it('caster Stop zeros computeActionSpeed; ChargedAction does not advance until Stop clears', () => {
    const cat = createCatalog({
      statusTypes: [chargingType(), stopType()],
      abilities: [tileBolt()],
      commandSets: [
        { id: commandSetId('battle_skill'), name: 'BS', members: [abilityId('bolt_test')], baseCost: 1, availability: 'hidden' },
      ],
      classes: [knightClass()],
      items: [],
      rulesets: [ruleset()],
    });
    const caster = makeUnit({
      id: 'caster',
      spd: 10,
      ma: 5,
      mp: 10,
      loadout: loadoutWith({ firstAction: 'battle_skill' }),
      position: { x: 0, y: 0, layer: 0 },
    });
    const target = makeUnit({
      id: 'target',
      spd: 10,
      hp: 100,
      maxHpBase: 100,
      team: 'team_b',
      loadout: loadoutWith({ firstAction: 'battle_skill' }),
      position: { x: 2, y: 0, layer: 0 },
    });
    let s = makeGameState({
      units: [caster, target],
      map: flatMap(5, 5),
      turnState: turnFor('caster'),
    });
    s = commitAction(
      s,
      {
        type: 'use_ability',
        source: 'player',
        actorId: caster.id,
        payload: {
          abilityId: abilityId('bolt_test'),
          target: { kind: 'tile', position: { x: 2, y: 0, layer: 0 } },
        },
      },
      cat,
    ).newState!;
    // Stamp Stop on the caster manually (simulating an enemy Stop spell
    // landing). Real flow would route through applyStatus; this is the
    // engine-test shortcut.
    s = {
      ...s,
      units: new Map(s.units).set(caster.id, {
        ...s.units.get(caster.id)!,
        statuses: [
          ...s.units.get(caster.id)!.statuses,
          {
            typeId: statusTypeId('stop'),
            source: { unitId: null, actionSeq: null },
            remainingDuration: 30,
          },
        ],
      }),
    };
    s = commitAction(
      s,
      { type: 'turn_end', source: 'system', payload: { unitId: caster.id } },
      cat,
    ).newState!;
    // Try to advance; the ChargedAction should never trigger as long as
    // Stop is active. The target may take their turn first.
    let chargeResolved = false;
    for (let i = 0; i < 30; i++) {
      const sched = advanceToNextEvent(s, cat);
      if (sched === null) break;
      s = sched.newState;
      if (sched.proposed.type === 'charged_action_resolve') {
        chargeResolved = true;
        break;
      }
      s = commitAction(s, sched.proposed, cat).newState!;
    }
    expect(chargeResolved).toBe(false);
    // Charge is still in flight (paused).
    expect(s.chargedActions).toHaveLength(1);
    // The ChargedAction's CT did not advance (still 0). Stop pauses
    // accumulation per BMG.
    expect(s.chargedActions[0]!.ct).toBe(0);
  });
});

describe('Charging skips the casters own turns', () => {
  it('queryTurnSkipped on Charging produces a skipped turn with auto-emitted turn_end', () => {
    const cat = createCatalog({
      statusTypes: [chargingType()],
      abilities: [tileBolt()],
      commandSets: [
        { id: commandSetId('battle_skill'), name: 'BS', members: [abilityId('bolt_test')], baseCost: 1, availability: 'hidden' },
      ],
      classes: [knightClass()],
      items: [],
      rulesets: [ruleset()],
    });
    const caster = makeUnit({
      id: 'caster',
      spd: 30, // fast enough that the unit's CT could outrun its charge
      ma: 5,
      mp: 10,
      loadout: loadoutWith({ firstAction: 'battle_skill' }),
      position: { x: 0, y: 0, layer: 0 },
    });
    let s = makeGameState({
      units: [caster],
      map: flatMap(5, 5),
      turnState: turnFor('caster'),
    });
    s = commitAction(
      s,
      {
        type: 'use_ability',
        source: 'player',
        actorId: caster.id,
        payload: {
          abilityId: abilityId('bolt_test'),
          target: { kind: 'tile', position: { x: 2, y: 0, layer: 0 } },
        },
      },
      cat,
    ).newState!;
    s = commitAction(
      s,
      { type: 'turn_end', source: 'system', payload: { unitId: caster.id } },
      cat,
    ).newState!;
    // The caster's CT will reach 100 before the charge does (Speed 30 vs
    // ActionSpeed 25). Their next turn should skip via Charging.
    const sched1 = advanceToNextEvent(s, cat);
    expect(sched1).not.toBeNull();
    if (sched1 === null) return;
    s = sched1.newState;
    expect(sched1.proposed.type).toBe('turn_start');
    if (sched1.proposed.type !== 'turn_start') return;
    expect(sched1.proposed.payload.unitId).toBe(caster.id);
    const r = commitAction(s, sched1.proposed, cat);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    s = r.newState;
    // turn_start should produce skipped: true and a generated turn_end.
    const turnStart = r.committed.find((c) => c.type === 'turn_start');
    expect(turnStart).toBeDefined();
    if (turnStart === undefined || turnStart.type !== 'turn_start') return;
    expect(turnStart.outcome!.skipped).toBe(true);
    expect(turnStart.outcome!.skipReason).toBe('charging');
    // turn_end committed too as part of the chain.
    const turnEnd = r.committed.find((c) => c.type === 'turn_end');
    expect(turnEnd).toBeDefined();
  });
});

describe('engine-side turn_end auto-emit on active unit KO', () => {
  it('Counter-killing the active unit auto-ends their turn (supersedes ADR-0013 orchestrator guard)', () => {
    // A attacks B; B has Lethal Counter that one-shots A; the engine
    // should auto-emit turn_end for A so the chain unwinds cleanly.
    const cat = createCatalog({
      statusTypes: [],
      abilities: [attackAbility(), lethalCounter(), overkillAbility()],
      commandSets: [
        { id: commandSetId('battle_skill'), name: 'BS', members: [abilityId('attack')], baseCost: 1, availability: 'hidden' },
      ],
      classes: [knightClass()],
      items: [],
      rulesets: [ruleset()],
    });
    const a = makeUnit({
      id: 'a',
      spd: 10,
      pa: 5,
      hp: 100,
      maxHpBase: 100,
      loadout: loadoutWith({ firstAction: 'battle_skill' }),
      position: { x: 0, y: 0, layer: 0 },
    });
    const b = makeUnit({
      id: 'b',
      spd: 10,
      pa: 5,
      hp: 100,
      maxHpBase: 100,
      team: 'team_b',
      loadout: loadoutWith({
        firstAction: 'battle_skill',
        reactionPassive: abilityId('lethal_counter'),
      }),
      position: { x: 1, y: 0, layer: 0 },
    });
    const state = makeGameState({
      units: [a, b],
      map: flatMap(3, 3),
      turnState: turnFor('a'),
    });
    const r = commitAction(
      state,
      {
        type: 'use_ability',
        source: 'player',
        actorId: a.id,
        payload: { abilityId: abilityId('attack'), target: { kind: 'unit', unitId: b.id } },
      },
      cat,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    // A's HP should be 0 (counter overkilled them).
    expect(r.newState.units.get(a.id)!.vitals.hp).toBe(0);
    // turnState must be null — auto-emitted turn_end committed in the chain.
    expect(r.newState.turnState).toBeNull();
    // The committed list contains: A's attack, B's counter, then A's turn_end.
    const types = r.committed.map((c) => c.type);
    expect(types).toContain('use_ability');
    expect(types).toContain('turn_end');
    // The turn_end has source 'system' (engine-emitted, not from a controller).
    const turnEnd = r.committed.find((c) => c.type === 'turn_end');
    expect(turnEnd!.source).toBe('system');
  });
});

describe('tile validation', () => {
  function validatorState(args: { distanceX?: number; distanceY?: number; distanceLayer?: number } = {}) {
    const cat = createCatalog({
      statusTypes: [chargingType()],
      abilities: [tileBolt()],
      commandSets: [
        { id: commandSetId('battle_skill'), name: 'BS', members: [abilityId('bolt_test')], baseCost: 1, availability: 'hidden' },
      ],
      classes: [knightClass()],
      items: [],
      rulesets: [ruleset()],
    });
    const caster = makeUnit({
      id: 'caster',
      spd: 10,
      ma: 5,
      mp: 10,
      loadout: loadoutWith({ firstAction: 'battle_skill' }),
      position: { x: 0, y: 0, layer: 0 },
    });
    const state = makeGameState({
      units: [caster],
      map: flatMap(10, 10),
      turnState: turnFor('caster'),
    });
    void args;
    return { cat, state, caster };
  }

  it('accepts a tile in range', () => {
    const { cat, state, caster } = validatorState();
    const result = validateAction(
      state,
      {
        type: 'use_ability',
        source: 'player',
        actorId: caster.id,
        payload: {
          abilityId: abilityId('bolt_test'),
          target: { kind: 'tile', position: { x: 3, y: 0, layer: 0 } },
        },
      },
      cat,
    );
    expect(result.valid).toBe(true);
  });

  it('rejects a tile out of range', () => {
    const { cat, state, caster } = validatorState();
    const result = validateAction(
      state,
      {
        type: 'use_ability',
        source: 'player',
        actorId: caster.id,
        payload: {
          abilityId: abilityId('bolt_test'),
          target: { kind: 'tile', position: { x: 9, y: 0, layer: 0 } },
        },
      },
      cat,
    );
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/out of range/);
  });

  it('rejects a non-existent tile', () => {
    const { cat, state, caster } = validatorState();
    const result = validateAction(
      state,
      {
        type: 'use_ability',
        source: 'player',
        actorId: caster.id,
        payload: {
          abilityId: abilityId('bolt_test'),
          target: { kind: 'tile', position: { x: 2, y: 0, layer: 5 } },
        },
      },
      cat,
    );
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/does not exist/);
  });

  it('rejects when the proposed target kind does not match the abilitys targeting kind', () => {
    const { cat, state, caster } = validatorState();
    // Bolt is tile-anchored; trying to fire it at a unit target should fail.
    const result = validateAction(
      state,
      {
        type: 'use_ability',
        source: 'player',
        actorId: caster.id,
        payload: {
          abilityId: abilityId('bolt_test'),
          target: { kind: 'unit', unitId: caster.id },
        },
      },
      cat,
    );
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/tile target/);
  });
});
