// TABA economy — skirmish valve + stub generator tests (M3 Stage 1, D3).

import { describe, expect, it } from 'vitest';
import { loadDefaultCatalog } from '@content/index.ts';
import { createInitialState } from '@engine/index.ts';
import { partyAverageLevel } from './enemy-level.ts';
import { allNodeBeats, getNode } from './graph.ts';
import { newCampaign } from './loop.ts';
import { M1_CAMPAIGN_GRAPH, M1_NODES } from './node.ts';
import { CLASS_TIER_MAP, tierEntryOf } from './progression/index.ts';
import { m0Roster } from './roster.ts';
import { firstBattleBeat } from './sequence.ts';
import { buildSkirmishBattle, generateSkirmishParty, skirmishLevelAt } from './skirmish.ts';
import { foldBattle } from './snapshot-fold.ts';

const catalog = loadDefaultCatalog();
const GRAPH = M1_CAMPAIGN_GRAPH;
const state = newCampaign(m0Roster, M1_NODES.riverRidge);

describe('generateSkirmishParty (the D3 stub behind the M4 seam)', () => {
  it('spawns exactly `count` generics at `level`', () => {
    const party = generateSkirmishParty(27, 4, catalog);
    expect(party).toHaveLength(4);
    for (const enemy of party) expect(enemy.level).toBe(27);
  });

  it('uses simple TIER-1 classes only', () => {
    for (const enemy of generateSkirmishParty(25, 6, catalog)) {
      expect(CLASS_TIER_MAP.has(enemy.classId)).toBe(true);
      expect(tierEntryOf(enemy.classId).tier).toBe(1);
    }
  });

  it('arms each generic with a usable kit and PLAIN gear (no equipment)', () => {
    for (const enemy of generateSkirmishParty(25, 3, catalog)) {
      expect(enemy.unlocks.length).toBeGreaterThan(0);
      expect(Object.values(enemy.equipment).every((v) => v === undefined || v === null)).toBe(true);
    }
  });

  it('is deterministic (same inputs → same party)', () => {
    expect(generateSkirmishParty(25, 5, catalog)).toEqual(generateSkirmishParty(25, 5, catalog));
  });
});

describe('buildSkirmishBattle', () => {
  const node = getNode(GRAPH, M1_NODES.riverRidge);

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
    const crossing = getNode(GRAPH, M1_NODES.theCrossing);
    expect(() => buildSkirmishBattle(crossing, state, catalog)).toThrow(/no battle beat/);
  });
});
