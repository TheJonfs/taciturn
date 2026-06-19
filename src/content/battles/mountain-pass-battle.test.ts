// Mountain Pass battle config sanity tests (S70). Mirrors the marshmoor
// battle tests, plus the split-zone specifics: the ambusher's authored
// staging must respect the per-sub-zone caps.

import { describe, expect, it } from 'vitest';
import { loadDefaultCatalog } from '@content/index.ts';
import {
  createInitialState,
  subZoneIndexForTile,
  teamForTile,
  teamId,
  type UnitId,
} from '@engine/index.ts';
import { deploymentZonesFor } from '../deployment/index.ts';
import { mountainPass } from '../maps/mountain-pass.ts';
import { mountainPassBattle } from './mountain-pass-battle.ts';
import { riverRidgeBattle } from './river-ridge-battle.ts';

const RED = teamId('team_b');

describe('Mountain Pass battle config', () => {
  it('uses the Mountain Pass map and a distinct battleId', () => {
    expect(mountainPassBattle.map).toBe(mountainPass);
    expect(mountainPassBattle.battleId).toBe('mountain_pass_v1');
  });

  it('preserves the River Ridge roster (same units, teams, classes)', () => {
    expect(mountainPassBattle.units.length).toBe(riverRidgeBattle.units.length);
    const rrById = new Map<UnitId, (typeof riverRidgeBattle.units)[number]>(
      riverRidgeBattle.units.map((u) => [u.id, u]),
    );
    for (const u of mountainPassBattle.units) {
      const rr = rrById.get(u.id);
      expect(rr).toBeDefined();
      expect(u.team).toBe(rr!.team);
      expect(u.classId).toBe(rr!.classId);
    }
  });

  it('starting positions are unique (no two units share a tile)', () => {
    const seen = new Set<string>();
    for (const unit of mountainPassBattle.units) {
      const key = `${unit.position.x},${unit.position.y},${unit.position.layer}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });

  it('each unit deploys inside their own team deployment zone', () => {
    const zones = deploymentZonesFor('mountain_pass');
    for (const unit of mountainPassBattle.units) {
      expect(teamForTile(zones, unit.position)).toBe(unit.team);
    }
  });

  it("the ambusher's authored staging respects the per-sub-zone caps (3 SW / 2 NE)", () => {
    const zones = deploymentZonesFor('mountain_pass');
    const perSubZone = new Map<number, number>();
    for (const unit of mountainPassBattle.units) {
      if (unit.team !== RED) continue;
      const idx = subZoneIndexForTile(zones, RED, unit.position);
      expect(idx).not.toBeNull();
      perSubZone.set(idx!, (perSubZone.get(idx!) ?? 0) + 1);
    }
    // Sub-zone 0 = SW massif (cap 3), sub-zone 1 = NE edge (cap 2).
    expect(perSubZone.get(0)).toBe(3);
    expect(perSubZone.get(1)).toBe(2);
  });

  it('initializes against the catalog without throwing', () => {
    const catalog = loadDefaultCatalog();
    const state = createInitialState(mountainPassBattle, catalog);
    expect(state.units.size).toBe(mountainPassBattle.units.length);
    expect(state.map.width).toBe(16);
    expect(state.map.height).toBe(16);
  });
});
