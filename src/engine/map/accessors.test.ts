import { OutOfBoundsError } from '../types/index.ts';
import { makeGameState, makeUnit } from '../ct/test-fixtures.ts';
import { tileAt, tilesAt, unitAt } from './accessors.ts';
import { flatMap, mapWith } from './test-fixtures.ts';

describe('tilesAt', () => {
  it('returns the single tile at a populated coordinate', () => {
    const map = flatMap(3, 3);
    const result = tilesAt(map, 1, 1);
    expect(result).toHaveLength(1);
    expect(result[0]!).toMatchObject({ x: 1, y: 1, layer: 0 });
  });

  it('returns every tile across layers at the same (x, y)', () => {
    const map = mapWith({
      width: 2,
      height: 2,
      tiles: [
        { x: 0, y: 0 },
        { x: 0, y: 0, layer: 1, elevation: 5 },
        { x: 1, y: 0 },
      ],
    });
    const result = tilesAt(map, 0, 0);
    expect(result).toHaveLength(2);
    expect(result.map((t) => t.layer).sort()).toEqual([0, 1]);
  });

  it('returns [] for an in-bounds coordinate that has no tile', () => {
    const map = mapWith({ width: 3, height: 3, tiles: [{ x: 0, y: 0 }] });
    expect(tilesAt(map, 2, 2)).toEqual([]);
  });

  it('throws OutOfBoundsError for coordinates outside the map', () => {
    const map = flatMap(3, 3);
    expect(() => tilesAt(map, 3, 0)).toThrow(OutOfBoundsError);
    expect(() => tilesAt(map, 0, 3)).toThrow(OutOfBoundsError);
    expect(() => tilesAt(map, -1, 0)).toThrow(OutOfBoundsError);
    expect(() => tilesAt(map, 0, -1)).toThrow(OutOfBoundsError);
  });
});

describe('tileAt', () => {
  it('returns the tile at the exact (x, y, layer)', () => {
    const map = mapWith({
      width: 2,
      height: 2,
      tiles: [
        { x: 0, y: 0 },
        { x: 0, y: 0, layer: 1, elevation: 5 },
      ],
    });
    expect(tileAt(map, 0, 0, 0)!.elevation).toBe(0);
    expect(tileAt(map, 0, 0, 1)!.elevation).toBe(5);
  });

  it('returns undefined when no tile exists at that layer', () => {
    const map = flatMap(2, 2);
    expect(tileAt(map, 0, 0, 1)).toBeUndefined();
  });

  it('throws OutOfBoundsError when (x, y) is outside the map', () => {
    const map = flatMap(2, 2);
    expect(() => tileAt(map, 5, 0, 0)).toThrow(OutOfBoundsError);
  });
});

describe('unitAt', () => {
  it('returns the unit standing at (x, y, layer)', () => {
    const u = makeUnit({ id: 'u1', spd: 10, position: { x: 1, y: 2, layer: 0 } });
    const state = makeGameState({ units: [u], map: flatMap(3, 3) });
    expect(unitAt(state, 1, 2, 0)?.id).toBe(u.id);
  });

  it('returns undefined when no unit occupies the position', () => {
    const u = makeUnit({ id: 'u1', spd: 10 });
    const state = makeGameState({ units: [u], map: flatMap(3, 3) });
    expect(unitAt(state, 2, 2, 0)).toBeUndefined();
  });

  it('discriminates by layer', () => {
    const u = makeUnit({ id: 'u1', spd: 10, position: { x: 0, y: 0, layer: 1 } });
    const state = makeGameState({ units: [u], map: flatMap(2, 2) });
    expect(unitAt(state, 0, 0, 0)).toBeUndefined();
    expect(unitAt(state, 0, 0, 1)?.id).toBe(u.id);
  });

  it('throws OutOfBoundsError when (x, y) is outside the map', () => {
    const state = makeGameState({ map: flatMap(2, 2) });
    expect(() => unitAt(state, 5, 0, 0)).toThrow(OutOfBoundsError);
  });
});
