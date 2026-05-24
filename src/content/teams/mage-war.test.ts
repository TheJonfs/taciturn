// Structural compliance tests for the "Mage War" template (S48 — third
// Chris-authored default template; the one-of-each-school + Knight
// lineup that names the v1 playable surface).
//
// Mirrors `computeTeamValidity`'s rules: size within bounds, single-
// class-per-team, unique-per-team items, valid ability budgets, non-
// empty names. Shared assertion lives in `template-compliance.ts`.

import { describe, expect, it } from 'vitest';
import { mageWar } from './mage-war.ts';
import { assertTemplateCompliance } from './template-compliance.ts';

describe('Mage War template (mageWar)', () => {
  it('passes structural compliance', () => {
    assertTemplateCompliance(mageWar);
  });

  it('has the expected display name', () => {
    expect(mageWar.name).toBe('Mage War');
  });

  it('fields the original five classes (Knight + one of each magic school)', () => {
    expect(mageWar.units).toHaveLength(5);
    // Order matters less than coverage; assert via set membership.
    expect(new Set(mageWar.units.map((u) => String(u.classId)))).toEqual(
      new Set(['knight', 'earth_mage', 'fire_mage', 'lightning_mage', 'water_mage']),
    );
  });
});
