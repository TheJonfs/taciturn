// Structural compliance tests for the "Gravity Well" template (S48 —
// first Chris-authored default template under the variable-length
// BuiltTeam shape; S50 — Calculator added to bring the roster to 5).
//
// Mirrors `computeTeamValidity`'s rules: size within bounds, single-
// class-per-team, unique-per-team items, valid ability budgets, non-
// empty names. Shared assertion lives in `template-compliance.ts`.

import { describe, expect, it } from 'vitest';
import { gravityWell } from './gravity-well.ts';
import { assertTemplateCompliance } from './template-compliance.ts';

describe('Gravity Well template (gravityWell)', () => {
  it('passes structural compliance', () => {
    assertTemplateCompliance(gravityWell);
  });

  it('has the expected display name', () => {
    expect(gravityWell.name).toBe('Gravity Well');
  });

  it('fields five units (Assassin / Calculator / Pyromancer / Templar / Hydrologist)', () => {
    expect(gravityWell.units).toHaveLength(5);
    expect(gravityWell.units.map((u) => String(u.classId))).toEqual([
      'assassin',
      'calculator',
      'fire_mage',
      'templar',
      'water_mage',
    ]);
  });
});
