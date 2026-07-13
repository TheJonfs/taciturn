// Authored campaign nodes — the CAMPAIGN_RULESET_ID pin.
//
// The between-battles Formation UI computes equipment-adjusted bucket
// capacity under `CAMPAIGN_RULESET_ID` (via the engine's draft
// resolver), and `createInitialState` enforces capacity under each
// battle template's own `rulesetId`. Those must be the same ruleset or
// the UI's legality forecast diverges from what battle entry enforces
// (the M3 gear-UI brief's D3 failure mode). This walks every authored
// node's battle beats and pins the agreement; if a per-node ruleset
// ever ships, the Formation UI must become node-aware before this pin
// is relaxed.

import { describe, expect, it } from 'vitest';
import { allNodeBeats, getNode } from './graph.ts';
import { CAMPAIGN_GRAPH } from './node.ts';
import { CAMPAIGN_RULESET_ID } from './node-content.ts';
import { battleBeats, firstBattleBeat } from './sequence.ts';

describe('campaign nodes — ruleset agreement', () => {
  it('every authored battle template plays under CAMPAIGN_RULESET_ID', () => {
    let battleCount = 0;
    for (const node of CAMPAIGN_GRAPH.nodes) {
      for (const beat of battleBeats(allNodeBeats(node))) {
        battleCount += 1;
        expect(beat.battle.template.rulesetId, node.id).toBe(CAMPAIGN_RULESET_ID);
      }
    }
    // The walk must actually cover battles — an empty graph would pass
    // vacuously.
    expect(battleCount).toBeGreaterThan(0);
  });
});

// --- Chapter 1 shipped-content pins (taba-ch1-authoring brief) ---------------
// The brief's acceptance surface, pinned against the live graph: joins fire
// at 2/4/6, guests at 1/6 (Sera guest→join at 6), uniques drop at 1/3/8,
// outcome branches at 9/10 record flags and carry BOTH branch scenes, and
// every story battle authors a leveled placeholder lineup (the template
// defaults are L25-era fixtures — unplayable at an L1 start).

const ch1Battle = (id: string) => firstBattleBeat(allNodeBeats(getNode(CAMPAIGN_GRAPH, id)))!.battle;

describe('Chapter 1 content wiring', () => {
  it('staggered joins: Clio at Alvera, Thessaly at Grek Forest, Sera at Ordal Canyon', () => {
    expect(ch1Battle('node-alvera').joins!.map((u) => String(u.id))).toEqual(['plot-clio']);
    expect(ch1Battle('node-grek-forest').joins!.map((u) => String(u.id))).toEqual(['plot-thessaly']);
    expect(ch1Battle('node-ordal-canyon').joins!.map((u) => String(u.id))).toEqual(['plot-sera']);
  });

  it('guests: Wiegraf at Oskun, Sera at Ordal Canyon (guest → roster join)', () => {
    expect(ch1Battle('node-oskun').guests!.map((u) => String(u.id))).toEqual(['plot-wiegraf']);
    const ordal = ch1Battle('node-ordal-canyon');
    expect(ordal.guests!.map((u) => String(u.id))).toEqual(['plot-sera']);
    // The guest IS the joiner — same unit definition on both sides.
    expect(ordal.guests![0]).toEqual(ordal.joins![0]);
    // Each guest template authors exactly one guest slot for the fold.
    for (const b of [ch1Battle('node-oskun'), ordal]) {
      const guestSlots = b.template.units.filter((u) => u.team === b.playerTeam && u.guest === true);
      expect(guestSlots).toHaveLength(b.guests!.length);
    }
  });

  it('unique drops: Pendant at Oskun, Flametongue at Zelmonia Hills, Charm at Mount Eska', () => {
    expect(ch1Battle('node-oskun').grants!.map(String)).toEqual(['pendant_of_lumara']);
    expect(ch1Battle('node-zelmonia-hills').grants!.map(String)).toEqual(['flametongue']);
    expect(ch1Battle('node-mount-eska').grants!.map(String)).toEqual(['freelancers_charm']);
  });

  it('subdue-secrets: 9/10 record outcome flags and author BOTH branch scenes', () => {
    const ester = ch1Battle('node-ester-road');
    expect(ester.recordOutcomeAs).toBe('ester');
    expect(Object.keys(ester.onOutcome!).sort()).toEqual(['ester-good', 'ester-standard']);
    const ruk = ch1Battle('node-ruk-village');
    expect(ruk.recordOutcomeAs).toBe('ruk');
    expect(Object.keys(ruk.onOutcome!).sort()).toEqual(['ruk-good', 'ruk-standard']);
    // Both fights author the tagged predicate conditions (good first —
    // ordered victoryConditions, first-satisfied wins).
    for (const [battle, good] of [[ester, 'ester-good'], [ruk, 'ruk-good']] as const) {
      const first = battle.template.victoryConditions[0]!;
      expect(first.kind).toBe('predicate');
      if (first.kind === 'predicate') expect(first.outcome).toBe(good);
    }
  });

  it('Theo returns at Mount Eska stronger than at Zelmonia Hills', () => {
    const hills = ch1Battle('node-zelmonia-hills').enemies![0]!;
    const eska = ch1Battle('node-mount-eska').enemies![0]!;
    expect(String(hills.id)).toBe('plot-theo');
    expect(String(eska.id)).toBe('plot-theo');
    expect(hills.level).toBe(4);
    expect(eska.level).toBe(10);
    expect(eska.unlocks.length).toBeGreaterThan(hills.unlocks.length);
  });

  it('every Ch1 story battle authors a leveled enemy lineup (no raw template defaults)', () => {
    for (const node of CAMPAIGN_GRAPH.nodes) {
      for (const beat of battleBeats(allNodeBeats(node))) {
        expect(beat.battle.enemies, `${node.id} must author enemies`).toBeDefined();
        expect(beat.battle.enemies!.length).toBeGreaterThan(0);
      }
    }
  });
});
