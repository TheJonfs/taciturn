// Structural compliance tests for the "The Irregulars" template (S68 —
// Chris-authored, cross-trained / off-class showcase).
//
// Mirrors `computeTeamValidity`'s rules via `assertTemplateCompliance`:
// size, single-class-per-team, unique-per-team items, valid ability
// budgets (incl. the Monkeygrip-relaxed two-handed + shield pairing on
// Octavian), non-empty names, and a clean `createInitialState` load.

import { describe, expect, it } from 'vitest';
import { theIrregulars } from './the-irregulars.ts';
import { assertTemplateCompliance } from './template-compliance.ts';

describe('The Irregulars template (theIrregulars)', () => {
  it('passes structural compliance', () => {
    assertTemplateCompliance(theIrregulars);
  });

  it('has the expected display name', () => {
    expect(theIrregulars.name).toBe('The Irregulars');
  });

  it('fields five units (Alchemist / Templar / Lightning Mage / Terraformer / Fire Mage)', () => {
    expect(theIrregulars.units).toHaveLength(5);
    expect(theIrregulars.units.map((u) => String(u.classId))).toEqual([
      'alchemist',
      'templar',
      'lightning_mage',
      'terraformer',
      'fire_mage',
    ]);
  });
});
