// Session 55 — tile_set (Worldcraft Barrier) targeting helpers. These back
// the `tile-set-target-select` picker: `tileSetLine` is the pure click-far-end
// geometry; `validTileSetLinesFrom` / `validTileSetAnchors` enumerate the
// engine-valid options the picker highlights. The point of the tests is that
// what the picker *offers* matches what `validateAction` will *accept* — the
// bug was the picker building a bare `tile` target the engine rejected.

import { describe, expect, it } from 'vitest';
import { abilityId, validateAction, type BattleMap, type Unit } from '@engine/index.ts';
import { loadDefaultCatalog } from '../content/index.ts';
import { makeGameState, makeUnit, activeTurnFor } from '../engine/ct/test-fixtures.ts';
import { mapWith } from '../engine/map/test-fixtures.ts';
import { tileSetLine, validTileSetLinesFrom, validTileSetAnchors, elevationKernelCells, computeLegalTargets, buildAction } from './use-turn-flow.ts';

const catalog = loadDefaultCatalog();
const barrierDef = catalog.getAbility(abilityId('barrier'));
if (barrierDef.kind !== 'active') throw new Error('barrier ability must be active');
const barrierAbility = barrierDef;

function deltasOf(id: string): ReadonlyArray<{ dx: number; dy: number; delta: number }> {
  const def = catalog.getAbility(abilityId(id));
  if (def.kind !== 'active' || def.effects.worldcraft?.kind !== 'elevation') {
    throw new Error(`${id} is not an elevation Worldcraft ability`);
  }
  return def.effects.worldcraft.deltas;
}

function landMap(width: number, height: number, elevation = 4): BattleMap {
  const tiles = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) tiles.push({ x, y, elevation });
  }
  return mapWith({ width, height, tiles });
}

function terraformer(overrides: Partial<Parameters<typeof makeUnit>[0]> = {}): Unit {
  return makeUnit({
    id: 'terra', spd: 8, pa: 6, ma: 8, mp: 100, maxMpBase: 100,
    classId: 'calculator', position: { x: 4, y: 4, layer: 0 }, ...overrides,
  });
}

describe('tileSetLine — click-far-end geometry', () => {
  const A = { x: 2, y: 2, layer: 0 };

  it('builds an inclusive horizontal line of the picked length', () => {
    expect(tileSetLine(A, { x: 4, y: 2, layer: 0 }, 3, 5)).toEqual([
      { x: 2, y: 2, layer: 0 }, { x: 3, y: 2, layer: 0 }, { x: 4, y: 2, layer: 0 },
    ]);
  });

  it('builds a vertical line descending from the anchor', () => {
    expect(tileSetLine(A, { x: 2, y: 5, layer: 0 }, 3, 5)).toHaveLength(4);
  });

  it('rejects a diagonal (non-axis-aligned) far end', () => {
    expect(tileSetLine(A, { x: 4, y: 4, layer: 0 }, 3, 5)).toBeNull();
  });

  it('rejects a line shorter than minLength', () => {
    expect(tileSetLine(A, { x: 3, y: 2, layer: 0 }, 3, 5)).toBeNull(); // length 2
  });

  it('rejects a line longer than maxLength', () => {
    expect(tileSetLine(A, { x: 8, y: 2, layer: 0 }, 3, 5)).toBeNull(); // length 7
  });

  it('rejects a far end on a different layer', () => {
    expect(tileSetLine(A, { x: 4, y: 2, layer: 1 }, 3, 5)).toBeNull();
  });
});

describe('validTileSetLinesFrom — engine-valid lines from an anchor', () => {
  it('every offered line passes validateAction as a tile_set', () => {
    const u = terraformer(); // caster at (4,4)
    const state = makeGameState({ units: [u], map: landMap(12, 12), turnState: activeTurnFor(u.id) });
    // Anchor off the caster's own tile (the caster occupies (4,4), which a
    // barrier can't be placed on), within range.
    const anchor = { x: 2, y: 4, layer: 0 };
    const lines = validTileSetLinesFrom(state, catalog, u, barrierAbility, anchor);
    expect(lines.size).toBeGreaterThan(0);
    for (const line of lines.values()) {
      expect(line.length).toBeGreaterThanOrEqual(3);
      expect(line.length).toBeLessThanOrEqual(5);
      const v = validateAction(
        state,
        { type: 'use_ability', source: 'player', actorId: u.id, payload: { abilityId: barrierAbility.id, target: { kind: 'tile_set', positions: line } } },
        catalog,
      );
      expect(v.valid).toBe(true);
    }
  });

  it('excludes lines that would cross an occupied tile', () => {
    const u = terraformer({ position: { x: 4, y: 4, layer: 0 } });
    // A blocker one tile east of the anchor — any eastward line of length ≥3
    // from (4,4) hits it, so it must be excluded.
    const blocker = makeUnit({ id: 'block', spd: 8, classId: 'knight', position: { x: 5, y: 4, layer: 0 } });
    const state = makeGameState({ units: [u, blocker], map: landMap(12, 12), turnState: activeTurnFor(u.id) });
    const lines = validTileSetLinesFrom(state, catalog, u, barrierAbility, { x: 4, y: 4, layer: 0 });
    for (const line of lines.values()) {
      expect(line.some((p) => p.x === 6 && p.y === 4)).toBe(false);
    }
  });
});

describe('elevationKernelCells — Hill/Valley/Pillar hover preview', () => {
  it('Hill yields the full 3×3 kernel (center +3, edges +2, corners +1) when in bounds', () => {
    const cells = elevationKernelCells(12, 12, deltasOf('hill'), { x: 5, y: 5, layer: 0 });
    expect(cells).toHaveLength(9);
    const byPos = new Map(cells.map((c) => [`${c.position.x},${c.position.y}`, c.delta]));
    expect(byPos.get('5,5')).toBe(3); // center
    expect(byPos.get('5,4')).toBe(2); // edge
    expect(byPos.get('4,4')).toBe(1); // corner
  });

  it('Valley yields the negated kernel', () => {
    const cells = elevationKernelCells(12, 12, deltasOf('valley'), { x: 5, y: 5, layer: 0 });
    const byPos = new Map(cells.map((c) => [`${c.position.x},${c.position.y}`, c.delta]));
    expect(byPos.get('5,5')).toBe(-3);
    expect(byPos.get('4,4')).toBe(-1);
  });

  it('Pillar yields a single +4 cell (post-S55 tune)', () => {
    const cells = elevationKernelCells(12, 12, deltasOf('pillar'), { x: 5, y: 5, layer: 0 });
    expect(cells).toEqual([{ position: { x: 5, y: 5, layer: 0 }, delta: 4 }]);
  });

  it('drops kernel offsets that fall off the map edge (corner anchor)', () => {
    const cells = elevationKernelCells(12, 12, deltasOf('hill'), { x: 0, y: 0, layer: 0 });
    expect(cells).toHaveLength(4); // anchor + east + south + SE
  });
});

describe('attacking a barrier with a basic (single_unit) attack — S55 UI gap fix', () => {
  const attack = catalog.getAbility(abilityId('attack'));
  if (attack.kind !== 'active') throw new Error('attack must be active');
  const barrierState = { hp: 48, ttl: 50, ownerId: 'someone' as Unit['id'] };

  // A land map with a single barrier one tile east of the attacker.
  function mapWithBarrier(): BattleMap {
    const tiles = [];
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        tiles.push({ x, y, elevation: 4, ...(x === 5 && y === 4 ? { barrier: barrierState } : {}) });
      }
    }
    return mapWith({ width: 8, height: 8, tiles });
  }

  it('computeLegalTargets offers the barrier tile to a damaging single_unit ability', () => {
    const u = makeUnit({ id: 'attacker', spd: 8, classId: 'knight', position: { x: 4, y: 4, layer: 0 } });
    const state = makeGameState({ units: [u], map: mapWithBarrier(), turnState: activeTurnFor(u.id) });
    const targets = computeLegalTargets(state, catalog, u, attack, false);
    expect(targets.tilePositions.has('5,4,0')).toBe(true);
  });

  it('buildAction builds a tile target when a damaging single_unit ability clicks an empty (barrier) tile', () => {
    const u = makeUnit({ id: 'attacker', spd: 8, classId: 'knight', position: { x: 4, y: 4, layer: 0 } });
    const action = buildAction(u.id, attack, { x: 5, y: 4, layer: 0 }, null, false);
    expect(action).not.toBeNull();
    expect(action?.type).toBe('use_ability');
    if (action?.type === 'use_ability') expect(action.payload.target).toEqual({ kind: 'tile', position: { x: 5, y: 4, layer: 0 } });
  });

  it('the built tile-target action validates against a real barrier tile', () => {
    const u = makeUnit({ id: 'attacker', spd: 8, classId: 'knight', position: { x: 4, y: 4, layer: 0 } });
    const state = makeGameState({ units: [u], map: mapWithBarrier(), turnState: activeTurnFor(u.id) });
    const action = buildAction(u.id, attack, { x: 5, y: 4, layer: 0 }, null, false);
    expect(action).not.toBeNull();
    expect(validateAction(state, { ...action!, actorId: u.id }, catalog).valid).toBe(true);
  });
});

describe('validTileSetAnchors — highlightable line starts', () => {
  it('offers anchors only where a valid barrier line can begin, all in range', () => {
    const u = terraformer();
    const state = makeGameState({ units: [u], map: landMap(12, 12), turnState: activeTurnFor(u.id) });
    const anchors = validTileSetAnchors(state, catalog, u, barrierAbility);
    expect(anchors.length).toBeGreaterThan(0);
    // Each anchor must itself yield at least one engine-valid line.
    for (const a of anchors) {
      expect(validTileSetLinesFrom(state, catalog, u, barrierAbility, a).size).toBeGreaterThan(0);
    }
  });
});
