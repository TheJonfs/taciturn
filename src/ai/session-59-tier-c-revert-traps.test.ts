// Session 59 — Tier C revert-traps (ADR-0096).
//
// When a Terraformer is at its Worldcraft effect cap, the next cast evicts
// (reverts) the oldest queued effect — and reverting a raise drops whoever
// rides its footprint. Tier C values springing that revert when an *enemy*
// currently stands on the evicted raise's footprint, via the Tier A fall
// computation, and HARD-VETOES dropping any ally. No speculative trap-laying
// (the trap must already be loaded and ridden now) and no movement prediction
// — current footprint occupancy only.
//
// Two layers: unit tests on the fall/veto mechanics (`scoreRevertDrop`) and
// the candidate gating (`bestRevertTrapCandidate`), and a `decideBasicAi`
// integration test (the AI springs a loaded trap).

import { describe, expect, it } from 'vitest';
import {
  abilityId,
  bucketId,
  commandSetId,
  teamId,
  type Position,
  type Tile,
  type Unit,
  type WorldcraftEffectEntry,
} from '@engine/index.ts';
import { loadDefaultCatalog } from '../content/index.ts';
import { activeTurnFor, makeGameState, makeUnit } from '../engine/ct/test-fixtures.ts';
import { decideBasicAi, _basicAiInternals } from './basic.ts';

const catalog = loadDefaultCatalog();
const TEAM_A = teamId('team_a');
const TEAM_B = teamId('team_b');
const TEAMS = [
  { id: TEAM_A, name: 'A', control: 'human' as const },
  { id: TEAM_B, name: 'B', control: 'ai' as const },
];
const FIRST = bucketId('first_action');
const WORLDCRAFT = commandSetId('worldcraft');
const PILLAR = abilityId('pillar');

function gridMap(width: number, height: number, elevAt: (x: number, y: number) => number): {
  width: number;
  height: number;
  tiles: Tile[];
} {
  const tiles: Tile[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      tiles.push({ x, y, layer: 0, elevation: elevAt(x, y), terrain: 'ground', properties: [] });
    }
  }
  return { width, height, tiles };
}

// A Terraformer with a Worldcraft loadout and a pre-loaded effect queue.
function terraformer(pos: Position, queue: WorldcraftEffectEntry[], mp = 40): Unit {
  const base = makeUnit({
    id: 'terra', spd: 10, ma: 8, classId: 'terraformer', hp: 50, mp, position: pos,
    loadout: { actionBuckets: { [FIRST]: [WORLDCRAFT] }, passiveBuckets: {} },
  });
  return { ...base, worldcraftEffects: queue };
}

function knight(id: string, team: typeof TEAM_A | typeof TEAM_B, pos: Position): Unit {
  return makeUnit({ id, team, spd: 10, classId: 'knight', maxHpBase: 60, hp: 60, position: pos });
}

// A terrain raise effect: each footprint tile rose from `original` to `new`,
// so its revert drops occupants by (new − original).
function raiseEntry(tiles: ReadonlyArray<{ x: number; y: number; original: number; raised: number }>): WorldcraftEffectEntry {
  return {
    kind: 'terrain',
    abilityId: PILLAR,
    castTick: 0,
    tileChanges: tiles.map((t) => ({
      x: t.x, y: t.y, layer: 0,
      originalElevation: t.original, newElevation: t.raised,
      originalTerrain: 'ground', newTerrain: 'ground',
    })),
  };
}

describe('S59 Tier C — scoreRevertDrop (fall value + never-drop-ally veto)', () => {
  it('values dropping an enemy that rides the reverting footprint', () => {
    const actor = terraformer({ x: 0, y: 0, layer: 0 }, []);
    const enemy = knight('e', TEAM_B, { x: 5, y: 5, layer: 0 });
    const state = makeGameState({ units: [actor, enemy], map: gridMap(6, 6, (x, y) => (x === 5 && y === 5 ? 4 : 0)), teams: TEAMS });
    // Revert drops the enemy 4 levels → 10 × 4 = 40 × killValue(full HP).
    const v = _basicAiInternals.scoreRevertDrop(state, actor, [raiseEntry([{ x: 5, y: 5, original: 0, raised: 4 }])]);
    expect(v).toBeGreaterThan(0);
  });

  it('hard-vetoes (null) when an ally rides any dropping footprint tile', () => {
    const actor = terraformer({ x: 0, y: 0, layer: 0 }, []);
    const ally = knight('a', TEAM_A, { x: 5, y: 5, layer: 0 });
    const state = makeGameState({ units: [actor, ally], map: gridMap(6, 6, () => 0), teams: TEAMS });
    expect(_basicAiInternals.scoreRevertDrop(state, actor, [raiseEntry([{ x: 5, y: 5, original: 0, raised: 4 }])])).toBeNull();
  });

  it('vetoes a mixed friend/enemy cluster (Hill 3×3) — never drop the ally to catch the enemy', () => {
    const actor = terraformer({ x: 0, y: 0, layer: 0 }, []);
    const enemy = knight('e', TEAM_B, { x: 4, y: 4, layer: 0 });
    const ally = knight('a', TEAM_A, { x: 5, y: 4, layer: 0 });
    const state = makeGameState({ units: [actor, enemy, ally], map: gridMap(6, 6, () => 0), teams: TEAMS });
    const hill = raiseEntry([
      { x: 4, y: 4, original: 0, raised: 3 }, // enemy rides (would fall)
      { x: 5, y: 4, original: 0, raised: 2 }, // ally rides → veto
    ]);
    expect(_basicAiInternals.scoreRevertDrop(state, actor, [hill])).toBeNull();
  });

  it('is 0 for an empty footprint (no rider to drop)', () => {
    const actor = terraformer({ x: 0, y: 0, layer: 0 }, []);
    const state = makeGameState({ units: [actor], map: gridMap(6, 6, () => 0), teams: TEAMS });
    expect(_basicAiInternals.scoreRevertDrop(state, actor, [raiseEntry([{ x: 5, y: 5, original: 0, raised: 4 }])])).toBe(0);
  });

  it('is 0 when the enemy drop is only 1 level (below the fall-damage gate)', () => {
    const actor = terraformer({ x: 0, y: 0, layer: 0 }, []);
    const enemy = knight('e', TEAM_B, { x: 5, y: 5, layer: 0 });
    const state = makeGameState({ units: [actor, enemy], map: gridMap(6, 6, () => 0), teams: TEAMS });
    expect(_basicAiInternals.scoreRevertDrop(state, actor, [raiseEntry([{ x: 5, y: 5, original: 0, raised: 1 }])])).toBe(0);
  });
});

describe('S59 Tier C — bestRevertTrapCandidate (cap gating + trigger)', () => {
  it('returns null below the cap (the next cast would not evict)', () => {
    // One queued effect, cap 2 → next cast fits, nothing reverts.
    const trap = raiseEntry([{ x: 5, y: 5, original: 0, raised: 4 }]);
    const actor = terraformer({ x: 0, y: 0, layer: 0 }, [trap]);
    const enemy = knight('e', TEAM_B, { x: 5, y: 5, layer: 0 });
    const state = makeGameState({ units: [actor, enemy], map: gridMap(6, 6, (x, y) => (x === 5 && y === 5 ? 4 : 0)), teams: TEAMS });
    const enumerated = enumerateWorks();
    expect(_basicAiInternals.bestRevertTrapCandidate(state, catalog, actor, enumerated)).toBeNull();
  });

  it('at cap, returns a worldcraft trigger candidate that springs an enemy-ridden trap', () => {
    const trap = raiseEntry([{ x: 5, y: 5, original: 0, raised: 4 }]);
    const filler = raiseEntry([{ x: 1, y: 0, original: 0, raised: 4 }]);
    const actor = terraformer({ x: 0, y: 0, layer: 0 }, [trap, filler]); // length 2 == cap
    const enemy = knight('e', TEAM_B, { x: 5, y: 5, layer: 0 });
    const state = makeGameState({ units: [actor, enemy], map: gridMap(6, 6, (x, y) => ((x === 5 && y === 5) || (x === 1 && y === 0) ? 4 : 0)), teams: TEAMS, turnState: activeTurnFor(actor.id) });
    const cand = _basicAiInternals.bestRevertTrapCandidate(state, catalog, actor, enumerateWorks());
    expect(cand).not.toBeNull();
    expect(cand!.action.type).toBe('use_ability');
    expect(cand!.score).toBeGreaterThan(0);
  });

  it('at cap, vetoes when an ally rides the evicted trap', () => {
    const trap = raiseEntry([{ x: 5, y: 5, original: 0, raised: 4 }]);
    const filler = raiseEntry([{ x: 1, y: 0, original: 0, raised: 4 }]);
    const actor = terraformer({ x: 0, y: 0, layer: 0 }, [trap, filler]);
    const ally = knight('a', TEAM_A, { x: 5, y: 5, layer: 0 });
    const state = makeGameState({ units: [actor, ally], map: gridMap(6, 6, (x, y) => ((x === 5 && y === 5) || (x === 1 && y === 0) ? 4 : 0)), teams: TEAMS });
    expect(_basicAiInternals.bestRevertTrapCandidate(state, catalog, actor, enumerateWorks())).toBeNull();
  });
});

describe('S59 Tier C — decideBasicAi springs a loaded trap', () => {
  it('commits a worldcraft cast to evict an enemy-ridden raise when no closer play exists', () => {
    const trap = raiseEntry([{ x: 5, y: 5, original: 0, raised: 4 }]);
    const filler = raiseEntry([{ x: 1, y: 0, original: 0, raised: 4 }]);
    const actor = terraformer({ x: 0, y: 0, layer: 0 }, [trap, filler]);
    // Enemy far from the Terraformer (out of attack / Pit range) but riding
    // the loaded trap — so the only positive play is to spring it.
    const enemy = knight('e', TEAM_B, { x: 5, y: 5, layer: 0 });
    const state = makeGameState({
      units: [actor, enemy],
      map: gridMap(6, 6, (x, y) => ((x === 5 && y === 5) || (x === 1 && y === 0) ? 4 : 0)),
      teams: TEAMS, turnState: activeTurnFor(actor.id),
    });
    const decision = decideBasicAi(state, catalog);
    expect(decision.kind).toBe('commit');
    if (decision.kind !== 'commit') return;
    expect(decision.action.type).toBe('use_ability');
  });
});

// Enumerate the actor's Worldcraft works the way decideBasicAi does, so the
// candidate gets real raise abilities to use as a trigger.
function enumerateWorks() {
  // bestRevertTrapCandidate only reads `effects.worldcraft` raise specs; the
  // worldcraft command set's pillar/hill qualify. Pull them from the catalog.
  const out = [];
  const cs = catalog.getCommandSet(WORLDCRAFT);
  for (const id of cs.members) {
    if (!catalog.hasAbility(id)) continue;
    const a = catalog.getAbility(id);
    if (a.kind === 'active') out.push(a);
  }
  return out;
}
