// Tests for derived-events synthesis (KO timeline, per-unit stats,
// action participants).

import { describe, expect, it } from 'vitest';
import {
  abilityId,
  unitId,
  type Action,
} from '@engine/index.ts';
import { makeGameState, makeUnit } from '@engine/ct/test-fixtures.ts';
import {
  deriveActionParticipants,
  deriveKoEvents,
  derivePerUnitStats,
} from './derived-events.ts';

// A skeleton action envelope for tests. Sequence numbers must be unique;
// the walker uses them as the `atSequence` key.
function envelope(seq: number, opts?: { actor?: string }): Pick<
  Action,
  'sequenceNumber' | 'source' | 'actorId' | 'timestamp' | 'seed' | 'chainDepth' | 'isReaction'
> {
  return {
    sequenceNumber: seq,
    source: 'system',
    ...(opts?.actor !== undefined ? { actorId: unitId(opts.actor) } : {}),
    timestamp: { tick: 0, ct: 0 },
    seed: 0,
    chainDepth: 0,
    isReaction: false,
  };
}

describe('deriveKoEvents', () => {
  it('emits a KO event when a use_ability drops a unit from positive HP to zero', () => {
    const aliveUnit = makeUnit({ id: 'killer', spd: 10, maxHpBase: 100 });
    const victim = makeUnit({ id: 'victim', spd: 10, maxHpBase: 100 });
    const state = makeGameState({ units: [aliveUnit, victim] });
    const log: Action[] = [
      {
        ...envelope(1),
        type: 'turn_start',
        payload: { unitId: aliveUnit.id },
      },
      {
        ...envelope(2, { actor: 'killer' }),
        type: 'use_ability',
        payload: { abilityId: abilityId('strike'), target: { kind: 'unit', unitId: victim.id } },
        outcome: {
          kind: 'use_ability',
          abilityId: abilityId('strike'),
          mpSpent: 0,
          perTargetResults: [
            { target: { kind: 'unit', unitId: victim.id }, hit: true, damage: 120 },
          ],
        },
      },
    ];
    const ko = deriveKoEvents(log, state);
    expect(ko).toHaveLength(1);
    expect(ko[0]!.unitId).toBe(victim.id);
    expect(ko[0]!.atSequence).toBe(2);
    expect(ko[0]!.killingActor).toBe(aliveUnit.id);
    expect(ko[0]!.tNumber).toBe(1);
  });

  it('does not double-emit when the same unit takes additional damage post-KO', () => {
    const victim = makeUnit({ id: 'victim', spd: 10, maxHpBase: 100 });
    const state = makeGameState({ units: [victim] });
    const log: Action[] = [
      {
        ...envelope(1, { actor: 'killer' }),
        type: 'use_ability',
        payload: { abilityId: abilityId('a'), target: { kind: 'unit', unitId: victim.id } },
        outcome: {
          kind: 'use_ability',
          abilityId: abilityId('a'),
          mpSpent: 0,
          perTargetResults: [{ target: { kind: 'unit', unitId: victim.id }, hit: true, damage: 120 }],
        },
      },
      {
        ...envelope(2, { actor: 'killer' }),
        type: 'use_ability',
        payload: { abilityId: abilityId('a'), target: { kind: 'unit', unitId: victim.id } },
        outcome: {
          kind: 'use_ability',
          abilityId: abilityId('a'),
          mpSpent: 0,
          perTargetResults: [{ target: { kind: 'unit', unitId: victim.id }, hit: true, damage: 50 }],
        },
      },
    ];
    const ko = deriveKoEvents(log, state);
    expect(ko).toHaveLength(1);
    expect(ko[0]!.atSequence).toBe(1);
  });

  it('attributes a charged_action_resolve KO to the original caster', () => {
    // Charged action resolves are system-emitted with no actorId on the
    // envelope. The walker must look back to the originating use_ability
    // to credit the caster.
    const caster = makeUnit({ id: 'caster', spd: 10, maxHpBase: 100 });
    const victim = makeUnit({ id: 'victim', spd: 10, maxHpBase: 100 });
    const state = makeGameState({ units: [caster, victim] });
    const log: Action[] = [
      {
        ...envelope(1, { actor: 'caster' }),
        type: 'use_ability',
        payload: { abilityId: abilityId('boltspell'), target: { kind: 'unit', unitId: victim.id } },
        outcome: {
          kind: 'use_ability',
          abilityId: abilityId('boltspell'),
          mpSpent: 8,
          perTargetResults: [],
          chargedActionId: 'charge_1' as import('@engine/index.ts').ChargedActionId,
        },
      },
      {
        ...envelope(2), // no actor on resolve, system source
        type: 'charged_action_resolve',
        payload: { chargedActionId: 'charge_1' as import('@engine/index.ts').ChargedActionId },
        outcome: {
          kind: 'charged_action_resolve',
          chargedActionId: 'charge_1' as import('@engine/index.ts').ChargedActionId,
          perTargetResults: [
            { target: { kind: 'unit', unitId: victim.id }, hit: true, damage: 120 },
          ],
        },
      },
    ];
    const ko = deriveKoEvents(log, state);
    expect(ko).toHaveLength(1);
    expect(ko[0]!.killingActor).toBe(caster.id);

    const stats = derivePerUnitStats(log, state);
    expect(stats.get(caster.id)!.damageDealt).toBe(120);
    expect(stats.get(caster.id)!.kosScored).toBe(1);
  });

  it('attributes a system_damage KO with null killingActor', () => {
    const victim = makeUnit({ id: 'victim', spd: 10, maxHpBase: 100 });
    const state = makeGameState({ units: [victim] });
    const log: Action[] = [
      {
        ...envelope(1),
        type: 'system_damage',
        payload: {
          targetId: victim.id,
          amount: 999,
          tags: [],
          source: { kind: 'falling', dropDistance: 9 },
        },
        outcome: {
          kind: 'system_damage',
          targetId: victim.id,
          amount: 999,
          applied: 100,
          source: { kind: 'falling', dropDistance: 9 },
        },
      },
    ];
    const ko = deriveKoEvents(log, state);
    expect(ko).toHaveLength(1);
    expect(ko[0]!.killingActor).toBeNull();
  });

  it('emits no event for misses or non-lethal damage', () => {
    const victim = makeUnit({ id: 'victim', spd: 10, maxHpBase: 100 });
    const state = makeGameState({ units: [victim] });
    const log: Action[] = [
      {
        ...envelope(1, { actor: 'killer' }),
        type: 'use_ability',
        payload: { abilityId: abilityId('a'), target: { kind: 'unit', unitId: victim.id } },
        outcome: {
          kind: 'use_ability',
          abilityId: abilityId('a'),
          mpSpent: 0,
          perTargetResults: [{ target: { kind: 'unit', unitId: victim.id }, hit: true, damage: 50 }],
        },
      },
      {
        ...envelope(2, { actor: 'killer' }),
        type: 'use_ability',
        payload: { abilityId: abilityId('a'), target: { kind: 'unit', unitId: victim.id } },
        outcome: {
          kind: 'use_ability',
          abilityId: abilityId('a'),
          mpSpent: 0,
          perTargetResults: [{ target: { kind: 'unit', unitId: victim.id }, hit: false }],
        },
      },
    ];
    const ko = deriveKoEvents(log, state);
    expect(ko).toHaveLength(0);
  });
});

describe('derivePerUnitStats', () => {
  it('tallies dealt/taken and credits the kosScored to the killing actor', () => {
    const killer = makeUnit({ id: 'killer', spd: 10, maxHpBase: 100 });
    const victim = makeUnit({ id: 'victim', spd: 10, maxHpBase: 100 });
    const state = makeGameState({ units: [killer, victim] });
    const log: Action[] = [
      {
        ...envelope(1, { actor: 'killer' }),
        type: 'use_ability',
        payload: { abilityId: abilityId('a'), target: { kind: 'unit', unitId: victim.id } },
        outcome: {
          kind: 'use_ability',
          abilityId: abilityId('a'),
          mpSpent: 0,
          perTargetResults: [{ target: { kind: 'unit', unitId: victim.id }, hit: true, damage: 120 }],
        },
      },
    ];
    const stats = derivePerUnitStats(log, state);
    expect(stats.get(killer.id)!.damageDealt).toBe(120);
    expect(stats.get(killer.id)!.kosScored).toBe(1);
    expect(stats.get(victim.id)!.damageTaken).toBe(120);
  });

  it('seeds zero entries for units with no log activity', () => {
    const inactive = makeUnit({ id: 'inactive', spd: 10, maxHpBase: 100 });
    const state = makeGameState({ units: [inactive] });
    const stats = derivePerUnitStats([], state);
    expect(stats.get(inactive.id)).toEqual({
      damageDealt: 0,
      damageTaken: 0,
      healingDealt: 0,
      kosScored: 0,
    });
  });
});

describe('deriveActionParticipants', () => {
  it('extracts actor + multi-target IDs from a use_ability AoE outcome', () => {
    const a = unitId('a');
    const b = unitId('b');
    const c = unitId('c');
    const action: Action = {
      ...envelope(1, { actor: 'killer' }),
      type: 'use_ability',
      payload: { abilityId: abilityId('quake'), target: { kind: 'tile', position: { x: 0, y: 0, layer: 0 } } },
      outcome: {
        kind: 'use_ability',
        abilityId: abilityId('quake'),
        mpSpent: 0,
        perTargetResults: [
          { target: { kind: 'unit', unitId: a }, hit: true, damage: 10 },
          { target: { kind: 'unit', unitId: b }, hit: true, damage: 10 },
          { target: { kind: 'unit', unitId: c }, hit: false },
        ],
      },
    };
    const p = deriveActionParticipants(action);
    expect(p.actorId).toBe(unitId('killer'));
    expect(p.targetIds).toEqual([a, b, c]);
  });

  it('returns just the actor for actions without a target (turn_start, wait, move)', () => {
    const action: Action = {
      ...envelope(1, { actor: 'u' }),
      type: 'wait',
      payload: {},
    };
    const p = deriveActionParticipants(action);
    expect(p.actorId).toBe(unitId('u'));
    expect(p.targetIds).toEqual([]);
  });
});
