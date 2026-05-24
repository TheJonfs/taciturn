// Shared structural-compliance assertions for `BuiltTeam` templates.
//
// Each template has a sibling `<template>.test.ts` that calls these
// helpers with the template under test. The checks mirror the rules
// `computeTeamValidity` enforces in the team builder — running them at
// authoring time fails loud if a template drifts out of compliance.

import { expect } from 'vitest';
import { loadDefaultCatalog } from '@content/index.ts';
import { riverRidgeBattle } from '@content/battles/river-ridge-battle.ts';
import { createInitialState, teamId } from '@engine/index.ts';
import { buildTeamBattleConfig } from './build-team-battle-config.ts';
import { MAX_TEAM_SIZE, MIN_TEAM_SIZE, type BuiltTeam } from './built-team.ts';

const EQUIPMENT_SLOTS = [
  'leftHand',
  'rightHand',
  'headgear',
  'armor',
  'accessory',
] as const;

// Run the full structural-compliance battery against a `BuiltTeam`.
// Fails the test at the first violation; otherwise no return value.
export function assertTemplateCompliance(template: BuiltTeam): void {
  // S48: team size is variable. Compliance requires that the template
  // sit within the runtime bounds the team builder enforces.
  expect(template.units.length).toBeGreaterThanOrEqual(MIN_TEAM_SIZE);
  expect(template.units.length).toBeLessThanOrEqual(MAX_TEAM_SIZE);

  // Each unit has a non-empty name.
  for (const unit of template.units) {
    expect(unit.name.length).toBeGreaterThan(0);
  }

  // Single-class-per-team: no class appears on more than one unit.
  const classIds = template.units.map((u) => String(u.classId));
  expect(new Set(classIds).size, `duplicate class on team ${template.name}`).toBe(
    classIds.length,
  );

  // Unique-per-team items: no equipment item appears on two units.
  const seen = new Map<string, string>();
  for (const unit of template.units) {
    for (const slot of EQUIPMENT_SLOTS) {
      const item = unit.equipment[slot];
      if (item === null) continue;
      const prior = seen.get(String(item));
      expect(
        prior,
        `${String(item)} appears on both ${prior} and ${unit.name}`,
      ).toBeUndefined();
      seen.set(String(item), unit.name);
    }
  }

  // The template loads into a valid battle config — `createInitialState`
  // runs the engine's loadout-budget and equipment-placement validation,
  // so an over-capacity bucket or a class-restricted item in the wrong
  // hands throws here.
  const catalog = loadDefaultCatalog();
  const config = buildTeamBattleConfig(
    riverRidgeBattle,
    template,
    teamId('team_a'),
  );
  const state = createInitialState(config, catalog);
  // The built config drops unused template slots (S48: the upper-bound
  // template authors 5 blue slots; a shorter team consumes only the
  // first N), so the state size is "built-team units + every authored
  // team_b unit" — not the raw template's `units.length`.
  const otherTeamUnits = riverRidgeBattle.units.filter(
    (u) => u.team !== teamId('team_a'),
  ).length;
  expect(state.units.size).toBe(template.units.length + otherTeamUnits);
}
