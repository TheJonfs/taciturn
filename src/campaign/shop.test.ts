// TABA economy — shop tests (M3 economy brief, Stage 2).

import { describe, expect, it } from 'vitest';
import { itemId } from '@engine/index.ts';
import {
  DEFAULT_ITEM_PRICE,
  SELL_RATE,
} from './economy-config.ts';
import { grantItems, ownedCount } from './inventory.ts';
import { newCampaign } from './loop.ts';
import { M1_CAMPAIGN_GRAPH, M1_NODES } from './node.ts';
import { m0Roster } from './roster.ts';
import { buyItem, itemPrice, sellBlockReason, sellItem, sellValue, shopStock } from './shop.ts';
import type { CampaignState } from './types.ts';

const GRAPH = M1_CAMPAIGN_GRAPH;

function stateWith(overrides: Partial<CampaignState>): CampaignState {
  return { ...newCampaign(m0Roster, M1_NODES.riverRidge), ...overrides };
}

const IRON_SWORD = itemId('iron_sword'); // river-ridge bundle
const STEEL_HELM = itemId('steel_helm'); // stonebridge bundle
const FLAMETONGUE = itemId('flametongue'); // unique-pool (sell-blocked)

describe('shopStock (cumulative, story-gated)', () => {
  it('is empty before any node clears', () => {
    expect(shopStock(GRAPH, stateWith({}))).toEqual([]);
  });

  it('clearing a node stocks its bundle', () => {
    const stock = shopStock(GRAPH, stateWith({ clearedStoryBeats: [M1_NODES.riverRidge] }));
    const ids = stock.map((e) => String(e.itemId));
    expect(ids).toContain('iron_sword');
    expect(ids).not.toContain('steel_helm'); // stonebridge not cleared
  });

  it('is MONOTONIC: clearing more nodes only ever adds', () => {
    const one = shopStock(GRAPH, stateWith({ clearedStoryBeats: [M1_NODES.riverRidge] }));
    const two = shopStock(
      GRAPH,
      stateWith({ clearedStoryBeats: [M1_NODES.riverRidge, M1_NODES.stonebridge] }),
    );
    const oneIds = new Set(one.map((e) => String(e.itemId)));
    expect(two.length).toBeGreaterThan(one.length);
    for (const id of oneIds) {
      expect(two.some((e) => String(e.itemId) === id)).toBe(true);
    }
  });

  it('never stocks unique-pool or unassigned items', () => {
    const all = stateWith({
      clearedStoryBeats: GRAPH.nodes.map((n) => n.id),
    });
    for (const entry of shopStock(GRAPH, all)) {
      expect(entry.acquisition).toBe('shop');
      expect(entry.firstAvailableAt).toBeDefined();
    }
  });
});

describe('buyItem', () => {
  const readyToBuy = stateWith({ clearedStoryBeats: [M1_NODES.riverRidge], gil: 2_000 });

  it('debits the price and grants the item through the receipt door', () => {
    const before = ownedCount(readyToBuy, IRON_SWORD);
    const bought = buyItem(readyToBuy, GRAPH, IRON_SWORD);
    expect(bought.gil).toBe(2_000 - itemPrice(IRON_SWORD));
    expect(ownedCount(bought, IRON_SWORD)).toBe(before + 1);
  });

  it('refuses an item not in the current stock (story gate holds)', () => {
    expect(() => buyItem(readyToBuy, GRAPH, STEEL_HELM)).toThrow(/not in the current shop stock/);
  });

  it('refuses on insufficient gil (spendGil re-validates)', () => {
    const broke = { ...readyToBuy, gil: itemPrice(IRON_SWORD) - 1 };
    expect(() => buyItem(broke, GRAPH, IRON_SWORD)).toThrow(/insufficient gil/);
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
    expect(sellValue(IRON_SWORD)).toBe(Math.floor(DEFAULT_ITEM_PRICE * SELL_RATE));
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
