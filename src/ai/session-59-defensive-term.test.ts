// Session 59 — defensive above-melee-reach term (ADR-0095).
//
// The first consumer of the coverage map (ADR-0094): among equal-offence
// plans, the AI prefers the one exposing it to less incoming damage (a
// tie-break — offence still decides whether/what to attack, so engagement is
// never suppressed). Two layers: unit tests on the residual-danger mechanics
// (`residualDangerForPlan` / `planKoTargetId`, where the discount lives) and
// `decideBasicAi` integration tests (the headline behaviours — kite to
// safety, don't dodge an enemy you're about to kill, still engage when no
// safe tile exists, inert when unthreatened).
//
// "Safe high ground" is tested at the geometry level in
// coverage-map.test.ts (a melee swing can't reach a tile above its vertical
// reach, a bow can). Here the safety is expressed as distance (out of a
// melee enemy's reach) — the same coverage-map mechanism, easier to set up
// without ramp/jump constraints.

import { describe, expect, it } from 'vitest';
import {
  bucketId,
  commandSetId,
  teamId,
  type ProposedAction,
  type Tile,
  type Unit,
  abilityId,
  unitId,
} from '@engine/index.ts';
import { loadDefaultCatalog } from '../content/index.ts';
import { activeTurnFor, makeGameState, makeUnit } from '../engine/ct/test-fixtures.ts';
import { decideBasicAi, _basicAiInternals } from './basic.ts';
import { buildCoverageMap } from './threat/coverage-map.ts';

const catalog = loadDefaultCatalog();
const TEAM_A = teamId('team_a');
const TEAM_B = teamId('team_b');
const TEAMS = [
  { id: TEAM_A, name: 'A', control: 'human' as const },
  { id: TEAM_B, name: 'B', control: 'ai' as const },
];
const FIRST = bucketId('first_action');
const LIGHTNING_SPELLS = commandSetId('lightning_spells');
const LIGHTNING_STRIKE = abilityId('lightning_strike');

function flat(width: number, height: number): Tile[] {
  const tiles: Tile[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      tiles.push({ x, y, layer: 0, elevation: 0, terrain: 'ground', properties: [] });
    }
  }
  return tiles;
}

function mage(x: number, y: number): Unit {
  return makeUnit({
    id: 'mage', spd: 12, ma: 8, hp: 44, mp: 44, classId: 'lightning_mage',
    position: { x, y, layer: 0 },
    loadout: { actionBuckets: { [FIRST]: [LIGHTNING_SPELLS] }, passiveBuckets: {} },
  });
}

// A Lightning Strike from an MA-8 mage projects ~61 damage, so a "survives
// the shot" target needs maxHpBase/hp above that.
function knight(id: string, x: number, y: number, hp = 60, pa = 5, maxHpBase = 60): Unit {
  return makeUnit({ id, team: TEAM_B, spd: 10, pa, maxHpBase, hp, classId: 'knight', position: { x, y, layer: 0 } });
}

function strikeAt(id: string): ProposedAction {
  return {
    type: 'use_ability',
    source: 'player',
    actorId: unitId('mage'),
    payload: { abilityId: LIGHTNING_STRIKE, target: { kind: 'unit', unitId: unitId(id) } },
  };
}

describe('S59 defensive term — residual-danger mechanics', () => {
  it('is 0 when there is no coverage map', () => {
    const actor = mage(2, 2);
    const penalty = _basicAiInternals.residualDangerForPlan(
      makeGameState({ units: [actor], map: { width: 4, height: 4, tiles: flat(4, 4) }, teams: TEAMS }),
      catalog, null, actor, actor.position, strikeAt('whoever'),
    );
    expect(penalty).toBe(0);
  });

  it('is positive when a melee enemy can reach the source tile and the plan does not kill it', () => {
    const actor = mage(2, 2);
    const enemy = knight('e', 3, 2, /* hp */ 100, /* pa */ 5, /* maxHpBase */ 100); // adjacent, survives the shot
    const state = makeGameState({ units: [actor, enemy], map: { width: 6, height: 6, tiles: flat(6, 6) }, teams: TEAMS });
    const coverage = buildCoverageMap(state, catalog, actor, [actor.position]);

    expect(coverage.expectedIncoming(actor.position)).toBeGreaterThan(0);
    const penalty = _basicAiInternals.residualDangerForPlan(
      state, catalog, coverage, actor, actor.position, strikeAt('e'),
    );
    expect(penalty).toBeGreaterThan(0);
  });

  it('discounts a threat the plan would KO (no penalty for dodging an enemy you kill)', () => {
    const actor = mage(2, 2);
    const enemy = knight('e', 3, 2, /* hp */ 5); // a Lightning Strike one-shots this
    const state = makeGameState({ units: [actor, enemy], map: { width: 6, height: 6, tiles: flat(6, 6) }, teams: TEAMS });
    const coverage = buildCoverageMap(state, catalog, actor, [actor.position]);

    // The raw danger is real...
    expect(coverage.expectedIncoming(actor.position)).toBeGreaterThan(0);
    // ...but a plan that KOs the sole threat carries no defensive penalty.
    const penalty = _basicAiInternals.residualDangerForPlan(
      state, catalog, coverage, actor, actor.position, strikeAt('e'),
    );
    expect(penalty).toBe(0);
  });

  it('planKoTargetId reports the target only when the shot is lethal', () => {
    const actor = mage(2, 2);
    const lethal = knight('low', 3, 2, 5);
    const tough = knight('tough', 3, 3, /* hp */ 100, /* pa */ 5, /* maxHpBase */ 100);
    const state = makeGameState({ units: [actor, lethal, tough], map: { width: 6, height: 6, tiles: flat(6, 6) }, teams: TEAMS });

    expect(_basicAiInternals.planKoTargetId(state, catalog, actor, actor.position, strikeAt('low'))).toBe('low');
    expect(_basicAiInternals.planKoTargetId(state, catalog, actor, actor.position, strikeAt('tough'))).toBeNull();
  });
});

describe('S59 defensive term — decideBasicAi behaviour', () => {
  it('kites to a melee-safe tile when an equal-offence safe tile exists', () => {
    // Mage at (4,1) can hit the (harmless) shoot target from here, but a
    // melee threat at (0,1) reaches (4,1). Stepping east to (5,1) keeps the
    // target in cast range while leaving the melee threat's reach (move 3 +
    // reach 1 = 4 < distance 5). The AI should commit the Move to (5,1).
    const actor = mage(4, 1);
    const target = knight('target', 8, 1, 30, /* pa */ 0); // harmless; only a target
    const threat = knight('threat', 0, 1, 60, /* pa */ 5);
    const state = makeGameState({
      units: [actor, target, threat],
      map: { width: 10, height: 3, tiles: flat(10, 3) },
      teams: TEAMS, turnState: activeTurnFor(unitId('mage')),
    });

    const decision = decideBasicAi(state, catalog);
    expect(decision.kind).toBe('commit');
    if (decision.kind !== 'commit') return;
    expect(decision.action.type).toBe('move');
    if (decision.action.type !== 'move') return;
    expect(decision.action.payload.destination).toEqual({ x: 5, y: 1, layer: 0 });
  });

  it('attacks in place when the shot kills the threatening target (no needless kite)', () => {
    // Sole enemy is both the threat and a one-shot kill. The discount means
    // the AI stays and kills rather than side-stepping a soon-dead enemy.
    const actor = mage(4, 1);
    const enemy = knight('e', 3, 1, /* hp */ 5);
    const state = makeGameState({
      units: [actor, enemy],
      map: { width: 10, height: 3, tiles: flat(10, 3) },
      teams: TEAMS, turnState: activeTurnFor(unitId('mage')),
    });

    const decision = decideBasicAi(state, catalog);
    expect(decision.kind).toBe('commit');
    if (decision.kind !== 'commit') return;
    expect(decision.action.type).toBe('use_ability');
  });

  it('still engages from an exposed tile when no safer firing tile exists', () => {
    // The target (full HP, survives) sits adjacent; every tile in cast range
    // is also within the target's own melee reach, so there is no safe
    // alternative. The conservative dial must not turn a worthwhile attack
    // into inaction — the AI attacks.
    const actor = mage(2, 1);
    const enemy = knight('e', 3, 1, /* hp */ 100, /* pa */ 5, /* maxHpBase */ 100); // survives the shot
    const state = makeGameState({
      units: [actor, enemy],
      map: { width: 4, height: 3, tiles: flat(4, 3) }, // tight board — nowhere safe to retreat
      teams: TEAMS, turnState: activeTurnFor(unitId('mage')),
    });

    const decision = decideBasicAi(state, catalog);
    expect(decision.kind).toBe('commit');
    if (decision.kind !== 'commit') return;
    // Either an in-place strike or a move that still sets up the strike —
    // never end-turn. The point: it doesn't refuse to act out of caution.
    expect(['use_ability', 'move']).toContain(decision.action.type);
  });

  it('is inert when no enemy can threaten the actor (attacks the target normally)', () => {
    // The only enemy is harmless-distance away from threatening the mage's
    // firing tile but in cast range; with zero incoming danger the defensive
    // term does nothing and the AI strikes in place.
    const actor = mage(4, 1);
    const enemy = knight('e', 7, 1, 30, /* pa */ 0); // pa 0 → no incoming danger
    const state = makeGameState({
      units: [actor, enemy],
      map: { width: 10, height: 3, tiles: flat(10, 3) },
      teams: TEAMS, turnState: activeTurnFor(unitId('mage')),
    });

    const decision = decideBasicAi(state, catalog);
    expect(decision.kind).toBe('commit');
    if (decision.kind !== 'commit') return;
    expect(decision.action.type).toBe('use_ability');
  });
});
