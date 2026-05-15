// Structural compliance tests for the "Mage Variety Pack" template
// (Session 38).

import { describe, expect, it } from 'vitest';
import { mageVarietyPack } from './mage-variety-pack.ts';
import { assertTemplateCompliance } from './template-compliance.ts';

describe('Mage Variety Pack template', () => {
  it('passes structural compliance', () => {
    assertTemplateCompliance(mageVarietyPack);
  });

  it('has the expected display name', () => {
    expect(mageVarietyPack.name).toBe('Mage Variety Pack');
  });

  it('runs all four mage elements (no Knight)', () => {
    const classIds = mageVarietyPack.units.map((u) => String(u.classId)).sort();
    expect(classIds).toEqual([
      'earth_mage',
      'fire_mage',
      'lightning_mage',
      'water_mage',
    ]);
  });
});
