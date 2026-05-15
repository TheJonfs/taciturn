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
import type { BuiltTeam } from './built-team.ts';

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
  // Four units (the locked v1 team size).
  expect(template.units).toHaveLength(4);

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
  expect(state.units.size).toBe(riverRidgeBattle.units.length);
}
