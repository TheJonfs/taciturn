// Marshmoor battle config sanity tests (Session 52). Mirrors
// stonebridge / river-ridge battle tests: guard-rails against drift
// between the River Ridge roster and the restaged Marshmoor config,
// plus deployment-zone correctness for each unit's starting position.

import { describe, expect, it } from 'vitest';
import { loadDefaultCatalog } from '@content/index.ts';
import {
  createInitialState,
  teamId,
  tileAt,
  type UnitId,
} from '@engine/index.ts';
import { marshmoor } from '../maps/marshmoor.ts';
import { marshmoorBattle } from './marshmoor-battle.ts';
import { riverRidgeBattle } from './river-ridge-battle.ts';

describe('Marshmoor battle config', () => {
  it('uses the Marshmoor map and a distinct battleId', () => {
    expect(marshmoorBattle.map).toBe(marshmoor);
    expect(marshmoorBattle.battleId).toBe('marshmoor_v1');
  });

  it('preserves the River Ridge roster (same 10 units, teams, classes)', () => {
    expect(marshmoorBattle.units.length).toBe(riverRidgeBattle.units.length);
    const rrById = new Map<UnitId, (typeof riverRidgeBattle.units)[number]>(
      riverRidgeBattle.units.map((u) => [u.id, u]),
    );
    for (const u of marshmoorBattle.units) {
      const rr = rrById.get(u.id);
      expect(rr).toBeDefined();
      expect(u.team).toBe(rr!.team);
      expect(u.classId).toBe(rr!.classId);
    }
  });

  it('places every unit on the 16×16 board at layer 0', () => {
    for (const unit of marshmoorBattle.units) {
      expect(unit.position.x).toBeGreaterThanOrEqual(0);
      expect(unit.position.x).toBeLessThan(marshmoor.width);
      expect(unit.position.y).toBeGreaterThanOrEqual(0);
      expect(unit.position.y).toBeLessThan(marshmoor.height);
      expect(unit.position.layer).toBe(0);
    }
  });

  it('starting positions are unique (no two units share a tile)', () => {
    const seen = new Set<string>();
    for (const unit of marshmoorBattle.units) {
      const key = `${unit.position.x},${unit.position.y},${unit.position.layer}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });

  it('each unit deploys inside their own team deployment zone', () => {
    for (const unit of marshmoorBattle.units) {
      const tile = tileAt(marshmoor, unit.position.x, unit.position.y, unit.position.layer);
      expect(tile).toBeDefined();
      expect(tile!.deploymentZone).toBe(unit.team);
    }
  });

  it('Blue (team_a) deploys in the NE corner (cols 13-15, rows 0-2)', () => {
    for (const unit of marshmoorBattle.units) {
      if (unit.team === teamId('team_a')) {
        expect(unit.position.x).toBeGreaterThanOrEqual(13);
        expect(unit.position.y).toBeLessThanOrEqual(2);
      }
    }
  });

  it('Red (team_b) deploys in the SW corner (cols 0-2, rows 13-15)', () => {
    for (const unit of marshmoorBattle.units) {
      if (unit.team === teamId('team_b')) {
        expect(unit.position.x).toBeLessThanOrEqual(2);
        expect(unit.position.y).toBeGreaterThanOrEqual(13);
      }
    }
  });

  it('initializes against the catalog without throwing', () => {
    const catalog = loadDefaultCatalog();
    const state = createInitialState(marshmoorBattle, catalog);
    expect(state.units.size).toBe(marshmoorBattle.units.length);
    expect(state.map.width).toBe(16);
    expect(state.map.height).toBe(16);
  });
});
