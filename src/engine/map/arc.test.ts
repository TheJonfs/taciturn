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

  it('does not consider intermediate obstructions — only source/target columns', () => {
    // Intermediate tile (1,1) carries blocks_los; arc ignores it.
    const map = mapWith({
      width: 3,
      height: 3,
      tiles: [
        { x: 0, y: 0 },
        { x: 1, y: 1, properties: ['blocks_los'] },
        { x: 1, y: 1, layer: 1, elevation: 5 },
        { x: 2, y: 2 },
      ],
    });
    expect(
      arcTargetable(map, { x: 0, y: 0, layer: 0 }, { x: 2, y: 2, layer: 0 }),
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
