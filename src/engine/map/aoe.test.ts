import { aoeFootprint, shapeOffsets, type AoeShape } from './aoe.ts';
import { flatMap, mapWith } from './test-fixtures.ts';

describe('shapeOffsets', () => {
  it('single tile is just (0, 0)', () => {
    expect(shapeOffsets({ kind: 'tile' })).toEqual([{ dx: 0, dy: 0 }]);
  });

  it('diamond radius 1 is the 5-tile plus pattern', () => {
    const offs = shapeOffsets({ kind: 'diamond', radius: 1 });
    expect(offs).toHaveLength(5);
    expect(offs).toEqual(
      expect.arrayContaining([
        { dx: 0, dy: 0 },
        { dx: 1, dy: 0 },
        { dx: -1, dy: 0 },
        { dx: 0, dy: 1 },
        { dx: 0, dy: -1 },
      ]),
    );
  });

  it('diamond radius 2 has 13 tiles', () => {
    expect(shapeOffsets({ kind: 'diamond', radius: 2 })).toHaveLength(13);
  });

  it('square radius 1 has 9 tiles (full 3x3)', () => {
    expect(shapeOffsets({ kind: 'square', radius: 1 })).toHaveLength(9);
  });

  it('square radius 2 has 25 tiles', () => {
    expect(shapeOffsets({ kind: 'square', radius: 2 })).toHaveLength(25);
  });

  it('cross radius 2 has 9 tiles (1 center + 4 arms × 2)', () => {
    expect(shapeOffsets({ kind: 'cross', radius: 2 })).toHaveLength(9);
  });

  it('custom returns the supplied offsets verbatim', () => {
    const offs = [{ dx: 0, dy: 0 }, { dx: 7, dy: -3 }];
    expect(shapeOffsets({ kind: 'custom', offsets: offs })).toEqual(offs);
  });
});

describe('aoeFootprint — basic shapes on a flat map', () => {
  const map = flatMap(5, 5);

  it('single tile at the anchor', () => {
    const tiles = aoeFootprint({
      map,
      anchor: { x: 2, y: 2, elevation: 0 },
      shape: { kind: 'tile' },
      verticalTolerance: 0,
    });
    expect(tiles).toHaveLength(1);
    expect(tiles[0]).toMatchObject({ x: 2, y: 2 });
  });

  it('diamond radius 1 at center yields 5 tiles', () => {
    const tiles = aoeFootprint({
      map,
      anchor: { x: 2, y: 2, elevation: 0 },
      shape: { kind: 'diamond', radius: 1 },
      verticalTolerance: 0,
    });
    expect(tiles).toHaveLength(5);
  });

  it('diamond radius 2 clips at the corner of the map', () => {
    // Anchor at (0, 0) — only the in-bounds portion of a radius-2 diamond
    // is included.
    const tiles = aoeFootprint({
      map,
      anchor: { x: 0, y: 0, elevation: 0 },
      shape: { kind: 'diamond', radius: 2 },
      verticalTolerance: 0,
    });
    // Of 13 offsets, only the ones with x >= 0 and y >= 0 are in bounds:
    // (0,0), (1,0), (2,0), (0,1), (1,1), (0,2) → 6.
    expect(tiles).toHaveLength(6);
  });
});

describe('aoeFootprint — vertical tolerance', () => {
  it('excludes tiles whose elevation differs from the anchor by more than verticalTolerance', () => {
    // 3-tile strip at y=0; middle tile at elev 5.
    const map = mapWith({
      width: 3,
      height: 1,
      tiles: [
        { x: 0, y: 0 },
        { x: 1, y: 0, elevation: 5 },
        { x: 2, y: 0 },
      ],
    });
    const tiles = aoeFootprint({
      map,
      anchor: { x: 1, y: 0, elevation: 0 },
      shape: { kind: 'cross', radius: 1 },
      verticalTolerance: 1,
    });
    // Anchor elev 0; tiles at elev 0 (x=0, x=2) are within tolerance,
    // tile at elev 5 (x=1) is not. Cross radius 1 also includes (1, 1)
    // and (1, -1) but those are out of bounds (height=1).
    expect(tiles.map((t) => ({ x: t.x, y: t.y })).sort((a, b) => a.x - b.x)).toEqual([
      { x: 0, y: 0 },
      { x: 2, y: 0 },
    ]);
  });

  it('includes all qualifying layers at the same (x, y)', () => {
    // (1, 0) has both a layer-0 ground tile and a layer-1 bridge.
    // Both within tolerance → both affected.
    const map = mapWith({
      width: 3,
      height: 1,
      tiles: [
        { x: 0, y: 0 },
        { x: 1, y: 0, elevation: 0 },
        { x: 1, y: 0, layer: 1, elevation: 1 },
        { x: 2, y: 0 },
      ],
    });
    const tiles = aoeFootprint({
      map,
      anchor: { x: 1, y: 0, elevation: 0 },
      shape: { kind: 'tile' },
      verticalTolerance: 1,
    });
    expect(tiles).toHaveLength(2);
    expect(tiles.map((t) => t.layer).sort()).toEqual([0, 1]);
  });

  it('verticalTolerance 0 only includes tiles at exactly the anchor elevation', () => {
    const map = mapWith({
      width: 1,
      height: 1,
      tiles: [
        { x: 0, y: 0, elevation: 0 },
        { x: 0, y: 0, layer: 1, elevation: 1 },
      ],
    });
    const tiles = aoeFootprint({
      map,
      anchor: { x: 0, y: 0, elevation: 0 },
      shape: { kind: 'tile' },
      verticalTolerance: 0,
    });
    expect(tiles).toHaveLength(1);
    expect(tiles[0]!.elevation).toBe(0);
  });
});

describe('aoeFootprint — custom shape', () => {
  it('honors caller-supplied offsets exactly', () => {
    const map = flatMap(5, 5);
    const tiles = aoeFootprint({
      map,
      anchor: { x: 2, y: 2, elevation: 0 },
      shape: {
        kind: 'custom',
        offsets: [
          { dx: 0, dy: 0 },
          { dx: 2, dy: 0 },
          { dx: -2, dy: 0 },
        ],
      },
      verticalTolerance: 0,
    });
    expect(tiles.map((t) => ({ x: t.x, y: t.y })).sort((a, b) => a.x - b.x)).toEqual([
      { x: 0, y: 2 },
      { x: 2, y: 2 },
      { x: 4, y: 2 },
    ]);
  });

  it('skips offsets that fall outside the map', () => {
    const map = flatMap(2, 2);
    const tiles = aoeFootprint({
      map,
      anchor: { x: 0, y: 0, elevation: 0 },
      shape: { kind: 'custom', offsets: [{ dx: 0, dy: 0 }, { dx: 100, dy: 100 }] },
      verticalTolerance: 0,
    });
    expect(tiles).toHaveLength(1);
  });
});

describe('aoeFootprint — shape kind exhaustiveness', () => {
  it('every AoeShape kind resolves without throwing', () => {
    const map = flatMap(5, 5);
    const shapes: AoeShape[] = [
      { kind: 'tile' },
      { kind: 'diamond', radius: 1 },
      { kind: 'square', radius: 1 },
      { kind: 'cross', radius: 1 },
      { kind: 'custom', offsets: [{ dx: 0, dy: 0 }] },
    ];
    for (const shape of shapes) {
      expect(() =>
        aoeFootprint({
          map,
          anchor: { x: 2, y: 2, elevation: 0 },
          shape,
          verticalTolerance: 0,
        }),
      ).not.toThrow();
    }
  });
});
