// TABA economy — the shop (M3 economy brief, Stage 2).
//
// The AVAILABLE POOL is cumulative and story-gated: the union of item
// bundles (`firstAvailableAt` on gear-pool entries) from every node whose
// story beat is CLEARED — monotonic, never delists. Clearing combat nodes
// feeds the pool; you SPEND it at hub locations (D2) — the pool is global,
// the access is a place.
//
// The two transactions are thin compositions of existing doors:
//   BUY  = spendGil + grantItems  (receipt stays the ONE way in — the
//          uniqueness gate is untouched by construction).
//   SELL = removeItems + grantGil at SELL_RATE (D1) — FREE instances only
//          (unequip first), and `unique`-pool items are BLOCKED (a
//          single-instance story item is an irreversible trap otherwise).
//
// Prices are placeholder config constants (D-econ-6), read through
// `itemPrice` so the real pricing pass swaps the table, not the callers.

import type { ItemId } from '@engine/index.ts';
import {
  DEFAULT_ITEM_PRICE,
  ITEM_PRICE_OVERRIDES,
  SELL_RATE,
} from './economy-config.ts';
import { TABA_GEAR_POOL, tabaGearEntry, type TabaGearEntry } from './equipment-pool.ts';
import { grantGil, spendGil } from './gil.ts';
import type { CampaignGraph } from './graph.ts';
import { freeCount, grantItems, removeItems } from './inventory.ts';
import { isStoryCleared } from './travel.ts';
import type { CampaignState } from './types.ts';

// The buy price for an item (placeholder table + flat default; D-econ-6).
export function itemPrice(itemId: ItemId): number {
  return ITEM_PRICE_OVERRIDES[String(itemId)] ?? DEFAULT_ITEM_PRICE;
}

// What the shop pays for an item (D1: SELL_RATE of the buy price, floored).
export function sellValue(itemId: ItemId): number {
  return Math.floor(itemPrice(itemId) * SELL_RATE);
}

// Node ids whose story beat is cleared — the pool's story gate.
function clearedNodeIds(graph: CampaignGraph, state: CampaignState): ReadonlySet<string> {
  const ids = new Set<string>();
  for (const node of graph.nodes) {
    if (isStoryCleared(state, node)) ids.add(node.id);
  }
  return ids;
}

// The current shop stock: every 'shop' entry whose `firstAvailableAt` node
// is cleared, in gear-pool (authoring) order. Monotonic by construction —
// `clearedStoryBeats` only grows, so the union never shrinks.
export function shopStock(graph: CampaignGraph, state: CampaignState): ReadonlyArray<TabaGearEntry> {
  const cleared = clearedNodeIds(graph, state);
  return TABA_GEAR_POOL.filter(
    (e) =>
      e.acquisition === 'shop' &&
      e.firstAvailableAt !== undefined &&
      cleared.has(e.firstAvailableAt),
  );
}

// Buy one instance of a stocked item: gil out, item in through the receipt
// door. Fails loud on an unstocked item or insufficient gil (spendGil's
// guard) — the UI disables both, so reaching either is a bug.
export function buyItem(
  state: CampaignState,
  graph: CampaignGraph,
  itemId: ItemId,
): CampaignState {
  if (!shopStock(graph, state).some((e) => e.itemId === itemId)) {
    throw new Error(`buyItem: ${JSON.stringify(itemId)} is not in the current shop stock`);
  }
  return grantItems(spendGil(state, itemPrice(itemId)), [[itemId, 1]]);
}

// Why an item can't be sold right now (undefined = sellable). Exposed so
// the UI surfaces the reason instead of silently hiding the row.
export function sellBlockReason(state: CampaignState, itemId: ItemId): string | undefined {
  const entry = tabaGearEntry(itemId);
  if (entry === undefined) return 'not a TABA item';
  if (entry.acquisition === 'unique') return 'unique — cannot be sold';
  if (freeCount(state, itemId) < 1) return 'none free (unequip first)';
  return undefined;
}

// Sell one FREE instance: item out through the removal door, gil in at the
// sell rate. Fails loud on any blocked sale (uniques, nothing free).
export function sellItem(state: CampaignState, itemId: ItemId): CampaignState {
  const blocked = sellBlockReason(state, itemId);
  if (blocked !== undefined) {
    throw new Error(`sellItem: ${JSON.stringify(itemId)} — ${blocked}`);
  }
  return grantGil(removeItems(state, itemId, 1), sellValue(itemId));
}
