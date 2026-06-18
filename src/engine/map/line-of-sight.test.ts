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

describe('hasLineOfSight — terrain-mass occlusion (S69 follow-up)', () => {
  // 3-tile strip; the middle tile is plain ground (no blocks_los / barrier)
  // at a given elevation. The ray must duck below the middle surface to be
  // occluded by the terrain mass.
  const strip = (left: number, mid: number, right: number) =>
    mapWith({
      width: 3,
      height: 1,
      tiles: [
        { x: 0, y: 0, elevation: left },
        { x: 1, y: 0, elevation: mid },
        { x: 2, y: 0, elevation: right },
      ],
    });

  it('blocks a level shot through a tall plain-terrain hump (the mountain case)', () => {
    // [10, 50, 10]: ray rides at 10 across the span; the middle surface is at
    // 50, far above it → buried in the mountain → blocked. (Previously this
    // connected — terrain mass was transparent.)
    expect(
      hasLineOfSight(strip(10, 50, 10), { x: 0, y: 0, elevation: 10 }, { x: 2, y: 0, elevation: 10 }),
    ).toBe(false);
  });

  it('blocks a downhill shot that ducks under a same-height hump', () => {
    // [10, 10, 7]: ray at the middle = 8.5, below the surface at 10 → blocked.
    expect(
      hasLineOfSight(strip(10, 10, 7), { x: 0, y: 0, elevation: 10 }, { x: 2, y: 0, elevation: 7 }),
    ).toBe(false);
  });

  it('does not block a smooth downhill slope (ray rides the surface)', () => {
    // [10, 8, 6]: ray at the middle = 8, exactly the surface → grazes, passes.
    expect(
      hasLineOfSight(strip(10, 8, 6), { x: 0, y: 0, elevation: 10 }, { x: 2, y: 0, elevation: 6 }),
    ).toBe(true);
  });

  it('does not block a level shot across flat ground', () => {
    expect(
      hasLineOfSight(strip(5, 5, 5), { x: 0, y: 0, elevation: 5 }, { x: 2, y: 0, elevation: 5 }),
    ).toBe(true);
  });

  it('clears a hump into a pit only with enough height (the see-over-the-ridge threshold)', () => {
    // Target in a pit at 7, hump at 10. To clear it the ray at the midpoint
    // (= (source+7)/2) must reach the crest (10): source 13 just clears,
    // source 12 (e.g. flat-ground 10 + Vantage's 2) is still short.
    expect(
      hasLineOfSight(strip(13, 10, 7), { x: 0, y: 0, elevation: 13 }, { x: 2, y: 0, elevation: 7 }),
    ).toBe(true);
    expect(
      hasLineOfSight(strip(12, 10, 7), { x: 0, y: 0, elevation: 12 }, { x: 2, y: 0, elevation: 7 }),
    ).toBe(false);
  });
});
