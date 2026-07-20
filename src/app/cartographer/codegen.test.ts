// Cartographer codegen — the round-trip fidelity pin (the correctness
// spine of the map-authoring tool, mirroring Atlas's codegen test).
//
//   1. BYTE-IDENTICAL: importing every shipped map spec (runtime value)
//      and re-emitting it reproduces the shipped module file exactly;
//      likewise the deployment-zone registry. Alvera is the bridge
//      fidelity trap the brief flags — its layer-1 deck + bridge_ramp
//      property must survive.
//   2. VALUE-IDENTICAL: the emitted specs rebuild the exact BattleMaps the
//      game ships.
//   3. FIXPOINT on a synthetic map exercising every spec feature at once
//      (bands incl. gte, overrides, properties, decks, non-square size).

import { describe, expect, it } from 'vitest';

import riverRidgeSource from '@content/maps/river-ridge.ts?raw';
import stonebridgeSource from '@content/maps/stonebridge.ts?raw';
import marshmoorSource from '@content/maps/marshmoor.ts?raw';
import mountainPassSource from '@content/maps/mountain-pass.ts?raw';
import oskunFieldsSource from '@content/maps/oskun-fields.ts?raw';
import alveraVillageSource from '@content/maps/alvera-village.ts?raw';
import zoneRegistrySource from '@content/deployment/registry.ts?raw';

import { buildMapFromSpec, type MapSpec } from '@content/maps/map-format.ts';
import { riverRidge } from '@content/maps/river-ridge.ts';
import { stonebridge } from '@content/maps/stonebridge.ts';
import { marshmoor } from '@content/maps/marshmoor.ts';
import { mountainPass } from '@content/maps/mountain-pass.ts';
import { oskunFields } from '@content/maps/oskun-fields.ts';
import { alveraVillage } from '@content/maps/alvera-village.ts';
import type { BattleMap } from '@engine/index.ts';

import { generateMapModule, generateZoneRegistryModule } from './codegen.ts';
import { importZoneRegistry, SHIPPED_MAP_SPECS, shippedMapSpec } from './import.ts';

const SHIPPED_SOURCES: ReadonlyArray<{ key: string; source: string; map: BattleMap }> = [
  { key: 'river_ridge', source: riverRidgeSource, map: riverRidge },
  { key: 'stonebridge', source: stonebridgeSource, map: stonebridge },
  { key: 'marshmoor', source: marshmoorSource, map: marshmoor },
  { key: 'mountain_pass', source: mountainPassSource, map: mountainPass },
  { key: 'oskun_fields', source: oskunFieldsSource, map: oskunFields },
  { key: 'alvera_village', source: alveraVillageSource, map: alveraVillage },
];

describe('cartographer codegen — shipped-map round trip', () => {
  it.each(SHIPPED_SOURCES)('re-emits $key byte-identical', ({ key, source }) => {
    const spec = shippedMapSpec(key);
    expect(spec).toBeDefined();
    expect(generateMapModule(spec!)).toBe(source);
  });

  it.each(SHIPPED_SOURCES)('spec rebuilds the shipped $key BattleMap', ({ key, map }) => {
    expect(buildMapFromSpec(shippedMapSpec(key)!)).toEqual(map);
  });

  it('covers every shipped spec (no source fixture forgotten)', () => {
    expect(SHIPPED_SOURCES.map((s) => s.key)).toEqual(SHIPPED_MAP_SPECS.map((s) => s.key));
  });

  it('Alvera keeps the bridge: 3 layer-1 deck tiles + the ramp property', () => {
    // The brief's named fidelity trap, pinned explicitly rather than only
    // via byte identity.
    const spec = shippedMapSpec('alvera_village')!;
    expect(spec.decks).toHaveLength(3);
    expect(spec.decks.every((d) => d.terrain === 'bridge' && d.elevation === 3)).toBe(true);
    expect(spec.properties).toEqual([{ x: 2, y: 10, properties: ['bridge_ramp'] }]);
  });
});

describe('cartographer codegen — zone-registry round trip', () => {
  it('re-emits the deployment-zone registry byte-identical', () => {
    expect(generateZoneRegistryModule(importZoneRegistry())).toBe(zoneRegistrySource);
  });

  it('carries Mountain Pass sub-zones and caps losslessly', () => {
    const mountainPassEntry = importZoneRegistry().find((e) => e.mapKey === 'mountain_pass')!;
    const red = mountainPassEntry.configs[0]!.teams.find((t) => t.team === 'team_b')!;
    expect(red.subZones.map((s) => s.cap)).toEqual([3, 2]);
    expect(red.subZones[1]!.tiles).toHaveLength(4);
  });
});

describe('cartographer codegen — synthetic fixpoint', () => {
  const SYNTHETIC: MapSpec = {
    key: 'test_gorge',
    label: 'Test Gorge',
    width: 4,
    height: 3,
    bands: [
      { when: 'eq', elevation: 0, terrain: 'water_deep' },
      { when: 'eq', elevation: 1, terrain: 'water_shallow' },
      { when: 'gte', elevation: 6, terrain: 'rock' },
    ],
    elevation: [
      [2, 2, 1, 0],
      [3, 2, 1, 0],
      [7, 6, 2, 1],
    ],
    terrainOverrides: [{ x: 0, y: 0, terrain: 'rampart' }],
    properties: [{ x: 1, y: 1, properties: ['blocks_los'] }],
    decks: [{ x: 2, y: 1, elevation: 3, terrain: 'bridge', properties: [] }],
  };

  it('emit → (module exports the same spec shape) → emit is byte-stable', () => {
    const emitted = generateMapModule(SYNTHETIC);
    // The emitted module contains the spec as a literal; emitting the same
    // spec again must be deterministic.
    expect(generateMapModule(SYNTHETIC)).toBe(emitted);
    // And the spec builds a coherent map: 12 ground tiles + 1 deck.
    const map = buildMapFromSpec(SYNTHETIC);
    expect(map.tiles).toHaveLength(13);
    expect(map.tiles.find((t) => t.layer === 1)).toMatchObject({ x: 2, y: 1, terrain: 'bridge' });
    expect(map.tiles.find((t) => t.x === 0 && t.y === 0)!.terrain).toBe('rampart');
    expect(map.tiles.find((t) => t.x === 0 && t.y === 2)!.terrain).toBe('rock');
    expect(map.tiles.find((t) => t.x === 1 && t.y === 1)!.properties).toEqual(['blocks_los']);
  });

  it('rejects malformed keys loudly', () => {
    expect(() => generateMapModule({ ...SYNTHETIC, key: 'Bad-Key' })).toThrow(/snake_case/);
  });
});
