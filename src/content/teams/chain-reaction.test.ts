// Structural compliance tests for the "Chain Reaction" template
// (team-builder Pass 2 follow-up — fourth Chris-authored default
// template under the variable-length BuiltTeam shape).
//
// Mirrors `computeTeamValidity`'s rules: size within bounds, single-
// class-per-team, unique-per-team items, valid ability budgets, non-
// empty names, plus the Monkeygrip-relaxed two-handed off-hand pairings.
// Shared assertion lives in `template-compliance.ts`.

import { describe, expect, it } from 'vitest';
import { chainReaction } from './chain-reaction.ts';
import { assertTemplateCompliance } from './template-compliance.ts';

describe('Chain Reaction template (chainReaction)', () => {
  it('passes structural compliance', () => {
    assertTemplateCompliance(chainReaction);
  });

  it('has the expected display name', () => {
    expect(chainReaction.name).toBe('Chain Reaction');
  });

  it('fields five units (Assassin / Calculator / Hunter / Terraformer / Lightning Mage)', () => {
    expect(chainReaction.units).toHaveLength(5);
    expect(chainReaction.units.map((u) => String(u.classId))).toEqual([
      'assassin',
      'calculator',
      'hunter',
      'terraformer',
      'lightning_mage',
    ]);
  });
});
