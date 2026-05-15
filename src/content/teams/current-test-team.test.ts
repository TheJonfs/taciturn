// Structural compliance tests for the "Aggro Knight Squad" template
// (file path retained as `current-test-team.ts` per S38 plan-review for
// state-key continuity).
//
// Mirrors `computeTeamValidity`'s rules: four units, single-class-per-
// team, unique-per-team items, valid ability budgets, non-empty names.
// The shared assertion lives in `template-compliance.ts`.

import { describe, expect, it } from 'vitest';
import { currentTestTeam } from './current-test-team.ts';
import { assertTemplateCompliance } from './template-compliance.ts';

describe('Aggro Knight Squad template (currentTestTeam)', () => {
  it('passes structural compliance', () => {
    assertTemplateCompliance(currentTestTeam);
  });

  it('has the expected display name', () => {
    expect(currentTestTeam.name).toBe('Aggro Knight Squad');
  });

  it('includes a Knight in the front slot', () => {
    expect(String(currentTestTeam.units[0]!.classId)).toBe('knight');
  });
});
