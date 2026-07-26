// TABA M4 — generated-enemy gear assignment (the S89 valuation consumer).
//
// Assigns a full equipment set to a generated enemy by ranking the campaign
// gear pool with the AI's gear-valuation floor (`rankItemsForUnit`, built in
// S89 for exactly this — D-ai-3's ordering cashes in here). The POOL is
// where the policy lives (M4 brief WI3):
//
//   - LEVEL-KEYED, UNCLAMPED: the enemy's level picks its gear chapter via
//     `ENEMY_GEAR_BANDS` (1–12 → Ch1, 13–24 → Ch2, 25+ → Ch3) with a per-slot
//     seeded ramp inside each band (`ENEMY_GEAR_RAMP_*`) so band boundaries
//     aren't cliffs. No story-chapter cap — high-level enemies carry gear the
//     player can't buy yet (the peek-at-the-future thrill; the level gap is
//     the imbalance, not the gear).
//   - NO UNIQUES, EVER: single-instance items are receipt-gated; generation
//     minting one would corrupt the uniqueness invariant. Test-pinned.
//   - NO EXOTICS: items whose identity the S89 floor deliberately doesn't
//     score (`TabaGearEntry.exotic`) stay off — an enemy misusing an exotic
//     is a worse encounter, not a harder one.
//   - GIL-BUDGETED (S99 cont., Chris): the weapon is free; the four armor
//     slots pay shop prices (`itemPrice`) out of `level ×
//     ENEMY_GEAR_GIL_PER_LEVEL`, spent in slot-priority order — low-level
//     enemies field a weapon and one or two pieces, not a full wardrobe.
//
// Slot legality runs through the shared draft resolver (slot eligibility,
// two-handed grip, dual-wield gating) — no enemy-specific legality path.
// Deterministic: same (inputs, seed) → same gear.

import {
  deriveActionSeed,
  isEquipment,
  loadoutGrantsDualWield,
  loadoutGrantsTwoHandedGrip,
  slotIneligibilityReason,
  EMPTY_UNIT_EQUIPMENT,
  type Catalog,
  type ClassId,
  type EquipmentDefinition,
  type EquipmentSlotId,
  type Loadout,
  type UnitEquipment,
} from '@engine/index.ts';
import { rankItemsForUnit, scoreItemForUnit, type GearScoreProfile } from '@ai/index.ts';
import {
  ENEMY_GEAR_BANDS,
  ENEMY_GEAR_GIL_PER_LEVEL,
  ENEMY_GEAR_RAMP_LEVELS,
  ENEMY_GEAR_RAMP_START,
} from './economy-config.ts';
import { TABA_GEAR_POOL } from './equipment-pool.ts';
import { itemPrice } from './shop.ts';

// A seed-derived roll in [0, 1) — the standard 32-bit stream, normalized.
export function seedRoll01(seed: number, salt: number): number {
  return deriveActionSeed(seed, salt) / 0x100000000;
}

// The gear chapter a single slot draws from at this level, given a [0,1)
// roll: the level's band chapter with the in-band ramp probability, else
// the chapter below (band entry ≈ RAMP_START chance of new-tier gear per
// slot, full pool RAMP_LEVELS levels in). Pure — the dial semantics live
// here, the seeding lives with the caller.
export function enemyGearChapterCeiling(level: number, roll: number): 1 | 2 | 3 {
  let band = ENEMY_GEAR_BANDS[0]!;
  for (const b of ENEMY_GEAR_BANDS) {
    if (level >= b.minLevel) band = b;
  }
  if (band.chapter === 1) return 1;
  const progress = (level - band.minLevel) / Math.max(1, ENEMY_GEAR_RAMP_LEVELS - 1);
  const p = Math.min(1, ENEMY_GEAR_RAMP_START + (1 - ENEMY_GEAR_RAMP_START) * progress);
  return roll < p ? band.chapter : ((band.chapter - 1) as 1 | 2);
}

// Slot fill order: weapon first (free, and its two-handedness gates the
// off-hand), then the PAID slots in purchase-priority order — the gil
// budget (S99 cont.) runs out top-down, so armor beats an accessory when a
// low-level purse can't afford both.
const SLOT_ORDER: ReadonlyArray<EquipmentSlotId> = [
  'rightHand',
  'armor',
  'headgear',
  'leftHand',
  'accessory',
];

// Salt base for per-slot chapter rolls — one independent roll per slot.
const SALT_GEAR_SLOT = 100;

export interface EnemyGearArgs {
  readonly classId: ClassId;
  readonly level: number;
  // Deterministic stream root — same seed, same gear.
  readonly seed: number;
  // The loadout as known BEFORE gear (first action + innates + secondary):
  // consulted for dual-wield / two-handed-grip grants only. R/S/M fill runs
  // AFTER gear because capacity is equipment-adjusted.
  readonly loadout: Loadout;
  readonly profile: GearScoreProfile;
  readonly catalog: Catalog;
}

// Fill every slot the class can legally use with the best-scoring pool item
// its level band allows. A slot with no positive-scoring legal candidate
// stays bare (the scorer returns 0 for class-illegal pieces; a bare slot is
// a fact about the pool, not an error).
export function assignEnemyGear(args: EnemyGearArgs): UnitEquipment {
  const { classId: cls, level, seed, loadout, profile, catalog } = args;

  // The generation pool: campaign-scoped gear minus uniques minus exotics.
  const poolDefs: EquipmentDefinition[] = [];
  const chapterOf = new Map<string, 1 | 2 | 3>();
  for (const entry of TABA_GEAR_POOL) {
    if (entry.acquisition === 'unique' || entry.exotic === true) continue;
    if (!catalog.hasItem(entry.itemId)) continue;
    const def = catalog.getItem(entry.itemId);
    if (!isEquipment(def)) continue;
    poolDefs.push(def);
    chapterOf.set(String(entry.itemId), entry.chapter);
  }

  const dualWield = loadoutGrantsDualWield(loadout, catalog);
  const monkeygrip = loadoutGrantsTwoHandedGrip(loadout, catalog);

  // The gil purse (S99 cont., the JP dial's sibling): the WEAPON is free,
  // every other slot pays its shop price out of level × the dial — a low-
  // level enemy fields a weapon and a piece or two, not a full wardrobe,
  // mirroring the player's own early-gil reality.
  let purse = Math.max(0, level) * ENEMY_GEAR_GIL_PER_LEVEL;

  let equipment: UnitEquipment = EMPTY_UNIT_EQUIPMENT;
  SLOT_ORDER.forEach((slot, slotIndex) => {
    // Off-hand next to a two-handed main weapon: the grip owns both hands.
    if (slot === 'leftHand' && !monkeygrip) {
      const rightId = equipment.rightHand;
      if (rightId !== null && catalog.hasItem(rightId)) {
        const right = catalog.getItem(rightId);
        if (right.kind === 'weapon' && right.twoHanded === true) return;
      }
    }
    const ceiling = enemyGearChapterCeiling(level, seedRoll01(seed, SALT_GEAR_SLOT + slotIndex));
    const paid = slot !== 'rightHand';
    const candidates = poolDefs.filter((def) => {
      if ((chapterOf.get(String(def.id)) ?? 3) > ceiling) return false;
      // Paid slots only offer what the purse still covers (the best
      // AFFORDABLE piece, not best-or-nothing — a bandit wears cheap
      // leathers, not no leathers).
      if (paid && itemPrice(def.id) > purse) return false;
      // No dual-wield passive → no second weapon (the UI-tier rule the
      // Team Builder and Cartographer both enforce).
      if (slot === 'leftHand' && def.kind === 'weapon' && !dualWield) {
        return false;
      }
      return slotIneligibilityReason(cls, slot, def, catalog) === null;
    });
    const ranked = rankItemsForUnit(catalog, candidates, profile);
    const best = ranked[0];
    if (best === undefined || scoreItemForUnit(catalog, best, profile) <= 0) return;
    if (paid) purse -= itemPrice(best.id);
    equipment = { ...equipment, [slot]: best.id };
  });
  return equipment;
}
