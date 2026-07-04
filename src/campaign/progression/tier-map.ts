// TABA M2 progression — the class tier/half map.
//
// The static "where does each class sit in the tree" table (brief §Tier map).
// This is NEW campaign-side content: the engine's `ClassDefinition` carries
// NO tier/half concept and must not gain one (arch rule 1 — the engine knows
// nothing of campaign progression). Classes are referenced by id (rule 4);
// this table never modifies class-definition.ts.
//
// Not serialized — a code constant, referenced by position. A `Map` is fine
// here (the plain-serializable D-C constraint is only on `CampaignState`, the
// save target; static tables are not saved).
//
//   Tier      PHYSICAL                 MAGICAL                    HYBRID
//   1   Alchemist, Monk, Hunter   Pyromancer, Hydrologist,     —
//                                 Geosage
//   2   Knight, Thief             Aethurge, Enchanter          Terraformer, Templar
//   3   Assassin                  Calculator                   [capstone — undesigned]
//
// (Content-name → classId: Pyromancer=fire_mage, Hydrologist=water_mage,
//  Geosage=earth_mage, Aethurge=lightning_mage.)

import { classId, type ClassId } from '@engine/index.ts';

export type ClassHalf = 'physical' | 'magical' | 'hybrid';
export type ClassTier = 1 | 2 | 3;

export interface ClassTierEntry {
  readonly half: ClassHalf;
  readonly tier: ClassTier;
}

// A `${half}:${tier}` slot key — the unit of tier-gating accounting. Both the
// per-tier-per-half spend accumulators and the unlocked-tier set are keyed by
// this. The hybrid T3 slot ('hybrid:3') exists as a seam; no class fills it.
export type TierSlot = `${ClassHalf}:${ClassTier}`;

export function tierSlot(half: ClassHalf, tier: ClassTier): TierSlot {
  return `${half}:${tier}`;
}

export function slotOf(entry: ClassTierEntry): TierSlot {
  return tierSlot(entry.half, entry.tier);
}

export const CLASS_TIER_MAP: ReadonlyMap<ClassId, ClassTierEntry> = new Map([
  // Physical
  [classId('alchemist'), { half: 'physical', tier: 1 }],
  [classId('monk'), { half: 'physical', tier: 1 }],
  [classId('hunter'), { half: 'physical', tier: 1 }],
  [classId('knight'), { half: 'physical', tier: 2 }],
  [classId('thief'), { half: 'physical', tier: 2 }],
  [classId('assassin'), { half: 'physical', tier: 3 }],
  // Magical
  [classId('fire_mage'), { half: 'magical', tier: 1 }],
  [classId('water_mage'), { half: 'magical', tier: 1 }],
  [classId('earth_mage'), { half: 'magical', tier: 1 }],
  [classId('lightning_mage'), { half: 'magical', tier: 2 }],
  [classId('enchanter'), { half: 'magical', tier: 2 }],
  [classId('calculator'), { half: 'magical', tier: 3 }],
  // Hybrid (Tier-3 capstone deliberately absent — undesigned, out of scope)
  [classId('terraformer'), { half: 'hybrid', tier: 2 }],
  [classId('templar'), { half: 'hybrid', tier: 2 }],
]);

// Tier/half for a class. Throws loudly on an unmapped class id (an authoring
// error — every playable class must sit somewhere in the tree) rather than
// returning a silent default (CLAUDE.md anti-pattern: no silent fallbacks).
export function tierEntryOf(id: ClassId): ClassTierEntry {
  const entry = CLASS_TIER_MAP.get(id);
  if (entry === undefined) {
    throw new Error(`tierEntryOf: class '${String(id)}' is not in CLASS_TIER_MAP`);
  }
  return entry;
}

// Every class sitting in a given slot (used to answer "which classes does
// unlocking this tier make reclass-able").
export function classesInSlot(slot: TierSlot): ReadonlyArray<ClassId> {
  const out: ClassId[] = [];
  for (const [id, entry] of CLASS_TIER_MAP) {
    if (slotOf(entry) === slot) out.push(id);
  }
  return out;
}
