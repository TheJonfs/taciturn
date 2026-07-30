// TABA economy — skirmish valve + M4 generator tests.

import { describe, expect, it } from 'vitest';
import { loadDefaultCatalog } from '@content/index.ts';
import { createInitialState } from '@engine/index.ts';
import { archetypeForNode, DEFAULT_ARCHETYPE, ENEMY_ARCHETYPES } from './archetypes.ts';
import { HIRE_NAMES_FEMALE, HIRE_NAMES_MALE } from './recruit.ts';
import { partyAverageLevel } from './enemy-level.ts';
import { allNodeBeats, getNode } from './graph.ts';
import { newCampaign } from './loop.ts';
import { CAMPAIGN_GRAPH, CAMPAIGN_NODES } from './node.ts';
import { m0Roster } from './roster.ts';
import { firstBattleBeat } from './sequence.ts';
import {
  buildSkirmishBattle,
  generateSkirmishParty,
  recordSkirmishWin,
  skirmishLevelAt,
  skirmishSeed,
  skirmishWinsAt,
} from './skirmish.ts';
import { foldBattle } from './snapshot-fold.ts';

const catalog = loadDefaultCatalog();
const GRAPH = CAMPAIGN_GRAPH;
const state = newCampaign(m0Roster, CAMPAIGN_NODES.oskun);
const BANDITS = ENEMY_ARCHETYPES.find((a) => a.id === 'bandits')!;

describe('generateSkirmishParty (the M4 generator)', () => {
  it('spawns exactly `count` enemies at `level`, cast from the archetype pool', () => {
    const party = generateSkirmishParty(7, 4, catalog, 123, BANDITS);
    expect(party).toHaveLength(4);
    const poolIds = new Set(BANDITS.classPool.map((e) => String(e.classId)));
    for (const enemy of party) {
      expect(enemy.level).toBe(7);
      expect(poolIds.has(String(enemy.classId))).toBe(true);
    }
  });

  it('names units from the gendered naming pools, unique within the party (S100)', () => {
    const party = generateSkirmishParty(5, 3, catalog, 9, BANDITS);
    const names = party.map((e) => e.name);
    expect(new Set(names).size).toBe(names.length);
    for (const enemy of party) {
      expect(enemy.gender).toBeDefined();
      const pool = enemy.gender === 'female' ? HIRE_NAMES_FEMALE : HIRE_NAMES_MALE;
      expect(pool).toContain(enemy.name.replace(/ \d+$/, ''));
    }
  });

  it('arms each enemy with a level-budgeted kit, real gear, and a rolled band (M4)', () => {
    for (const enemy of generateSkirmishParty(7, 4, catalog, 42, BANDITS)) {
      expect(enemy.unlocks.length).toBeGreaterThan(0);
      // M4: real gear, not the bare-dagger stub — at L7 every class can
      // hold SOMETHING (weapon or armor).
      const worn = Object.values(enemy.equipment).filter((id) => id !== null);
      expect(worn.length).toBeGreaterThan(0);
      expect(enemy.brave).toBeGreaterThanOrEqual(50);
      expect(enemy.brave).toBeLessThanOrEqual(70);
      expect(enemy.faith).toBeGreaterThanOrEqual(50);
      expect(enemy.faith).toBeLessThanOrEqual(70);
    }
  });

  it('is deterministic: same (level, count, seed, archetype) → same party', () => {
    expect(generateSkirmishParty(12, 5, catalog, 777, BANDITS)).toEqual(
      generateSkirmishParty(12, 5, catalog, 777, BANDITS),
    );
  });

  it('different seeds vary the party (repeat-farm variance)', () => {
    const seeds = [1, 2, 3, 4, 5];
    const parties = seeds.map((s) =>
      generateSkirmishParty(12, 5, catalog, s, BANDITS).map((u) => String(u.classId)).join(','),
    );
    expect(new Set(parties).size).toBeGreaterThan(1);
  });
});

describe('skirmish seed stream (per-node win counter)', () => {
  it('starts at zero wins and advances on recordSkirmishWin', () => {
    expect(skirmishWinsAt(state, CAMPAIGN_NODES.oskun)).toBe(0);
    const once = recordSkirmishWin(state, CAMPAIGN_NODES.oskun);
    expect(skirmishWinsAt(once, CAMPAIGN_NODES.oskun)).toBe(1);
    // Per-node: another node's counter is untouched.
    expect(skirmishWinsAt(once, CAMPAIGN_NODES.alvera)).toBe(0);
  });

  it('the seed depends on node identity and fight number', () => {
    expect(skirmishSeed(CAMPAIGN_NODES.oskun, 0)).not.toBe(skirmishSeed(CAMPAIGN_NODES.oskun, 1));
    expect(skirmishSeed(CAMPAIGN_NODES.oskun, 0)).not.toBe(skirmishSeed(CAMPAIGN_NODES.alvera, 0));
  });

  it('a win rerolls the next skirmish party; a reload (same state) does not', () => {
    const node = getNode(GRAPH, CAMPAIGN_NODES.oskun);
    const before = buildSkirmishBattle(node, state, catalog);
    const reload = buildSkirmishBattle(node, state, catalog);
    expect(before.enemies).toEqual(reload.enemies); // same state → same party
    const won = recordSkirmishWin(state, CAMPAIGN_NODES.oskun);
    const after = buildSkirmishBattle(node, won, catalog);
    expect(after.enemies).not.toEqual(before.enemies); // seed advanced
  });
});

describe('archetypeForNode', () => {
  it('every mapped Ch1 node resolves to a known archetype for any seed', () => {
    for (const nodeId of Object.values(CAMPAIGN_NODES)) {
      for (let s = 0; s < 8; s++) {
        const archetype = archetypeForNode(nodeId, s);
        expect(archetype.classPool.length).toBeGreaterThan(0);
      }
    }
  });

  it('an unmapped node falls back to the default archetype', () => {
    expect(archetypeForNode('node-not-authored-yet', 3)).toBe(DEFAULT_ARCHETYPE);
  });
});

describe('buildSkirmishBattle', () => {
  const node = getNode(GRAPH, CAMPAIGN_NODES.oskun);

  it('borrows the node battlefield and fights ONLY the generated party', () => {
    const battle = buildSkirmishBattle(node, state, catalog);
    const authored = firstBattleBeat(allNodeBeats(node))!.battle;
    expect(battle.template.map).toBe(authored.template.map);
    expect(battle.zones).toBe(authored.zones);
    // Enemy slots are trimmed to the generated party — no leftover story
    // enemies can leak into the fight through foldEnemyTeam's kept-slots.
    const enemySlots = battle.template.units.filter((u) => u.team !== battle.playerTeam);
    expect(battle.enemies).toHaveLength(enemySlots.length);
  });

  it('resolves the enemy level through the one lever (party avg + offset)', () => {
    const battle = buildSkirmishBattle(node, state, catalog);
    const expected = partyAverageLevel(state.roster) + (node.offset ?? 0);
    for (const enemy of battle.enemies!) expect(enemy.level).toBe(expected);
    expect(skirmishLevelAt(node, state)).toBe(expected);
  });

  it('folds into a launchable battle (engine accepts the generated party)', () => {
    const battle = buildSkirmishBattle(node, state, catalog);
    const config = foldBattle(battle, m0Roster.slice(0, battle.deployCap), catalog);
    const initial = createInitialState(config, catalog);
    // Every generated enemy stands on the field at its resolved level.
    for (const enemy of battle.enemies!) {
      const live = initial.units.get(enemy.id);
      expect(live).toBeDefined();
      expect(live!.level).toBe(enemy.level);
      expect(live!.vitals.hp).toBeGreaterThan(0);
    }
  });

  it('throws loudly for a node with no battle beat', () => {
    const crossing = getNode(GRAPH, CAMPAIGN_NODES.zelmoniaCastle);
    expect(() => buildSkirmishBattle(crossing, state, catalog)).toThrow(/no battle beat/);
  });
});
