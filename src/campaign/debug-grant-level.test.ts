// The dev level grant (S94): +1 level to every active unit, healed to the
// new effective full; lost units untouched; repeatable.

import { describe, expect, it } from 'vitest';
import { loadDefaultCatalog } from '@content/index.ts';
import { DEBUG_LEVEL_GRANT, debugGrantLevel } from './debug-grant-level.ts';
import { getNode } from './graph.ts';
import { newCampaign } from './loop.ts';
import { CAMPAIGN_GRAPH, CAMPAIGN_NODES } from './node.ts';
import { ch1StartingRoster } from './ch1-roster.ts';

const catalog = loadDefaultCatalog();
const node = getNode(CAMPAIGN_GRAPH, CAMPAIGN_NODES.oskun);

function stubRng(): () => number {
  let n = 7;
  return () => {
    n = (n * 9301 + 49297) % 233280;
    return n / 233280;
  };
}

describe('debugGrantLevel', () => {
  const base = newCampaign(ch1StartingRoster(stubRng(), catalog), CAMPAIGN_NODES.oskun);

  it('levels every active unit by the grant, resets xp, heals to effective full', () => {
    const before = base.roster[0]!;
    const after = debugGrantLevel(base, node, catalog);
    for (const [i, unit] of after.roster.entries()) {
      expect(unit.level).toBe(base.roster[i]!.level + DEBUG_LEVEL_GRANT);
      expect(unit.xp).toBe(0);
      // Healed to at least the pre-level vitals (max only grows with level).
      expect(unit.vitals.hp).toBeGreaterThanOrEqual(base.roster[i]!.vitals.hp);
    }
    expect(after.roster[0]!.vitals.hp).toBeGreaterThan(0);
    expect(before.level).toBe(1); // input untouched (pure)
  });

  it('skips lost units and is repeatable', () => {
    const withLost = {
      ...base,
      roster: [{ ...base.roster[0]!, fate: 'lost' as const }, ...base.roster.slice(1)],
    };
    const once = debugGrantLevel(withLost, node, catalog);
    const twice = debugGrantLevel(once, node, catalog);
    expect(twice.roster[0]!.level).toBe(1); // lost — never leveled
    expect(twice.roster[1]!.level).toBe(base.roster[1]!.level + 2 * DEBUG_LEVEL_GRANT);
  });
});
