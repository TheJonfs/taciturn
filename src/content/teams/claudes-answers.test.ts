// Structural compliance tests for the "Claude's Answers" template (S74 —
// planner-chat build: an offense-focused counter to Claude's Bulwark).
//
// Mirrors `computeTeamValidity`'s rules via `assertTemplateCompliance`:
// size, single-class-per-team, unique-per-team items, valid ability
// budgets, non-empty names, and a clean `createInitialState` load
// (equipment slot/two-handed validation included — incl. Crystal's Two
// Weapons dual-wield and Silas's two-handed Longbow).

import { describe, expect, it } from 'vitest';
import { claudesAnswers } from './claudes-answers.ts';
import { assertTemplateCompliance } from './template-compliance.ts';

describe("Claude's Answers template (claudesAnswers)", () => {
  it('passes structural compliance', () => {
    assertTemplateCompliance(claudesAnswers);
  });

  it('has the expected display name', () => {
    expect(claudesAnswers.name).toBe("Claude's Answers");
  });

  it('fields five units (Hunter / Lightning Mage / Knight / Assassin / Calculator)', () => {
    expect(claudesAnswers.units).toHaveLength(5);
    expect(claudesAnswers.units.map((u) => String(u.classId))).toEqual([
      'hunter',
      'lightning_mage',
      'knight',
      'assassin',
      'calculator',
    ]);
  });
});
