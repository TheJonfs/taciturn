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
import { tileSetLine, validTileSetLinesFrom, validTileSetAnchors } from './use-turn-flow.ts';

const catalog = loadDefaultCatalog();
const barrierDef = catalog.getAbility(abilityId('barrier'));
if (barrierDef.kind !== 'active') throw new Error('barrier ability must be active');
const barrierAbility = barrierDef;

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
    // A blocker two tiles east of the anchor — any eastward line of length ≥3
    // from (4,4) hits it, so it must be excluded.
    const blocker = makeUnit({ id: 'block', spd: 8, classId: 'knight', position: { x: 6, y: 4, layer: 0 } });
    const state = makeGameState({ units: [u, blocker], map: landMap(12, 12), turnState: activeTurnFor(u.id) });
    const lines = validTileSetLinesFrom(state, catalog, u, barrierAbility, { x: 4, y: 4, layer: 0 });
    for (const line of lines.values()) {
      expect(line.some((p) => p.x === 6 && p.y === 4)).toBe(false);
    }
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
