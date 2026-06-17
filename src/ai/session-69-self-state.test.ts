// Session 69, chunk 1 — self-state: gain a good state. Two previously
// AI-invisible Thief actives become scored candidates in the unified
// currency, both strictly subordinate (the cower discipline): the contest
// land-gate keeps each EV honest and a lethal play still wins.
//
//   - Steal Heart (charm): valued by the action-economy swing — the
//     target's damage-output proxy × charm duration × contest chance.
//   - Steal Buffs: valued by the transfer — stealable-buff count × per-buff
//     value × contest chance; 0 against a bare target.
//
// Layers:
//   1. countStealableBuffs / estimateOffensiveOutput — scoring primitives.
//   2. bestCharmCandidate / bestStealBuffCandidate — the builders decline
//      invalid / worthless targets and fire on worthwhile ones.
//   3. decideBasicAi — acceptance: the AI charms a high-threat target when
//      it's the best play, but never over a lethal finish; it steals buffs
//      off a buffed target but ignores a bare one.

import { describe, expect, it } from 'vitest';
import {
  abilityId,
  bucketId,
  commandSetId,
  teamId,
  type Gender,
  type Loadout,
  type StatusInstance,
  type Tile,
  type Unit,
  type UnitEquipment,
} from '@engine/index.ts';
import { loadDefaultCatalog } from '../content/index.ts';
import { activeTurnFor, makeGameState, makeUnit } from '../engine/ct/test-fixtures.ts';
import { makeStatusInstance } from '../engine/status/test-fixtures.ts';
import { decideBasicAi, _basicAiInternals } from './basic.ts';

const FIRST = bucketId('first_action');
const THIEF_ARTS = commandSetId('thief_arts');
const FIRE_SPELLS = commandSetId('fire_spells');
const STEAL_HEART = abilityId('steal_heart');
const STEAL_BUFFS = abilityId('steal_buffs');
const TEAM_A = teamId('team_a');
const TEAM_B = teamId('team_b');
const TEAMS = [
  { id: TEAM_A, name: 'A', control: 'human' as const },
  { id: TEAM_B, name: 'B', control: 'ai' as const },
];

const cat = loadDefaultCatalog();

function flatGround(width: number, height: number): Tile[] {
  const tiles: Tile[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      tiles.push({ x, y, layer: 0, elevation: 0, terrain: 'ground', properties: [] });
    }
  }
  return tiles;
}

function thiefLoadout(): Loadout {
  return { actionBuckets: { [FIRST]: [THIEF_ARTS] }, passiveBuckets: {} };
}

function mageLoadout(): Loadout {
  return { actionBuckets: { [FIRST]: [FIRE_SPELLS] }, passiveBuckets: {} };
}

const NO_WEAPON: UnitEquipment = {
  leftHand: null, rightHand: null, headgear: null, armor: null, accessory: null,
};

// A single Haste instance (polarity 'buff') — the canonical stealable buff.
function hasteBuff(): StatusInstance {
  return makeStatusInstance({ typeId: 'haste', magnitude: 1.5, remainingDuration: 5 });
}

// A Thief actor (gender male) on the AI team, MP-flush enough to cast the
// 24-MP Steal Heart, positioned adjacent-ish to the target.
function thief(opts: { mp?: number; weapon?: UnitEquipment; x?: number } = {}): Unit {
  const base = makeUnit({
    id: 'thief',
    spd: 10,
    pa: 5,
    brave: 100,
    classId: 'thief',
    mp: opts.mp ?? 28,
    maxMpBase: 28,
    position: { x: opts.x ?? 1, y: 0, layer: 0 },
    loadout: thiefLoadout(),
    equipment: opts.weapon ?? NO_WEAPON,
    team: 'team_b',
  });
  return { ...base, gender: 'male' as Gender };
}

// A female Fire Mage enemy — a real offensive threat (high MA, fire spells),
// the canonical charm target.
function mageEnemy(opts: { hp?: number; ma?: number; x?: number; statuses?: ReadonlyArray<StatusInstance> } = {}): Unit {
  const base = makeUnit({
    id: 'mage',
    spd: 10,
    ma: opts.ma ?? 16,
    classId: 'fire_mage',
    hp: opts.hp ?? 100,
    maxHpBase: 100,
    position: { x: opts.x ?? 2, y: 0, layer: 0 },
    loadout: mageLoadout(),
    statuses: opts.statuses ?? [],
    team: 'team_a',
  });
  return { ...base, gender: 'female' as Gender };
}

// A female enemy that can't hurt anyone (PA 0 / MA 0, empty loadout) — its
// only ability is the class free Attack, which projects 0. Used to exercise
// the "nothing worth charming" guard.
function harmlessEnemy(): Unit {
  const base = makeUnit({
    id: 'inert', spd: 10, pa: 0, ma: 0, classId: 'fire_mage',
    hp: 100, maxHpBase: 100, position: { x: 2, y: 0, layer: 0 }, team: 'team_a',
  });
  return { ...base, gender: 'female' as Gender };
}

describe('S69 chunk 1 — scoring primitives', () => {
  it('countStealableBuffs counts buff-polarity statuses, ignores debuffs', () => {
    const buffed = mageEnemy({ statuses: [hasteBuff()] });
    expect(_basicAiInternals.countStealableBuffs(buffed, cat)).toBe(1);
    const bare = mageEnemy();
    expect(_basicAiInternals.countStealableBuffs(bare, cat)).toBe(0);
  });

  it('estimateOffensiveOutput is positive for a real threat, zero for a harmless unit', () => {
    const inert = { ...harmlessEnemy(), position: { x: 3, y: 0, layer: 0 } };
    const state = makeGameState({
      units: [thief(), mageEnemy(), inert],
      map: { width: 4, height: 1, tiles: flatGround(4, 1) },
      teams: TEAMS,
    });
    const actor = state.units.get(thief().id)!;
    expect(_basicAiInternals.estimateOffensiveOutput(state, cat, state.units.get(mageEnemy().id)!, actor)).toBeGreaterThan(0);
    expect(_basicAiInternals.estimateOffensiveOutput(state, cat, state.units.get(inert.id)!, actor)).toBe(0);
  });
});

describe('S69 chunk 1 — bestCharmCandidate', () => {
  it('produces a positive Steal Heart candidate against a valid opposite-gender threat in range', () => {
    const a = thief();
    const e = mageEnemy();
    const state = makeGameState({
      units: [a, e], map: { width: 4, height: 1, tiles: flatGround(4, 1) },
      teams: TEAMS, turnState: activeTurnFor(a.id),
    });
    const cand = _basicAiInternals.bestCharmCandidate(state, cat, state.units.get(a.id)!, [state.units.get(e.id)!]);
    expect(cand).not.toBeNull();
    expect(cand!.score).toBeGreaterThan(0);
    expect(cand!.action.payload).toMatchObject({ abilityId: STEAL_HEART });
  });

  it('declines a same-gender target (validation rejects — no candidate)', () => {
    const a = thief();
    const e = { ...mageEnemy(), gender: 'male' as Gender }; // same gender as the thief
    const state = makeGameState({
      units: [a, e], map: { width: 4, height: 1, tiles: flatGround(4, 1) },
      teams: TEAMS, turnState: activeTurnFor(a.id),
    });
    const cand = _basicAiInternals.bestCharmCandidate(state, cat, state.units.get(a.id)!, [state.units.get(e.id)!]);
    expect(cand).toBeNull();
  });

  it('declines a target with no offensive output (nothing worth charming)', () => {
    const a = thief();
    const inert = harmlessEnemy();
    const state = makeGameState({
      units: [a, inert], map: { width: 4, height: 1, tiles: flatGround(4, 1) },
      teams: TEAMS, turnState: activeTurnFor(a.id),
    });
    const cand = _basicAiInternals.bestCharmCandidate(state, cat, state.units.get(a.id)!, [state.units.get(inert.id)!]);
    expect(cand).toBeNull();
  });
});

describe('S69 chunk 1 — bestStealBuffCandidate', () => {
  it('fires on a buffed target, scoring per stealable buff', () => {
    const a = thief();
    const e = mageEnemy({ statuses: [hasteBuff()] });
    const state = makeGameState({
      units: [a, e], map: { width: 4, height: 1, tiles: flatGround(4, 1) },
      teams: TEAMS, turnState: activeTurnFor(a.id),
    });
    const cand = _basicAiInternals.bestStealBuffCandidate(state, cat, state.units.get(a.id)!, [state.units.get(e.id)!]);
    expect(cand).not.toBeNull();
    expect(cand!.score).toBeGreaterThan(0);
    expect(cand!.action.payload).toMatchObject({ abilityId: STEAL_BUFFS });
  });

  it('declines a bare target (no buffs to steal)', () => {
    const a = thief();
    const e = mageEnemy(); // no buffs
    const state = makeGameState({
      units: [a, e], map: { width: 4, height: 1, tiles: flatGround(4, 1) },
      teams: TEAMS, turnState: activeTurnFor(a.id),
    });
    const cand = _basicAiInternals.bestStealBuffCandidate(state, cat, state.units.get(a.id)!, [state.units.get(e.id)!]);
    expect(cand).toBeNull();
  });
});

describe('S69 chunk 1 — decideBasicAi acceptance', () => {
  it('charms a high-threat target reachable only by Steal Heart (out of melee, no move)', () => {
    // Mage at x=3 (charm range 3 from x=1 reaches it; melee range 1 does
    // not). With no movement budget, the only positive act from the current
    // tile is the charm — the AI takes it rather than ending the turn.
    const a = thief({ weapon: NO_WEAPON });
    const e = mageEnemy({ hp: 100, ma: 18, x: 3 });
    const noMove = { ...activeTurnFor(a.id), budget: { movesAvailable: 0, actsAvailable: 1 } };
    const state = makeGameState({
      units: [a, e], map: { width: 5, height: 1, tiles: flatGround(5, 1) },
      teams: TEAMS, turnState: noMove,
    });
    const decision = decideBasicAi(state, cat);
    expect(decision.kind).toBe('commit');
    if (decision.kind !== 'commit') return;
    expect(decision.action.payload).toMatchObject({ abilityId: STEAL_HEART });
  });

  it('never charms over a lethal finish (attacks the near-dead enemy instead)', () => {
    const a = thief({ weapon: NO_WEAPON });
    const e = mageEnemy({ hp: 1, ma: 18 }); // a kill is available
    const state = makeGameState({
      units: [a, e], map: { width: 4, height: 1, tiles: flatGround(4, 1) },
      teams: TEAMS, turnState: activeTurnFor(a.id),
    });
    const decision = decideBasicAi(state, cat);
    expect(decision.kind).toBe('commit');
    if (decision.kind !== 'commit') return;
    // The lethal play is a damage ability (steal_hp / attack), not the charm.
    expect(decision.action.payload).not.toMatchObject({ abilityId: STEAL_HEART });
  });
});

// === Chunk 2 — break a bad state (free a charmed ally) =================

// An own-team (team_b) Fire Mage that an enemy has charmed: it carries the
// `enthralled` control-override and acts for team_a. A real threat once
// freed (fire spells). Adjacent to the breaker by default.
function charmedAlly(opts: { hp?: number; x?: number; charmed?: boolean } = {}): Unit {
  const statuses = (opts.charmed ?? true)
    ? [makeStatusInstance({ typeId: 'enthralled', remainingDuration: 3, customState: { charmerTeam: 'team_a' } })]
    : [];
  return makeUnit({
    id: 'puppet',
    spd: 10,
    ma: 16,
    classId: 'fire_mage',
    hp: opts.hp ?? 100,
    maxHpBase: 100,
    position: { x: opts.x ?? 1, y: 0, layer: 0 },
    loadout: mageLoadout(),
    statuses,
    team: 'team_b',
  });
}

describe('S69 chunk 2 — break-a-charm primitives', () => {
  it('isControlOverridden / controlOverrideRemainingTurns read the enthralled status', () => {
    const puppet = charmedAlly();
    expect(_basicAiInternals.isControlOverridden(puppet, cat)).toBe(true);
    expect(_basicAiInternals.controlOverrideRemainingTurns(puppet, cat)).toBe(3);
    const free = charmedAlly({ charmed: false });
    expect(_basicAiInternals.isControlOverridden(free, cat)).toBe(false);
  });
});

describe('S69 chunk 2 — bestBreakCharmCandidate', () => {
  function setup(opts: { allyHp?: number; charmed?: boolean }): {
    state: ReturnType<typeof makeGameState>; actor: Unit; allies: Unit[]; enemies: Unit[];
  } {
    const a = thief({ x: 0 }); // unarmed breaker, melee attack ~chip damage
    const puppet = charmedAlly({ hp: opts.allyHp ?? 100, x: 1, charmed: opts.charmed ?? true });
    const enemy = mageEnemy({ x: 4 }); // team_a, the repEnemy for the output estimate
    const state = makeGameState({
      units: [a, puppet, enemy], map: { width: 6, height: 1, tiles: flatGround(6, 1) },
      teams: TEAMS, turnState: activeTurnFor(a.id),
    });
    return {
      state,
      actor: state.units.get(a.id)!,
      allies: [state.units.get(a.id)!, state.units.get(puppet.id)!],
      enemies: [state.units.get(enemy.id)!],
    };
  }

  it('fires on a charmed ally — a positive, ally-targeted break', () => {
    const { state, actor, allies, enemies } = setup({});
    const cand = _basicAiInternals.bestBreakCharmCandidate(
      state, cat, actor, allies, enemies, _basicAiInternals.enumerateOffensiveAbilities(state, actor, cat),
    );
    expect(cand).not.toBeNull();
    expect(cand!.score).toBeGreaterThan(0);
    expect(cand!.action.payload).toMatchObject({ target: { kind: 'unit', unitId: 'puppet' } });
  });

  it('never targets a non-charmed ally (the guard)', () => {
    const { state, actor, allies, enemies } = setup({ charmed: false });
    const cand = _basicAiInternals.bestBreakCharmCandidate(
      state, cat, actor, allies, enemies, _basicAiInternals.enumerateOffensiveAbilities(state, actor, cat),
    );
    expect(cand).toBeNull();
  });

  it('declines when every attack would KO the ally (don\'t kill the unit we want back)', () => {
    const { state, actor, allies, enemies } = setup({ allyHp: 1 });
    const cand = _basicAiInternals.bestBreakCharmCandidate(
      state, cat, actor, allies, enemies, _basicAiInternals.enumerateOffensiveAbilities(state, actor, cat),
    );
    expect(cand).toBeNull();
  });
});

describe('S69 chunk 2 — decideBasicAi acceptance', () => {
  it('attacks a charmed ally to free it when no enemy is reachable', () => {
    const a = thief({ x: 0 });
    const puppet = charmedAlly({ x: 1 });
    const enemy = mageEnemy({ x: 5 }); // out of melee + charm reach
    const noMove = { ...activeTurnFor(a.id), budget: { movesAvailable: 0, actsAvailable: 1 } };
    const state = makeGameState({
      units: [a, puppet, enemy], map: { width: 6, height: 1, tiles: flatGround(6, 1) },
      teams: TEAMS, turnState: noMove,
    });
    const decision = decideBasicAi(state, cat);
    expect(decision.kind).toBe('commit');
    if (decision.kind !== 'commit') return;
    expect(decision.action.payload).toMatchObject({ target: { kind: 'unit', unitId: 'puppet' } });
  });

  it('never attacks a non-charmed ally (frees nobody when nobody is charmed)', () => {
    const a = thief({ x: 0 });
    const ally = charmedAlly({ x: 1, charmed: false }); // a normal ally
    const enemy = mageEnemy({ x: 5 });
    const noMove = { ...activeTurnFor(a.id), budget: { movesAvailable: 0, actsAvailable: 1 } };
    const state = makeGameState({
      units: [a, ally, enemy], map: { width: 6, height: 1, tiles: flatGround(6, 1) },
      teams: TEAMS, turnState: noMove,
    });
    const decision = decideBasicAi(state, cat);
    // Either it ends the turn or acts on the enemy — but it must NEVER target
    // the non-charmed ally.
    if (decision.kind === 'commit' && decision.action.type === 'use_ability') {
      const target = decision.action.payload.target;
      if (target.kind === 'unit') expect(target.unitId).not.toBe('puppet');
    }
  });
});
