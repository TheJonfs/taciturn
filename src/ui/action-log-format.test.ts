// Tests for action-log formatters. Pure-function coverage per action
// type; we don't exercise the React render layer.

import { describe, expect, it } from 'vitest';
import {
  abilityId,
  classId,
  commandSetId,
  rulesetId,
  statusTypeId,
  teamId,
  unitId,
  type Action,
  type ActionEnvelope,
  type Catalog,
  type GameState,
} from '@engine/index.ts';
import { activeTurnFor, makeGameState, makeUnit } from '../engine/ct/test-fixtures.ts';
import { flatMap } from '../engine/map/test-fixtures.ts';
import { makeAbilitiesCatalog, knightLoadout } from '../engine/abilities/test-fixtures.ts';
import { formatActionLog } from './action-log-format.ts';

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
          perTargetResults: [{ target: { kind: 'unit', unitId: victim.id }, hit: true, damage: 120 }],
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
