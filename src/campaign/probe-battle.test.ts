// TABA campaign — canonical probe battlefield tests.
//
// THE load-bearing pin: the vitals/stat probe's result must not depend on
// which battle template it folds onto — that independence is what lets a
// battlefield-less location (a pure market town) size hires against the
// canonical field, and the Formation probes drop their graph dependency.

import { describe, expect, it } from 'vitest';
import { loadDefaultCatalog } from '@content/index.ts';
import { allNodeBeats, getNode } from './graph.ts';
import { M1_CAMPAIGN_GRAPH, M1_NODES } from './node.ts';
import { CANONICAL_PROBE_BATTLE, probeBattleFor } from './probe-battle.ts';
import { m0Roster } from './roster.ts';
import { firstBattleBeat } from './sequence.ts';
import { probeEffectiveMaxes, probeUnitStats } from './snapshot-fold.ts';
import type { CampaignNode } from './graph.ts';

const catalog = loadDefaultCatalog();

describe('probe template independence (the market-town enabler)', () => {
  const riverRidge = firstBattleBeat(allNodeBeats(getNode(M1_CAMPAIGN_GRAPH, M1_NODES.riverRidge)))!.battle;

  it('effective max vitals are identical across templates', () => {
    const onCanonical = probeEffectiveMaxes(
      CANONICAL_PROBE_BATTLE.template,
      m0Roster,
      CANONICAL_PROBE_BATTLE.playerTeam,
      catalog,
    );
    const onRiverRidge = probeEffectiveMaxes(riverRidge.template, m0Roster, riverRidge.playerTeam, catalog);
    for (const unit of m0Roster) {
      expect(onCanonical.get(unit.id)).toEqual(onRiverRidge.get(unit.id));
    }
  });

  it('effective stats are identical across templates', () => {
    for (const unit of m0Roster.slice(0, 3)) {
      const a = probeUnitStats(CANONICAL_PROBE_BATTLE.template, unit, CANONICAL_PROBE_BATTLE.playerTeam, catalog);
      const b = probeUnitStats(riverRidge.template, unit, riverRidge.playerTeam, catalog);
      expect(a).toEqual(b);
    }
  });
});

describe('probeBattleFor', () => {
  it("prefers the node's own battlefield when it has one", () => {
    const node = getNode(M1_CAMPAIGN_GRAPH, M1_NODES.stonebridge);
    const probe = probeBattleFor(node);
    expect(probe.template).toBe(firstBattleBeat(allNodeBeats(node))!.battle.template);
  });

  it('falls back to the canonical field for a beat-less node', () => {
    const town: CampaignNode = { id: 'node-town', name: 'Watford Market', chapter: 1, engagements: [], isHub: true };
    expect(probeBattleFor(town)).toBe(CANONICAL_PROBE_BATTLE);
  });
});
