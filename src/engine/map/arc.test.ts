import { arcTargetable } from './arc.ts';
import { flatMap, mapWith } from './test-fixtures.ts';

describe('arcTargetable', () => {
  it('returns true when both source and target are uncovered', () => {
    const map = flatMap(3, 3);
    expect(
      arcTargetable(
        map,
        { x: 0, y: 0, layer: 0 },
        { x: 2, y: 2, layer: 0 },
      ),
    ).toBe(true);
  });

  it('returns false when the source is covered by a higher-layer tile', () => {
    // Bridge over (0, 0): layer 1 tile sitting above layer 0.
    const map = mapWith({
      width: 3,
      height: 3,
      tiles: [
        { x: 0, y: 0 },
        { x: 0, y: 0, layer: 1, elevation: 3 }, // cover
        { x: 2, y: 2 },
      ],
    });
    expect(
      arcTargetable(map, { x: 0, y: 0, layer: 0 }, { x: 2, y: 2, layer: 0 }),
    ).toBe(false);
  });

  it('returns false when the target is covered by a higher-layer tile', () => {
    const map = mapWith({
      width: 3,
      height: 3,
      tiles: [
        { x: 0, y: 0 },
        { x: 2, y: 2 },
        { x: 2, y: 2, layer: 1, elevation: 3 }, // cover
      ],
    });
    expect(
      arcTargetable(map, { x: 0, y: 0, layer: 0 }, { x: 2, y: 2, layer: 0 }),
    ).toBe(false);
  });

  it('lobs over intermediate cover up to the clearance (a wall / low hump)', () => {
    // Intermediate (1,1) carries blocks_los and a modest hump (elev 3, under
    // the clearance) — the lob arcs over both. Arc still ignores `blocks_los`
    // / ground walls within its apex.
    const map = mapWith({
      width: 3,
      height: 3,
      tiles: [
        { x: 0, y: 0 },
        { x: 1, y: 1, elevation: 3, properties: ['blocks_los'] },
        { x: 2, y: 2 },
      ],
    });
    expect(
      arcTargetable(map, { x: 0, y: 0, layer: 0 }, { x: 2, y: 2, layer: 0 }),
    ).toBe(true);
  });

  it('blocks a lob over a mountain taller than the clearance (S69 follow-up)', () => {
    // Endpoints at elev 0 → apex 5. A 50-tall peak between them pokes through
    // the arc → blocked. (Previously the lob ignored it entirely.)
    const map = mapWith({
      width: 3,
      height: 1,
      tiles: [
        { x: 0, y: 0 },
        { x: 1, y: 0, elevation: 50 },
        { x: 2, y: 0 },
      ],
    });
    expect(
      arcTargetable(map, { x: 0, y: 0, layer: 0 }, { x: 2, y: 0, layer: 0 }),
    ).toBe(false);
  });

  it('clears exactly at the clearance, blocks just above it', () => {
    // Endpoints at elev 0 → apex 5. Obstacle at 5 grazes the ceiling (5 > 5
    // false → clears); at 6 it pokes through → blocked.
    const at = (mid: number) =>
      arcTargetable(
        mapWith({
          width: 3,
          height: 1,
          tiles: [{ x: 0, y: 0 }, { x: 1, y: 0, elevation: mid }, { x: 2, y: 0 }],
        }),
        { x: 0, y: 0, layer: 0 },
        { x: 2, y: 0, layer: 0 },
      );
    expect(at(5)).toBe(true);
    expect(at(6)).toBe(false);
  });

  it('a higher endpoint raises the apex, clearing a taller ridge', () => {
    // Target on a mesa at 20 → apex max(0,20)+5 = 25. A ridge at 22 between
    // the shooter and the mesa is cleared.
    const map = mapWith({
      width: 3,
      height: 1,
      tiles: [
        { x: 0, y: 0 },
        { x: 1, y: 0, elevation: 22 },
        { x: 2, y: 0, elevation: 20 },
      ],
    });
    expect(
      arcTargetable(map, { x: 0, y: 0, layer: 0 }, { x: 2, y: 0, layer: 0 }),
    ).toBe(true);
  });

  it('a source on the higher layer is not "covered" by anything beneath it', () => {
    // Source on layer 1 with no tile above (no layer 2 here).
    const map = mapWith({
      width: 2,
      height: 1,
      tiles: [
        { x: 0, y: 0 },
        { x: 0, y: 0, layer: 1, elevation: 3 },
        { x: 1, y: 0 },
      ],
    });
    expect(
      arcTargetable(map, { x: 0, y: 0, layer: 1 }, { x: 1, y: 0, layer: 0 }),
    ).toBe(true);
  });
});
