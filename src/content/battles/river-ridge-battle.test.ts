// River Ridge battle config sanity tests. Mirrors training-field-
// battle.test.ts: same guard-rails against drift between the demo
// roster and the runtime config, plus deployment-zone correctness for
// each unit's starting position.

import { describe, expect, it } from 'vitest';
import { loadDefaultCatalog } from '@content/index.ts';
import {
  createInitialState,
  itemId,
  teamId,
  tileAt,
  unitId,
  type UnitId,
} from '@engine/index.ts';
import { riverRidge } from '../maps/river-ridge.ts';
import { demoBattle } from './demo.ts';
import { riverRidgeBattle } from './river-ridge-battle.ts';

describe('River Ridge battle config', () => {
  it('uses the River Ridge map', () => {
    expect(riverRidgeBattle.map).toBe(riverRidge);
  });

  it('defaults Team A to human control and Team B to AI (S43)', () => {
    // The classic single-player default: Blue (team_a) is the player,
    // Red (team_b) is the AI. The unified-team flow (S43) lets the setup
    // screen override these per battle, but the authored config carries
    // the backward-compatible defaults.
    expect(riverRidgeBattle.teams[0]!.control).toBe('human');
    expect(riverRidgeBattle.teams[1]!.control).toBe('ai');
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

  it('Red Lightning Mage carries the Session 36 loadout (Staff of Power / Silvered Vest / Guard Cap / Purifier)', () => {
    const catalog = loadDefaultCatalog();
    // createInitialState runs equipment-placement validation; an
    // ineligible slot or class restriction would throw here.
    const state = createInitialState(riverRidgeBattle, catalog);
    const redLightning = state.units.get(unitId('red_lightning_mage'));
    expect(redLightning).toBeDefined();
    expect(redLightning!.equipment.rightHand).toBe(itemId('staff_of_power'));
    // Session 36: Wizard's Robe → Silvered Vest, Pointy Hat → Guard Cap
    // (the Red team ran three Wizard's Robes and three Pointy Hats before
    // the unique-per-team adjustment). Staff of Power and Purifier — the
    // Session 33.5 Burn × Purifier interaction pieces — are retained.
    expect(redLightning!.equipment.armor).toBe(itemId('silvered_vest'));
    expect(redLightning!.equipment.headgear).toBe(itemId('guard_cap'));
    expect(redLightning!.equipment.accessory).toBe(itemId('purifier'));
  });

  // Session 36: the team builder enforces unique-per-team equipment —
  // each team carries at most one instance of any item. River Ridge's
  // authored rosters must satisfy the same rule so they load as valid
  // teams. This guards against regression on the loadout adjustments.
  it('each team carries unique-per-team equipment (no item appears twice on a team)', () => {
    const slots = ['leftHand', 'rightHand', 'headgear', 'armor', 'accessory'] as const;
    for (const team of [teamId('team_a'), teamId('team_b')]) {
      const seen = new Map<string, UnitId>();
      for (const unit of riverRidgeBattle.units) {
        if (unit.team !== team) continue;
        const equipment = unit.equipment;
        if (equipment === undefined) continue;
        for (const slot of slots) {
          const item = equipment[slot];
          if (item === null || item === undefined) continue;
          const prior = seen.get(String(item));
          expect(
            prior,
            `${String(item)} appears on both ${String(prior)} and ${String(unit.id)} (team ${String(team)})`,
          ).toBeUndefined();
          seen.set(String(item), unit.id);
        }
      }
    }
  });
});
