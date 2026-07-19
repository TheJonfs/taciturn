// S96 (bridges, ADR-0155) — Worldcraft vs decks: destruction, the ram rule,
// and the validation gates. Real content catalog (Pillar/Pit/Valley).
//
// The rules under pin (Chris's S96 calls):
//   - A LOWERING cast (Pit/Valley) on a deck cell DESTROYS the span —
//     permanent, no effect-queue entry, occupants fall the full true-
//     elevation drop to the tile below (into the river, off the map's
//     authored clearance — wherever layer 0 is).
//   - A RAISING cast aimed at a deck is invalid ("no earth to shape");
//     kernel raises simply skip deck cells.
//   - RAM: a ground raise that would leave clearance < BRIDGE_MIN_CLEARANCE
//     under a deck destroys the deck (chained system_bridge_destroy);
//     its occupant lands on the freshly-risen ground.

import { describe, expect, it } from 'vitest';
import { abilityId, type Action, type BattleMap, type Unit } from '@engine/index.ts';
import { loadDefaultCatalog } from '@content/index.ts';
import { commitAction } from './commit.ts';
import { validateAction } from './validate.ts';
import { makeGameState, makeUnit, activeTurnFor } from '../ct/test-fixtures.ts';
import { mapWith, type TileSpec } from '../map/test-fixtures.ts';

const catalog = loadDefaultCatalog();

// A 5×5 field of ground at elevation 2 with a three-cell deck (layer 1,
// elevation 5 — clearance 3) spanning (2,1)-(2,3).
function bridgedField(): BattleMap {
  const tiles: TileSpec[] = [];
  for (let y = 0; y < 5; y++) {
    for (let x = 0; x < 5; x++) tiles.push({ x, y, elevation: 2 });
  }
  for (const y of [1, 2, 3]) {
    tiles.push({ x: 2, y, layer: 1, elevation: 5, terrain: 'bridge' });
  }
  return mapWith({ width: 5, height: 5, tiles });
}

function terraformer(overrides: Partial<Parameters<typeof makeUnit>[0]> = {}): Unit {
  return makeUnit({
    id: 'terra',
    spd: 8,
    pa: 6,
    ma: 8,
    mp: 100,
    maxMpBase: 100,
    classId: 'calculator',
    position: { x: 0, y: 2, layer: 0 },
    ...overrides,
  });
}

function cast(actor: Unit, ability: string, x: number, y: number, layer: number) {
  return {
    type: 'use_ability' as const,
    source: 'player' as const,
    actorId: actor.id,
    payload: {
      abilityId: abilityId(ability),
      target: { kind: 'tile' as const, position: { x, y, layer } },
    },
  };
}

const destroysFrom = (committed: ReadonlyArray<Action>) =>
  committed.filter((a) => a.type === 'system_bridge_destroy');

describe('Pit on a deck — destruction', () => {
  it('removes the span permanently, drops the occupant, and consumes NO queue slot', () => {
    const terra = terraformer();
    const mark = makeUnit({
      id: 'mark',
      spd: 10,
      hp: 100,
      maxHpBase: 100,
      team: 'team_b',
      position: { x: 2, y: 2, layer: 1 }, // standing mid-span
    });
    const state = makeGameState({
      units: [terra, mark],
      map: bridgedField(),
      turnState: activeTurnFor(terra.id),
    });
    const r = commitAction(state, cast(terra, 'pit', 2, 2, 1), catalog);
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    // The deck tile is gone; the river of ground beneath is untouched.
    const stackAfter = r.newState.map.tiles.filter((t) => t.x === 2 && t.y === 2);
    expect(stackAfter).toHaveLength(1);
    expect(stackAfter[0]!.layer).toBe(0);

    // The destroy committed with the fall recorded.
    const destroy = destroysFrom(r.committed)[0]!;
    expect(destroy).toBeDefined();
    if (destroy.type !== 'system_bridge_destroy') return;
    expect(destroy.outcome?.appliedCount).toBe(1);
    expect(destroy.outcome?.fallen).toHaveLength(1);
    expect(destroy.outcome?.fallen[0]).toMatchObject({
      unitId: mark.id,
      to: { x: 2, y: 2, layer: 0 },
      drop: 3,
    });

    // The occupant relocated to layer 0 and took falling damage (drop 3 > 1).
    const markAfter = r.newState.units.get(mark.id)!;
    expect(markAfter.position).toEqual({ x: 2, y: 2, layer: 0 });
    expect(markAfter.vitals.hp).toBeLessThan(100);

    // Permanent: no Worldcraft effect-queue entry for a destroy-only cast.
    expect(r.newState.units.get(terra.id)!.worldcraftEffects).toHaveLength(0);
  });

  it('an occupied under-tile displaces the faller to the first free cardinal neighbor', () => {
    const terra = terraformer();
    const above = makeUnit({
      id: 'above', spd: 10, hp: 100, maxHpBase: 100, team: 'team_b',
      position: { x: 2, y: 2, layer: 1 },
    });
    const below = makeUnit({
      id: 'below', spd: 10, hp: 100, maxHpBase: 100, team: 'team_b',
      position: { x: 2, y: 2, layer: 0 }, // wading under the span
    });
    const state = makeGameState({
      units: [terra, above, below],
      map: bridgedField(),
      turnState: activeTurnFor(terra.id),
    });
    const r = commitAction(state, cast(terra, 'pit', 2, 2, 1), catalog);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const aboveAfter = r.newState.units.get(above.id)!;
    // N/E/S/W scan → first free is (2,1) at layer 0.
    expect(aboveAfter.position).toEqual({ x: 2, y: 1, layer: 0 });
    // The under-stander is untouched.
    expect(r.newState.units.get(below.id)!.position).toEqual({ x: 2, y: 2, layer: 0 });
  });

  it('rejects the cast when the faller would have nowhere to land', () => {
    const terra = terraformer({ position: { x: 0, y: 0, layer: 0 } });
    const above = makeUnit({
      id: 'above', spd: 10, team: 'team_b', position: { x: 2, y: 2, layer: 1 },
    });
    const blockers = [
      { id: 'b1', x: 2, y: 2 }, // under
      { id: 'b2', x: 2, y: 1 },
      { id: 'b3', x: 3, y: 2 },
      { id: 'b4', x: 2, y: 3 },
      { id: 'b5', x: 1, y: 2 },
    ].map((b) =>
      makeUnit({ id: b.id, spd: 10, team: 'team_b', position: { x: b.x, y: b.y, layer: 0 } }),
    );
    const state = makeGameState({
      units: [terra, above, ...blockers],
      map: bridgedField(),
      turnState: activeTurnFor(terra.id),
    });
    const v = validateAction(
      state,
      {
        ...cast(terra, 'pit', 2, 2, 1),
        sequenceNumber: 0, seed: 1, timestamp: { tick: 0, ct: 0 }, chainDepth: 0, isReaction: false,
      },
      catalog,
    );
    expect(v.valid).toBe(false);
    if (!v.valid) expect(v.reason).toMatch(/No landing/);
  });
});

describe('raises vs decks', () => {
  it('Pillar aimed at a deck is invalid — no earth to shape', () => {
    const terra = terraformer();
    const state = makeGameState({
      units: [terra],
      map: bridgedField(),
      turnState: activeTurnFor(terra.id),
    });
    const v = validateAction(
      state,
      {
        ...cast(terra, 'pillar', 2, 2, 1),
        sequenceNumber: 0, seed: 1, timestamp: { tick: 0, ct: 0 }, chainDepth: 0, isReaction: false,
      },
      catalog,
    );
    expect(v.valid).toBe(false);
    if (!v.valid) expect(v.reason).toMatch(/Cannot raise a bridge/);
  });

  it('RAM: a Pillar under the span destroys it and its occupant lands on the risen ground', () => {
    const terra = terraformer({ position: { x: 2, y: 4, layer: 0 } });
    const above = makeUnit({
      id: 'above', spd: 10, hp: 100, maxHpBase: 100, team: 'team_b',
      position: { x: 2, y: 2, layer: 1 },
    });
    const state = makeGameState({
      units: [terra, above],
      map: bridgedField(),
      turnState: activeTurnFor(terra.id),
    });
    // Pillar +4 on the ground UNDER the mid-span: 2 → 6, which crowds the
    // deck (elev 5) far past min clearance → the span is rammed apart.
    // (The arc cover gate is exempt for elevation Worldcraft — this cast
    // aims at a covered tile by design.)
    const r2 = commitAction(state, cast(terra, 'pillar', 2, 2, 0), catalog);
    expect(r2.ok).toBe(true);
    if (!r2.ok) return;
    const destroy = destroysFrom(r2.committed)[0]!;
    expect(destroy).toBeDefined();
    if (destroy.type !== 'system_bridge_destroy') return;
    expect(destroy.outcome?.appliedCount).toBe(1);
    // The deck is gone; the ground rose to 6.
    const stack = r2.newState.map.tiles.filter((t) => t.x === 2 && t.y === 2);
    expect(stack).toHaveLength(1);
    expect(stack[0]!.elevation).toBe(6);
    // The occupant landed on the risen pillar — no real drop, no damage.
    const aboveAfter = r2.newState.units.get(above.id)!;
    expect(aboveAfter.position).toEqual({ x: 2, y: 2, layer: 0 });
    expect(aboveAfter.vitals.hp).toBe(100);
  });
});

describe('Valley kernels spanning deck + ground', () => {
  it('reshapes the ground cells (queued) and destroys the deck cells (permanent)', () => {
    const terra = terraformer({ position: { x: 2, y: 2, layer: 1 } });
    // Anchor ON the mid-span: the 3×3 kernel at layer 1 finds only the
    // three deck cells (the rest have no layer-1 tile) — all destroyed;
    // no terrain change, no queue entry.
    const state = makeGameState({
      units: [terra],
      map: bridgedField(),
      turnState: activeTurnFor(terra.id),
    });
    const r = commitAction(state, cast(terra, 'valley', 2, 2, 1), catalog);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const destroy = destroysFrom(r.committed)[0]!;
    if (destroy.type !== 'system_bridge_destroy') return;
    expect(destroy.outcome?.appliedCount).toBe(3); // the whole span
    expect(r.newState.map.tiles.filter((t) => t.layer === 1)).toHaveLength(0);
    expect(r.newState.units.get(terra.id)!.worldcraftEffects).toHaveLength(0);
  });
});
