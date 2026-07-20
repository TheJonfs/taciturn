// enemiesFromLineup tests (S98 Tier 2) — the identity half of an authored
// lineup: class + level per slot, framed by the shared enemy-kit
// constructor exactly as the skirmish stub frames its generics.

import { describe, expect, it } from 'vitest';
import { classId } from '@engine/index.ts';
import { loadDefaultCatalog } from '@content/index.ts';
import type { LineupSpec } from '@content/battles/lineup-format.ts';
import { enemiesFromLineup } from './lineup.ts';
import { enemyBraveFaith, enemyKitForLevel } from './enemy-kit.ts';
import { generateSkirmishParty } from './skirmish.ts';

const catalog = loadDefaultCatalog();

const SPEC: LineupSpec = {
  key: 'test_field',
  mapKey: 'marshmoor',
  battleId: 'test_field_v1',
  players: [],
  guests: [],
  enemies: [
    { x: 7, y: 1, layer: 0, facing: 'S', classId: 'monk', level: 3 },
    { x: 6, y: 1, layer: 0, facing: 'S', classId: 'fire_mage', level: 5 },
  ],
};

describe('enemiesFromLineup', () => {
  const enemies = enemiesFromLineup(SPEC, catalog);

  it('builds one spec per enemy slot, index-aligned, with authored class + level', () => {
    expect(enemies).toHaveLength(2);
    expect(String(enemies[0]!.id)).toBe('test_field-enemy-1');
    expect(String(enemies[1]!.id)).toBe('test_field-enemy-2');
    expect(enemies[0]!.classId).toBe(classId('monk'));
    expect(enemies[0]!.level).toBe(3);
    expect(enemies[1]!.classId).toBe(classId('fire_mage'));
    expect(enemies[1]!.level).toBe(5);
  });

  it('frames each enemy with the enemy-kit framework (kit, Brave/Faith band, class name)', () => {
    expect(enemies[0]!.unlocks).toEqual(enemyKitForLevel(classId('monk'), 3, catalog));
    expect(enemies[1]!.unlocks).toEqual(enemyKitForLevel(classId('fire_mage'), 5, catalog));
    const roll0 = enemyBraveFaith(3, 0);
    expect(enemies[0]!.brave).toBe(roll0.brave);
    expect(enemies[0]!.faith).toBe(roll0.faith);
    expect(enemies[0]!.name).toBe(catalog.getClass(classId('monk')).name);
  });

  it('matches the skirmish stub construction for the same class/level/index (shared constructor)', () => {
    // Skirmish slot 0 is a monk; an authored monk at the same level and
    // index differs only in id/name — the framing (kit, loadout, gear,
    // Brave/Faith) is byte-for-byte the same constructor output.
    const skirmish = generateSkirmishParty(3, 1, catalog)[0]!;
    const authored = enemies[0]!;
    expect(authored.loadout).toEqual(skirmish.loadout);
    expect(authored.equipment).toEqual(skirmish.equipment);
    expect(authored.unlocks).toEqual(skirmish.unlocks);
    expect(authored.brave).toBe(skirmish.brave);
    expect(authored.faith).toBe(skirmish.faith);
  });
});
