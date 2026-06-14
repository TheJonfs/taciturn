// Session 66, chunk 1 — Knockback usage: the AI values a `damage.knockback`
// rider for its knock-into-hazard fall consequence (D1: consequence-only).
//
// Three layers:
//   1. `fallValueForOccupant` — the shared signed per-occupant fall value
//      (the gate the Worldcraft fall scorer and the knockback path both read).
//   2. `expectedKnockbackFallValue` — projects the post-knockback landing
//      tile (via the engine's `applyKnockback`) and folds the resulting fall
//      at the knockback chance; 0 on flat ground / shove-into-wall.
//   3. `decideBasicAi` — a Knight at a Pit edge picks Bull Rush (the fall
//      payoff tips it over a plain strike); on flat ground it does not.

import { describe, expect, it } from 'vitest';
import {
  abilityId,
  bucketId,
  commandSetId,
  teamId,
  type ActiveAbilityDefinition,
  type Position,
  type StatusFormulaFactors,
  type Tile,
  type Unit,
} from '@engine/index.ts';
import { loadDefaultCatalog } from '../content/index.ts';
import { longSword } from '../content/items/long-sword.ts';
import { attack } from '../content/abilities/attack.ts';
import { bullRush } from '../content/abilities/bull-rush.ts';
import { activeTurnFor, makeGameState, makeUnit } from '../engine/ct/test-fixtures.ts';
import { decideBasicAi, _basicAiInternals } from './basic.ts';

const FIRST = bucketId('first_action');
const BULL_RUSH = abilityId('bull_rush');
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

function knight(id: string, team: 'team_a' | 'team_b', pos: Position): Unit {
  return makeUnit({ id, team, spd: 10, pa: 8, classId: 'knight', maxHpBase: 60, hp: 60, position: pos });
}

// A minimal melee strike carrying a knockback rider. `factors: {}` opts out
// of every factor (full-override semantics), so the expected chance is just
// `chance / 100` — keeps the per-occupant math in the unit tests exact.
function shove(chance: number, factors: StatusFormulaFactors = {}): ActiveAbilityDefinition {
  return {
    id: abilityId('power_attack'), // any registered id; the helper reads only effects
    name: 'Test Shove',
    kind: 'active',
    bucket: FIRST,
    baseCost: 1,
    availability: 'available',
    targeting: { kind: 'single_unit', range: { horizontal: 1, vertical: 3 }, rangeMode: 'melee' },
    actionSpeed: 0,
    mpCost: 0,
    hitRoll: {},
    effects: {
      damage: {
        tags: ['physical', 'weapon'],
        power_coefficient: 1.0,
        variance: { min: 0.9, max: 1.1 },
        knockback: { distance: 1, chance, factors },
      },
    },
  };
}

describe('S66 chunk 1 — fallValueForOccupant (shared signed fall value)', () => {
  const actor = knight('actor', 'team_a', { x: 0, y: 0, layer: 0 });

  it('enemy drop > 1 scores positive (drop 3 → 30 at full-HP killValue 1)', () => {
    const enemy = knight('e', 'team_b', { x: 1, y: 0, layer: 0 });
    expect(_basicAiInternals.fallValueForOccupant(actor, enemy, 3)).toBe(30);
  });

  it('a drop of exactly 1 scores 0 (mirrors the > 1 fall gate)', () => {
    const enemy = knight('e', 'team_b', { x: 1, y: 0, layer: 0 });
    expect(_basicAiInternals.fallValueForOccupant(actor, enemy, 1)).toBe(0);
  });

  it('ally drop is a penalty (friendly fire → −30)', () => {
    const ally = knight('a', 'team_a', { x: 1, y: 0, layer: 0 });
    expect(_basicAiInternals.fallValueForOccupant(actor, ally, 3)).toBe(-30);
  });

  it('a KO’d occupant contributes nothing (a corpse can’t fall)', () => {
    const dead = makeUnit({ id: 'd', team: 'team_b', spd: 10, classId: 'knight', maxHpBase: 60, hp: 0, position: { x: 1, y: 0, layer: 0 } });
    expect(_basicAiInternals.fallValueForOccupant(actor, dead, 3)).toBe(0);
  });
});

describe('S66 chunk 1 — expectedKnockbackFallValue (chance × fall consequence)', () => {
  const cat = loadDefaultCatalog();
  // Actor at (0,0) shoves the victim at (1,0) eastward onto (2,0). Ground is
  // elev 3; the shove tile (2,0) is the variable (a pit, flat, or a wall).
  const actor = knight('actor', 'team_a', { x: 0, y: 0, layer: 0 });
  const victim = knight('v', 'team_b', { x: 1, y: 0, layer: 0 });

  function stateWith(shoveTileElev: number) {
    return makeGameState({
      units: [actor, victim],
      map: gridMap(4, 4, (x, y) => (x === 2 && y === 0 ? shoveTileElev : 3)),
      teams: TEAMS,
      turnState: activeTurnFor(actor.id),
    });
  }

  it('folds the fall at the knockback chance (drop 3, chance 100% → 30)', () => {
    const state = stateWith(0); // (2,0) at elev 0 → drop 3
    const v = _basicAiInternals.expectedKnockbackFallValue(
      state, cat, actor, actor.position, victim.position, victim, shove(100), true,
    );
    expect(v).toBe(30);
  });

  it('scales by a partial chance (drop 3, chance 50% → 15)', () => {
    const state = stateWith(0);
    const v = _basicAiInternals.expectedKnockbackFallValue(
      state, cat, actor, actor.position, victim.position, victim, shove(50), true,
    );
    expect(v).toBe(15);
  });

  it('a shove onto flat ground deals no fall value (consequence-only, D1)', () => {
    const state = stateWith(3); // (2,0) level with the victim → drop 0
    const v = _basicAiInternals.expectedKnockbackFallValue(
      state, cat, actor, actor.position, victim.position, victim, shove(100), true,
    );
    expect(v).toBe(0);
  });

  it('a shove into a wall (too-high tile) cancels → no fall value', () => {
    const state = stateWith(9); // (2,0) far above → knockback cancels, drop 0
    const v = _basicAiInternals.expectedKnockbackFallValue(
      state, cat, actor, actor.position, victim.position, victim, shove(100), true,
    );
    expect(v).toBe(0);
  });

  it('contributes 0 when the direct hit is expected to kill (survival gate)', () => {
    const state = stateWith(0);
    const v = _basicAiInternals.expectedKnockbackFallValue(
      state, cat, actor, actor.position, victim.position, victim, shove(100), false,
    );
    expect(v).toBe(0);
  });

  it('an ability with no knockback rider contributes 0', () => {
    const state = stateWith(0);
    const noRider: ActiveAbilityDefinition = {
      ...shove(100),
      effects: { damage: { tags: ['physical', 'weapon'], power_coefficient: 1.0, variance: { min: 0.9, max: 1.1 } } },
    };
    const v = _basicAiInternals.expectedKnockbackFallValue(
      state, cat, actor, actor.position, victim.position, victim, noRider, true,
    );
    expect(v).toBe(0);
  });
});

describe('S66 chunk 1 — decideBasicAi values Bull Rush for the fall payoff', () => {
  // A Knight with Battle Skill + a Long Sword, adjacent to a full-HP enemy.
  // Both stand on high ground; the tile beyond the enemy (in the shove
  // direction) is the variable.
  function battle(beyondTileElev: number) {
    const cat = loadDefaultCatalog();
    const attacker = makeUnit({
      id: 'kn', spd: 10, pa: 8, hp: 60, mp: 20, classId: 'knight',
      position: { x: 1, y: 1, layer: 0 },
      loadout: { actionBuckets: { [FIRST]: [commandSetId('battle_skill')] }, passiveBuckets: {} },
      equipment: { leftHand: null, rightHand: longSword.id, headgear: null, armor: null, accessory: null },
    });
    const enemy = knight('foe', 'team_b', { x: 2, y: 1, layer: 0 });
    const state = makeGameState({
      units: [attacker, enemy],
      map: gridMap(6, 6, (x, y) => (x === 3 && y === 1 ? beyondTileElev : 6)),
      teams: TEAMS,
      turnState: activeTurnFor(attacker.id),
    });
    return { cat, state, attacker, enemy };
  }

  it('picks Bull Rush when the shove drops the enemy into a deep Pit', () => {
    const { cat, state } = battle(0); // (3,1) at elev 0 → drop 6 → fall 60
    const d = decideBasicAi(state, cat);
    expect(d.kind).toBe('commit');
    if (d.kind !== 'commit' || d.action.type !== 'use_ability') throw new Error('expected use_ability');
    expect(d.action.payload.abilityId).toEqual(BULL_RUSH);
    const t = d.action.payload.target;
    expect(t.kind).toBe('unit');
    if (t.kind === 'unit') expect(t.unitId).toEqual('foe');
  });

  it('does not cast Bull Rush on flat ground (no hazard → no shove bonus)', () => {
    // On flat ground the Knight may legitimately move to flank first; the
    // criterion is only that it does not *cast* Bull Rush absent a payoff.
    const { cat, state } = battle(6); // (3,1) level → drop 0 → fall 0
    const d = decideBasicAi(state, cat);
    if (d.kind === 'commit' && d.action.type === 'use_ability') {
      expect(d.action.payload.abilityId).not.toEqual(BULL_RUSH);
    }
  });
});

describe('S66 chunk 1 — scoreSingleUnitOffensive folds the fall consequence', () => {
  // Knight with a Long Sword adjacent to a full-HP enemy at (2,1); the tile
  // beyond the enemy in the shove direction (3,1) is the variable.
  function setup(beyondTileElev: number) {
    const cat = loadDefaultCatalog();
    // Full MP so the S66 chunk-2 MP-spend penalty is inert — this layer
    // isolates the knockback-fall term from MP economy.
    const attacker = makeUnit({
      id: 'kn', spd: 10, pa: 8, hp: 60, maxMpBase: 20, mp: 20, classId: 'knight',
      position: { x: 1, y: 1, layer: 0 },
      equipment: { leftHand: null, rightHand: longSword.id, headgear: null, armor: null, accessory: null },
    });
    const enemy = knight('foe', 'team_b', { x: 2, y: 1, layer: 0 });
    const state = makeGameState({
      units: [attacker, enemy],
      map: gridMap(6, 6, (x, y) => (x === 3 && y === 1 ? beyondTileElev : 6)),
      teams: TEAMS,
      turnState: activeTurnFor(attacker.id),
    });
    return { cat, state, attacker, enemy };
  }

  it('Bull Rush scores higher into a Pit than on flat ground', () => {
    const pit = setup(0);
    const flat = setup(6);
    const sPit = _basicAiInternals.scoreSingleUnitOffensive(
      pit.state, pit.cat, pit.attacker, pit.attacker.position, pit.enemy, bullRush,
    );
    const sFlat = _basicAiInternals.scoreSingleUnitOffensive(
      flat.state, flat.cat, flat.attacker, flat.attacker.position, flat.enemy, bullRush,
    );
    expect(sPit).toBeGreaterThan(sFlat);
  });

  it('on flat ground Bull Rush scores exactly its plain-strike value (no shove bonus)', () => {
    const flat = setup(6);
    const sBull = _basicAiInternals.scoreSingleUnitOffensive(
      flat.state, flat.cat, flat.attacker, flat.attacker.position, flat.enemy, bullRush,
    );
    const sAttack = _basicAiInternals.scoreSingleUnitOffensive(
      flat.state, flat.cat, flat.attacker, flat.attacker.position, flat.enemy, attack,
    );
    expect(sBull).toBeCloseTo(sAttack, 10);
  });
});
