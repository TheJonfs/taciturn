// enemiesFromLineup tests (S98 Tier 2, M4-composed) — the identity half of
// an authored lineup: class + level per slot, framed by the M4 unified
// composer exactly as skirmish generics are.

import { describe, expect, it } from 'vitest';
import { bucketId, classId, commandSetId } from '@engine/index.ts';
import { loadDefaultCatalog } from '@content/index.ts';
import type { LineupSpec } from '@content/battles/lineup-format.ts';
import { composeLineupEnemyDraft, enemiesFromLineup, lineupSlotSeed } from './lineup.ts';
import { generatedEnemyUnit } from './enemy-generation.ts';
import { enemyBraveFaith, enemyKitForBudget, enemyKitForLevel } from './enemy-kit.ts';
import { withInnatePassives } from './innate-passives.ts';
import { tokenKey } from './progression/index.ts';

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

  it('frames each enemy with the composer (kit prefix, Brave/Faith band, class name)', () => {
    // The kit STARTS with the primary curriculum prefix (M4 may append
    // pair-class spillover after it).
    const monkPrefix = enemyKitForLevel(classId('monk'), 3, catalog);
    expect(enemies[0]!.unlocks.slice(0, monkPrefix.length)).toEqual(monkPrefix);
    const pyroPrefix = enemyKitForLevel(classId('fire_mage'), 5, catalog);
    expect(enemies[1]!.unlocks.slice(0, pyroPrefix.length)).toEqual(pyroPrefix);
    const roll0 = enemyBraveFaith(3, 0);
    expect(enemies[0]!.brave).toBe(roll0.brave);
    expect(enemies[0]!.faith).toBe(roll0.faith);
    expect(enemies[0]!.name).toBe(catalog.getClass(classId('monk')).name);
  });

  it('matches the shared constructor for the same class/level/index/seed (one composer)', () => {
    const twin = generatedEnemyUnit({
      id: 'twin',
      name: 'Twin',
      classId: classId('monk'),
      level: 3,
      index: 0,
      seed: lineupSlotSeed('test_field', 0),
      catalog,
    });
    const authored = enemies[0]!;
    expect(authored.loadout).toEqual(twin.loadout);
    expect(authored.equipment).toEqual(twin.equipment);
    expect(authored.unlocks).toEqual(twin.unlocks);
    expect(authored.brave).toBe(twin.brave);
    expect(authored.faith).toBe(twin.faith);
  });

  it('is stable: the per-slot seed derives from (lineup key, index) alone', () => {
    expect(enemiesFromLineup(SPEC, catalog)).toEqual(enemiesFromLineup(SPEC, catalog));
  });
});

describe('enemy overrides (Tier 3)', () => {
  const base = SPEC.enemies[0]!; // monk L3 at (7,1)

  it('jpBudget dial decouples the kit from level (curriculum prefix at the budget)', () => {
    const spec: LineupSpec = {
      ...SPEC,
      enemies: [{ ...base, overrides: { jpBudget: 900 } }],
    };
    const [enemy] = enemiesFromLineup(spec, catalog);
    const prefix = enemyKitForBudget(classId('monk'), 900, catalog);
    expect(enemy!.unlocks.slice(0, prefix.length)).toEqual(prefix);
    expect(prefix.length).toBeGreaterThan(
      enemyKitForLevel(classId('monk'), 3, catalog).length,
    );
  });

  it('explicit unlocks win over jpBudget and brand into real tokens', () => {
    const kit = enemyKitForLevel(classId('monk'), 10, catalog);
    const refs = kit.map((t) => ({ kind: t.kind, id: String(t.id) }));
    const spec: LineupSpec = {
      ...SPEC,
      enemies: [{ ...base, overrides: { jpBudget: 100, unlocks: refs } }],
    };
    const [enemy] = enemiesFromLineup(spec, catalog);
    // Explicit kits are exact — no budget spillover appended.
    expect(enemy!.unlocks.map(tokenKey)).toEqual(kit.map(tokenKey));
  });

  it('secondary command set + explicit passives compose into the loadout, innates merged', () => {
    const monkSet = catalog.getClass(classId('monk')).firstActionCommandSet;
    const pyroSet = catalog.getClass(classId('fire_mage')).firstActionCommandSet;
    const spec: LineupSpec = {
      ...SPEC,
      enemies: [
        {
          ...base,
          overrides: {
            secondaryCommandSet: String(pyroSet),
            passives: { reaction: [], support: [], movement: [] },
          },
        },
      ],
    };
    const [enemy] = enemiesFromLineup(spec, catalog);
    expect(enemy!.loadout.actionBuckets[bucketId('first_action')]).toEqual([monkSet]);
    expect(enemy!.loadout.actionBuckets[bucketId('secondary_command_sets')]).toEqual([
      commandSetId(String(pyroSet)),
    ]);
    // Explicit (empty) passives → innates only, exactly the innate merge.
    const innatesOnly = withInnatePassives(
      { actionBuckets: {}, passiveBuckets: {} },
      classId('monk'),
      catalog,
    );
    expect(enemy!.loadout.passiveBuckets).toEqual(innatesOnly.passiveBuckets);
  });

  it('an equipment record replaces generated gear wholesale; empty record = bare-handed', () => {
    const armed: LineupSpec = {
      ...SPEC,
      enemies: [{ ...base, overrides: { equipment: { rightHand: 'spiked_maul' } } }],
    };
    expect(String(enemiesFromLineup(armed, catalog)[0]!.equipment.rightHand)).toBe('spiked_maul');
    const bare: LineupSpec = {
      ...SPEC,
      enemies: [{ ...base, overrides: { equipment: {} } }],
    };
    expect(enemiesFromLineup(bare, catalog)[0]!.equipment.rightHand).toBeNull();
  });

  it('name/brave/faith/gender riders apply; absent riders keep framework defaults', () => {
    const spec: LineupSpec = {
      ...SPEC,
      enemies: [
        { ...base, overrides: { name: 'Grond of the Ford', brave: 88, gender: 'male' } },
      ],
    };
    const [enemy] = enemiesFromLineup(spec, catalog);
    expect(enemy!.name).toBe('Grond of the Ford');
    expect(enemy!.brave).toBe(88);
    expect(enemy!.faith).toBe(enemyBraveFaith(3, 0).faith); // band default survives
    expect(enemy!.gender).toBe('male');
  });

  it('composeLineupEnemyDraft matches what enemiesFromLineup ships (the validation contract)', () => {
    const slot = { ...base, overrides: { equipment: { rightHand: 'dagger' as const } } };
    const spec: LineupSpec = { ...SPEC, enemies: [slot] };
    const draft = composeLineupEnemyDraft(slot, catalog, lineupSlotSeed(spec.key, 0));
    const [enemy] = enemiesFromLineup(spec, catalog);
    expect(enemy!.loadout).toEqual(draft.loadout);
    expect(enemy!.equipment).toEqual(draft.equipment);
    expect(enemy!.unlocks).toEqual(draft.unlocks);
  });
});
