// Session 57 — unified-currency AI scoring (ADR-0092).
//
// These tests pin the commensurability fix: every action class (attack,
// heal, item throw, revive, Math Skill) competes in one scored pool, with
// Compound demoted to a last-resort fallback. They target the edge cases
// the old pre-empt cascade got wrong — cases that had NO AI-layer
// coverage before this session (the Alchemist / Math decision paths were
// only exercised by engine integration tests, never by `decideBasicAi`).
//
// Built on the real default catalog so the projection runs the live
// damage pipeline (matching the tier-2 tests in basic.test.ts).

import { describe, expect, it } from 'vitest';
import {
  abilityId,
  bucketId,
  commandSetId,
  itemId,
  teamId,
  type Tile,
  type UnitEquipment,
} from '@engine/index.ts';
import { loadDefaultCatalog } from '../content/index.ts';
import { activeTurnFor, makeGameState, makeUnit } from '../engine/ct/test-fixtures.ts';
import { decideBasicAi } from './basic.ts';
import { pickBestMathSkill } from './math-skill-scoring.ts';

const FIRST = bucketId('first_action');
const SECOND = bucketId('secondary_command_sets');
const TEAM_A = teamId('team_a');
const TEAM_B = teamId('team_b');

const CURE = abilityId('cure');
const BATTLE_SKILL = commandSetId('battle_skill');
const ALCHEMY = commandSetId('alchemy');
const WHITE_MAGIC = commandSetId('white_magic');
const MATH_SKILL = commandSetId('math_skill');
const LIGHTNING_SPELLS = commandSetId('lightning_spells');
const LONG_SWORD = itemId('long_sword');
const PHOENIX_DOWN = itemId('phoenix_down');

function flatGround(width: number, height: number): Tile[] {
  const tiles: Tile[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      tiles.push({ x, y, layer: 0, elevation: 0, terrain: 'ground', properties: [] });
    }
  }
  return tiles;
}

// Long Sword in the right hand; everything else empty. Physical attacks
// need a weapon to project non-zero damage.
function withSword(): UnitEquipment {
  return { leftHand: null, rightHand: LONG_SWORD, headgear: null, armor: null, accessory: null };
}

const TEAMS = [
  { id: TEAM_A, name: 'A', control: 'human' as const },
  { id: TEAM_B, name: 'B', control: 'ai' as const },
];

describe('S57 unified scoring — non-damage actions no longer pre-empt attacks', () => {
  it('a Knight with Alchemy secondary finishes a low-HP enemy instead of banking-Compound', () => {
    // The reported bug: a Knight carrying Alchemy as a secondary command
    // set crafted/banked items (the old Phase-0a pre-empt) instead of
    // taking a lethal swing. Empty stockpile => the old pickCompoundItem
    // cascade WOULD have returned a Compound. The pool must pick the kill.
    const cat = loadDefaultCatalog();
    // Actor placed directly behind the (north-facing) enemy so an
    // in-place attack is already the best angle — isolates "attack vs
    // Compound" from the joint planner's legitimate back-attack
    // repositioning. The specific damage ability (power_attack etc.) is
    // the planner's choice; we only assert it engages the enemy.
    const actor = makeUnit({
      id: 'knight', spd: 10, pa: 8, classId: 'knight', hp: 60, mp: 30,
      position: { x: 2, y: 3, layer: 0 }, equipment: withSword(),
      loadout: {
        actionBuckets: { [FIRST]: [BATTLE_SKILL], [SECOND]: [ALCHEMY] },
        passiveBuckets: {},
      },
      stockpile: new Map(), // empty → Compound would want to craft
    });
    const enemy = makeUnit({
      id: 'enemy', team: 'team_b', spd: 10, classId: 'knight',
      maxHpBase: 60, hp: 6, position: { x: 2, y: 2, layer: 0 },
    });
    const state = makeGameState({
      units: [actor, enemy], map: { width: 6, height: 6, tiles: flatGround(6, 6) },
      teams: TEAMS, turnState: activeTurnFor(actor.id),
    });

    const decision = decideBasicAi(state, cat);
    expect(decision.kind).toBe('commit');
    if (decision.kind !== 'commit') return;
    // Attacks the enemy — NOT use_compound / use_throw_item.
    expect(decision.action.type).toBe('use_ability');
    if (decision.action.type !== 'use_ability') return;
    const target = decision.action.payload.target;
    expect(target.kind).toBe('unit');
    if (target.kind === 'unit') expect(target.unitId).toEqual(enemy.id);
  });

  it('a strong attacker with Math secondary attacks instead of casting a marginal Math option', () => {
    // A Lightning Mage carrying Math Skill secondary, with a near-dead
    // enemy in range. A positive Math option exists (so it is a real
    // competitor), but the lethal attack must outrank it now that the
    // MATH_SCORE_THRESHOLD pre-empt is gone.
    const cat = loadDefaultCatalog();
    const actor = makeUnit({
      id: 'caster', spd: 12, ma: 8, classId: 'lightning_mage', hp: 44, mp: 44,
      position: { x: 1, y: 1, layer: 0 },
      loadout: {
        actionBuckets: { [FIRST]: [LIGHTNING_SPELLS], [SECOND]: [MATH_SKILL] },
        passiveBuckets: {},
      },
    });
    // current_hp values chosen prime so the 'current_hp'/'prime' Math
    // option matches at least one enemy (a positive Math candidate).
    const lowEnemy = makeUnit({
      id: 'low', team: 'team_b', spd: 10, classId: 'knight',
      maxHpBase: 60, hp: 5, position: { x: 3, y: 1, layer: 0 },
    });
    const otherEnemy = makeUnit({
      id: 'other', team: 'team_b', spd: 10, classId: 'knight',
      maxHpBase: 60, hp: 23, position: { x: 1, y: 4, layer: 0 },
    });
    const state = makeGameState({
      units: [actor, lowEnemy, otherEnemy], map: { width: 6, height: 6, tiles: flatGround(6, 6) },
      teams: TEAMS, turnState: activeTurnFor(actor.id),
    });

    // Sanity: a positive Math option genuinely exists in this state.
    expect(pickBestMathSkill(state, cat, actor)).not.toBeNull();

    const decision = decideBasicAi(state, cat);
    expect(decision.kind).toBe('commit');
    if (decision.kind !== 'commit') return;
    expect(decision.action.type).toBe('use_ability');
    if (decision.action.type !== 'use_ability') return;
    // The committed action is a real attack, NOT a Math Skill cast.
    expect(decision.action.payload.target.kind).not.toBe('math_skill');
  });
});

describe('S57 unified scoring — heal and revive compete on the same scale', () => {
  it('heals a genuinely dying ally over attacking a healthy enemy', () => {
    const cat = loadDefaultCatalog();
    const healer = makeUnit({
      id: 'healer', spd: 10, pa: 6, ma: 6, classId: 'knight', hp: 60, mp: 20,
      position: { x: 1, y: 1, layer: 0 }, equipment: withSword(),
      loadout: {
        actionBuckets: { [FIRST]: [BATTLE_SKILL], [SECOND]: [WHITE_MAGIC] },
        passiveBuckets: {},
      },
    });
    const dyingAlly = makeUnit({
      id: 'ally', team: 'team_a', spd: 10, classId: 'knight',
      maxHpBase: 60, hp: 3, position: { x: 1, y: 2, layer: 0 },
    });
    const enemy = makeUnit({
      id: 'enemy', team: 'team_b', spd: 10, classId: 'knight',
      maxHpBase: 60, hp: 60, position: { x: 2, y: 1, layer: 0 },
    });
    const state = makeGameState({
      units: [healer, dyingAlly, enemy], map: { width: 6, height: 6, tiles: flatGround(6, 6) },
      teams: TEAMS, turnState: activeTurnFor(healer.id),
    });

    const decision = decideBasicAi(state, cat);
    expect(decision.kind).toBe('commit');
    if (decision.kind !== 'commit') return;
    expect(decision.action.type).toBe('use_ability');
    if (decision.action.type !== 'use_ability') return;
    expect(decision.action.payload.abilityId).toEqual(CURE);
    const target = decision.action.payload.target;
    expect(target.kind).toBe('unit');
    if (target.kind === 'unit') expect(target.unitId).toEqual(dyingAlly.id);
  });

  it('revives a KO\'d ally when no higher-value action is available', () => {
    const cat = loadDefaultCatalog();
    const alch = makeUnit({
      id: 'alch', spd: 10, pa: 8, classId: 'alchemist', hp: 60, mp: 30,
      position: { x: 1, y: 1, layer: 0 },
      loadout: { actionBuckets: { [FIRST]: [ALCHEMY] }, passiveBuckets: {} },
      stockpile: new Map([[PHOENIX_DOWN, 1]]),
    });
    const koAlly = makeUnit({
      id: 'ko', team: 'team_a', spd: 10, classId: 'knight',
      maxHpBase: 60, hp: 0, position: { x: 1, y: 2, layer: 0 },
    });
    // Enemy far out of reach so nothing competes with the revive.
    const farEnemy = makeUnit({
      id: 'far', team: 'team_b', spd: 10, classId: 'knight',
      maxHpBase: 60, hp: 60, position: { x: 5, y: 5, layer: 0 },
    });
    const state = makeGameState({
      units: [alch, koAlly, farEnemy], map: { width: 6, height: 6, tiles: flatGround(6, 6) },
      teams: TEAMS, turnState: activeTurnFor(alch.id),
    });

    const decision = decideBasicAi(state, cat);
    expect(decision.kind).toBe('commit');
    if (decision.kind !== 'commit') return;
    expect(decision.action.type).toBe('use_throw_item');
    if (decision.action.type !== 'use_throw_item') return;
    expect(decision.action.payload.itemId).toEqual(PHOENIX_DOWN);
    const target = decision.action.payload.target;
    expect(target.kind).toBe('unit');
    if (target.kind === 'unit') expect(target.unitId).toEqual(koAlly.id);
  });

  it('finishes a killable enemy rather than reviving (revive competes, does not pre-empt)', () => {
    // Same KO'd ally + Phoenix Down, but now a near-dead enemy is in
    // melee range. A clean finish (small damage × large killValue)
    // outscores the revive — proving revive is a scored candidate, not a
    // forced first move.
    const cat = loadDefaultCatalog();
    // Alchemist directly behind the (north-facing) near-dead enemy so the
    // finish is an in-place best-angle attack; a KO'd ally sits in throw
    // range so the revive (score ≈ maxHpBase × 1.5) is a genuine
    // competitor. The finish (small damage × large killValue) must win.
    const alch = makeUnit({
      id: 'alch', spd: 10, pa: 8, classId: 'alchemist', hp: 60, mp: 30,
      position: { x: 2, y: 3, layer: 0 }, equipment: withSword(),
      loadout: { actionBuckets: { [FIRST]: [ALCHEMY] }, passiveBuckets: {} },
      stockpile: new Map([[PHOENIX_DOWN, 1]]),
    });
    const koAlly = makeUnit({
      id: 'ko', team: 'team_a', spd: 10, classId: 'knight',
      maxHpBase: 60, hp: 0, position: { x: 1, y: 3, layer: 0 },
    });
    const lowEnemy = makeUnit({
      id: 'low', team: 'team_b', spd: 10, classId: 'knight',
      maxHpBase: 60, hp: 5, position: { x: 2, y: 2, layer: 0 },
    });
    const state = makeGameState({
      units: [alch, koAlly, lowEnemy], map: { width: 6, height: 6, tiles: flatGround(6, 6) },
      teams: TEAMS, turnState: activeTurnFor(alch.id),
    });

    const decision = decideBasicAi(state, cat);
    expect(decision.kind).toBe('commit');
    if (decision.kind !== 'commit') return;
    // Finishes the enemy — NOT use_throw_item (revive competes, loses).
    expect(decision.action.type).toBe('use_ability');
    if (decision.action.type !== 'use_ability') return;
    const target = decision.action.payload.target;
    expect(target.kind).toBe('unit');
    if (target.kind === 'unit') expect(target.unitId).toEqual(lowEnemy.id);
  });
});
