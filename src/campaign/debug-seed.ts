// TABA M3 — the dev inventory seed (the gear-UI test harness).
//
// The M3 equipment catalog is only reachable in real play through the
// deferred economy pass (shops, drops, unique pickups). Until that
// ships, this seed is what makes the gear playable at all: it tops the
// party's owned count up to DEBUG_SEED_TARGET for EVERY equippable item
// in the catalog — uniques included, hidden (TABA-pool) items included.
//
// Local-only: the sole caller is the dev chip on the campaign's manage
// screen, gated on `import.meta.env.DEV`, so none of this is reachable
// in a production build. Top-up (not add) semantics keep repeated
// clicks idempotent, and everything flows through `grantItems` — the
// inventory's one receipt door.

import { isEquipment, type Catalog, type ItemId } from '@engine/index.ts';
import { grantItems, ownedCount } from './inventory.ts';
import type { CampaignState } from './types.ts';

// Within the brief's "~5–20 of everything" band.
export const DEBUG_SEED_TARGET = 10;

// The top-up grants that bring every equipment item to the target.
// Empty when the inventory is already fully seeded (the chip reads this
// to show its done-state).
export function debugSeedGrants(
  state: CampaignState,
  catalog: Catalog,
): ReadonlyArray<readonly [ItemId, number]> {
  const grants: Array<readonly [ItemId, number]> = [];
  for (const item of catalog.items()) {
    if (!isEquipment(item)) continue; // consumables aren't gear
    const shortfall = DEBUG_SEED_TARGET - ownedCount(state, item.id);
    if (shortfall > 0) grants.push([item.id, shortfall]);
  }
  return grants;
}

export function debugSeedInventory(state: CampaignState, catalog: Catalog): CampaignState {
  return grantItems(state, debugSeedGrants(state, catalog));
}
