import { hasLineOfSight } from './line-of-sight.ts';
import { flatMap, mapWith } from './test-fixtures.ts';

describe('hasLineOfSight — trivial cases', () => {
  it('returns true when source and target are the same tile', () => {
    const map = flatMap(3, 3);
    expect(
      hasLineOfSight(map, { x: 1, y: 1, elevation: 0 }, { x: 1, y: 1, elevation: 0 }),
    ).toBe(true);
  });

  it('returns true between adjacent tiles (no intermediate cells)', () => {
    const map = flatMap(3, 3);
    expect(
      hasLineOfSight(map, { x: 0, y: 0, elevation: 0 }, { x: 1, y: 0, elevation: 0 }),
    ).toBe(true);
  });

  it('returns true for a clear straight shot across the map', () => {
    const map = flatMap(5, 1);
    expect(
      hasLineOfSight(map, { x: 0, y: 0, elevation: 0 }, { x: 4, y: 0, elevation: 0 }),
    ).toBe(true);
  });
});

describe('hasLineOfSight — blocks_los handling', () => {
  it('blocks when an intermediate tile has blocks_los at the ray elevation', () => {
    // 3-tile horizontal strip. Middle tile has blocks_los and elev 0.
    // Source and target both elev 0. Ray elev at the middle tile is 0.
    // Wait — strict-inequality means rayElev exactly at tile.elevation
    // does NOT block. Need to raise the ray within (0, 1).
    // Use source elevation 0.5 and target 0.5 → ray stays at 0.5.
    const map = mapWith({
      width: 3,
      height: 1,
      tiles: [
        { x: 0, y: 0 },
        { x: 1, y: 0, properties: ['blocks_los'] },
        { x: 2, y: 0 },
      ],
    });
    expect(
      hasLineOfSight(map, { x: 0, y: 0, elevation: 0.5 }, { x: 2, y: 0, elevation: 0.5 }),
    ).toBe(false);
  });

  it('does not block when the ray grazes the floor of a blocker (strict-inequality)', () => {
    // Same blocker, but ray runs at elevation 0 exactly — equal to
    // tile.elevation — passes (lean toward "doesn't block").
    const map = mapWith({
      width: 3,
      height: 1,
      tiles: [
        { x: 0, y: 0 },
        { x: 1, y: 0, properties: ['blocks_los'] },
        { x: 2, y: 0 },
      ],
    });
    expect(
      hasLineOfSight(map, { x: 0, y: 0, elevation: 0 }, { x: 2, y: 0, elevation: 0 }),
    ).toBe(true);
  });

  it('does not block when the ray grazes the ceiling of a blocker (strict-inequality)', () => {
    // Ray runs at elev 1 exactly — equal to tile.elevation + BLOCKER_HEIGHT.
    const map = mapWith({
      width: 3,
      height: 1,
      tiles: [
        { x: 0, y: 0 },
        { x: 1, y: 0, properties: ['blocks_los'] },
        { x: 2, y: 0 },
      ],
    });
    expect(
      hasLineOfSight(map, { x: 0, y: 0, elevation: 1 }, { x: 2, y: 0, elevation: 1 }),
    ).toBe(true);
  });

  it('does not block when no tile on the path has blocks_los', () => {
    const map = mapWith({
      width: 3,
      height: 1,
      tiles: [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 2, y: 0 },
      ],
    });
    expect(
      hasLineOfSight(map, { x: 0, y: 0, elevation: 0 }, { x: 2, y: 0, elevation: 0 }),
    ).toBe(true);
  });

  it('does not block when blocks_los is at source or target (endpoints excluded)', () => {
    // Endpoint tiles carry blocks_los; intermediate is clear.
    const map = mapWith({
      width: 3,
      height: 1,
      tiles: [
        { x: 0, y: 0, properties: ['blocks_los'] },
        { x: 1, y: 0 },
        { x: 2, y: 0, properties: ['blocks_los'] },
      ],
    });
    expect(
      hasLineOfSight(map, { x: 0, y: 0, elevation: 0.5 }, { x: 2, y: 0, elevation: 0.5 }),
    ).toBe(true);
  });

  it('blocks when the blocker is on a higher layer at the same (x, y)', () => {
    // Ground tile at (1, 0); above it, an overhead obstruction tile at
    // layer 1 elev 0.5 with blocks_los. Ray at elev 0.7 should be blocked.
    const map = mapWith({
      width: 3,
      height: 1,
      tiles: [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 1, y: 0, layer: 1, elevation: 0.5, properties: ['blocks_los'] },
        { x: 2, y: 0 },
      ],
    });
    expect(
      hasLineOfSight(map, { x: 0, y: 0, elevation: 0.7 }, { x: 2, y: 0, elevation: 0.7 }),
    ).toBe(false);
  });

  it('does not block when the ray passes over a tall blocker by elevation', () => {
    // Ray runs from elev 5 to elev 5; the blocker is at elev 0 (extent 0..1).
    const map = mapWith({
      width: 3,
      height: 1,
      tiles: [
        { x: 0, y: 0 },
        { x: 1, y: 0, properties: ['blocks_los'] },
        { x: 2, y: 0 },
      ],
    });
    expect(
      hasLineOfSight(map, { x: 0, y: 0, elevation: 5 }, { x: 2, y: 0, elevation: 5 }),
    ).toBe(true);
  });
});
