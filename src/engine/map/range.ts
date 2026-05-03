// Range geometry — horizontal and vertical range checks.
// See docs/design/map-and-battlefield.md ("Range geometry").
//
// All functions are pure: numbers in, booleans/numbers out. No map or
// state lookup; callers resolve tile coordinates and elevations once
// upstream and pass the values in.

import type { Position } from '../types/index.ts';

// Manhattan distance over (x, y). Layer is intentionally not part of
// horizontal distance per the design doc — two tiles at the same (x, y)
// but different layers have horizontal distance 0.
export function horizontalDistance(
  a: { readonly x: number; readonly y: number },
  b: { readonly x: number; readonly y: number },
): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

// Absolute elevation differential. The sign is a separate concern (e.g.,
// "shooting downhill = bonus" — captured by ability/damage code, not
// here).
export function verticalDistance(aElevation: number, bElevation: number): number {
  return Math.abs(aElevation - bElevation);
}

export interface RangeParams {
  readonly horizontalMax: number;
  readonly horizontalMin?: number;
  readonly verticalMax: number;
}

export interface RangeEndpoint {
  readonly x: number;
  readonly y: number;
  readonly elevation: number;
}

// True iff `target` is within the configured range from `source`.
// Horizontal: Manhattan distance bounded by [horizontalMin, horizontalMax].
//   horizontalMin defaults to 0 (no minimum); set it for artillery /
//   ranged-only abilities that can't fire too close.
// Vertical: |elevation differential| ≤ verticalMax.
export function inRange(args: {
  readonly source: RangeEndpoint;
  readonly target: RangeEndpoint;
  readonly params: RangeParams;
}): boolean {
  const { source, target, params } = args;
  const h = horizontalDistance(source, target);
  if (h > params.horizontalMax) return false;
  if (h < (params.horizontalMin ?? 0)) return false;
  const v = verticalDistance(source.elevation, target.elevation);
  if (v > params.verticalMax) return false;
  return true;
}

// Convenience: extract a `RangeEndpoint` from a Position + a same-shape
// elevation lookup. Saves callers a small spread at the use site.
export function endpointFrom(
  position: Position,
  elevation: number,
): RangeEndpoint {
  return { x: position.x, y: position.y, elevation };
}
