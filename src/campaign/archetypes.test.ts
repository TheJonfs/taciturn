// TABA M4 — archetype registry tests (WI4): the Ch1 class gate, weighted
// rolls, composition minimums, and the fail-soft starvation path.

import { describe, expect, it } from 'vitest';
import { classId } from '@engine/index.ts';
import { loadDefaultCatalog } from '@content/index.ts';
import {
  archetypeForNode,
  DEFAULT_ARCHETYPE,
  ENEMY_ARCHETYPES,
  NODE_ARCHETYPES,
  rollArchetypeClasses,
  type EnemyArchetype,
} from './archetypes.ts';
import { generateSkirmishParty, skirmishSeed } from './skirmish.ts';
import { CAMPAIGN_NODES } from './node.ts';

const catalog = loadDefaultCatalog();
const ASSASSIN = classId('assassin');
const CALCULATOR = classId('calculator');

describe('the Ch1 registry', () => {
  it('every mapped node id references known archetypes', () => {
    const known = new Set(ENEMY_ARCHETYPES.map((a) => a.id));
    for (const ids of Object.values(NODE_ARCHETYPES)) {
      for (const id of ids) expect(known.has(id)).toBe(true);
    }
  });

  it('every Ch1 campaign node has an authored archetype mapping', () => {
    for (const nodeId of Object.values(CAMPAIGN_NODES)) {
      expect(NODE_ARCHETYPES[nodeId], nodeId).toBeDefined();
    }
  });

  it('every archetype pool class exists in the catalog', () => {
    for (const archetype of [...ENEMY_ARCHETYPES, DEFAULT_ARCHETYPE]) {
      for (const e of archetype.classPool) {
        expect(catalog.hasClass(e.classId), `${archetype.id}: ${String(e.classId)}`).toBe(true);
      }
    }
  });
});

describe('the Ch1 class gate (the brief acceptance pin)', () => {
  it('NO Assassin or Calculator in a Ch1 skirmish at ANY level — class or secondary', () => {
    for (const nodeId of Object.values(CAMPAIGN_NODES)) {
      for (let fight = 0; fight < 4; fight++) {
        const seed = skirmishSeed(nodeId, fight);
        const archetype = archetypeForNode(nodeId, seed);
        for (const level of [1, 10, 40]) {
          for (const enemy of generateSkirmishParty(level, 5, catalog, seed, archetype)) {
            expect(enemy.classId).not.toBe(ASSASSIN);
            expect(enemy.classId).not.toBe(CALCULATOR);
            // The secondary command set can't be a Tier-3 class's either:
            // the pair roll is tier-capped and every Ch1 pool tops out at
            // Tier 2, so no bucket may carry their sets.
            const sets = Object.values(enemy.loadout.actionBuckets).flat().map(String);
            expect(sets).not.toContain(String(catalog.getClass(ASSASSIN).firstActionCommandSet));
            expect(sets).not.toContain(
              String(catalog.getClass(CALCULATOR).firstActionCommandSet),
            );
          }
        }
      }
    }
  });
});

describe('rollArchetypeClasses', () => {
  const bandits = ENEMY_ARCHETYPES.find((a) => a.id === 'bandits')!;

  it('rolls only from the pool, deterministically', () => {
    const poolIds = new Set(bandits.classPool.map((e) => String(e.classId)));
    const a = rollArchetypeClasses(bandits, 6, 42, catalog);
    const b = rollArchetypeClasses(bandits, 6, 42, catalog);
    expect(a).toEqual(b);
    for (const cls of a) expect(poolIds.has(String(cls))).toBe(true);
  });

  it('enforces composition minimums (bandits always field a thief)', () => {
    for (let seed = 0; seed < 32; seed++) {
      const rolled = rollArchetypeClasses(bandits, 4, seed, catalog);
      expect(rolled.some((c) => c === classId('thief'))).toBe(true);
    }
  });

  it('fails soft on an unsatisfiable minimum (party smaller than the floors)', () => {
    const greedy: EnemyArchetype = {
      id: 'greedy',
      label: 'Greedy',
      unitNamePrefix: 'Greedy',
      classPool: [
        { classId: classId('monk'), weight: 1 },
        { classId: classId('hunter'), weight: 1 },
      ],
      minimums: [
        { classIds: [classId('monk')], count: 2 },
        { classIds: [classId('hunter')], count: 2 },
      ],
    };
    // A 2-unit party cannot satisfy 4 required slots — must not throw.
    const rolled = rollArchetypeClasses(greedy, 2, 7, catalog);
    expect(rolled).toHaveLength(2);
  });
});
