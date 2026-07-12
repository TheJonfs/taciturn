// Session 89 — the debuff-valuation floor.
//
// Damage-less status appliers (the Assassin's whole Shadow Arts kit, Brine,
// Spark, Pin Down, Earth Curse) were previously mis-scored through the
// Magnetic-Mark Vulnerable proxy with land chance ignored — so the Assassin
// mostly basic-attacked past its own class identity. Now each debuff reads
// its content-declared floor value (`StatusEffectType.aiHints.value`) × the
// engine's real land chance (`computeStatusChance`) × the target's HP ratio.
//
// Layers:
//   1. `scoreSingleUnitOffensive` — value × chance × hpRatio; 0 when the
//      target already carries the status; Vulnerable keeps its setup math.
//   2. `decideBasicAi` — an unarmed Assassin beside a healthy enemy opens
//      with Shadow Stitch (Stop); it re-picks a different play against an
//      already-Stopped target; it finishes a near-dead enemy with a weapon
//      instead of debuffing it.

import { describe, expect, it } from 'vitest';
import {
  abilityId,
  bucketId,
  commandSetId,
  computeStatusChance,
  statusTypeId,
  teamId,
  type Position,
  type Tile,
  type Unit,
} from '@engine/index.ts';
import { loadDefaultCatalog } from '../content/index.ts';
import { shadowStitch } from '../content/abilities/shadow-stitch.ts';
import { longSword } from '../content/items/long-sword.ts';
import { activeTurnFor, makeGameState, makeUnit } from '../engine/ct/test-fixtures.ts';
import { decideBasicAi, _basicAiInternals } from './basic.ts';

const FIRST = bucketId('first_action');
const SHADOW_STITCH = abilityId('shadow_stitch');
const STOP = statusTypeId('stop');
const TEAM_A = teamId('team_a');
const TEAM_B = teamId('team_b');
const TEAMS = [
  { id: TEAM_A, name: 'A', control: 'human' as const },
  { id: TEAM_B, name: 'B', control: 'ai' as const },
];

function flatMap(width: number, height: number): { width: number; height: number; tiles: Tile[] } {
  const tiles: Tile[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      tiles.push({ x, y, layer: 0, elevation: 3, terrain: 'ground', properties: [] });
    }
  }
  return { width, height, tiles };
}

function assassin(pos: Position, opts: { weapon?: boolean } = {}): Unit {
  return makeUnit({
    id: 'asn',
    team: 'team_a',
    spd: 14,
    pa: 8,
    hp: 50,
    maxMpBase: 30,
    mp: 30,
    classId: 'assassin',
    position: pos,
    loadout: { actionBuckets: { [FIRST]: [commandSetId('shadow_arts')] }, passiveBuckets: {} },
    ...(opts.weapon === true
      ? { equipment: { leftHand: null, rightHand: longSword.id, headgear: null, armor: null, accessory: null } }
      : {}),
  });
}

function foe(pos: Position, opts: { hp?: number; statuses?: Unit['statuses'] } = {}): Unit {
  const u = makeUnit({
    id: 'foe', team: 'team_b', spd: 10, pa: 6, classId: 'knight',
    maxHpBase: 80, hp: opts.hp ?? 80, position: pos,
  });
  return opts.statuses !== undefined ? { ...u, statuses: opts.statuses } : u;
}

function battle(actor: Unit, enemy: Unit) {
  const cat = loadDefaultCatalog();
  const state = makeGameState({
    units: [actor, enemy],
    map: flatMap(8, 8),
    teams: TEAMS,
    turnState: activeTurnFor(actor.id),
  });
  return { cat, state };
}

// Drive the AI's one-decision-per-call cadence: when it commits the Move leg
// of a Move+Act plan (e.g. kiting back to max range before a stitch), apply
// the reposition and ask again, returning the first non-move commit. The
// budget isn't decremented — the AI's own plan converges (it moves at most
// once toward the tile it already chose), and maxSteps guards regressions.
function driveToAbility(
  state: ReturnType<typeof makeGameState>,
  cat: ReturnType<typeof loadDefaultCatalog>,
  actorId: string,
  maxSteps = 3,
): ReturnType<typeof decideBasicAi> {
  let s = state;
  for (let i = 0; i < maxSteps; i++) {
    const d = decideBasicAi(s, cat);
    if (d.kind !== 'commit' || d.action.type !== 'move') return d;
    const dest = d.action.payload.destination;
    const unit = s.units.get(actorId as Unit['id'])!;
    const units = new Map(s.units);
    units.set(unit.id, { ...unit, position: dest });
    s = { ...s, units };
  }
  throw new Error('AI kept moving past maxSteps — plan did not converge');
}

describe('S89 — scoreSingleUnitOffensive values damage-less debuffs', () => {
  it('scores value × real land chance × hpRatio for a fresh debuff', () => {
    const actor = assassin({ x: 1, y: 1, layer: 0 });
    const enemy = foe({ x: 3, y: 1, layer: 0 });
    const { cat, state } = battle(actor, enemy);
    const score = _basicAiInternals.scoreSingleUnitOffensive(
      state, cat, actor, actor.position, enemy, shadowStitch,
    );
    const spec = shadowStitch.effects.statusEffects![0]!;
    const expectedChance = computeStatusChance({
      state, catalog: cat, caster: actor, target: enemy,
      statusType: cat.getStatusType(STOP), ability: shadowStitch,
      baseChance: spec.baseChance ?? 100,
      ...(spec.factors !== undefined ? { factors: spec.factors } : {}),
    });
    // Stop declares aiHints.value 40; full-HP target → hpRatio 1; full MP →
    // no scarcity penalty.
    expect(score).toBeCloseTo(40 * expectedChance, 10);
    expect(score).toBeGreaterThan(0);
  });

  it('scores 0 against a target already carrying the status', () => {
    const actor = assassin({ x: 1, y: 1, layer: 0 });
    const stopped = foe({ x: 3, y: 1, layer: 0 }, {
      statuses: [{
        typeId: STOP,
        source: { unitId: null, actionSeq: null },
        remainingDuration: 2,
        stacks: 1,
      }],
    });
    const { cat, state } = battle(actor, stopped);
    const score = _basicAiInternals.scoreSingleUnitOffensive(
      state, cat, actor, actor.position, stopped, shadowStitch,
    );
    expect(score).toBe(0);
  });

  it('is worth less on a nearly-dead target (hpRatio down-weight)', () => {
    const actor = assassin({ x: 1, y: 1, layer: 0 });
    const healthy = foe({ x: 3, y: 1, layer: 0 });
    const dying = foe({ x: 3, y: 1, layer: 0 }, { hp: 8 });
    const sHealthy = _basicAiInternals.scoreSingleUnitOffensive(
      battle(actor, healthy).state, loadDefaultCatalog(), actor, actor.position, healthy, shadowStitch,
    );
    const sDying = _basicAiInternals.scoreSingleUnitOffensive(
      battle(actor, dying).state, loadDefaultCatalog(), actor, actor.position, dying, shadowStitch,
    );
    expect(sHealthy).toBeGreaterThan(sDying * 5);
  });
});

describe('S89 — decideBasicAi plays the Assassin kit', () => {
  it('opens with Shadow Stitch (Stop) on a healthy enemy', () => {
    // Unarmed: the basic attack chips ~nothing, so the sensible opener is
    // the ranged Stop — exactly the play the old proxy never surfaced.
    const actor = assassin({ x: 1, y: 1, layer: 0 });
    const enemy = foe({ x: 4, y: 1, layer: 0 });
    const { cat, state } = battle(actor, enemy);
    const d = driveToAbility(state, cat, 'asn');
    expect(d.kind).toBe('commit');
    if (d.kind !== 'commit' || d.action.type !== 'use_ability') throw new Error('expected use_ability');
    expect(d.action.payload.abilityId).toEqual(SHADOW_STITCH);
  });

  it('does not re-stitch an already-Stopped enemy', () => {
    const actor = assassin({ x: 1, y: 1, layer: 0 });
    const stopped = foe({ x: 4, y: 1, layer: 0 }, {
      statuses: [{
        typeId: STOP,
        source: { unitId: null, actionSeq: null },
        remainingDuration: 2,
        stacks: 1,
      }],
    });
    const { cat, state } = battle(actor, stopped);
    const d = decideBasicAi(state, cat);
    if (d.kind === 'commit' && d.action.type === 'use_ability') {
      expect(d.action.payload.abilityId).not.toEqual(SHADOW_STITCH);
    }
  });

  it('finishes a near-dead enemy with the sword instead of debuffing', () => {
    const actor = assassin({ x: 1, y: 1, layer: 0 }, { weapon: true });
    const dying = foe({ x: 2, y: 1, layer: 0 }, { hp: 6 });
    const { cat, state } = battle(actor, dying);
    const d = driveToAbility(state, cat, 'asn');
    expect(d.kind).toBe('commit');
    if (d.kind !== 'commit' || d.action.type !== 'use_ability') throw new Error('expected use_ability');
    expect(d.action.payload.abilityId).not.toEqual(SHADOW_STITCH);
  });
});
