// Session 62 — Raise (the Templar's spell revival), end-to-end through the
// charged-action lifecycle. Raise is `effects.removeKO` + a healing
// `damage` effect (power 10): resolving it against a KO'd ally revives the
// unit (HP 0 → 1, turnsKOd → 0, CT → 0) and then heals MA × 10 × faith on
// top — per ADR-0099. Mirrors the consumable Phoenix Down path, but as an
// MA/faith-scaled spell.
//
// The revive lives in `resolveAbilityEffect` (before the damage pipeline),
// so it runs identically for instant and charged casts; Raise is charged
// (actionSpeed 30), so these tests drive the scheduler to the
// `charged_action_resolve` event, the real cast path.

import { describe, expect, it } from 'vitest';
import { createCatalog, type StatusEffectType } from '../catalog/index.ts';
import {
  DEFAULT_TEST_DAMAGE_PIPELINE,
  makeTestRuleset,
} from '../catalog/test-fixtures.ts';
import { makeGameState, makeUnit } from '../ct/test-fixtures.ts';
import { advanceToNextEvent } from '../turn/scheduler.ts';
import { flatMap } from '../map/test-fixtures.ts';
import { ACTIVE_BUCKET_IDS, PASSIVE_BUCKET_IDS } from '../abilities/constants.ts';
import {
  abilityId,
  bucketId,
  classId,
  commandSetId,
  statusHook,
  statusTypeId,
  unitId,
  type AbilityId,
  type ClassDefinition,
  type Loadout,
  type ProposedAction,
} from '@engine/index.ts';
import { commitAction } from './commit.ts';
import type { GameState } from '../types/index.ts';
import { raise } from '../../content/abilities/raise.ts';

// --- Fixtures (mirrors charged-action-integration.test.ts) ---

function knightClass(): ClassDefinition {
  return {
    id: classId('knight'),
    name: 'Knight',
    movement: { moveRange: 3, jump: 2, terrainCosts: new Map(), canEnter: new Set(['ground']) },
    evasion: { front: 0, side: 0, back: 0 },
    firstActionCommandSet: commandSetId('white_magic'),
    freeAbilities: new Set(),
    equipmentSlots: { leftHand: true, rightHand: true, headgear: true, armor: true, accessory: true },
    dominantStat: 'ma',
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

function loadoutFirstAction(set: string): Loadout {
  const actionBuckets: Record<string, ReadonlyArray<ReturnType<typeof commandSetId>>> = {};
  for (const b of ACTIVE_BUCKET_IDS) actionBuckets[b] = [];
  actionBuckets[bucketId('first_action')] = [commandSetId(set)];
  const passiveBuckets: Record<string, ReadonlyArray<AbilityId>> = {};
  for (const b of PASSIVE_BUCKET_IDS) passiveBuckets[b] = [];
  return { actionBuckets, passiveBuckets };
}

function turnFor(id: string) {
  return {
    unitId: unitId(id),
    budget: { movesAvailable: 1, actsAvailable: 1 },
    consumed: { movesConsumed: 0, actsConsumed: 0 },
    reactionsUsedThisTurn: new Map(),
  };
}

function makeCatalog() {
  return createCatalog({
    statusTypes: [chargingType()],
    abilities: [raise],
    commandSets: [
      {
        id: commandSetId('white_magic'),
        name: 'White Magic',
        members: [abilityId('raise')],
        baseCost: 1,
        availability: 'hidden',
      },
    ],
    classes: [knightClass()],
    items: [],
    rulesets: [makeTestRuleset({ damagePipelineStages: DEFAULT_TEST_DAMAGE_PIPELINE })],
  });
}

// Drives the scheduler from `s` until a charged_action_resolve event,
// commits it, and returns the resulting state.
function resolveCharge(s0: GameState, cat: ReturnType<typeof makeCatalog>): GameState {
  let s = s0;
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
    if (!r.ok) return s;
    s = r.newState;
  }
  expect(resolveProposed).not.toBeNull();
  const r = commitAction(s, resolveProposed!, cat);
  expect(r.ok).toBe(true);
  if (!r.ok) return s;
  return r.newState;
}

// --- Tests ---

describe('Raise — charged revive end-to-end', () => {
  it('revives a KO\'d ally and heals MA × 10 × faith on top', () => {
    const cat = makeCatalog();
    const healer = makeUnit({
      id: 'healer', spd: 10, ma: 6, mp: 30, faith: 80,
      loadout: loadoutFirstAction('white_magic'),
      position: { x: 0, y: 0, layer: 0 },
    });
    const koAlly = makeUnit({
      id: 'ally', team: 'team_a', spd: 10, faith: 80,
      hp: 0, maxHpBase: 100, turnsKOd: 1,
      position: { x: 1, y: 0, layer: 0 },
    });
    // A live enemy keeps the battle open while the charge resolves.
    const enemy = makeUnit({
      id: 'enemy', team: 'team_b', spd: 10, hp: 60, maxHpBase: 60,
      position: { x: 4, y: 4, layer: 0 },
    });
    let s = makeGameState({
      units: [healer, koAlly, enemy],
      map: flatMap(6, 6),
      turnState: turnFor('healer'),
    });

    // Cast Raise on the KO'd ally → spawns a ChargedAction.
    const cast = commitAction(s, {
      type: 'use_ability', source: 'player', actorId: healer.id,
      payload: { abilityId: abilityId('raise'), target: { kind: 'unit', unitId: koAlly.id } },
    }, cat);
    expect(cast.ok).toBe(true);
    if (!cast.ok) return;
    s = cast.newState;
    expect(s.chargedActions).toHaveLength(1);
    // Still KO'd while charging — the revive lands at resolution, not cast.
    expect(s.units.get(koAlly.id)!.vitals.hp).toBe(0);

    // End the healer's turn so the scheduler can advance the charge.
    const ended = commitAction(s, { type: 'turn_end', source: 'system', payload: { unitId: healer.id } }, cat);
    expect(ended.ok).toBe(true);
    if (!ended.ok) return;
    s = resolveCharge(ended.newState, cat);

    const revived = s.units.get(koAlly.id)!;
    expect(revived.vitals.hp).toBeGreaterThan(1); // revived (1) + the heal
    expect(revived.removed).toBe(false);
    expect(revived.turnsKOd).toBe(0); // reset on revive
    // Heal band: 1 + MA 6 × 10 × faith 0.64 × variance [0.95, 1.05]
    // = 1 + [36.5, 40.3] → [37, 41].
    expect(revived.vitals.hp).toBeGreaterThanOrEqual(37);
    expect(revived.vitals.hp).toBeLessThanOrEqual(41);
    // Charge cleaned up.
    expect(s.chargedActions).toHaveLength(0);
  });

  it('rejects a non-KO\'d target — Raise is KO-only (amends ADR-0099)', () => {
    // Playtest change (Chris): Raise no longer doubles as a heal on a living
    // ally, so the AI can't mis-cast it as a healing spell. Casting on a
    // living ally now fails validation rather than landing as a heal.
    const cat = makeCatalog();
    const healer = makeUnit({
      id: 'healer', spd: 10, ma: 6, mp: 30, faith: 80,
      loadout: loadoutFirstAction('white_magic'),
      position: { x: 0, y: 0, layer: 0 },
    });
    const woundedAlly = makeUnit({
      id: 'ally', team: 'team_a', spd: 10, faith: 80,
      hp: 10, maxHpBase: 100,
      position: { x: 1, y: 0, layer: 0 },
    });
    const enemy = makeUnit({
      id: 'enemy', team: 'team_b', spd: 10, hp: 60, maxHpBase: 60,
      position: { x: 4, y: 4, layer: 0 },
    });
    const s = makeGameState({
      units: [healer, woundedAlly, enemy],
      map: flatMap(6, 6),
      turnState: turnFor('healer'),
    });
    const cast = commitAction(s, {
      type: 'use_ability', source: 'player', actorId: healer.id,
      payload: { abilityId: abilityId('raise'), target: { kind: 'unit', unitId: woundedAlly.id } },
    }, cat);
    expect(cast.ok).toBe(false);
  });
});
