// Structural compliance tests for the "T-Munny" template (S75 — a custom
// sustain-and-control build transcribed from its team-export JSON).
//
// `assertTemplateCompliance` enforces `computeTeamValidity`'s rules: size,
// single-class-per-team, unique-per-team items, valid ability budgets,
// non-empty names, and a clean `createInitialState` load (equipment slot /
// two-handed validation included — incl. the Monkeygrip holds on Adrian
// and Octavius and Ostara's two-handed Riptide Bow).

import { describe, expect, it } from 'vitest';
import { tMunny } from './t-munny.ts';
import { assertTemplateCompliance } from './template-compliance.ts';

describe('T-Munny template (tMunny)', () => {
  it('passes structural compliance', () => {
    assertTemplateCompliance(tMunny);
  });

  it('has the expected display name', () => {
    expect(tMunny.name).toBe('T-Munny');
  });

  it('fields five units (Knight / Thief / Enchanter / Templar / Water Mage)', () => {
    expect(tMunny.units).toHaveLength(5);
    expect(tMunny.units.map((u) => String(u.classId))).toEqual([
      'knight',
      'thief',
      'enchanter',
      'templar',
      'water_mage',
    ]);
  });
});
