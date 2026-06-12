// ADR-0107 — pierce × dual-wield composition.
//
// Before this fix, a basic Attack whose DOMINANT weapon pierces routed the
// whole attack through the AoE/pierce dispatch, which didn't apply the Two
// Weapons multi-swing — so a dual-wielder's off-hand swing was silently
// dropped (one damage instead of two). Now each swing resolves its own
// footprint: the piercing weapon pierces the line, the non-piercing off-hand
// swing hits the primary target.
//
// Reducer-level integration against the real default catalog.

import { describe, expect, it } from 'vitest';
import { loadDefaultCatalog } from '../../content/index.ts';
import { reduceUseAbility } from './reducers.ts';
import { activeTurnFor, makeGameState, makeUnit } from '../ct/test-fixtures.ts';
import { ACTIVE_BUCKET_IDS, PASSIVE_BUCKET_IDS } from '../abilities/constants.ts';
import {
  abilityId,
  bucketId,
  itemId,
  unitId,
  type AbilityId,
  type Action,
  type GameState,
  type Loadout,
  type Unit,
  type UnitEquipment,
} from '@engine/index.ts';

const catalog = loadDefaultCatalog();

function loadoutWithSupport(passives: ReadonlyArray<AbilityId>): Loadout {
  const actionBuckets: Record<string, ReadonlyArray<never>> = {};
  for (const b of ACTIVE_BUCKET_IDS) actionBuckets[b] = [];
  const passiveBuckets: Record<string, ReadonlyArray<AbilityId>> = {};
  for (const b of PASSIVE_BUCKET_IDS) passiveBuckets[b] = [];
  passiveBuckets[bucketId('support')] = passives;
  return { actionBuckets, passiveBuckets } as Loadout;
}

function gameStateWith(units: ReadonlyArray<Unit>): GameState {
  return makeGameState({
    units,
    map: {
      width: 6,
      height: 6,
      tiles: Array.from({ length: 36 }, (_, i) => ({
        x: i % 6,
        y: Math.floor(i / 6),
        layer: 0,
        elevation: 2,
        terrain: 'ground' as const,
        properties: [],
      })),
    },
    turnState: activeTurnFor(units[0]!.id),
  });
}

function attackAction(targetId: ReturnType<typeof unitId>): Extract<Action, { type: 'use_ability' }> {
  return {
    type: 'use_ability',
    sequenceNumber: 1,
    source: 'player',
    timestamp: { tick: 0, ct: 0 },
    seed: 4242,
    chainDepth: 0,
    isReaction: false,
    actorId: unitId('atk'),
    payload: { abilityId: abilityId('attack'), target: { kind: 'unit', unitId: targetId } },
  };
}

function dualWielder(equipment: UnitEquipment): Unit {
  return makeUnit({
    id: 'atk',
    spd: 14,
    pa: 12,
    classId: 'assassin',
    position: { x: 0, y: 0, layer: 0 },
    loadout: loadoutWithSupport([abilityId('two_weapons'), abilityId('monkeygrip')]),
    equipment,
  });
}

const LANCE_RIGHT_DEFENDER_LEFT: UnitEquipment = {
  leftHand: itemId('defender'), // non-piercing knight sword
  rightHand: itemId('lance'), // piercing polearm (dominant)
  headgear: null,
  armor: null,
  accessory: null,
};

describe('ADR-0107 — pierce + dual-wield composition', () => {
  it('both weapons swing: piercing dominant pierces the line, off-hand hits the primary', () => {
    const atk = dualWielder(LANCE_RIGHT_DEFENDER_LEFT);
    // Primary in front (1,0); a second enemy directly behind it (2,0). The
    // Lance (dominant, pierces) hits both; the Defender (off-hand) hits only
    // the primary. Friendly fire is on in v1, so team placement is irrelevant.
    const primary = makeUnit({ id: 'def', spd: 8, hp: 400, maxHpBase: 400, position: { x: 1, y: 0, layer: 0 } });
    const behind = makeUnit({ id: 'behind', spd: 8, hp: 400, maxHpBase: 400, position: { x: 2, y: 0, layer: 0 } });
    const state = gameStateWith([atk, primary, behind]);

    const { outcome } = reduceUseAbility(state, attackAction(primary.id), catalog);
    // 3 hits total: Lance → primary + behind (2), Defender → primary (1).
    expect(outcome.perTargetResults).toHaveLength(3);
    const hitOn = (id: string) =>
      outcome.perTargetResults.filter(
        (r) => r.target.kind === 'unit' && String(r.target.unitId) === id,
      ).length;
    expect(hitOn('def')).toBe(2); // Lance pierce + Defender off-hand
    expect(hitOn('behind')).toBe(1); // Lance pierce only
  });

  it('regression: non-piercing dominant + piercing off-hand still swings twice', () => {
    const atk = dualWielder({
      leftHand: itemId('lance'),
      rightHand: itemId('defender'),
      headgear: null,
      armor: null,
      accessory: null,
    });
    const primary = makeUnit({ id: 'def', spd: 8, hp: 400, maxHpBase: 400, position: { x: 1, y: 0, layer: 0 } });
    const state = gameStateWith([atk, primary]);
    const { outcome } = reduceUseAbility(state, attackAction(primary.id), catalog);
    expect(outcome.perTargetResults.length).toBeGreaterThanOrEqual(2);
  });

  it('regression: a lone piercing weapon (no dual-wield) still pierces once', () => {
    const atk = makeUnit({
      id: 'atk',
      spd: 14,
      pa: 12,
      classId: 'assassin',
      position: { x: 0, y: 0, layer: 0 },
      loadout: loadoutWithSupport([]), // no Two Weapons → single swing
      equipment: {
        leftHand: null,
        rightHand: itemId('lance'),
        headgear: null,
        armor: null,
        accessory: null,
      },
    });
    const primary = makeUnit({ id: 'def', spd: 8, hp: 400, maxHpBase: 400, position: { x: 1, y: 0, layer: 0 } });
    const behind = makeUnit({ id: 'behind', spd: 8, hp: 400, maxHpBase: 400, position: { x: 2, y: 0, layer: 0 } });
    const state = gameStateWith([atk, primary, behind]);
    const { outcome } = reduceUseAbility(state, attackAction(primary.id), catalog);
    // One swing, pierces the line → primary + behind, each once.
    expect(outcome.perTargetResults).toHaveLength(2);
  });
});
