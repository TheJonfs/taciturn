// TABA economy — shop tests (M3 economy brief, Stage 2).

import { describe, expect, it } from 'vitest';
import { itemId } from '@engine/index.ts';
import {
  DEFAULT_ITEM_PRICE,
  SELL_RATE,
} from './economy-config.ts';
import { grantItems, ownedCount } from './inventory.ts';
import { newCampaign } from './loop.ts';
import { CAMPAIGN_GRAPH, CAMPAIGN_NODES } from './node.ts';
import { m0Roster } from './roster.ts';
import { buyItem, itemPrice, sellBlockReason, sellItem, sellValue, shopStock } from './shop.ts';
import type { CampaignState } from './types.ts';

const GRAPH = CAMPAIGN_GRAPH;

function stateWith(overrides: Partial<CampaignState>): CampaignState {
  return { ...newCampaign(m0Roster, CAMPAIGN_NODES.zarghidas), ...overrides };
}

const IRON_SWORD = itemId('iron_sword'); // Zarghidas starter bundle
const STEEL_HELM = itemId('steel_helm'); // Zelmonia Castle armory bundle
const FLAMETONGUE = itemId('flametongue'); // unique-pool (sell-blocked)

describe('shopStock (per-hub, story-gated — S94)', () => {
  it('is empty before any node clears', () => {
    expect(shopStock(GRAPH, stateWith({}), CAMPAIGN_NODES.zarghidas)).toEqual([]);
  });

  it('clearing a hub stocks its own shelves', () => {
    const cleared = stateWith({ clearedStoryBeats: [CAMPAIGN_NODES.zarghidas] });
    const ids = shopStock(GRAPH, cleared, CAMPAIGN_NODES.zarghidas).map((e) => String(e.itemId));
    expect(ids).toContain('iron_sword');
    expect(ids).not.toContain('steel_helm'); // Zelmonia Castle's shelf, not here
  });

  it("a hub sells ONLY its own gear: Alvera does not carry Zarghidas's", () => {
    const bothCleared = stateWith({
      clearedStoryBeats: [CAMPAIGN_NODES.zarghidas, CAMPAIGN_NODES.alvera],
    });
    const alvera = shopStock(GRAPH, bothCleared, CAMPAIGN_NODES.alvera).map((e) => String(e.itemId));
    expect(alvera).toContain('wand_of_lumen');
    expect(alvera).not.toContain('iron_sword'); // Zarghidas gear stays home
    const zarghidas = shopStock(GRAPH, bothCleared, CAMPAIGN_NODES.zarghidas).map((e) => String(e.itemId));
    expect(zarghidas).toContain('iron_sword');
    expect(zarghidas).not.toContain('wand_of_lumen');
  });

  it("the Alvera refreshes unlock on Old Ordal / Mount Eska clears but sell AT Alvera", () => {
    const beforeRefresh = stateWith({ clearedStoryBeats: [CAMPAIGN_NODES.alvera] });
    expect(
      shopStock(GRAPH, beforeRefresh, CAMPAIGN_NODES.alvera).map((e) => String(e.itemId)),
    ).not.toContain('staff_of_abundance');
    const afterOldOrdal = stateWith({
      clearedStoryBeats: [CAMPAIGN_NODES.alvera, CAMPAIGN_NODES.oldOrdal],
    });
    const shelves = shopStock(GRAPH, afterOldOrdal, CAMPAIGN_NODES.alvera).map((e) => String(e.itemId));
    expect(shelves).toContain('staff_of_abundance');
    expect(shelves).toContain('tome_of_power');
    // …and Old Ordal itself (a dead node) sells nothing.
    expect(shopStock(GRAPH, afterOldOrdal, CAMPAIGN_NODES.oldOrdal)).toEqual([]);
  });

  it('is MONOTONIC per hub: clearing more nodes only ever adds', () => {
    const one = shopStock(
      GRAPH,
      stateWith({ clearedStoryBeats: [CAMPAIGN_NODES.alvera] }),
      CAMPAIGN_NODES.alvera,
    );
    const two = shopStock(
      GRAPH,
      stateWith({ clearedStoryBeats: [CAMPAIGN_NODES.alvera, CAMPAIGN_NODES.oldOrdal] }),
      CAMPAIGN_NODES.alvera,
    );
    expect(two.length).toBeGreaterThan(one.length);
    for (const e of one) {
      expect(two.some((x) => x.itemId === e.itemId)).toBe(true);
    }
  });

  it('never stocks unique-pool or unassigned items', () => {
    const all = stateWith({
      clearedStoryBeats: GRAPH.nodes.map((n) => n.id),
    });
    for (const hub of GRAPH.nodes) {
      for (const entry of shopStock(GRAPH, all, hub.id)) {
        expect(entry.acquisition).toBe('shop');
        expect(entry.firstAvailableAt).toBeDefined();
        expect(entry.soldAt).toBe(hub.id);
      }
    }
  });
});

describe('buyItem', () => {
  const readyToBuy = stateWith({ clearedStoryBeats: [CAMPAIGN_NODES.zarghidas], gil: 2_000 });

  it('debits the price and grants the item through the receipt door', () => {
    const before = ownedCount(readyToBuy, IRON_SWORD);
    const bought = buyItem(readyToBuy, GRAPH, CAMPAIGN_NODES.zarghidas, IRON_SWORD);
    expect(bought.gil).toBe(2_000 - itemPrice(IRON_SWORD));
    expect(ownedCount(bought, IRON_SWORD)).toBe(before + 1);
  });

  it('refuses an item not stocked at this hub (story + location gates hold)', () => {
    expect(() => buyItem(readyToBuy, GRAPH, CAMPAIGN_NODES.zarghidas, STEEL_HELM)).toThrow(/not stocked at/);
  });

  it('refuses on insufficient gil (spendGil re-validates)', () => {
    const broke = { ...readyToBuy, gil: itemPrice(IRON_SWORD) - 1 };
    expect(() => buyItem(broke, GRAPH, CAMPAIGN_NODES.zarghidas, IRON_SWORD)).toThrow(/insufficient gil/);
  });
});

describe('sellItem (D1: partial rate, uniques blocked)', () => {
  it('credits the sell rate and removes the free instance', () => {
    const state = grantItems(stateWith({ gil: 0 }), [[IRON_SWORD, 2]]);
    const sold = sellItem(state, IRON_SWORD);
    expect(sold.gil).toBe(Math.floor(itemPrice(IRON_SWORD) * SELL_RATE));
    expect(ownedCount(sold, IRON_SWORD)).toBe(1);
  });

  it('sell value is the floored rate of the buy price', () => {
    // iron_sword carries a Ch1 stub-price override; an unpriced item
    // (long_sword — Ch2, unstamped) falls back to the flat default.
    expect(sellValue(IRON_SWORD)).toBe(Math.floor(itemPrice(IRON_SWORD) * SELL_RATE));
    expect(itemPrice(itemId('long_sword'))).toBe(DEFAULT_ITEM_PRICE);
  });

  it('Ch1 stub prices override the flat default', () => {
    expect(itemPrice(IRON_SWORD)).toBe(200);
    expect(itemPrice(itemId('staff_of_abundance'))).toBe(600);
  });

  it('BLOCKS selling unique-pool items (the irreversible trap)', () => {
    const state = grantItems(stateWith({}), [[FLAMETONGUE, 1]]);
    expect(sellBlockReason(state, FLAMETONGUE)).toMatch(/unique/);
    expect(() => sellItem(state, FLAMETONGUE)).toThrow(/unique/);
  });

  it('blocks selling when no FREE instance exists (equipped gear stays put)', () => {
    // The roster's day-one gear is fully equipped: owned == equipped.
    const state = stateWith({});
    const equippedId = Object.keys(state.inventory)[0]!;
    expect(sellBlockReason(state, itemId(equippedId))).toMatch(/none free/);
  });
});
