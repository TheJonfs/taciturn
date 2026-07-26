// TABA M4 — generated-enemy gear assignment (the S89 valuation consumer).
//
// Assigns an equipment set to a generated enemy by weighing the campaign
// gear pool with the AI's gear-valuation floor (`scoreItemForUnit`, built
// in S89 for exactly this — D-ai-3's ordering cashes in here), then a
// seeded diversity roll among the near-top candidates per slot (S99 cont.:
// parties mix Axe/Bow Hunters instead of five identical kits). Weapons
// additionally weight by EFFECTIVE accuracy — catalog accuracy × the
// wielder's own equipped hit-chance passives — so Eagle Eye Hunters keep
// their deliberately-accuracy-40 bows while everyone else reads them as
// the whiff-sticks they'd be. The POOL is where the policy lives (M4
// brief WI3):
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
import { scoreItemForUnit, type GearScoreProfile } from '@ai/index.ts';
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
// Salt base for per-slot candidate picks (the diversity roll).
const SALT_GEAR_PICK = 150;

// The diversity window (S99 cont., Chris): instead of strict best-scoring,
// every candidate within this fraction of the top weight joins a seeded,
// weight-proportional roll — so two Hunters in one party can carry Axe and
// Bow, and the first affordable headpiece isn't always the same cap. A
// clearly-best item (nothing else within the window) still always wins.
const GEAR_PICK_DIVERSITY_FLOOR = 0.7;

// Class → weapon-type affinity (S99 cont. draft — Chris review pending,
// same tier as the archetype pools). The S89 scorer can't express class
// FLAVOR: at low levels its damage terms compress and a Deepwood Wand
// outbids a cutlass on a Bandit Thief. This table multiplies the roll
// weight per weapon type — a type absent from a class's row never
// generates on it (legality is untouched; authored gear can still hand
// anyone anything). Weights are deliberately gentle: the window does the
// mixing, the table does the flavor. Monk is the empty row (bare hands
// are the class definition). Fails loud on an unmapped class — a new
// class must take a stance here, like CLASS_TIER_MAP.
type WeaponTypeName =
  | 'sword'
  | 'knife'
  | 'knight_sword'
  | 'axe'
  | 'polearm'
  | 'bow'
  | 'wand'
  | 'staff';
const CLASS_WEAPON_AFFINITY: ReadonlyMap<string, ReadonlyMap<WeaponTypeName, number>> = new Map(
  (
    [
      ['monk', []],
      ['hunter', [['bow', 1.2], ['axe', 1.2], ['sword', 0.9], ['knife', 0.6]]],
      ['alchemist', [['knife', 1.3], ['sword', 1.0], ['axe', 0.8]]],
      ['knight', [['knight_sword', 1.3], ['sword', 1.2], ['axe', 1.0], ['polearm', 1.0]]],
      ['thief', [['knife', 1.3], ['sword', 1.0], ['bow', 0.6]]],
      ['assassin', [['knife', 1.3], ['sword', 1.0], ['bow', 0.8]]],
      ['fire_mage', [['wand', 1.1], ['staff', 1.0]]],
      ['water_mage', [['wand', 1.1], ['staff', 1.0]]],
      ['earth_mage', [['wand', 1.1], ['staff', 1.0]]],
      ['lightning_mage', [['wand', 1.1], ['staff', 1.0]]],
      ['enchanter', [['staff', 1.2], ['wand', 1.0]]],
      ['calculator', [['staff', 1.1], ['wand', 1.0]]],
      ['terraformer', [['staff', 1.1], ['wand', 1.0], ['polearm', 0.8]]],
      ['templar', [['polearm', 1.2], ['knight_sword', 1.2], ['sword', 1.0], ['staff', 0.8]]],
    ] as const
  ).map(([cls, rows]) => [cls, new Map(rows)]),
);

// The affinity factor for a weapon on a class (0 = never generates).
function weaponAffinity(cls: ClassId, weaponType: WeaponTypeName | undefined): number {
  const row = CLASS_WEAPON_AFFINITY.get(String(cls));
  if (row === undefined) {
    throw new Error(`weaponAffinity: class '${String(cls)}' has no weapon-affinity row`);
  }
  if (weaponType === undefined) return 0; // untyped weapons don't generate
  return row.get(weaponType) ?? 0;
}

// Probe the loadout's equipped passives for `modifyOutgoingHitChance`
// contributors — the Eagle Eye problem: Short Bow's accuracy 40 is
// DESIGNED around the Hunter's ×2 support ("the passive is the weapon's
// other half"), so weapon choice must see the wielder's own passives or
// every bow looks like a whiff-stick on Hunters and a bargain on everyone
// else. Floor semantics, same spirit as the S89 scorer: a handler that
// evaluates from `baseHitChance` alone is credited; one that needs battle
// context throws against the bare probe and is deliberately left unvalued
// (NOT an error — the swallow is the documented floor boundary).
export function draftHitChanceMultiplier(loadout: Loadout, catalog: Catalog): number {
  let mult = 1;
  for (const ids of Object.values(loadout.passiveBuckets)) {
    for (const id of ids) {
      if (!catalog.hasAbility(id)) continue;
      const def = catalog.getAbility(id);
      if (def.kind !== 'passive') continue;
      for (const hook of def.hooks) {
        if (hook.name !== 'modifyOutgoingHitChance') continue;
        try {
          const probe = (hook.handler as (args: unknown, ctx: unknown) => number)(
            { attacker: undefined, target: undefined, ability: undefined, baseHitChance: 100 },
            {},
          );
          if (Number.isFinite(probe) && probe > 0) mult *= probe / 100;
        } catch {
          // Context-dependent contributor — unvalued (floor boundary).
        }
      }
    }
  }
  return mult;
}

export interface EnemyGearArgs {
  readonly classId: ClassId;
  readonly level: number;
  // Deterministic stream root — same seed, same gear.
  readonly seed: number;
  // The unit's PROVISIONAL loadout (first action + secondary + the R/S/M
  // fill against baseline capacity): consulted for dual-wield /
  // two-handed-grip grants and the hit-chance probe (Eagle Eye). The
  // AUTHORITATIVE fill re-runs after gear because capacity is
  // equipment-adjusted.
  readonly loadout: Loadout;
  readonly profile: GearScoreProfile;
  readonly catalog: Catalog;
}

// Fill every slot the class can legally use from the level band's pool: a
// seeded, weight-proportional pick among the near-top candidates per slot
// (see GEAR_PICK_DIVERSITY_FLOOR). Weapons weight by score × EFFECTIVE
// accuracy — catalog accuracy times the wielder's own hit-chance passives —
// so an accuracy-40 bow stays viable exactly where its other half (Eagle
// Eye) is equipped. A slot with no positive-weight legal candidate stays
// bare (the scorer returns 0 for class-illegal pieces; a bare slot is a
// fact about the pool, not an error).
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
  const hitMult = draftHitChanceMultiplier(loadout, catalog);

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
      // The weapon hand carries a WEAPON: shields and held off-hands are
      // slot-legal there (the engine's two-shields latitude) but low-level
      // score compression would let them squat the hand — they compete
      // for the off-hand instead.
      if (slot === 'rightHand' && def.kind !== 'weapon') return false;
      // Paid slots only offer what the purse still covers (the best
      // AFFORDABLE piece, not best-or-nothing — a bandit wears cheap
      // leathers, not no leathers).
      if (paid && itemPrice(def.id) > purse) return false;
      // No dual-wield passive → no second weapon (the UI-tier rule the
      // Team Builder and Cartographer both enforce) — and even a
      // dual-wielder's OFF-hand never takes a two-handed weapon (both
      // hands are already spoken for) unless a grip passive relaxes it.
      if (slot === 'leftHand' && def.kind === 'weapon') {
        if (!dualWield) return false;
        if (def.twoHanded === true && !monkeygrip) return false;
      }
      return slotIneligibilityReason(cls, slot, def, catalog) === null;
    });
    // Weigh the candidates: the S89 score, times effective accuracy for
    // weapons (accuracy × the wielder's own hit-chance passives, capped at
    // 1 — the whiff-risk discount the flat reach/height bonuses otherwise
    // escape). Ties break on id so the ordering is deterministic.
    const weighed = candidates
      .map((def) => {
        let weight = scoreItemForUnit(catalog, def, profile);
        if (def.kind === 'weapon') {
          weight *= Math.min(1, (def.accuracy / 100) * hitMult);
          weight *= weaponAffinity(cls, def.weaponType);
        }
        return { def, weight };
      })
      .filter((c) => c.weight > 0)
      .sort((a, b) =>
        a.weight !== b.weight ? b.weight - a.weight : a.def.id < b.def.id ? -1 : 1,
      );
    if (weighed.length === 0) return;
    // The diversity roll: a seeded, weight-proportional pick among every
    // candidate within the window of the best.
    const window = weighed.filter((c) => c.weight >= weighed[0]!.weight * GEAR_PICK_DIVERSITY_FLOOR);
    const total = window.reduce((sum, c) => sum + c.weight, 0);
    let cursor = seedRoll01(seed, SALT_GEAR_PICK + slotIndex) * total;
    let chosen = window[window.length - 1]!.def;
    for (const c of window) {
      cursor -= c.weight;
      if (cursor < 0) {
        chosen = c.def;
        break;
      }
    }
    if (paid) purse -= itemPrice(chosen.id);
    equipment = { ...equipment, [slot]: chosen.id };
  });
  return equipment;
}
