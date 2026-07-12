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
import { M1_CAMPAIGN_GRAPH } from './node.ts';
import { CAMPAIGN_RULESET_ID } from './node-content.ts';
import { battleBeats } from './sequence.ts';

describe('campaign nodes — ruleset agreement', () => {
  it('every authored battle template plays under CAMPAIGN_RULESET_ID', () => {
    let battleCount = 0;
    for (const node of M1_CAMPAIGN_GRAPH.nodes) {
      for (const beat of battleBeats(node.beats)) {
        battleCount += 1;
        expect(beat.battle.template.rulesetId, node.id).toBe(CAMPAIGN_RULESET_ID);
      }
    }
    // The walk must actually cover battles — an empty graph would pass
    // vacuously.
    expect(battleCount).toBeGreaterThan(0);
  });
});
