import { endpointFrom, horizontalDistance, inRange, verticalDistance } from './range.ts';

describe('horizontalDistance', () => {
  it('is Manhattan distance over (x, y)', () => {
    expect(horizontalDistance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(7);
    expect(horizontalDistance({ x: -2, y: 1 }, { x: 1, y: -1 })).toBe(5);
  });

  it('is 0 for the same (x, y) regardless of any other fields on the input', () => {
    expect(horizontalDistance({ x: 5, y: 5 }, { x: 5, y: 5 })).toBe(0);
  });
});

describe('verticalDistance', () => {
  it('returns the absolute elevation differential', () => {
    expect(verticalDistance(3, 7)).toBe(4);
    expect(verticalDistance(7, 3)).toBe(4);
    expect(verticalDistance(2, 2)).toBe(0);
  });
});

describe('inRange', () => {
  const source = { x: 0, y: 0, elevation: 0 };

  it('accepts targets within both horizontal and vertical bounds', () => {
    expect(
      inRange({
        source,
        target: { x: 2, y: 1, elevation: 1 },
        params: { horizontalMax: 4, verticalMax: 2 },
      }),
    ).toBe(true);
  });

  it('rejects targets outside horizontalMax', () => {
    expect(
      inRange({
        source,
        target: { x: 3, y: 3, elevation: 0 },
        params: { horizontalMax: 4, verticalMax: 5 },
      }),
    ).toBe(false);
  });

  it('rejects targets too close (under horizontalMin)', () => {
    // Artillery: min 2, max 5.
    expect(
      inRange({
        source,
        target: { x: 1, y: 0, elevation: 0 },
        params: { horizontalMax: 5, horizontalMin: 2, verticalMax: 5 },
      }),
    ).toBe(false);
  });

  it('accepts targets at the edge of horizontalMax', () => {
    expect(
      inRange({
        source,
        target: { x: 4, y: 0, elevation: 0 },
        params: { horizontalMax: 4, verticalMax: 5 },
      }),
    ).toBe(true);
  });

  it('accepts targets at exactly horizontalMin', () => {
    expect(
      inRange({
        source,
        target: { x: 2, y: 0, elevation: 0 },
        params: { horizontalMax: 5, horizontalMin: 2, verticalMax: 5 },
      }),
    ).toBe(true);
  });

  it('rejects targets outside verticalMax even when horizontally in range', () => {
    expect(
      inRange({
        source,
        target: { x: 1, y: 0, elevation: 5 },
        params: { horizontalMax: 5, verticalMax: 2 },
      }),
    ).toBe(false);
  });

  it('treats vertical range as |differential|, not signed', () => {
    expect(
      inRange({
        source,
        target: { x: 0, y: 1, elevation: -3 },
        params: { horizontalMax: 5, verticalMax: 3 },
      }),
    ).toBe(true);
    expect(
      inRange({
        source,
        target: { x: 0, y: 1, elevation: -4 },
        params: { horizontalMax: 5, verticalMax: 3 },
      }),
    ).toBe(false);
  });

  it('horizontalMin defaults to 0 (i.e., no minimum)', () => {
    expect(
      inRange({
        source,
        target: { x: 0, y: 0, elevation: 0 },
        params: { horizontalMax: 1, verticalMax: 0 },
      }),
    ).toBe(true);
  });
});

describe('endpointFrom', () => {
  it('packs a Position + elevation into a RangeEndpoint', () => {
    expect(endpointFrom({ x: 1, y: 2, layer: 3 }, 5)).toEqual({ x: 1, y: 2, elevation: 5 });
  });
});
