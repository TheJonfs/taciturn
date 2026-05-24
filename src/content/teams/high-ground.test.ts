// Structural compliance tests for the "High Ground" template (S48 —
// second Chris-authored default template; first 5-unit template under
// the variable-length BuiltTeam shape).
//
// Mirrors `computeTeamValidity`'s rules: size within bounds, single-
// class-per-team, unique-per-team items, valid ability budgets, non-
// empty names. Shared assertion lives in `template-compliance.ts`.

import { describe, expect, it } from 'vitest';
import { bucketId } from '@engine/index.ts';
import { highGround } from './high-ground.ts';
import { assertTemplateCompliance } from './template-compliance.ts';

describe('High Ground template (highGround)', () => {
  it('passes structural compliance', () => {
    assertTemplateCompliance(highGround);
  });

  it('has the expected display name', () => {
    expect(highGround.name).toBe('High Ground');
  });

  it('fields five units (Hunter / Alchemist / Aethurge / Geosage / Knight)', () => {
    expect(highGround.units).toHaveLength(5);
    expect(highGround.units.map((u) => String(u.classId))).toEqual([
      'hunter',
      'alchemist',
      'lightning_mage',
      'earth_mage',
      'knight',
    ]);
  });

  it('exercises the Magus Crown +1 secondary-command-set capacity (Samuel runs 2 secondary sets)', () => {
    // Magus Crown lifts the secondary-command-set capacity from 1 → 2.
    // Samuel uses both slots — Lightning Spells (primary cross-school)
    // + Water Spells (sustain back-up). This is the first template to
    // exercise the dual-secondary path; if a future change to the
    // bucket cap landing causes Samuel to drop one, the team is no
    // longer the intended composition.
    const samuel = highGround.units.find((u) => u.name === 'Samuel')!;
    expect(samuel.equipment.headgear).toBeTruthy();
    expect(
      samuel.loadout.actionBuckets[bucketId('secondary_command_sets')],
    ).toHaveLength(2);
  });
});
