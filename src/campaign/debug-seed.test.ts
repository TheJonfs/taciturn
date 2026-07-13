// TABA M3 Stage 0 — the dev inventory seed (top-up semantics).

import { describe, expect, it } from 'vitest';
import { loadDefaultCatalog } from '../content/index.ts';
import { isEquipment, itemId } from '@engine/index.ts';
import { DEBUG_SEED_TARGET, debugSeedGrants, debugSeedInventory } from './debug-seed.ts';
import { freeCount, grantItems, ownedCount } from './inventory.ts';
import { newCampaign } from './loop.ts';
import { CAMPAIGN_NODES } from './node.ts';
import { m0Roster } from './roster.ts';

const cat = loadDefaultCatalog();

describe('debugSeedInventory', () => {
  it('tops every equipment item (uniques + hidden TABA pool included) up to the target', () => {
    const seeded = debugSeedInventory(newCampaign(m0Roster, CAMPAIGN_NODES.oskun), cat);
    for (const item of cat.items()) {
      if (!isEquipment(item)) continue;
      expect(ownedCount(seeded, item.id), String(item.id)).toBeGreaterThanOrEqual(
        DEBUG_SEED_TARGET,
      );
      expect(freeCount(seeded, item.id), String(item.id)).toBeGreaterThan(0);
    }
  });

  it('never grants consumables', () => {
    const seeded = debugSeedInventory(newCampaign(m0Roster, CAMPAIGN_NODES.oskun), cat);
    for (const item of cat.items()) {
      if (isEquipment(item)) continue;
      expect(ownedCount(seeded, item.id), String(item.id)).toBe(0);
    }
  });

  it('is idempotent (top-up, not add) and preserves counts already above target', () => {
    const base = grantItems(newCampaign(m0Roster, CAMPAIGN_NODES.oskun), [
      [itemId('long_sword'), 50],
    ]);
    const once = debugSeedInventory(base, cat);
    expect(debugSeedGrants(once, cat)).toEqual([]); // fully seeded → chip shows done
    expect(debugSeedInventory(once, cat)).toEqual(once);
    expect(ownedCount(once, itemId('long_sword'))).toBe(50); // never lowered
  });
});
