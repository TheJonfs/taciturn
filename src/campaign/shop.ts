// TABA economy — the shop (M3 economy brief, Stage 2; PER-HUB stock S94).
//
// Stock is PER LOCATION and story-gated (S94, Chris — revising the D2
// global pool): an entry is on a hub's shelves when it is SOLD THERE
// (`soldAt` — where you buy) AND its unlock trigger has fired
// (`firstAvailableAt` — the node whose cleared story beat puts it in
// stock; usually the hub itself, but the Alvera back-half refreshes key
// on Old Ordal / Mount Eska clears). Within a hub, stock stays monotonic
// — cleared beats never un-clear, so shelves only ever grow.
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

// The shop stock AT `nodeId` (the hub the player stands at): every 'shop'
// entry sold at this hub whose unlock trigger is cleared, in gear-pool
// (authoring) order.
export function shopStock(
  graph: CampaignGraph,
  state: CampaignState,
  nodeId: string,
): ReadonlyArray<TabaGearEntry> {
  const cleared = clearedNodeIds(graph, state);
  return TABA_GEAR_POOL.filter(
    (e) =>
      e.acquisition === 'shop' &&
      e.soldAt === nodeId &&
      e.firstAvailableAt !== undefined &&
      cleared.has(e.firstAvailableAt),
  );
}

// --- stock-refresh notification (S95 WI2) ---
//
// Per-hub stock means a refresh wave lands in a hub the party may have left
// long ago; nothing about the current location signals it, so an expanded
// shop is undiscoverable by default (economy §5, revised). The fix is a
// per-hub SEEN record on CampaignState: the stocked item ids at the last
// moment the party stood at that hub. Current stock ⊖ seen drives the map's
// new-stock badge; standing at the hub restamps the record.

// Stamp the CURRENT node's stock as seen. Called on arrival (routeToNode)
// and on beat-clear (resolveNode — the hub's own wave-1 unlocks while the
// party is still standing there). No-op object churn is avoided when the
// record is already current.
export function markShopStockSeen(state: CampaignState, graph: CampaignGraph): CampaignState {
  const stock = shopStock(graph, state, state.currentNodeId).map((e) => String(e.itemId));
  const prev = state.shopStockSeen?.[state.currentNodeId] ?? [];
  if (prev.length === stock.length && stock.every((id, i) => prev[i] === id)) return state;
  return {
    ...state,
    shopStockSeen: { ...state.shopStockSeen, [state.currentNodeId]: stock },
  };
}

// Hubs whose shelves hold something the party hasn't seen — the map badge
// set. The current node is excluded (the party is standing there; its
// record is stamped by the same transitions that got them there).
export function nodesWithUnseenStock(
  graph: CampaignGraph,
  state: CampaignState,
): ReadonlyArray<string> {
  const out: string[] = [];
  for (const node of graph.nodes) {
    if (node.id === state.currentNodeId) continue;
    const stock = shopStock(graph, state, node.id);
    if (stock.length === 0) continue;
    const seen = new Set(state.shopStockSeen?.[node.id] ?? []);
    if (stock.some((e) => !seen.has(String(e.itemId)))) out.push(node.id);
  }
  return out;
}

// Buy one instance of an item stocked at `nodeId`: gil out, item in through
// the receipt door. Fails loud on an unstocked item or insufficient gil
// (spendGil's guard) — the UI disables both, so reaching either is a bug.
export function buyItem(
  state: CampaignState,
  graph: CampaignGraph,
  nodeId: string,
  itemId: ItemId,
): CampaignState {
  if (!shopStock(graph, state, nodeId).some((e) => e.itemId === itemId)) {
    throw new Error(`buyItem: ${JSON.stringify(itemId)} is not stocked at ${JSON.stringify(nodeId)}`);
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
