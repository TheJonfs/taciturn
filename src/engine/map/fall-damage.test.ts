// Session 53 — shared fall-damage helper (extracted from knockback.ts).

import { describe, expect, it } from 'vitest';
import { fallDamageAction, FALLING_DAMAGE_PER_LEVEL } from './fall-damage.ts';
import { unitId } from '@engine/index.ts';

describe('fallDamageAction', () => {
  it('emits 10 × dropDistance falling system_damage for a drop > 1', () => {
    const a = fallDamageAction(unitId('u'), 3);
    expect(a).not.toBeNull();
    if (a === null) return;
    expect(a.type).toBe('system_damage');
    if (a.type !== 'system_damage') return;
    expect(a.payload.targetId).toBe(unitId('u'));
    expect(a.payload.amount).toBe(30);
    expect(a.payload.tags).toEqual(['physical']);
    expect(a.payload.source.kind).toBe('falling');
    if (a.payload.source.kind === 'falling') {
      expect(a.payload.source.dropDistance).toBe(3);
      expect(a.payload.source.unitId).toBe(unitId('u'));
    }
  });

  it('returns null for a harmless drop of exactly 1', () => {
    expect(fallDamageAction(unitId('u'), 1)).toBeNull();
  });

  it('returns null for a drop of 0 or an uphill end (negative)', () => {
    expect(fallDamageAction(unitId('u'), 0)).toBeNull();
    expect(fallDamageAction(unitId('u'), -2)).toBeNull();
  });

  it('scales linearly at the documented per-level rate', () => {
    const a = fallDamageAction(unitId('u'), 5);
    if (a === null || a.type !== 'system_damage') throw new Error('expected emission');
    expect(a.payload.amount).toBe(FALLING_DAMAGE_PER_LEVEL * 5);
  });
});
