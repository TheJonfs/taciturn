// Tests for action-log formatters. Pure-function coverage per action
// type; we don't exercise the React render layer.

import { describe, expect, it } from 'vitest';
import {
  abilityId,
  statusTypeId,
  teamId,
  unitId,
  type Action,
  type ActionEnvelope,
  type Catalog,
  type GameState,
} from '@engine/index.ts';
import { activeTurnFor, makeGameState, makeUnit } from '../engine/ct/test-fixtures.ts';
import { makeStatusInstance } from '../engine/status/test-fixtures.ts';
import { flatMap } from '../engine/map/test-fixtures.ts';
import { makeAbilitiesCatalog, knightLoadout } from '../engine/abilities/test-fixtures.ts';
import { buildLogView, formatActionLog } from './action-log-format.ts';

function env(overrides: Partial<ActionEnvelope> & { sequenceNumber: number }): ActionEnvelope {
  return {
    source: 'player',
    timestamp: { tick: 0, ct: 0 },
    seed: 1234,
    chainDepth: 0,
    isReaction: false,
    ...overrides,
  };
}

function makeBaseState(): GameState {
  const u = makeUnit({ id: 'u1', spd: 10, loadout: knightLoadout() });
  return makeGameState({
    units: [u],
    map: flatMap(3, 3),
    turnState: activeTurnFor(u.id),
  });
}

function emptyCatalog(): Catalog {
  return makeAbilitiesCatalog({});
}

describe('formatActionLog', () => {
  it('returns an empty list for an empty log', () => {
    const rows = formatActionLog([], makeBaseState(), emptyCatalog());
    expect(rows).toEqual([]);
  });

  it('emits a T#### row for turn_start', () => {
    const state = makeBaseState();
    const cat = emptyCatalog();
    const log: Action[] = [
      {
        ...env({ sequenceNumber: 1, actorId: unitId('u1') }),
        type: 'turn_start',
        payload: { unitId: unitId('u1') },
        outcome: { kind: 'turn_start', unitId: unitId('u1'), skipped: false },
      },
    ];
    const rows = formatActionLog(log, state, cat);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.tag).toBe('T0001');
    expect(rows[0]!.tagKind).toBe('turn');
    expect(rows[0]!.indent).toBe(false);
  });

  it('emits no row for turn_end', () => {
    const log: Action[] = [
      {
        ...env({ sequenceNumber: 1, actorId: unitId('u1') }),
        type: 'turn_end',
        payload: { unitId: unitId('u1') },
      },
    ];
    expect(formatActionLog(log, makeBaseState(), emptyCatalog())).toEqual([]);
  });

  it('emits an indented row for move', () => {
    const log: Action[] = [
      {
        ...env({ sequenceNumber: 1, actorId: unitId('u1') }),
        type: 'move',
        payload: { destination: { x: 4, y: 5, layer: 0 } },
      },
    ];
    const rows = formatActionLog(log, makeBaseState(), emptyCatalog());
    expect(rows).toHaveLength(1);
    expect(rows[0]!.text).toContain('(4, 5)');
    expect(rows[0]!.indent).toBe(true);
  });

  it('emits an indented row for wait', () => {
    const log: Action[] = [
      {
        ...env({ sequenceNumber: 1, actorId: unitId('u1') }),
        type: 'wait',
        payload: {},
      },
    ];
    const rows = formatActionLog(log, makeBaseState(), emptyCatalog());
    expect(rows).toHaveLength(1);
    expect(rows[0]!.text).toContain('Waited');
    expect(rows[0]!.indent).toBe(true);
  });

  it('emits no row for set_facing', () => {
    const log: Action[] = [
      {
        ...env({ sequenceNumber: 1, actorId: unitId('u1') }),
        type: 'set_facing',
        payload: { facing: 'N' },
      },
    ];
    expect(formatActionLog(log, makeBaseState(), emptyCatalog())).toEqual([]);
  });

  it('formats use_ability with damage', () => {
    const log: Action[] = [
      {
        ...env({ sequenceNumber: 1, actorId: unitId('u1') }),
        type: 'use_ability',
        payload: { abilityId: abilityId('attack'), target: { kind: 'unit', unitId: unitId('u1') } },
        outcome: {
          kind: 'use_ability',
          abilityId: abilityId('attack'),
          mpSpent: 0,
          perTargetResults: [
            { target: { kind: 'unit', unitId: unitId('u1') }, hit: true, damage: 17 },
          ],
        },
      },
    ];
    const rows = formatActionLog(log, makeBaseState(), emptyCatalog());
    expect(rows).toHaveLength(1);
    expect(rows[0]!.text).toContain('17 dmg');
  });

  it('marks reaction use_ability with the reaction glyph', () => {
    const log: Action[] = [
      {
        ...env({ sequenceNumber: 1, actorId: unitId('u1'), isReaction: true }),
        type: 'use_ability',
        payload: { abilityId: abilityId('counter'), target: { kind: 'unit', unitId: unitId('u1') } },
        outcome: {
          kind: 'use_ability',
          abilityId: abilityId('counter'),
          mpSpent: 0,
          perTargetResults: [
            { target: { kind: 'unit', unitId: unitId('u1') }, hit: true, damage: 5 },
          ],
        },
      },
    ];
    const rows = formatActionLog(log, makeBaseState(), emptyCatalog());
    expect(rows[0]!.tag).toBe('↳');
    expect(rows[0]!.tagKind).toBe('reaction');
  });

  it('formats battle_end as a top-level system row', () => {
    const log: Action[] = [
      {
        ...env({ sequenceNumber: 1, source: 'system' }),
        type: 'battle_end',
        payload: { winner: teamId('team_a'), conditionIndex: 0 },
        outcome: {
          kind: 'battle_end',
          winner: teamId('team_a'),
          conditionIndex: 0,
          description: 'all enemies KO',
        },
      },
    ];
    const rows = formatActionLog(log, makeBaseState(), emptyCatalog());
    expect(rows).toHaveLength(1);
    expect(rows[0]!.tag).toBe('[end]');
    expect(rows[0]!.indent).toBe(false);
    expect(rows[0]!.text).toContain('team_a wins');
  });

  it('formats a status_tick row', () => {
    const log: Action[] = [
      {
        ...env({ sequenceNumber: 1, source: 'system' }),
        type: 'status_tick',
        payload: { unitId: unitId('u1'), statusTypeId: statusTypeId('poison') },
        outcome: {
          kind: 'status_tick',
          unitId: unitId('u1'),
          statusTypeId: statusTypeId('poison'),
          removed: false,
        },
      },
    ];
    const rows = formatActionLog(log, makeBaseState(), emptyCatalog());
    expect(rows).toHaveLength(1);
    expect(rows[0]!.tag).toBe('[tick]');
  });

  it('increments T-number across multiple turn_starts', () => {
    const log: Action[] = [
      {
        ...env({ sequenceNumber: 1, actorId: unitId('u1') }),
        type: 'turn_start',
        payload: { unitId: unitId('u1') },
      },
      {
        ...env({ sequenceNumber: 2, actorId: unitId('u1') }),
        type: 'turn_start',
        payload: { unitId: unitId('u1') },
      },
    ];
    const rows = formatActionLog(log, makeBaseState(), emptyCatalog());
    expect(rows.map((r) => r.tag)).toEqual(['T0001', 'T0002']);
  });

  it('interleaves a [ko] row right after the lethal damage row', () => {
    const killer = makeUnit({ id: 'killer', spd: 10, maxHpBase: 100 });
    const victim = makeUnit({ id: 'victim', spd: 10, maxHpBase: 100 });
    const state = makeGameState({
      units: [killer, victim],
      map: flatMap(3, 3),
      turnState: activeTurnFor(killer.id),
    });
    const log: Action[] = [
      {
        ...env({ sequenceNumber: 1, actorId: killer.id }),
        type: 'turn_start',
        payload: { unitId: killer.id },
      },
      {
        ...env({ sequenceNumber: 2, actorId: killer.id }),
        type: 'use_ability',
        payload: { abilityId: abilityId('strike'), target: { kind: 'unit', unitId: victim.id } },
        outcome: {
          kind: 'use_ability',
          abilityId: abilityId('strike'),
          mpSpent: 0,
          perTargetResults: [
            { target: { kind: 'unit', unitId: victim.id }, hit: true, damage: 120, hpAfter: 0 },
          ],
        },
      },
    ];
    const rows = formatActionLog(log, state, emptyCatalog());
    // Three rows: turn_start, use_ability, ko.
    expect(rows).toHaveLength(3);
    expect(rows[2]!.tag).toBe('[ko]');
    expect(rows[2]!.tagKind).toBe('ko');
    expect(rows[2]!.text).toContain('victim');
    expect(rows[2]!.participants.targetIds).toEqual([victim.id]);
  });

  it('formats system_apply_status as success for `stacked` outcomes (Burn)', () => {
    // Regression test for the burn-status false-failure bug. Prior to
    // the fix, the formatter read `outcome.result.applied` (which doesn't
    // exist on StatusApplicationOutcome) and reported every apply as
    // "(failed)". Burn uses STACK_COUNT_ADDITIVE → kind: 'stacked'.
    const log: Action[] = [
      {
        ...env({ sequenceNumber: 1, source: 'system' }),
        type: 'system_apply_status',
        payload: { targetId: unitId('u1'), statusTypeId: statusTypeId('burn'), sourceUnitId: null },
        outcome: {
          kind: 'system_apply_status',
          targetId: unitId('u1'),
          statusTypeId: statusTypeId('burn'),
          result: {
            kind: 'stacked',
            mode: 'additive',
            instance: {
              typeId: statusTypeId('burn'),
              source: { unitId: null, actionSeq: null },
              remainingDuration: null,
              stacks: 3,
            },
          },
        },
      },
    ];
    const rows = formatActionLog(log, makeBaseState(), emptyCatalog());
    expect(rows).toHaveLength(1);
    expect(rows[0]!.text).toContain('stacked ×3');
    expect(rows[0]!.text).not.toContain('failed');
  });

  it('formats system_apply_status as success for `applied`/`refreshed`/`replaced`', () => {
    const baseStatus = {
      typeId: statusTypeId('haste'),
      source: { unitId: null, actionSeq: null },
      remainingDuration: 5,
    };
    const log: Action[] = [
      {
        ...env({ sequenceNumber: 1, source: 'system' }),
        type: 'system_apply_status',
        payload: { targetId: unitId('u1'), statusTypeId: statusTypeId('haste'), sourceUnitId: null },
        outcome: {
          kind: 'system_apply_status',
          targetId: unitId('u1'),
          statusTypeId: statusTypeId('haste'),
          result: { kind: 'applied', instance: baseStatus },
        },
      },
      {
        ...env({ sequenceNumber: 2, source: 'system' }),
        type: 'system_apply_status',
        payload: { targetId: unitId('u1'), statusTypeId: statusTypeId('haste'), sourceUnitId: null },
        outcome: {
          kind: 'system_apply_status',
          targetId: unitId('u1'),
          statusTypeId: statusTypeId('haste'),
          result: { kind: 'refreshed', instance: baseStatus },
        },
      },
      {
        ...env({ sequenceNumber: 3, source: 'system' }),
        type: 'system_apply_status',
        payload: { targetId: unitId('u1'), statusTypeId: statusTypeId('haste'), sourceUnitId: null },
        outcome: {
          kind: 'system_apply_status',
          targetId: unitId('u1'),
          statusTypeId: statusTypeId('haste'),
          result: { kind: 'replaced', previousInstance: baseStatus, instance: baseStatus },
        },
      },
    ];
    const rows = formatActionLog(log, makeBaseState(), emptyCatalog());
    expect(rows[0]!.text).toContain('applied');
    expect(rows[1]!.text).toContain('refreshed');
    expect(rows[2]!.text).toContain('replaced');
    for (const r of rows) expect(r.text).not.toContain('failed');
  });

  it('formats system_apply_status as failure for `resisted`/`rejected`/`missed`', () => {
    const log: Action[] = [
      {
        ...env({ sequenceNumber: 1, source: 'system' }),
        type: 'system_apply_status',
        payload: { targetId: unitId('u1'), statusTypeId: statusTypeId('poison'), sourceUnitId: null },
        outcome: {
          kind: 'system_apply_status',
          targetId: unitId('u1'),
          statusTypeId: statusTypeId('poison'),
          result: { kind: 'resisted' },
        },
      },
      {
        ...env({ sequenceNumber: 2, source: 'system' }),
        type: 'system_apply_status',
        payload: { targetId: unitId('u1'), statusTypeId: statusTypeId('poison'), sourceUnitId: null },
        outcome: {
          kind: 'system_apply_status',
          targetId: unitId('u1'),
          statusTypeId: statusTypeId('poison'),
          result: { kind: 'rejected', reason: 'stacking_rule' },
        },
      },
      {
        ...env({ sequenceNumber: 3, source: 'system' }),
        type: 'system_apply_status',
        payload: { targetId: unitId('u1'), statusTypeId: statusTypeId('poison'), sourceUnitId: null },
        outcome: {
          kind: 'system_apply_status',
          targetId: unitId('u1'),
          statusTypeId: statusTypeId('poison'),
          result: { kind: 'missed', chance: 0.6, roll: 0.9 },
        },
      },
    ];
    const rows = formatActionLog(log, makeBaseState(), emptyCatalog());
    expect(rows[0]!.text).toContain('resisted');
    expect(rows[1]!.text).toContain('rejected');
    expect(rows[2]!.text).toContain('missed');
  });

  it('counts use_ability per-target status applications correctly', () => {
    // Regression test: prior to the fix, `formatTargetResult` read
    // `s.applied` (also undefined) and always counted 0 statuses applied.
    const baseStatus = {
      typeId: statusTypeId('burn'),
      source: { unitId: null, actionSeq: null },
      remainingDuration: null,
      stacks: 1,
    };
    const log: Action[] = [
      {
        ...env({ sequenceNumber: 1, actorId: unitId('u1') }),
        type: 'use_ability',
        payload: { abilityId: abilityId('spark'), target: { kind: 'unit', unitId: unitId('u1') } },
        outcome: {
          kind: 'use_ability',
          abilityId: abilityId('spark'),
          mpSpent: 0,
          perTargetResults: [
            {
              target: { kind: 'unit', unitId: unitId('u1') },
              hit: true,
              statusesApplied: [
                { kind: 'applied', instance: baseStatus },
                { kind: 'stacked', mode: 'additive', instance: baseStatus },
              ],
            },
          ],
        },
      },
    ];
    const rows = formatActionLog(log, makeBaseState(), emptyCatalog());
    expect(rows[0]!.text).toContain('status ×2');
    expect(rows[0]!.text).not.toContain('resisted');
  });

  it('emits charged_action_resolve as a top-level T-number row', () => {
    // Regression test: previously charged resolves rendered as indented
    // [charged] sub-rows binned under the previous turn's T-number.
    const log: Action[] = [
      {
        ...env({ sequenceNumber: 1, actorId: unitId('u1') }),
        type: 'turn_start',
        payload: { unitId: unitId('u1') },
      },
      {
        ...env({ sequenceNumber: 2, source: 'system' }),
        type: 'charged_action_resolve',
        payload: {
          chargedActionId: 'ca-1' as unknown as import('@engine/index.ts').ChargedActionId,
        },
        outcome: {
          kind: 'charged_action_resolve',
          chargedActionId: 'ca-1' as unknown as import('@engine/index.ts').ChargedActionId,
          perTargetResults: [],
        },
      },
    ];
    const rows = formatActionLog(log, makeBaseState(), emptyCatalog());
    expect(rows.map((r) => r.tag)).toEqual(['T0001', 'T0002']);
    expect(rows[1]!.indent).toBe(false);
    expect(rows[1]!.tagKind).toBe('turn');
  });

  it('tags unit-name segments with the unit team for team-coloring (ADR-0051)', () => {
    const blueAttacker = makeUnit({ id: 'blue1', spd: 10, team: 'team_a' });
    const redTarget = makeUnit({ id: 'red1', spd: 10, team: 'team_b' });
    const state = makeGameState({
      units: [blueAttacker, redTarget],
      map: flatMap(3, 3),
      turnState: activeTurnFor(blueAttacker.id),
    });
    const log: Action[] = [
      {
        ...env({ sequenceNumber: 1, actorId: blueAttacker.id }),
        type: 'use_ability',
        payload: { abilityId: abilityId('attack'), target: { kind: 'unit', unitId: redTarget.id } },
        outcome: {
          kind: 'use_ability',
          abilityId: abilityId('attack'),
          mpSpent: 0,
          perTargetResults: [{ target: { kind: 'unit', unitId: redTarget.id }, hit: true, damage: 10 }],
        },
      },
    ];
    const rows = formatActionLog(log, state, emptyCatalog());
    expect(rows).toHaveLength(1);
    const segs = rows[0]!.segments;
    // Actor segment is the blue unit's name with team_a tag.
    const actorSeg = segs.find((s) => s.text === blueAttacker.name);
    expect(actorSeg?.team).toBe('team_a');
    // Target segment is the red unit's name with team_b tag.
    const targetSeg = segs.find((s) => s.text === redTarget.name);
    expect(targetSeg?.team).toBe('team_b');
    // Plain text segments carry no team field.
    const plainSeg = segs.find((s) => s.text.includes(' → '));
    expect(plainSeg?.team).toBeUndefined();
  });

  it('charged_action_resolve includes the target (unit name or tile coords) per session 25', () => {
    const blueCaster = makeUnit({ id: 'blue1', spd: 10, team: 'team_a' });
    const redTarget = makeUnit({ id: 'red1', spd: 10, team: 'team_b' });
    const state = makeGameState({
      units: [blueCaster, redTarget],
      map: flatMap(3, 3),
      turnState: activeTurnFor(blueCaster.id),
    });
    // Unit-targeted charged spell: cast → resolve.
    const chargedId = 'ca-unit' as unknown as import('@engine/index.ts').ChargedActionId;
    const log: Action[] = [
      {
        ...env({ sequenceNumber: 1, actorId: blueCaster.id }),
        type: 'use_ability',
        payload: { abilityId: abilityId('earth_strike'), target: { kind: 'unit', unitId: redTarget.id } },
        outcome: {
          kind: 'use_ability',
          abilityId: abilityId('earth_strike'),
          mpSpent: 4,
          perTargetResults: [],
          chargedActionId: chargedId,
        },
      },
      {
        ...env({ sequenceNumber: 2, source: 'system' }),
        type: 'charged_action_resolve',
        payload: { chargedActionId: chargedId },
        outcome: { kind: 'charged_action_resolve', chargedActionId: chargedId, perTargetResults: [] },
      },
    ];
    const rows = formatActionLog(log, state, emptyCatalog());
    // Two rows: the "began casting" cast row + the resolve row.
    const resolveRow = rows.find((r) => r.tag === 'T0001');
    expect(resolveRow).toBeDefined();
    // The resolve row's flattened text includes "on <redTarget.name>".
    expect(resolveRow!.text).toContain(`on ${redTarget.name}`);
    // The target unit segment carries its team color.
    const targetSeg = resolveRow!.segments.find((s) => s.text === redTarget.name);
    expect(targetSeg?.team).toBe('team_b');
  });

  it('charged_action_resolve on a tile renders (x, y) coords (no unit segment)', () => {
    const blueCaster = makeUnit({ id: 'blue1', spd: 10, team: 'team_a' });
    const state = makeGameState({
      units: [blueCaster],
      map: flatMap(5, 5),
      turnState: activeTurnFor(blueCaster.id),
    });
    const chargedId = 'ca-tile' as unknown as import('@engine/index.ts').ChargedActionId;
    const log: Action[] = [
      {
        ...env({ sequenceNumber: 1, actorId: blueCaster.id }),
        type: 'use_ability',
        payload: {
          abilityId: abilityId('bolt'),
          target: { kind: 'tile', position: { x: 3, y: 4, layer: 0 } },
        },
        outcome: {
          kind: 'use_ability',
          abilityId: abilityId('bolt'),
          mpSpent: 8,
          perTargetResults: [],
          chargedActionId: chargedId,
        },
      },
      {
        ...env({ sequenceNumber: 2, source: 'system' }),
        type: 'charged_action_resolve',
        payload: { chargedActionId: chargedId },
        outcome: { kind: 'charged_action_resolve', chargedActionId: chargedId, perTargetResults: [] },
      },
    ];
    const rows = formatActionLog(log, state, emptyCatalog());
    const resolveRow = rows.find((r) => r.tag === 'T0001');
    expect(resolveRow).toBeDefined();
    expect(resolveRow!.text).toContain('on (3, 4)');
  });

  it('attaches participants and actionSeq to every emitted row', () => {
    const log: Action[] = [
      {
        ...env({ sequenceNumber: 7, actorId: unitId('u1') }),
        type: 'move',
        payload: { destination: { x: 1, y: 1, layer: 0 } },
      },
    ];
    const rows = formatActionLog(log, makeBaseState(), emptyCatalog());
    expect(rows[0]!.actionSeq).toBe(7);
    expect(rows[0]!.participants.actorId).toBe(unitId('u1'));
  });
});

describe('buildLogView (Session 63 events view)', () => {
  it('groups rows by turn and splits events from the ledger', () => {
    const log: Action[] = [
      {
        ...env({ sequenceNumber: 1, actorId: unitId('u1') }),
        type: 'turn_start',
        payload: { unitId: unitId('u1') },
      },
      {
        ...env({ sequenceNumber: 2, actorId: unitId('u1') }),
        type: 'move',
        payload: { destination: { x: 4, y: 5, layer: 0 } },
      },
      {
        // A non-damaging status countdown — bookkeeping → ledger.
        ...env({ sequenceNumber: 3, source: 'system' }),
        type: 'status_tick',
        payload: { unitId: unitId('u1'), statusTypeId: statusTypeId('poison') },
        outcome: {
          kind: 'status_tick',
          unitId: unitId('u1'),
          statusTypeId: statusTypeId('poison'),
          removed: false,
        },
      },
    ];
    const view = buildLogView(log, makeBaseState(), emptyCatalog());
    expect(view.groups).toHaveLength(1);
    const g = view.groups[0]!;
    expect(g.tLabel).toBe('T0001');
    expect(g.events).toHaveLength(1);
    expect(g.events[0]!.text).toContain('(4, 5)');
    expect(g.events[0]!.icon).toBe('arrow');
    expect(g.ledger).toHaveLength(1);
    expect(g.ledger[0]!.text).toContain('ticked');
  });

  it('renders a damaging status tick as one Burn event; the bare tick lands in the ledger', () => {
    const victim = makeUnit({ id: 'victim', spd: 10, maxHpBase: 100 });
    const state = makeGameState({
      units: [victim],
      map: flatMap(3, 3),
      turnState: activeTurnFor(victim.id),
    });
    const log: Action[] = [
      {
        ...env({ sequenceNumber: 1, actorId: victim.id }),
        type: 'turn_start',
        payload: { unitId: victim.id },
      },
      {
        ...env({ sequenceNumber: 2, source: 'system' }),
        type: 'status_tick',
        payload: { unitId: victim.id, statusTypeId: statusTypeId('burn') },
        outcome: {
          kind: 'status_tick',
          unitId: victim.id,
          statusTypeId: statusTypeId('burn'),
          removed: false,
        },
      },
      {
        ...env({ sequenceNumber: 3, source: 'system' }),
        type: 'system_damage',
        payload: {
          targetId: victim.id,
          amount: 9,
          source: { kind: 'status_tick', statusTypeId: statusTypeId('burn'), unitId: victim.id },
          tags: [],
        },
        outcome: {
          kind: 'system_damage',
          targetId: victim.id,
          amount: 9,
          applied: 9,
          hpAfter: 60,
        },
      },
    ];
    const view = buildLogView(log, state, emptyCatalog());
    const g = view.groups[0]!;
    // One Burn DoT event (flame), text "burn → victim 9".
    const burn = g.events.find((e) => e.icon === 'flame');
    expect(burn).toBeDefined();
    expect(burn!.text).toContain('→');
    expect(burn!.text).toContain('9');
    // The bare "ticked" row is demoted to the ledger.
    expect(g.events.some((e) => e.text.includes('ticked'))).toBe(false);
    expect(g.ledger.some((e) => e.text.includes('ticked'))).toBe(true);
  });

  it('folds a KO into its killing-blow row (emphasis + marker), dropping the standalone [ko] row', () => {
    const killer = makeUnit({ id: 'killer', spd: 10, maxHpBase: 100 });
    const victim = makeUnit({ id: 'victim', spd: 10, maxHpBase: 100 });
    const state = makeGameState({
      units: [killer, victim],
      map: flatMap(3, 3),
      turnState: activeTurnFor(killer.id),
    });
    const log: Action[] = [
      {
        ...env({ sequenceNumber: 1, actorId: killer.id }),
        type: 'turn_start',
        payload: { unitId: killer.id },
      },
      {
        ...env({ sequenceNumber: 2, actorId: killer.id }),
        type: 'use_ability',
        payload: { abilityId: abilityId('strike'), target: { kind: 'unit', unitId: victim.id } },
        outcome: {
          kind: 'use_ability',
          abilityId: abilityId('strike'),
          mpSpent: 0,
          perTargetResults: [
            { target: { kind: 'unit', unitId: victim.id }, hit: true, damage: 181, hpAfter: 0 },
          ],
        },
      },
    ];
    const g = buildLogView(log, state, emptyCatalog()).groups[0]!;
    // No standalone [ko] row survives; the attack row carries it.
    expect(g.events.some((e) => e.tagKind === 'ko')).toBe(false);
    const blow = g.events.find((e) => e.text.includes('181'));
    expect(blow).toBeDefined();
    expect(blow!.emphasis).toBe(true);
    expect(blow!.text).toContain('KO');
  });

  it('keeps a system-dealt KO (Burn tick) as a standalone skull event', () => {
    const victim = makeUnit({ id: 'victim', spd: 10, maxHpBase: 100 });
    const state = makeGameState({
      units: [victim],
      map: flatMap(3, 3),
      turnState: activeTurnFor(victim.id),
    });
    const log: Action[] = [
      {
        ...env({ sequenceNumber: 1, actorId: victim.id }),
        type: 'turn_start',
        payload: { unitId: victim.id },
      },
      {
        ...env({ sequenceNumber: 2, source: 'system' }),
        type: 'system_damage',
        payload: {
          targetId: victim.id,
          amount: 120,
          source: { kind: 'status_tick', statusTypeId: statusTypeId('burn'), unitId: victim.id },
          tags: [],
        },
        outcome: {
          kind: 'system_damage',
          targetId: victim.id,
          amount: 120,
          applied: 120,
          hpAfter: 0,
        },
      },
    ];
    const g = buildLogView(log, state, emptyCatalog()).groups[0]!;
    // The Burn damage event + a standalone skull KO event (not folded into
    // the system row).
    expect(g.events.some((e) => e.icon === 'flame')).toBe(true);
    expect(g.events.some((e) => e.tagKind === 'ko' && e.icon === 'skull')).toBe(true);
  });

  it('routes battle_end to the outro and pre-first-turn rows to the preamble', () => {
    const log: Action[] = [
      {
        // Pre-battle init grant — before any turn → preamble (state).
        ...env({ sequenceNumber: 1, source: 'system' }),
        type: 'status_tick',
        payload: { unitId: unitId('u1'), statusTypeId: statusTypeId('regen') },
        outcome: {
          kind: 'status_tick',
          unitId: unitId('u1'),
          statusTypeId: statusTypeId('regen'),
          removed: false,
        },
      },
      {
        ...env({ sequenceNumber: 2, actorId: unitId('u1') }),
        type: 'turn_start',
        payload: { unitId: unitId('u1') },
      },
      {
        ...env({ sequenceNumber: 3, source: 'system' }),
        type: 'battle_end',
        payload: { winner: teamId('team_a'), conditionIndex: 0 },
        outcome: {
          kind: 'battle_end',
          winner: teamId('team_a'),
          conditionIndex: 0,
          description: 'all enemies KO',
        },
      },
    ];
    const view = buildLogView(log, makeBaseState(), emptyCatalog());
    expect(view.preamble).toHaveLength(1);
    expect(view.groups).toHaveLength(1);
    expect(view.outro).toHaveLength(1);
    expect(view.outro[0]!.icon).toBe('trophy');
    expect(view.outro[0]!.text).toContain('team_a wins');
  });

  it('routes a failed status application (a non-firing reaction) to the ledger; a landing stays an event', () => {
    const log: Action[] = [
      {
        ...env({ sequenceNumber: 1, actorId: unitId('u1') }),
        type: 'turn_start',
        payload: { unitId: unitId('u1') },
      },
      {
        // A reaction that didn't fire — "Updraft rejected on u1".
        ...env({ sequenceNumber: 2, source: 'system' }),
        type: 'system_apply_status',
        payload: { targetId: unitId('u1'), statusTypeId: statusTypeId('updraft'), sourceUnitId: null },
        outcome: {
          kind: 'system_apply_status',
          targetId: unitId('u1'),
          statusTypeId: statusTypeId('updraft'),
          result: { kind: 'rejected', reason: 'stacking_rule' },
        },
      },
      {
        // A status that actually landed — a tactical event.
        ...env({ sequenceNumber: 3, source: 'system' }),
        type: 'system_apply_status',
        payload: { targetId: unitId('u1'), statusTypeId: statusTypeId('burn'), sourceUnitId: null },
        outcome: {
          kind: 'system_apply_status',
          targetId: unitId('u1'),
          statusTypeId: statusTypeId('burn'),
          result: { kind: 'applied', instance: makeStatusInstance({ typeId: 'burn' }) },
        },
      },
    ];
    const g = buildLogView(log, makeBaseState(), emptyCatalog()).groups[0]!;
    // The rejected reaction is bookkeeping → ledger, not a top-line event.
    expect(g.ledger.some((e) => e.text.includes('rejected'))).toBe(true);
    expect(g.events.some((e) => e.text.includes('rejected'))).toBe(false);
    // The landed status is a flame event.
    expect(g.events.some((e) => e.icon === 'flame')).toBe(true);
  });
});
