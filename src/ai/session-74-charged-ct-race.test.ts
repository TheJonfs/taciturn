// Session 74, AI B — charged-attack CT-race devaluation.
//
// A tile-pinned charged attack (Hunter's Charged Attack) hits whoever stands
// on the pinned tile at resolution and misses if they've moved off. The AI
// optimistically scores it against the enemy standing there *now* — but if
// that enemy reaches its next turn before the charge resolves, it can act and
// step off the tile, so the shot probably whiffs. AI B devalues (does not ban)
// such a pick: a pure CT-race check via `estimateChargedTiming`. Charges stay
// good against slow / Stopped / non-acting targets (the race is won, or the
// target has no upcoming turn). No movement prediction — just the race.
//
// Layers:
//   1. chargedTilePinValueFactor — < 1 when the target acts before the charge
//      resolves; 1 when the charge lands first (slow target) or the ability
//      isn't charged.
//   2. bestActFromSource — with a fast (dodging) and a slow (pinned) enemy of
//      equal HP, the AI aims the Charged Attack at the slow one. Still charges
//      (no regression to never-charging).

import { describe, expect, it } from 'vitest';
import { bucketId, commandSetId, teamId, type Tile, type Unit } from '@engine/index.ts';
import { loadDefaultCatalog } from '../content/index.ts';
import { chargedAttack } from '../content/abilities/charged-attack.ts';
import { longbow } from '../content/items/longbow.ts';
import { activeTurnFor, makeGameState, makeUnit } from '../engine/ct/test-fixtures.ts';
import { _basicAiInternals } from './basic.ts';

const FIRST = bucketId('first_action');
const MARKSMANSHIP = commandSetId('marksmanship');
const TEAM_A = teamId('team_a');
const TEAM_B = teamId('team_b');
const TEAMS = [
  { id: TEAM_A, name: 'A', control: 'ai' as const },
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

// The active Hunter, at CT 100 (it's taking its turn). Charged Attack
// (actionSpeed 25) resolves ~4 ticks after the Hunter's turn ends.
function hunterAt(x: number, y: number): Unit {
  return makeUnit({
    id: 'hunter', spd: 9, pa: 6, classId: 'hunter', hp: 100, mp: 50, ct: 100,
    position: { x, y, layer: 0 },
    loadout: { actionBuckets: { [FIRST]: [MARKSMANSHIP] }, passiveBuckets: {} },
    equipment: { leftHand: null, rightHand: longbow.id, headgear: null, armor: null, accessory: null },
  });
}

// A target that will act ~1 tick after the Hunter's turn (fast + nearly
// full CT) — it reaches its next turn well before the 4-tick charge resolve.
function dodgingFoe(id: string, x: number, y: number): Unit {
  return makeUnit({
    id, team: 'team_b', spd: 12, ct: 90, classId: 'knight', maxHpBase: 80, hp: 80,
    position: { x, y, layer: 0 },
  });
}

// A target that won't act for ~17 ticks (slow + empty CT) — the charge lands
// long before its next turn, so it stays pinned.
function pinnedFoe(id: string, x: number, y: number): Unit {
  return makeUnit({
    id, team: 'team_b', spd: 6, ct: 0, classId: 'knight', maxHpBase: 80, hp: 80,
    position: { x, y, layer: 0 },
  });
}

describe('S74 AI B — chargedTilePinValueFactor', () => {
  it('penalizes a target that acts before the charge resolves', () => {
    const hunter = hunterAt(1, 1);
    const foe = dodgingFoe('foe', 4, 1);
    const state = makeGameState({
      units: [hunter, foe], map: { width: 8, height: 4, tiles: flatGround(8, 4) },
      teams: TEAMS, turnState: activeTurnFor(hunter.id),
    });
    const factor = _basicAiInternals.chargedTilePinValueFactor(state, cat, hunter, foe, chargedAttack);
    expect(factor).toBeLessThan(1);
  });

  it('does not penalize a slow target the charge beats to the punch', () => {
    const hunter = hunterAt(1, 1);
    const foe = pinnedFoe('foe', 4, 1);
    const state = makeGameState({
      units: [hunter, foe], map: { width: 8, height: 4, tiles: flatGround(8, 4) },
      teams: TEAMS, turnState: activeTurnFor(hunter.id),
    });
    const factor = _basicAiInternals.chargedTilePinValueFactor(state, cat, hunter, foe, chargedAttack);
    expect(factor).toBe(1);
  });
});

describe('S74 AI B — bestActFromSource prefers the non-dodging target', () => {
  it('aims the Charged Attack at the slow (pinned) enemy over the fast (dodging) one', () => {
    const hunter = hunterAt(1, 1);
    const dodger = dodgingFoe('dodger', 4, 1); // distance 3 — inside the bow's 2-5 band
    const pinned = pinnedFoe('pinned', 1, 4); // distance 3
    const enemies = [dodger, pinned];
    const state = makeGameState({
      units: [hunter, dodger, pinned], map: { width: 8, height: 8, tiles: flatGround(8, 8) },
      teams: TEAMS, turnState: activeTurnFor(hunter.id),
    });
    const best = _basicAiInternals.bestActFromSource(
      state, cat, hunter, hunter.position, enemies, [hunter], [chargedAttack], [],
    );
    expect(best).not.toBeNull();
    if (best === null) throw new Error('expected a Charged Attack plan');
    if (best.action.type !== 'use_ability') throw new Error('expected use_ability');
    const target = best.action.payload.target;
    if (target.kind !== 'tile') throw new Error('expected a tile-pin');
    // The dodger would step off before resolution (×0.35); the pinned enemy
    // stays put (×1) — equal HP, so the pinned tile wins.
    expect(target.position).toEqual(pinned.position);
  });

  it('still commits the charge against a dodging-only field (no never-charge regression)', () => {
    const hunter = hunterAt(1, 1);
    const dodger = dodgingFoe('dodger', 4, 1);
    const state = makeGameState({
      units: [hunter, dodger], map: { width: 8, height: 4, tiles: flatGround(8, 4) },
      teams: TEAMS, turnState: activeTurnFor(hunter.id),
    });
    const best = _basicAiInternals.bestActFromSource(
      state, cat, hunter, hunter.position, [dodger], [hunter], [chargedAttack], [],
    );
    expect(best).not.toBeNull();
    if (best === null) throw new Error('expected a Charged Attack plan even at a discount');
    if (best.action.type !== 'use_ability') throw new Error('expected use_ability');
    expect(best.action.payload.abilityId).toEqual(chargedAttack.id);
  });
});
