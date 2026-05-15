// Unit tests for the deployment-facing layer's pure geometry helpers.
// The Pixi rendering + interactivity side isn't tested headlessly —
// same posture as the other renderer layers' tests.

import { describe, expect, it } from 'vitest';
import type { Direction, Position } from '@engine/index.ts';
import {
  DEPLOYMENT_FACING_DIRECTIONS,
  facingArrowAngle,
  facingArrowCenter,
  facingArrowOffset,
} from './deployment-facing-layer.ts';
import { TILE_SIZE } from './constants.ts';
import { positionCenter } from './world.ts';

describe('DEPLOYMENT_FACING_DIRECTIONS', () => {
  it('is the four cardinals in N/E/S/W order', () => {
    expect(DEPLOYMENT_FACING_DIRECTIONS).toEqual(['N', 'E', 'S', 'W']);
  });
});

describe('facingArrowOffset — one tile-step out along the cardinal', () => {
  it('offsets N up, S down, E right, W left by a full tile', () => {
    expect(facingArrowOffset('N')).toEqual({ x: 0, y: -TILE_SIZE });
    expect(facingArrowOffset('S')).toEqual({ x: 0, y: TILE_SIZE });
    expect(facingArrowOffset('E')).toEqual({ x: TILE_SIZE, y: 0 });
    expect(facingArrowOffset('W')).toEqual({ x: -TILE_SIZE, y: 0 });
  });
});

describe('facingArrowCenter — tile center plus the cardinal offset', () => {
  it('places each arrow one tile-step from the tile center', () => {
    const tile: Position = { x: 6, y: 2, layer: 0 };
    const center = positionCenter(tile);
    for (const dir of DEPLOYMENT_FACING_DIRECTIONS) {
      const offset = facingArrowOffset(dir);
      expect(facingArrowCenter(tile, dir)).toEqual({
        x: center.x + offset.x,
        y: center.y + offset.y,
      });
    }
  });
});

describe('facingArrowAngle — rotation of the base upward triangle', () => {
  it('rotates the N-pointing base triangle to each cardinal', () => {
    expect(facingArrowAngle('N')).toBe(0);
    expect(facingArrowAngle('E')).toBe(90);
    expect(facingArrowAngle('S')).toBe(180);
    expect(facingArrowAngle('W')).toBe(270);
  });

  it('every cardinal gets a distinct quarter-turn', () => {
    const angles = new Set(
      (['N', 'E', 'S', 'W'] as Direction[]).map(facingArrowAngle),
    );
    expect(angles.size).toBe(4);
  });
});
