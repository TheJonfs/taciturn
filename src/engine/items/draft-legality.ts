// Draft loadout + equipment legality — the state-free resolver.
//
// ONE source of truth for "is this unit's class/loadout/equipment combination
// legal", shared by BOTH sides of the pre-battle boundary:
//   - the engine's throw side: `createInitialState`'s equipment-placement
//     validation calls these exact functions, and
//   - the UI's warn side: the Mage War Team Builder and the campaign
//     Formation gear view surface the same structured violations.
//
// Why state-free: the engine's canonical `getCapacity` / `getCost` read a
// built `GameState` through the hook chain — but `createInitialState` throws
// on an invalid loadout, so a draft under edit (which is *legitimately*
// invalid mid-edit) can never be probed that way. Pre-battle, a unit has no
// statuses, and equipment is the only `modifyBucketCapacity` contributor in
// content, so the state-free composition here is exactly what the hook chain
// would produce. `draft-legality.test.ts` pins that agreement against the
// real engine functions — if a class-trait or status capacity contributor
// ever ships, that pin fails loud and this module must learn the new rule.
//
// Scope note (who enforces what):
//   - Slot/kind/class/item↔item/two-handed rules: enforced here AND thrown
//     on by `createInitialState` — the same code path, per the M3 gear-UI
//     brief's D3 ("UI legality and engine legality are one resolver").
//   - Bucket overages: reported here for the UIs; `createInitialState`
//     gates capacity through the hook-based `validateLoadout` instead,
//     because authored placements may carry initial statuses whose capacity
//     contributions a draft can't see. The agreement pin keeps the two
//     computations identical for status-free (pre-battle) units.
//   - Dual-wield without a granting passive: a UI-tier rule. The engine
//     tolerates the state (the swing loop simply never grants the off-hand
//     swing), so `createInitialState` does not throw on it. UIs block it.
//     UI-stricter is the safe direction; the reverse is the D3 bug.

import type { Catalog } from '../catalog/index.ts';
import type { ItemDefinition } from '../catalog/index.ts';
import type {
  AbilityId,
  BucketId,
  ClassId,
  CommandSetId,
  EquipmentSlotId,
  ItemId,
  Loadout,
  RulesetId,
  UnitEquipment,
} from '../types/index.ts';
import { EQUIPMENT_SLOT_IDS } from '../types/index.ts';
import {
  ACTIVE_BUCKET_IDS,
  ALL_BUCKET_IDS,
  PASSIVE_BUCKET_IDS,
} from '../abilities/constants.ts';
import { isEquipment, slotAcceptsKind } from './equipment.ts';

// Re-exported alongside the reason enum so draft-side callers get the
// whole per-slot rule surface from one module.
export { slotAcceptsKind };

// The state-free view of a unit a draft legality check needs — what a
// Team Builder draft slot, a campaign roster unit, and an authored
// `UnitPlacement` all have in common.
export interface DraftUnitView {
  readonly classId: ClassId;
  readonly loadout: Loadout;
  readonly equipment: UnitEquipment;
}

// ---------------------------------------------------------------------
// Capacity / cost (the state-free twins of getCapacity / getCost)
// ---------------------------------------------------------------------

// Bucket capacity for a draft unit: ruleset baseline + Σ equipped items'
// `bucketCapacityMods`, floored at 0 (the same floor `getCapacity`
// applies — Spiked Maul's reaction −3 lands at 0, not −1). Unknown item
// ids are skipped: the composite `validateDraftUnit` reports them as
// invalid slots; capacity itself must stay computable mid-edit.
export function draftBucketCapacity(
  equipment: UnitEquipment,
  bucketId: BucketId,
  catalog: Catalog,
  rulesetId: RulesetId,
): number {
  const ruleset = catalog.getRuleset(rulesetId);
  let capacity = ruleset.bucketCapacities.get(bucketId) ?? 0;
  for (const slot of EQUIPMENT_SLOT_IDS) {
    const itemId = equipment[slot];
    if (itemId === null || !catalog.hasItem(itemId)) continue;
    const item = catalog.getItem(itemId);
    if (!isEquipment(item)) continue;
    const delta = item.bucketCapacityMods?.get(bucketId);
    if (delta !== undefined) capacity += delta;
  }
  return Math.max(0, Math.floor(capacity));
}

// Ability slot cost for a draft unit — the class's `freeAbilities`
// (its own innate kit) cost 0; everything else costs its `baseCost`.
// This cost-weighting is why Spiked Maul's capacity-0 reaction bucket
// still holds the wielder's innate reaction: innate costs 0 ≤ 0.
export function draftAbilityCost(
  classId: ClassId,
  abilityId: AbilityId,
  catalog: Catalog,
): number {
  if (catalog.getClass(classId).freeAbilities.has(abilityId)) return 0;
  return catalog.getAbility(abilityId).baseCost;
}

export function draftCommandSetCost(
  commandSetId: CommandSetId,
  catalog: Catalog,
): number {
  return catalog.getCommandSet(commandSetId).baseCost;
}

// Total slot cost equipped in one bucket of a draft loadout. Unknown
// ability / command-set ids are skipped (reported elsewhere; a stale
// save must not crash the budget display).
export function draftBucketUsed(
  classId: ClassId,
  loadout: Loadout,
  bucketId: BucketId,
  catalog: Catalog,
): number {
  if (PASSIVE_BUCKET_IDS.includes(bucketId)) {
    const abilities = loadout.passiveBuckets[bucketId] ?? [];
    return abilities.reduce(
      (sum, abilityId) =>
        catalog.hasAbility(abilityId)
          ? sum + draftAbilityCost(classId, abilityId, catalog)
          : sum,
      0,
    );
  }
  const commandSets = loadout.actionBuckets[bucketId] ?? [];
  return commandSets.reduce(
    (sum, commandSetId) =>
      catalog.hasCommandSet(commandSetId)
        ? sum + draftCommandSetCost(commandSetId, catalog)
        : sum,
    0,
  );
}

// ---------------------------------------------------------------------
// Per-slot equip eligibility
// ---------------------------------------------------------------------

export type DraftInvalidSlotReason =
  | 'unknown_item' // id not in the catalog (stale save / typo)
  | 'wrong_kind' // consumable, or kind/slot mismatch
  | 'slot_not_permitted' // the class doesn't use this slot at all
  | 'class_restricted'; // the item's classRestrictions excludes this class

// Why can't a unit of `classId` hold `item` in `slot` — or null when it
// can. The single per-slot rule; `classCanEquip` is its boolean face.
export function slotIneligibilityReason(
  classId: ClassId,
  slot: EquipmentSlotId,
  item: ItemDefinition,
  catalog: Catalog,
): DraftInvalidSlotReason | null {
  if (!isEquipment(item)) return 'wrong_kind';
  if (!slotAcceptsKind(slot, item.kind)) return 'wrong_kind';
  if (!catalog.getClass(classId).equipmentSlots[slot]) return 'slot_not_permitted';
  if (item.classRestrictions !== undefined && !item.classRestrictions.includes(classId)) {
    return 'class_restricted';
  }
  return null;
}

export function classCanEquip(
  classId: ClassId,
  slot: EquipmentSlotId,
  item: ItemDefinition,
  catalog: Catalog,
): boolean {
  return slotIneligibilityReason(classId, slot, item, catalog) === null;
}

// ---------------------------------------------------------------------
// Loadout-granted equipment permissions
// ---------------------------------------------------------------------

// True when any equipped passive declares `relaxesTwoHandedGrip`
// (Monkeygrip, ADR-0100) — a two-hander may then share a hand with an
// off-hand item. Read declaratively off the loadout: equip legality is
// a static property, not a runtime hook dispatch.
export function loadoutGrantsTwoHandedGrip(loadout: Loadout, catalog: Catalog): boolean {
  for (const abilityIds of Object.values(loadout.passiveBuckets)) {
    for (const abilityId of abilityIds) {
      if (!catalog.hasAbility(abilityId)) continue;
      const ability = catalog.getAbility(abilityId);
      if (ability.kind === 'passive' && ability.relaxesTwoHandedGrip === true) return true;
    }
  }
  return false;
}

// True when any equipped passive registers a `modifyDualWield` hook
// (Two Weapons) — both hands may then hold a weapon. Content-agnostic:
// detected by hook name, never a hard-coded ability id.
export function loadoutGrantsDualWield(loadout: Loadout, catalog: Catalog): boolean {
  for (const abilityIds of Object.values(loadout.passiveBuckets)) {
    for (const abilityId of abilityIds) {
      if (!catalog.hasAbility(abilityId)) continue;
      const ability = catalog.getAbility(abilityId);
      if (ability.kind === 'passive' && ability.hooks.some((h) => h.name === 'modifyDualWield')) {
        return true;
      }
    }
  }
  return false;
}

// ---------------------------------------------------------------------
// The composite legality report
// ---------------------------------------------------------------------

export interface DraftInvalidSlot {
  readonly slot: EquipmentSlotId;
  readonly itemId: ItemId;
  readonly reason: DraftInvalidSlotReason;
}

export interface DraftBucketOverage {
  readonly bucketId: BucketId;
  readonly used: number;
  readonly capacity: number;
}

// An item↔item `equipLegality` violation (TABA M3, Freelancer's Charm):
// the worn piece forbids what's in the other slot.
export interface DraftEquipLegalityConflict {
  readonly wornSlot: EquipmentSlotId;
  readonly wornItemId: ItemId;
  readonly forbiddenSlot: EquipmentSlotId;
  readonly otherItemId: ItemId;
}

export interface DraftUnitLegality {
  // Slots whose item the unit can't hold (wrong kind, slot not
  // permitted, class-restricted, or unknown id).
  readonly invalidSlots: ReadonlyArray<DraftInvalidSlot>;
  // Buckets whose equipped cost exceeds equipment-adjusted capacity.
  readonly bucketOverages: ReadonlyArray<DraftBucketOverage>;
  // Hands holding a two-handed weapon while the other hand is occupied
  // (and no Monkeygrip). Empty when legal.
  readonly twoHandedConflictHands: ReadonlyArray<EquipmentSlotId>;
  // Both hands hold weapons without a dual-wield-granting passive.
  // UI-tier: UIs block it; `createInitialState` tolerates it (see the
  // module header's scope note).
  readonly dualWielding: boolean;
  // Item↔item `equipLegality` violations (Freelancer's Charm).
  readonly equipLegalityConflicts: ReadonlyArray<DraftEquipLegalityConflict>;
  readonly valid: boolean;
}

// Hands holding a two-handed weapon while the other hand is occupied —
// empty when legal (or when Monkeygrip relaxes the rule). Exported for
// `createInitialState`'s throw side; the composite report includes it.
export function findTwoHandedConflictHands(
  view: DraftUnitView,
  catalog: Catalog,
): ReadonlyArray<EquipmentSlotId> {
  if (loadoutGrantsTwoHandedGrip(view.loadout, catalog)) return [];
  const hands: EquipmentSlotId[] = [];
  for (const [hand, other] of [
    ['rightHand', 'leftHand'],
    ['leftHand', 'rightHand'],
  ] as const) {
    const id = view.equipment[hand];
    if (id === null || !catalog.hasItem(id)) continue;
    const item = catalog.getItem(id);
    if (item.kind === 'weapon' && item.twoHanded === true && view.equipment[other] !== null) {
      hands.push(hand);
    }
  }
  return hands;
}

function isDualWielding(view: DraftUnitView, catalog: Catalog): boolean {
  const left = view.equipment.leftHand;
  const right = view.equipment.rightHand;
  if (left === null || right === null) return false;
  if (!catalog.hasItem(left) || !catalog.hasItem(right)) return false;
  const bothWeapons =
    catalog.getItem(left).kind === 'weapon' && catalog.getItem(right).kind === 'weapon';
  if (!bothWeapons) return false;
  return !loadoutGrantsDualWield(view.loadout, catalog);
}

// Item↔item `equipLegality` conflicts across the worn set. First
// instance: `forbidClassRestrictedInSlots` bars class-restricted gear
// from the named slots while the declaring piece is worn.
export function findEquipLegalityConflicts(
  equipment: UnitEquipment,
  catalog: Catalog,
): ReadonlyArray<DraftEquipLegalityConflict> {
  const conflicts: DraftEquipLegalityConflict[] = [];
  for (const wornSlot of EQUIPMENT_SLOT_IDS) {
    const wornId = equipment[wornSlot];
    if (wornId === null || !catalog.hasItem(wornId)) continue;
    const worn = catalog.getItem(wornId);
    if (!isEquipment(worn) || worn.equipLegality === undefined) continue;
    for (const forbiddenSlot of worn.equipLegality.forbidClassRestrictedInSlots ?? []) {
      const otherId = equipment[forbiddenSlot];
      if (otherId === null || !catalog.hasItem(otherId)) continue;
      const other = catalog.getItem(otherId);
      if (isEquipment(other) && other.classRestrictions !== undefined) {
        conflicts.push({ wornSlot, wornItemId: wornId, forbiddenSlot, otherItemId: otherId });
      }
    }
  }
  return conflicts;
}

// The full draft-unit legality report. Enumerated, not first-error —
// the UIs show every problem at once (mirrors `validateLoadout`'s
// convention), and `createInitialState` throws on the first it finds.
export function validateDraftUnit(
  view: DraftUnitView,
  catalog: Catalog,
  rulesetId: RulesetId,
): DraftUnitLegality {
  const invalidSlots: DraftInvalidSlot[] = [];
  for (const slot of EQUIPMENT_SLOT_IDS) {
    const itemId = view.equipment[slot];
    if (itemId === null) continue;
    if (!catalog.hasItem(itemId)) {
      invalidSlots.push({ slot, itemId, reason: 'unknown_item' });
      continue;
    }
    const reason = slotIneligibilityReason(view.classId, slot, catalog.getItem(itemId), catalog);
    if (reason !== null) invalidSlots.push({ slot, itemId, reason });
  }

  const bucketOverages: DraftBucketOverage[] = [];
  for (const bucketId of ALL_BUCKET_IDS) {
    const used = draftBucketUsed(view.classId, view.loadout, bucketId, catalog);
    const capacity = draftBucketCapacity(view.equipment, bucketId, catalog, rulesetId);
    if (used > capacity) bucketOverages.push({ bucketId, used, capacity });
  }

  const twoHandedConflictHands = findTwoHandedConflictHands(view, catalog);
  const dualWielding = isDualWielding(view, catalog);
  const equipLegalityConflicts = findEquipLegalityConflicts(view.equipment, catalog);

  return {
    invalidSlots,
    bucketOverages,
    twoHandedConflictHands,
    dualWielding,
    equipLegalityConflicts,
    valid:
      invalidSlots.length === 0 &&
      bucketOverages.length === 0 &&
      twoHandedConflictHands.length === 0 &&
      !dualWielding &&
      equipLegalityConflicts.length === 0,
  };
}

// Re-exported so draft-side callers can iterate buckets without
// reaching into `engine/abilities` themselves.
export { ACTIVE_BUCKET_IDS, ALL_BUCKET_IDS, PASSIVE_BUCKET_IDS };
