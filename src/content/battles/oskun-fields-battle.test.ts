// Oskun Fields + Alvera Village battle config sanity tests (S96). Mirrors
// mountain-pass-battle.test.ts: the restage keeps the River Ridge roster,
// stages uniquely, and every authored position sits inside its team's
// deployment zone.

import { describe, expect, it } from 'vitest';
import { loadDefaultCatalog } from '@content/index.ts';
import { createInitialState, teamForTile, type BattleConfig, type UnitId } from '@engine/index.ts';
import { deploymentZonesFor } from '../deployment/index.ts';
import { oskunFields } from '../maps/oskun-fields.ts';
import { alveraVillage } from '../maps/alvera-village.ts';
import { oskunFieldsBattle } from './oskun-fields-battle.ts';
import { alveraVillageBattle } from './alvera-village-battle.ts';
import { riverRidgeBattle } from './river-ridge-battle.ts';

const catalog = loadDefaultCatalog();

function checkRestage(config: BattleConfig, zonesKey: string): void {
  // Roster preserved.
  expect(config.units.length).toBe(riverRidgeBattle.units.length);
  const rrById = new Map<UnitId, (typeof riverRidgeBattle.units)[number]>(
    riverRidgeBattle.units.map((u) => [u.id, u]),
  );
  for (const u of config.units) {
    const rr = rrById.get(u.id);
    expect(rr).toBeDefined();
    expect(u.team).toBe(rr!.team);
    expect(u.classId).toBe(rr!.classId);
  }
  // Unique staging.
  const seen = new Set<string>();
  for (const u of config.units) {
    const key = `${u.position.x},${u.position.y},${u.position.layer}`;
    expect(seen.has(key)).toBe(false);
    seen.add(key);
  }
  // Every unit inside its own team's zone.
  const zones = deploymentZonesFor(zonesKey);
  for (const u of config.units) {
    expect(teamForTile(zones, u.position)).toBe(u.team);
  }
  // The template boots into a valid initial state.
  expect(() => createInitialState(config, catalog)).not.toThrow();
}

describe('Oskun Fields battle config', () => {
  it('uses the Oskun Fields map and a distinct battleId', () => {
    expect(oskunFieldsBattle.map).toBe(oskunFields);
    expect(oskunFieldsBattle.battleId).toBe('oskun_fields_v1');
  });

  it('restages the River Ridge roster inside the oskun_fields zones', () => {
    checkRestage(oskunFieldsBattle, 'oskun_fields');
  });
});

describe('Alvera Village battle config', () => {
  it('uses the Alvera Village map and a distinct battleId', () => {
    expect(alveraVillageBattle.map).toBe(alveraVillage);
    expect(alveraVillageBattle.battleId).toBe('alvera_village_v1');
  });

  it('restages the River Ridge roster inside the alvera_village zones', () => {
    checkRestage(alveraVillageBattle, 'alvera_village');
  });
});
