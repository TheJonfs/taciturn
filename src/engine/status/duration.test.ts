// Tests for the isInfiniteDuration predicate.
// See ADR-0079.

import { describe, expect, it } from 'vitest';
import { isInfiniteDuration } from './duration.ts';
import { statusTypeId, type StatusInstance } from '../types/index.ts';

// Builds a raw StatusInstance with the requested remainingDuration. We
// bypass the `makeStatusInstance` fixture because its `??` default
// collapses an explicit `null` to 5.
function instWith(remainingDuration: number | null): StatusInstance {
  return {
    typeId: statusTypeId('foo'),
    source: { unitId: null, actionSeq: null },
    remainingDuration,
  };
}

describe('isInfiniteDuration', () => {
  it('returns true when remainingDuration is null', () => {
    expect(isInfiniteDuration(instWith(null))).toBe(true);
  });

  it('returns false when remainingDuration is a positive number', () => {
    expect(isInfiniteDuration(instWith(5))).toBe(false);
  });

  it('returns false when remainingDuration is zero', () => {
    expect(isInfiniteDuration(instWith(0))).toBe(false);
  });

  it('returns false when remainingDuration is a very large number', () => {
    expect(isInfiniteDuration(instWith(99999))).toBe(false);
  });
});
