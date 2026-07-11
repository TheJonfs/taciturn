// TABA M3 — the party inventory: instance counting + the equip/unequip ops.
//
// The stored state is ONE record: `CampaignState.inventory`, OWNED count
// per item id (total, equipped instances included). Everything else is
// derived on read (CLAUDE.md rule 5):
//   - equipped(item) = count of that id across ALL roster units' slots;
//   - free(item)     = owned(item) − equipped(item), floored at 0.
// So "decrement-on-equip / return-on-unequip" is not a mutation anywhere —
// equipping writes the unit's equipment slot and the free count *falls out*.
// There is no second counter to drift.
//
// Design choices (M3 gear-UI brief, Stage 0):
//   - LOST UNITS KEEP THEIR KIT. Equipped counts scan the whole roster
//     regardless of `fate` — a permadeath-lost unit takes its gear with it
//     (FFT-canonical). A future strip-the-fallen mechanic changes the scan
//     filter, not the model.
//   - RECEIPT-GATED UNIQUENESS. Nothing here caps counts at 1; uniques are
//     unique because of how they're RECEIVED (the deferred economy pass owns
//     receipt). `grantItems` is the one receipt door.
//   - GRANDFATHERING. Roster units authored with starting gear own it:
//     `bootstrapInventory` raises owned counts to cover whatever is equipped,
//     so unequipping day-one gear returns it to the pool instead of
//     vanishing. Runs at campaign start and at deserialize (pre-inventory
//     saves load with owned = equipped).
//   - EQUIP LEGALITY IS NOT GATED HERE. Per D2 the invalid intermediate
//     state is held and surfaced, never blocked at the data layer — the
//     shared draft resolver reports it and the UI blocks DEPLOY, not the
//     edit. The only hard gate on equip is availability (a free instance
//     must exist), which fails loud: no legitimate UI path offers an item
//     with none free, so reaching it is a bug.

import {
  EQUIPMENT_SLOT_IDS,
  loadoutGrantsTwoHandedGrip,
  type Catalog,
  type EquipmentSlotId,
  type ItemId,
  type UnitId,
} from '@engine/index.ts';
import type { CampaignState, CampaignUnit } from './types.ts';

export type InventoryRecord = Readonly<Record<string, number>>;

export const EMPTY_INVENTORY: InventoryRecord = {};

// --- derived counts ---------------------------------------------------

export function ownedCount(state: CampaignState, itemId: ItemId): number {
  return state.inventory[String(itemId)] ?? 0;
}

// Count of each item id equipped across the WHOLE roster (all fates —
// see the module header on lost units).
export function equippedCounts(
  roster: ReadonlyArray<CampaignUnit>,
): ReadonlyMap<string, number> {
  const counts = new Map<string, number>();
  for (const unit of roster) {
    for (const slot of EQUIPMENT_SLOT_IDS) {
      const id = unit.equipment[slot];
      if (id === null) continue;
      counts.set(String(id), (counts.get(String(id)) ?? 0) + 1);
    }
  }
  return counts;
}

export function equippedCount(
  roster: ReadonlyArray<CampaignUnit>,
  itemId: ItemId,
): number {
  return equippedCounts(roster).get(String(itemId)) ?? 0;
}

// Instances free to equip right now. Floored at 0 defensively: a roster
// mutation that bypassed `bootstrapInventory` (equipped > owned) reads
// as "none free", never a negative.
export function freeCount(state: CampaignState, itemId: ItemId): number {
  return Math.max(0, ownedCount(state, itemId) - equippedCount(state.roster, itemId));
}

// --- receipt ----------------------------------------------------------

// Add owned instances — the ONE door through which items enter the
// party (shop purchases, drops, pickups, the dev seed). Quantities must
// be positive integers; receipt is additive only (selling/consuming is
// the economy pass's concern, added when a consumer exists).
export function grantItems(
  state: CampaignState,
  grants: ReadonlyArray<readonly [ItemId, number]>,
): CampaignState {
  if (grants.length === 0) return state;
  const inventory: Record<string, number> = { ...state.inventory };
  for (const [itemId, quantity] of grants) {
    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new Error(
        `grantItems: quantity for ${JSON.stringify(itemId)} must be a positive integer, ` +
          `got ${JSON.stringify(quantity)}`,
      );
    }
    inventory[String(itemId)] = (inventory[String(itemId)] ?? 0) + quantity;
  }
  return { ...state, inventory };
}

// Remove FREE owned instances — the one exit door (M3 economy Stage 2:
// selling; future consuming). Only free instances can leave: gear on
// someone's back must be unequipped first, so owned never drops below
// equipped and the derived counts can't go negative. Fails loud on a
// non-positive quantity or insufficient free instances (the UI only
// offers what's free, so reaching either is a bug).
export function removeItems(
  state: CampaignState,
  itemId: ItemId,
  quantity: number,
): CampaignState {
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new Error(
      `removeItems: quantity must be a positive integer, got ${JSON.stringify(quantity)}`,
    );
  }
  const free = freeCount(state, itemId);
  if (free < quantity) {
    throw new Error(
      `removeItems: only ${free} free instance(s) of ${JSON.stringify(itemId)} (need ${quantity})`,
    );
  }
  const key = String(itemId);
  const remaining = (state.inventory[key] ?? 0) - quantity;
  const inventory: Record<string, number> = { ...state.inventory };
  if (remaining > 0) inventory[key] = remaining;
  else delete inventory[key];
  return { ...state, inventory };
}

// --- grandfather bootstrap ---------------------------------------------

// Raise owned counts to cover everything currently equipped on the
// roster, so authored/pre-inventory gear is owned by the party and
// returns to the pool on unequip instead of vanishing. Idempotent.
// Called at campaign start and at deserialize; a future mid-campaign
// join (a plot unit arriving with gear) calls it too.
export function bootstrapInventory(
  inventory: InventoryRecord,
  roster: ReadonlyArray<CampaignUnit>,
): InventoryRecord {
  const out: Record<string, number> = { ...inventory };
  for (const [id, equipped] of equippedCounts(roster)) {
    if ((out[id] ?? 0) < equipped) out[id] = equipped;
  }
  return out;
}

// --- equip / unequip ops (pure; return a new CampaignState) ------------

function rosterUnit(state: CampaignState, unitId: UnitId): CampaignUnit {
  const unit = state.roster.find((u) => u.id === unitId);
  if (unit === undefined) {
    throw new Error(`inventory: unit ${JSON.stringify(unitId)} is not on the roster`);
  }
  return unit;
}

function withUnit(state: CampaignState, next: CampaignUnit): CampaignState {
  return {
    ...state,
    roster: state.roster.map((u) => (u.id === next.id ? next : u)),
  };
}

// Set (or clear, with null) one equipment slot on a CampaignUnit — the
// unit-level core both `equipItem` and the Formation gear UI use.
// Because inventory stores OWNED totals and equipped counts derive from
// roster equipment, changing a slot needs no inventory mutation — the
// displaced item returns to the pool by derivation. Mirrors the Team
// Builder's two-handed convenience: placing a two-handed weapon in a
// hand clears the other hand (returning its item), unless an equipped
// passive relaxes the grip (Monkeygrip) — then the off-hand keeps its
// item. No legality gate: an illegal-but-held state is D2's
// surfaced-not-resolved intermediate (availability is the CALLER's
// gate — the UI's dropdown filter, or `equipItem`'s loud check).
export function equipOnUnit(
  unit: CampaignUnit,
  slot: EquipmentSlotId,
  itemId: ItemId | null,
  catalog: Catalog,
): CampaignUnit {
  if (unit.equipment[slot] === itemId) return unit;
  let equipment = { ...unit.equipment, [slot]: itemId };
  if ((slot === 'leftHand' || slot === 'rightHand') && itemId !== null && catalog.hasItem(itemId)) {
    const item = catalog.getItem(itemId);
    if (
      item.kind === 'weapon' &&
      item.twoHanded === true &&
      !loadoutGrantsTwoHandedGrip(unit.loadout, catalog)
    ) {
      const otherHand: EquipmentSlotId = slot === 'leftHand' ? 'rightHand' : 'leftHand';
      equipment = { ...equipment, [otherHand]: null };
    }
  }
  return { ...unit, equipment };
}

// Equip `itemId` into `slot` on a roster unit, gated on a free instance
// existing (fails loud — see module header).
export function equipItem(
  state: CampaignState,
  unitId: UnitId,
  slot: EquipmentSlotId,
  itemId: ItemId,
  catalog: Catalog,
): CampaignState {
  const unit = rosterUnit(state, unitId);
  if (unit.equipment[slot] === itemId) return state; // re-equip same: no-op
  if (!catalog.hasItem(itemId)) {
    throw new Error(`equipItem: item ${JSON.stringify(itemId)} is not in the catalog`);
  }
  if (freeCount(state, itemId) < 1) {
    throw new Error(
      `equipItem: no free instance of ${JSON.stringify(itemId)} ` +
        `(owned ${ownedCount(state, itemId)}, all equipped)`,
    );
  }
  return withUnit(state, equipOnUnit(unit, slot, itemId, catalog));
}

// Clear a slot; the instance returns to the free pool by derivation.
export function unequipItem(
  state: CampaignState,
  unitId: UnitId,
  slot: EquipmentSlotId,
): CampaignState {
  const unit = rosterUnit(state, unitId);
  if (unit.equipment[slot] === null) return state;
  return withUnit(state, {
    ...unit,
    equipment: { ...unit.equipment, [slot]: null },
  });
}
