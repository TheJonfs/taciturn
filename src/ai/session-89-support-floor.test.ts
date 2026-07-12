// Session 89 — the support-competency floor: Raise, Esuna, Jump.
//
//   - Raise (Templar): the long-standing "AI never casts an ability revive"
//     exclusion is lifted — `effects.removeKO` abilities are valued exactly
//     like the Alchemist's Phoenix Down (`maxHpBase × REVIVE_WEIGHT`).
//   - Esuna (Enchanter): `effects.cleanse` abilities are valued in Remedy's
//     currency (CLEANSE_VALUE_PER_DEBUFF per cleansable debuff) summed over
//     the AoE footprint, with enemies caught in the diamond deducted.
//   - Jump (Templar): no new machinery — it rides the S74 charged tile-pin
//     branch. The scenario pins that this actually holds: a perch-camper
//     beyond melee's vertical reach is answered by Jump's V6.

import { describe, expect, it } from 'vitest';
import {
  abilityId,
  bucketId,
  commandSetId,
  statusTypeId,
  teamId,
  type Position,
  type StatusInstance,
  type Tile,
  type Unit,
} from '@engine/index.ts';
import { loadDefaultCatalog } from '../content/index.ts';
import { longSword } from '../content/items/long-sword.ts';
import { activeTurnFor, makeGameState, makeUnit } from '../engine/ct/test-fixtures.ts';
import { decideBasicAi, _basicAiInternals } from './basic.ts';

const FIRST = bucketId('first_action');
const RAISE = abilityId('raise');
const ESUNA = abilityId('esuna');
const JUMP = abilityId('jump');
const POISON = statusTypeId('poison');
const TEAM_A = teamId('team_a');
const TEAM_B = teamId('team_b');
const TEAMS = [
  { id: TEAM_A, name: 'A', control: 'human' as const },
  { id: TEAM_B, name: 'B', control: 'ai' as const },
];

function gridMap(width: number, height: number, elevAt: (x: number, y: number) => number): {
  width: number; height: number; tiles: Tile[];
} {
  const tiles: Tile[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      tiles.push({ x, y, layer: 0, elevation: elevAt(x, y), terrain: 'ground', properties: [] });
    }
  }
  return { width, height, tiles };
}

const flat = (w: number, h: number) => gridMap(w, h, () => 3);

function poisoned(): StatusInstance[] {
  return [{
    typeId: POISON,
    source: { unitId: null, actionSeq: null },
    remainingDuration: 4,
    stacks: 1,
  }];
}

// Drive the one-decision-per-call cadence: apply committed Move legs and
// return the first non-move commit (see session-89-debuff-floor.test.ts).
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

function templar(pos: Position): Unit {
  return makeUnit({
    id: 'tp', team: 'team_a', spd: 10, pa: 7, ma: 8, hp: 60,
    maxMpBase: 40, mp: 40, classId: 'templar', position: pos,
    loadout: { actionBuckets: { [FIRST]: [commandSetId('templar_arts')] }, passiveBuckets: {} },
    equipment: { leftHand: null, rightHand: longSword.id, headgear: null, armor: null, accessory: null },
  });
}

describe('S89 — Raise: the Templar picks up a downed ally', () => {
  function setup(allyHp: number) {
    const cat = loadDefaultCatalog();
    const actor = templar({ x: 1, y: 1, layer: 0 });
    const downed = makeUnit({
      id: 'aly', team: 'team_a', spd: 10, classId: 'knight',
      maxHpBase: 70, hp: allyHp, position: { x: 3, y: 1, layer: 0 },
    });
    const enemy = makeUnit({
      id: 'foe', team: 'team_b', spd: 10, pa: 6, classId: 'knight',
      maxHpBase: 80, hp: 80, position: { x: 7, y: 7, layer: 0 },
    });
    const state = makeGameState({
      units: [actor, downed, enemy],
      map: flat(9, 9),
      teams: TEAMS,
      turnState: activeTurnFor(actor.id),
    });
    return { cat, state, actor, downed };
  }

  it('bestReviveCandidate values a KO’d ally like a Phoenix Down (maxHp × 1.5)', () => {
    const { cat, state, actor } = setup(0);
    const cand = _basicAiInternals.bestReviveCandidate(state, cat, actor);
    expect(cand).not.toBeNull();
    if (cand === null) throw new Error('expected candidate');
    expect(cand.score).toBeCloseTo(70 * 1.5, 5);
    if (cand.action.type !== 'use_ability') throw new Error('expected use_ability');
    expect(cand.action.payload.abilityId).toEqual(RAISE);
  });

  it('decideBasicAi commits Raise over chasing the distant enemy', () => {
    const { cat, state } = setup(0);
    const d = driveToAbility(state, cat, 'tp');
    expect(d.kind).toBe('commit');
    if (d.kind !== 'commit' || d.action.type !== 'use_ability') throw new Error('expected use_ability');
    expect(d.action.payload.abilityId).toEqual(RAISE);
    const t = d.action.payload.target;
    if (t.kind === 'unit') expect(t.unitId).toEqual('aly');
  });

  it('never proposes Raise on a living ally', () => {
    const { cat, state, actor } = setup(35); // wounded but alive
    const cand = _basicAiInternals.bestReviveCandidate(state, cat, actor);
    expect(cand).toBeNull();
  });
});

describe('S89 — Esuna: the Enchanter cleanses the debuffed cluster', () => {
  function setup(opts: { debuffed: boolean }) {
    const cat = loadDefaultCatalog();
    const actor = makeUnit({
      id: 'en', team: 'team_a', spd: 10, ma: 8, hp: 50,
      maxMpBase: 40, mp: 40, classId: 'enchanter', position: { x: 2, y: 2, layer: 0 },
      loadout: { actionBuckets: { [FIRST]: [commandSetId('auramancy')] }, passiveBuckets: {} },
    });
    const mk = (id: string, pos: Position): Unit => {
      const u = makeUnit({
        id, team: 'team_a', spd: 10, classId: 'knight',
        maxHpBase: 70, hp: 70, position: pos,
      });
      return opts.debuffed ? { ...u, statuses: poisoned() } : u;
    };
    // Two debuffed allies adjacent to each other — one Esuna diamond covers both.
    const a1 = mk('a1', { x: 4, y: 2, layer: 0 });
    const a2 = mk('a2', { x: 5, y: 2, layer: 0 });
    const enemy = makeUnit({
      id: 'foe', team: 'team_b', spd: 10, pa: 6, classId: 'knight',
      maxHpBase: 80, hp: 80, position: { x: 8, y: 8, layer: 0 },
    });
    const state = makeGameState({
      units: [actor, a1, a2, enemy],
      map: flat(9, 9),
      teams: TEAMS,
      turnState: activeTurnFor(actor.id),
    });
    return { cat, state, actor };
  }

  it('bestCleanseCandidate covers both debuffed allies with one diamond', () => {
    const { cat, state, actor } = setup({ debuffed: true });
    const allies = [actor, state.units.get('a1' as Unit['id'])!, state.units.get('a2' as Unit['id'])!];
    const enemies = [state.units.get('foe' as Unit['id'])!];
    const cand = _basicAiInternals.bestCleanseCandidate(state, cat, actor, allies, enemies);
    expect(cand).not.toBeNull();
    if (cand === null) throw new Error('expected candidate');
    if (cand.action.type !== 'use_ability') throw new Error('expected use_ability');
    expect(cand.action.payload.abilityId).toEqual(ESUNA);
    // Two cleansable debuffs × 15 = 30, minus a negligible MP term.
    expect(cand.score).toBeGreaterThan(25);
  });

  it('decideBasicAi commits Esuna when the team is debuffed', () => {
    const { cat, state } = setup({ debuffed: true });
    const d = driveToAbility(state, cat, 'en');
    expect(d.kind).toBe('commit');
    if (d.kind !== 'commit' || d.action.type !== 'use_ability') throw new Error('expected use_ability');
    expect(d.action.payload.abilityId).toEqual(ESUNA);
  });

  it('never casts Esuna on a clean team', () => {
    const { cat, state, actor } = setup({ debuffed: false });
    const allies = [actor, state.units.get('a1' as Unit['id'])!, state.units.get('a2' as Unit['id'])!];
    const enemies = [state.units.get('foe' as Unit['id'])!];
    const cand = _basicAiInternals.bestCleanseCandidate(state, cat, actor, allies, enemies);
    expect(cand).toBeNull();
  });
});

describe('S89 — Jump rides the charged tile-pin branch (pinning test)', () => {
  it('a Templar answers a perch-camper beyond melee’s vertical reach with Jump', () => {
    const cat = loadDefaultCatalog();
    const actor = templar({ x: 1, y: 1, layer: 0 });
    // Percher on an elev-9 pillar: melee vertical 3 can't touch it and the
    // pillar is unclimbable, but Jump's V6 (from elev 3) reaches.
    const percher = makeUnit({
      id: 'foe', team: 'team_b', spd: 10, pa: 6, classId: 'hunter',
      maxHpBase: 60, hp: 60, position: { x: 4, y: 1, layer: 0 },
    });
    const state = makeGameState({
      units: [actor, percher],
      map: gridMap(8, 8, (x, y) => (x === 4 && y === 1 ? 9 : 3)),
      teams: TEAMS,
      turnState: activeTurnFor(actor.id),
    });
    const d = driveToAbility(state, cat, 'tp', 5);
    expect(d.kind).toBe('commit');
    if (d.kind !== 'commit' || d.action.type !== 'use_ability') throw new Error('expected use_ability');
    expect(d.action.payload.abilityId).toEqual(JUMP);
    const t = d.action.payload.target;
    expect(t.kind).toBe('tile');
    if (t.kind === 'tile') expect({ x: t.position.x, y: t.position.y }).toEqual({ x: 4, y: 1 });
  });
});
