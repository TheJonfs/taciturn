// Gear valuation — the AI's item-choice floor (S89, WI4b).
//
// `scoreItemForUnit` puts a single damage-equivalent-ish number on "how
// good is this equipment piece for this unit," so a chooser can rank
// candidates per slot. The M4 skirmish generator is the intended consumer
// (its equipment-assignment upgrade replaces `generateSkirmishParty`'s
// gear-less stub — see D-ai-3 in the AI-refresh brief); the campaign shell
// may also reuse it for "recommended gear" affordances.
//
// FLOOR, NOT CEILING (D-ai-1): stat gear and *common effect patterns* are
// valued — WP, accuracy, stat mods, evasion, resistances, movement, MP
// economy, permanent status grants, procs/lifesteal/reflect as flat
// recognized bumps. Exotic effect timing (Del's Stave dump cadence, Moon
// Robe synergies, conditional mods) deliberately scores 0 beyond its stat
// lines — the generator should never be *misled* by an exotic item, but it
// won't optimize around one either.
//
// The absolute scale is loose; RELATIVE ordering within a slot is the
// contract ("the Geosage takes the rod over the sword"). Weights are
// playtest dials in the same spirit as basic.ts's constants.
//
// Pure and deterministic; reads only the catalog definition + the profile.

import type {
  Catalog,
  ClassId,
  EquipmentDefinition,
  ItemDefinition,
} from '@engine/index.ts';

// The minimal unit shape the scorer needs — deliberately NOT a battle
// `Unit`, because the M4 generator ranks gear before any battle exists.
// Build it from a CampaignUnit's curve stats (caller-side).
export interface GearScoreProfile {
  readonly classId: ClassId;
  readonly pa: number;
  readonly ma: number;
  // Whether the unit's kit spends MP (casters / hybrid kits). Scales the
  // value of maxMp bonuses and MP-cost discounts. Default false.
  readonly usesMp?: boolean;
}

// --- weights (playtest dials) -----------------------------------------
// A "point" of a stat, in the rough damage-equivalent currency basic.ts
// scores in. Attack-stat points are weighted by kit affinity below.
const W_ATTACK_STAT_POINT = 6;
const W_OFF_STAT_POINT = 1.5; // the non-affine attack stat still helps a hybrid
const W_SPD_POINT = 8;
const W_MAXHP_POINT = 0.5;
const W_MAXMP_POINT_CASTER = 0.4;
const W_MAXMP_POINT_OTHER = 0.05;
const W_BRAVE_FAITH_POINT = 0.3;
const W_CRIT_CHANCE_POINT = 0.8;
const W_EVASION_POINT = 0.8;
const W_RESIST_POINT = 0.15;
const W_MOVE_POINT = 10;
const W_JUMP_POINT = 4;
const W_STATUS_GRANT = 20; // a permanent Haste/Regen-class grant
const W_REFLECT_POINT = 0.5;
const W_PROC_VALUE = 15; // × proc chance — matches the debuff-floor scale
const W_LIFESTEAL_POINT = 0.4; // per % on a weapon
const W_MP_COST_DISCOUNT = 25; // × (1 − multiplier), casters only
const W_BUCKET_CAPACITY_POINT = 8;
const W_SPELL_POWER_DELTA = 2; // × ma-affinity

// How much the unit's kit cares about each attack stat, in [0, 1]. The
// dominant stat gets 1; the other scales by its relative magnitude so a
// true hybrid (Terraformer) still values both.
function affinity(profile: GearScoreProfile): { pa: number; ma: number } {
  const { pa, ma } = profile;
  if (pa <= 0 && ma <= 0) return { pa: 0.5, ma: 0.5 };
  if (pa >= ma) return { pa: 1, ma: Math.max(0, ma / Math.max(1, pa)) * 0.6 };
  return { ma: 1, pa: Math.max(0, pa / Math.max(1, ma)) * 0.6 };
}

// Score one equipment piece for a unit profile. Returns 0 for a piece the
// unit's class may not equip (defensive — callers usually pre-filter
// legality) and for consumables (not gear). Higher is better; only compare
// scores across candidates for the SAME slot.
export function scoreItemForUnit(
  catalog: Catalog,
  item: ItemDefinition,
  profile: GearScoreProfile,
): number {
  if (item.kind === 'consumable') return 0;
  if (
    item.classRestrictions !== undefined &&
    !item.classRestrictions.includes(profile.classId)
  ) {
    return 0;
  }
  const aff = affinity(profile);
  let score = 0;

  // --- weapon offense ---------------------------------------------------
  if (item.kind === 'weapon') {
    const stat = item.attackStat ?? 'pa';
    const statValue = stat === 'ma' ? profile.ma : profile.pa;
    const statAffinity = stat === 'ma' ? aff.ma : aff.pa;
    // Expected swing value: WP × the wielder's scaler × accuracy, scaled
    // by how much this kit uses that stat — a Geosage holding a great
    // sword wastes its MA turniness; a Knight holding a rod swings PA 0.
    score += item.wp * statValue * (item.accuracy / 100) * statAffinity;
    // Reach is action economy: each point of max range past melee.
    if (item.range !== undefined && item.range.max > 1) {
      score += (item.range.max - 1) * 4;
    }
    if (item.rangeFromHeightBonus !== undefined) score += 6; // the bow height game
    if (item.attackSwingMultiplier !== undefined && item.attackSwingMultiplier > 1) {
      score += item.wp * statValue * (item.accuracy / 100) * statAffinity
        * (item.attackSwingMultiplier - 1) * 0.8; // extra swings, slightly discounted
    }
    // Common weapon riders — flat recognized bumps (floor).
    if (item.attackProcs !== undefined) {
      for (const proc of item.attackProcs) score += proc.chance * W_PROC_VALUE;
    }
    if (item.damageLifestealMods !== undefined) {
      for (const m of item.damageLifestealMods) score += m.percent * W_LIFESTEAL_POINT;
    }
    if (item.damageMpDrainPercent !== undefined) score += item.damageMpDrainPercent * 0.2;
    if (item.damageCtDrainPercent !== undefined) score += item.damageCtDrainPercent * 0.2;
  }

  // --- stat lines (all equipment kinds) ----------------------------------
  const mods = item.statMods;
  if (mods !== undefined) {
    score += (mods.pa ?? 0) * W_ATTACK_STAT_POINT * Math.max(aff.pa, W_OFF_STAT_POINT / W_ATTACK_STAT_POINT);
    score += (mods.ma ?? 0) * W_ATTACK_STAT_POINT * Math.max(aff.ma, W_OFF_STAT_POINT / W_ATTACK_STAT_POINT);
    score += (mods.spd ?? 0) * W_SPD_POINT;
    score += (mods.maxHpBase ?? 0) * W_MAXHP_POINT;
    score += (mods.maxMpBase ?? 0) * (profile.usesMp === true ? W_MAXMP_POINT_CASTER : W_MAXMP_POINT_OTHER);
    score += ((mods.brave ?? 0) + (mods.faith ?? 0)) * W_BRAVE_FAITH_POINT;
    score += (mods.crit_chance ?? 0) * W_CRIT_CHANCE_POINT;
  }
  const mult = item.statModsMultiplicative;
  if (mult !== undefined) {
    // Value a ×K stat line as the bonus fraction of the profile's own
    // stat (maxHp/maxMp read the class-typical scale via the profile's
    // attack stats as a coarse proxy is wrong — use flat per-stat scales).
    for (const [stat, factor] of Object.entries(mult)) {
      if (factor === undefined) continue;
      const bonus = factor - 1;
      if (bonus === 0) continue;
      if (stat === 'pa') score += bonus * profile.pa * W_ATTACK_STAT_POINT * aff.pa;
      else if (stat === 'ma') score += bonus * profile.ma * W_ATTACK_STAT_POINT * aff.ma;
      else if (stat === 'spd') score += bonus * 10 * W_SPD_POINT; // ~10 spd baseline
      else if (stat === 'maxHp') score += bonus * 60 * W_MAXHP_POINT; // ~60 HP baseline
      else if (stat === 'maxMp') score += bonus * 30 * (profile.usesMp === true ? W_MAXMP_POINT_CASTER : W_MAXMP_POINT_OTHER);
    }
  }

  // --- defensive / utility lines -----------------------------------------
  if (item.evasionMods !== undefined) {
    score += ((item.evasionMods.front ?? 0) + (item.evasionMods.side ?? 0) + (item.evasionMods.back ?? 0)) * W_EVASION_POINT;
  }
  if (item.resistanceMods !== undefined) {
    for (const value of item.resistanceMods.values()) score += value * W_RESIST_POINT;
  }
  if (item.movementMods !== undefined) {
    score += (item.movementMods.moveRange ?? 0) * W_MOVE_POINT;
    score += (item.movementMods.jump ?? 0) * W_JUMP_POINT;
  }
  if (item.statusGrants !== undefined) {
    for (const grant of item.statusGrants) {
      if (!catalog.hasStatusType(grant)) continue;
      const polarity = catalog.getStatusType(grant).aiHints?.polarity ?? 'debuff';
      if (polarity === 'buff') score += W_STATUS_GRANT;
    }
  }
  if (item.physicalReflectPercent !== undefined) score += item.physicalReflectPercent * W_REFLECT_POINT;
  if (item.magicalReflectPercent !== undefined) score += item.magicalReflectPercent * W_REFLECT_POINT;
  if (item.mpCostMultipliers !== undefined && profile.usesMp === true) {
    for (const m of item.mpCostMultipliers) {
      if (m < 1) score += (1 - m) * W_MP_COST_DISCOUNT;
    }
  }
  if (item.bucketCapacityMods !== undefined) {
    for (const delta of item.bucketCapacityMods.values()) score += delta * W_BUCKET_CAPACITY_POINT;
  }
  if (item.spellPowerModifiers !== undefined) {
    for (const m of item.spellPowerModifiers) score += m.delta * W_SPELL_POWER_DELTA * aff.ma;
  }
  if (item.spellProcs !== undefined) {
    for (const proc of item.spellProcs) score += proc.chance * W_PROC_VALUE * aff.ma;
  }
  // Everything else (conditional mods, dump mechanics, exotic riders) is
  // deliberately unvalued — floor, not ceiling.

  return score;
}

// Convenience: rank a candidate list for one slot, best first. Ties break
// on item id (lex ascending) so the ordering is deterministic.
export function rankItemsForUnit(
  catalog: Catalog,
  items: ReadonlyArray<EquipmentDefinition>,
  profile: GearScoreProfile,
): EquipmentDefinition[] {
  return [...items]
    .map((item) => ({ item, score: scoreItemForUnit(catalog, item, profile) }))
    .sort((a, b) => (a.score !== b.score ? b.score - a.score : a.item.id < b.item.id ? -1 : 1))
    .map((e) => e.item);
}
