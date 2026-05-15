// River Ridge battle config sanity tests. Mirrors training-field-
// battle.test.ts: same guard-rails against drift between the demo
// roster and the runtime config, plus deployment-zone correctness for
// each unit's starting position.

import { describe, expect, it } from 'vitest';
import { loadDefaultCatalog } from '@content/index.ts';
import { createInitialState, itemId, teamId, tileAt, unitId } from '@engine/index.ts';
import { riverRidge } from '../maps/river-ridge.ts';
import { demoBattle } from './demo.ts';
import { riverRidgeBattle } from './river-ridge-battle.ts';

describe('River Ridge battle config', () => {
  it('uses the River Ridge map', () => {
    expect(riverRidgeBattle.map).toBe(riverRidge);
  });

  it('extends the demo roster to 4v4 (all demo units + Blue Fire / Red Water Mage)', () => {
    // Session 35: River Ridge is the 4v4 deployment-phase demo. It
    // carries all six `demoBattle` units (unchanged teams / classes)
    // plus two River-Ridge-specific units so the 3v3 engine smoke-test
    // fixture stays untouched.
    expect(riverRidgeBattle.units.length).toBe(8);
    expect(demoBattle.units.length).toBe(6);

    const battleIds = new Set(riverRidgeBattle.units.map((u) => u.id));
    for (const demoUnit of demoBattle.units) {
      expect(battleIds.has(demoUnit.id)).toBe(true);
      const unit = riverRidgeBattle.units.find((u) => u.id === demoUnit.id)!;
      expect(unit.team).toBe(demoUnit.team);
      expect(unit.classId).toBe(demoUnit.classId);
    }

    const extras = riverRidgeBattle.units.filter(
      (u) => !demoBattle.units.some((d) => d.id === u.id),
    );
    expect(extras.map((u) => u.id)).toEqual([
      unitId('blue_fire_mage'),
      unitId('red_water_mage'),
    ]);

    let blue = 0;
    let red = 0;
    for (const u of riverRidgeBattle.units) {
      if (u.team === teamId('team_a')) blue += 1;
      if (u.team === teamId('team_b')) red += 1;
    }
    expect(blue).toBe(4);
    expect(red).toBe(4);
  });

  it('places every unit within the 14×14 board', () => {
    for (const unit of riverRidgeBattle.units) {
      expect(unit.position.x).toBeGreaterThanOrEqual(0);
      expect(unit.position.x).toBeLessThan(riverRidge.width);
      expect(unit.position.y).toBeGreaterThanOrEqual(0);
      expect(unit.position.y).toBeLessThan(riverRidge.height);
      expect(unit.position.layer).toBe(0);
    }
  });

  it('starting positions are unique (no two units share a tile)', () => {
    const seen = new Set<string>();
    for (const unit of riverRidgeBattle.units) {
      const key = `${unit.position.x},${unit.position.y},${unit.position.layer}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });

  it('each unit deploys inside their own team deployment zone', () => {
    for (const unit of riverRidgeBattle.units) {
      const tile = tileAt(riverRidge, unit.position.x, unit.position.y, unit.position.layer);
      expect(tile).toBeDefined();
      expect(tile!.deploymentZone).toBe(unit.team);
    }
  });

  it('Blue (team_a) units deploy in the northern zone (y ≤ 2)', () => {
    for (const unit of riverRidgeBattle.units) {
      if (unit.team === teamId('team_a')) {
        expect(unit.position.y).toBeLessThanOrEqual(2);
      }
    }
  });

  it('Red (team_b) units deploy in the southern zone (y ≥ 11)', () => {
    for (const unit of riverRidgeBattle.units) {
      if (unit.team === teamId('team_b')) {
        expect(unit.position.y).toBeGreaterThanOrEqual(11);
      }
    }
  });

  it('initializes against the catalog without throwing', () => {
    const catalog = loadDefaultCatalog();
    const state = createInitialState(riverRidgeBattle, catalog);
    expect(state.units.size).toBe(riverRidgeBattle.units.length);
    expect(state.map.width).toBe(14);
    expect(state.map.height).toBe(14);
  });

  it('Red Lightning Mage carries the Session 33.5 loadout (Staff of Power / Wizard\'s Robe / Pointy Hat / Purifier)', () => {
    const catalog = loadDefaultCatalog();
    // createInitialState runs equipment-placement validation; an
    // ineligible slot or class restriction would throw here.
    const state = createInitialState(riverRidgeBattle, catalog);
    const redLightning = state.units.get(unitId('red_lightning_mage'));
    expect(redLightning).toBeDefined();
    expect(redLightning!.equipment.rightHand).toBe(itemId('staff_of_power'));
    expect(redLightning!.equipment.armor).toBe(itemId('wizards_robe'));
    expect(redLightning!.equipment.headgear).toBe(itemId('pointy_hat'));
    expect(redLightning!.equipment.accessory).toBe(itemId('purifier'));
  });
});
