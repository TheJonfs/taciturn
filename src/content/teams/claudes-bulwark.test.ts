// Structural compliance tests for the "Claude's Bulwark" template (S74 —
// planner-chat build: a sustain-and-buff bulwark).
//
// Mirrors `computeTeamValidity`'s rules via `assertTemplateCompliance`:
// size, single-class-per-team, unique-per-team items, valid ability
// budgets (every passive bucket filled to capacity 3 via class natives),
// non-empty names, and a clean `createInitialState` load (equipment
// slot/two-handed validation included).

import { describe, expect, it } from 'vitest';
import { claudesBulwark } from './claudes-bulwark.ts';
import { assertTemplateCompliance } from './template-compliance.ts';

describe("Claude's Bulwark template (claudesBulwark)", () => {
  it('passes structural compliance', () => {
    assertTemplateCompliance(claudesBulwark);
  });

  it('has the expected display name', () => {
    expect(claudesBulwark.name).toBe("Claude's Bulwark");
  });

  it('fields five units (Enchanter / Knight / Templar / Earth Mage / Alchemist)', () => {
    expect(claudesBulwark.units).toHaveLength(5);
    expect(claudesBulwark.units.map((u) => String(u.classId))).toEqual([
      'enchanter',
      'knight',
      'templar',
      'earth_mage',
      'alchemist',
    ]);
  });
});
