// Session 74, AI A — buff coverage targeting.
//
// An AI Enchanter casting an AoE ally-buff (Auramancy's Haste / Protect /
// Shell — a diamond-1 footprint) should aim the diamond at the anchor that
// maximizes covered beneficiaries, not a lonely ally. The scorer sums the
// per-ally buff potency over every beneficiary the footprint reaches, so a
// cluster of three allies beats a single stray. It skips non-beneficiaries
// (no offensive output to amplify, or already carrying the buff) and treats
// an enemy caught in the footprint as an own-goal (Auramancy is friendly-fire
// + excludeCaster:false).
//
// Subordinate by construction: it competes on the same scale as every other
// Act and never stalls for a better cluster (that's the move-phase cohesion's
// job — S73). Pairs with that cohesion: allies gather, the caster aims at the
// gathering.
//
// Layers:
//   1. buffPotency — beneficiary value; 0 for a no-offense unit and for one
//      already carrying the buff.
//   2. scoreAoeBuff — coverage sum; cluster anchor beats stray; enemy own-goal
//      deducts.
//   3. bestActFromSource — the Enchanter picks the cluster-center ally as the
//      cast anchor.

import { describe, expect, it } from 'vitest';
import {
  abilityId,
  bucketId,
  commandSetId,
  teamId,
  type ActiveAbilityDefinition,
  type Tile,
  type Unit,
} from '@engine/index.ts';
import { makeStatusInstance } from '../engine/status/test-fixtures.ts';
import { loadDefaultCatalog } from '../content/index.ts';
import { activeTurnFor, makeGameState, makeUnit } from '../engine/ct/test-fixtures.ts';
import { _basicAiInternals } from './basic.ts';

const FIRST = bucketId('first_action');
const AURAMANCY = commandSetId('auramancy');
const BATTLE_SKILL = commandSetId('battle_skill');
const TEAM_A = teamId('team_a');
const TEAM_B = teamId('team_b');
const TEAMS = [
  { id: TEAM_A, name: 'A', control: 'ai' as const },
  { id: TEAM_B, name: 'B', control: 'ai' as const },
];

const cat = loadDefaultCatalog();

function activeAbility(id: string): ActiveAbilityDefinition {
  const a = cat.getAbility(abilityId(id));
  if (a.kind !== 'active') throw new Error(`${id} is not an active ability`);
  return a;
}
const enchantHaste = activeAbility('enchant_haste');

function flatGround(width: number, height: number): Tile[] {
  const tiles: Tile[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      tiles.push({ x, y, layer: 0, elevation: 0, terrain: 'ground', properties: [] });
    }
  }
  return tiles;
}

function enchanter(x: number, y: number): Unit {
  return makeUnit({
    id: 'ench', team: 'team_a', spd: 10, ma: 10, classId: 'enchanter', hp: 103, maxMpBase: 40, mp: 40,
    position: { x, y, layer: 0 },
    loadout: { actionBuckets: { [FIRST]: [AURAMANCY] }, passiveBuckets: {} },
  });
}

// A melee beneficiary: a Knight has `attack` (offensive) and MA 4, so
// buffPotency = 4 × 1 × 0.3 = 1.2 > 0.
function knight(id: string, x: number, y: number): Unit {
  return makeUnit({
    id, team: 'team_a', spd: 10, classId: 'knight', hp: 100,
    position: { x, y, layer: 0 },
    loadout: { actionBuckets: { [FIRST]: [BATTLE_SKILL] }, passiveBuckets: {} },
  });
}

// A Knight on the enemy team (offensive output, so it benefits from a buff —
// makes the own-goal deduction non-zero).
function enemyKnight(id: string, x: number, y: number): Unit {
  return makeUnit({
    id, team: 'team_b', spd: 10, classId: 'knight', maxHpBase: 60, hp: 60,
    position: { x, y, layer: 0 },
    loadout: { actionBuckets: { [FIRST]: [BATTLE_SKILL] }, passiveBuckets: {} },
  });
}

describe('S74 AI A — buffPotency', () => {
  it('is positive for an offensive ally not already buffed', () => {
    const ally = knight('kn', 4, 4);
    expect(_basicAiInternals.buffPotency(makeGameState({
      units: [ally], map: { width: 8, height: 8, tiles: flatGround(8, 8) }, teams: TEAMS,
    }), cat, ally, enchantHaste)).toBeGreaterThan(0);
  });

  it('is zero for an ally that already carries the buff', () => {
    const buffed = makeUnit({
      id: 'kn', team: 'team_a', spd: 10, classId: 'knight', hp: 100, position: { x: 4, y: 4, layer: 0 },
      loadout: { actionBuckets: { [FIRST]: [BATTLE_SKILL] }, passiveBuckets: {} },
      statuses: [makeStatusInstance({ typeId: 'quickening', remainingDuration: 6 })],
    });
    expect(_basicAiInternals.buffPotency(makeGameState({
      units: [buffed], map: { width: 8, height: 8, tiles: flatGround(8, 8) }, teams: TEAMS,
    }), cat, buffed, enchantHaste)).toBe(0);
  });
});

describe('S74 AI A — scoreAoeBuff coverage', () => {
  it('a cluster anchor scores higher than a lonely ally', () => {
    const ench = enchanter(4, 6);
    // Cluster of three around (4,4): center + two orthogonal neighbours all
    // fall inside the diamond-1 anchored at (4,4).
    const c1 = knight('c1', 4, 4);
    const c2 = knight('c2', 3, 4);
    const c3 = knight('c3', 5, 4);
    // A stray well clear of the cluster's footprint.
    const stray = knight('stray', 8, 6);
    const allies = [ench, c1, c2, c3, stray];
    const state = makeGameState({
      units: allies, map: { width: 12, height: 12, tiles: flatGround(12, 12) },
      teams: TEAMS, turnState: activeTurnFor(ench.id),
    });
    const clusterScore = _basicAiInternals.scoreAoeBuff(
      state, cat, ench, ench.position, c1.position, enchantHaste, [], allies,
    );
    const strayScore = _basicAiInternals.scoreAoeBuff(
      state, cat, ench, ench.position, stray.position, enchantHaste, [], allies,
    );
    expect(clusterScore).toBeGreaterThan(strayScore);
  });

  it('deducts for an enemy caught in the footprint (own-goal)', () => {
    const ench = enchanter(4, 6);
    const c1 = knight('c1', 4, 4);
    const allies = [ench, c1];
    const cleanState = makeGameState({
      units: allies, map: { width: 12, height: 12, tiles: flatGround(12, 12) },
      teams: TEAMS, turnState: activeTurnFor(ench.id),
    });
    const clean = _basicAiInternals.scoreAoeBuff(cleanState, cat, ench, ench.position, c1.position, enchantHaste, [], allies);

    const foe = enemyKnight('foe', 5, 4); // adjacent to the anchor → inside diamond-1
    const dirtyState = makeGameState({
      units: [...allies, foe], map: { width: 12, height: 12, tiles: flatGround(12, 12) },
      teams: TEAMS, turnState: activeTurnFor(ench.id),
    });
    const dirty = _basicAiInternals.scoreAoeBuff(dirtyState, cat, ench, ench.position, c1.position, enchantHaste, [foe], allies);
    expect(dirty).toBeLessThan(clean);
  });
});

describe('S74 AI A — bestActFromSource picks the cluster anchor', () => {
  it('aims Auramancy at the cluster-center ally, not the stray', () => {
    const ench = enchanter(4, 6);
    const c1 = knight('c1', 4, 4);
    const c2 = knight('c2', 3, 4);
    const c3 = knight('c3', 5, 4);
    const stray = knight('stray', 7, 6);
    const allies = [ench, c1, c2, c3, stray];
    const state = makeGameState({
      units: allies, map: { width: 12, height: 12, tiles: flatGround(12, 12) },
      teams: TEAMS, turnState: activeTurnFor(ench.id),
    });
    const best = _basicAiInternals.bestActFromSource(
      state, cat, ench, ench.position, [], allies, [], [enchantHaste],
    );
    expect(best).not.toBeNull();
    if (best === null) throw new Error('expected a buff plan');
    if (best.action.type !== 'use_ability') throw new Error('expected use_ability');
    const target = best.action.payload.target;
    if (target.kind !== 'unit') throw new Error('expected a unit anchor');
    // The anchor that maximizes coverage is the cluster center (c1 at (4,4),
    // whose diamond-1 also reaches c2 and c3) — not the stray.
    expect(target.unitId).toBe(c1.id);
  });
});
