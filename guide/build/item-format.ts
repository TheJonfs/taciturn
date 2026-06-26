// Item formatter — turns a catalog ItemDefinition into structured
// display facts the armory template can lay out.
//
// Like ability-format.ts, this is presentation logic, not game logic:
// it reads the engine's item shapes and produces human-readable fields.
// Every value traces straight back to the catalog.

import { catalog } from './data.ts';
import type { ItemDefinition } from '@engine/index.ts';

/**
 * The Academy's three classes of requisitionable gear, for the armour
 * slots (off-hand / body / head). Rather than enumerate the eligible
 * disciplines on every entry — a list that spills the column and grows
 * with every new class — each restricted piece is sorted into a tier a
 * cadet reads at a glance:
 *
 *  - 'universal' — open to every discipline.
 *  - 'heavy'     — the Knight's line: heavy armour and the true shields.
 *                  Currently the Knight and the Templar.
 *  - 'magical'   — the casting line: robes, mage headgear, the Books.
 *                  Currently the four elemental Mages, the Calculator,
 *                  and the Terraformer.
 *
 * Future classes join a tier rather than minting a new restriction set;
 * the tier is computed by *membership* (does the restriction include the
 * Knight? a caster?), not by an exact roster match, so a new discipline
 * added to either family is picked up without a guide edit.
 */
export type GearTier = 'universal' | 'heavy' | 'magical';

/** Structured, display-ready facts about one item. */
export interface ItemFacts {
  readonly id: string;
  readonly name: string;
  /** 'Weapon' | 'Shield' | 'Armour' | 'Headgear' | 'Accessory'. */
  readonly kindLabel: string;
  /**
   * Gear tier for restricted armour-slot pieces — 'heavy' or 'magical'.
   * undefined for universal items and for kinds the tiers don't apply to
   * (weapons, accessories), which carry no restriction line.
   */
  readonly tier: GearTier | undefined;
  /** Display label for the tier — "Heavy" / "Magical"; undefined = universal/n.a. */
  readonly tierLabel: string | undefined;
  /** Weapons only: "WP 8 · 95% accuracy · sword". */
  readonly weaponLine: string | undefined;
  /** Every other modifier the item carries, as short human-readable bits. */
  readonly effects: ReadonlyArray<string>;
}

const KIND_LABELS: Record<string, string> = {
  weapon: 'Weapon',
  shield: 'Shield',
  armor: 'Armour',
  headgear: 'Headgear',
  accessory: 'Accessory',
};

const STAT_LABELS: Record<string, string> = {
  maxHpBase: 'HP',
  maxMpBase: 'MP',
  pa: 'PA',
  ma: 'MA',
  spd: 'Speed',
  brave: 'Brave',
  faith: 'Faith',
  crit_chance: 'Crit chance',
  crit_multiplier: 'Crit damage',
};

const MULT_STAT_LABELS: Record<string, string> = {
  maxHp: 'max HP',
  maxMp: 'max MP',
  pa: 'PA',
  ma: 'MA',
  spd: 'Speed',
};

const WEAPON_FAMILIES = new Set(['sword', 'axe', 'knife', 'staff', 'wand', 'bow', 'spear']);

// Tier anchors. The 'heavy' line is anchored by the Knight; the
// 'magical' line by any caster discipline. Membership, not exact match,
// decides the tier — so a future class added to either family is picked
// up automatically. The two anchor sets must stay disjoint (no class is
// both heavy and magical); a restriction touching both would be a
// content contradiction and is failed loudly below.
const HEAVY_ANCHOR_IDS = new Set(['knight']);
const MAGICAL_ANCHOR_IDS = new Set([
  'earth_mage',
  'water_mage',
  'fire_mage',
  'lightning_mage',
  'calculator',
  'terraformer',
  'enchanter',
]);

const TIER_LABELS: Record<GearTier, string> = {
  universal: 'Universal',
  heavy: 'Heavy',
  magical: 'Magical',
};

function signed(n: number): string {
  return n >= 0 ? `+${n}` : `−${Math.abs(n)}`;
}

function titleCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Sort an item's class restriction into a gear tier. Universal items
 * (no restriction) return 'universal'. Restricted pieces are classified
 * by membership: a restriction listing the Knight reads 'heavy'; one
 * listing a caster reads 'magical'. A restriction touching *both* anchor
 * families — or *neither* — is a content contradiction the tier model
 * doesn't describe, so it fails loudly rather than mislabelling (per
 * CLAUDE.md: no silent fallbacks).
 */
function gearTier(item: ItemDefinition): GearTier {
  const ids = item.classRestrictions;
  if (!ids || ids.length === 0) return 'universal';
  const keys = ids.map((id) => String(id));
  const isHeavy = keys.some((k) => HEAVY_ANCHOR_IDS.has(k));
  const isMagical = keys.some((k) => MAGICAL_ANCHOR_IDS.has(k));
  if (isHeavy && isMagical) {
    throw new Error(
      `Item "${item.id}" restriction spans both the heavy and magical lines (${keys.join(', ')}) — the gear-tier model assumes the two are disjoint. Reconcile the content or extend the tiers.`,
    );
  }
  if (isHeavy) return 'heavy';
  if (isMagical) return 'magical';
  throw new Error(
    `Item "${item.id}" has a class restriction (${keys.join(', ')}) that fits no gear tier. Add the discipline to an anchor set in item-format.ts.`,
  );
}

function weaponLine(item: ItemDefinition): string | undefined {
  if (item.kind !== 'weapon') return undefined;
  const parts = [`WP ${item.wp}`, `${item.accuracy}% accuracy`];
  const family = item.tags?.find((t) => WEAPON_FAMILIES.has(t));
  if (family) parts.push(family);
  // Some weapons declare an inherent range (Session 45 bows — Longbow,
  // Riptide Bow). When present, it sets the basic Attack's reach with
  // that weapon, so it belongs on the headline alongside WP / accuracy.
  if (item.range) {
    const r = item.range;
    const min = r.min;
    const range = min !== undefined && min > 0 ? `${min}–${r.max}` : `${r.max}`;
    parts.push(`range ${range}`);
  }
  if (item.twoHanded) parts.push('two-handed');
  return parts.join('  ·  ');
}

function statEffects(item: ItemDefinition): string[] {
  const out: string[] = [];

  for (const [key, value] of Object.entries(item.statMods ?? {})) {
    if (value === undefined) continue;
    const label = STAT_LABELS[key] ?? key;
    const suffix = key === 'crit_chance' ? '%' : '';
    out.push(`${label} ${signed(value)}${suffix}`);
  }

  for (const [key, factor] of Object.entries(item.statModsMultiplicative ?? {})) {
    if (factor === undefined) continue;
    out.push(`×${factor} ${MULT_STAT_LABELS[key] ?? key}`);
  }

  for (const [stat, delta] of Object.entries(item.movementMods ?? {})) {
    if (delta === undefined) continue;
    const label = stat === 'moveRange' ? 'Move' : 'Jump';
    out.push(`${label} ${signed(delta)}`);
  }

  return out;
}

function defensiveEffects(item: ItemDefinition): string[] {
  const out: string[] = [];

  // Resistances — collapse common all-equal patterns so a uniform six-
  // way blanket (the Mantle of Protection) doesn't print as six lines,
  // and the older "all four elements" case stays collapsed too.
  if (item.resistanceMods && item.resistanceMods.size > 0) {
    const entries = [...item.resistanceMods.entries()];
    const values = new Set(entries.map(([, v]) => v));
    const elements = entries.map(([tag]) => String(tag));
    const ELEMENTAL = ['fire', 'water', 'earth', 'lightning'];
    const ALL_DAMAGE_TAGS = [...ELEMENTAL, 'holy', 'dark'];
    const isAllDamage =
      entries.length === ALL_DAMAGE_TAGS.length &&
      ALL_DAMAGE_TAGS.every((e) => elements.includes(e));
    const isAllElemental =
      entries.length === ELEMENTAL.length &&
      ELEMENTAL.every((e) => elements.includes(e));
    if (isAllDamage && values.size === 1) {
      out.push(`All damage-type resistance ${signed(entries[0]![1])}`);
    } else if (isAllElemental && values.size === 1) {
      out.push(`All elemental resistance ${signed(entries[0]![1])}`);
    } else {
      for (const [tag, value] of entries) {
        out.push(`${titleCase(String(tag))} resistance ${signed(value)}`);
      }
    }
  }

  // Per-facing evasion — collapse when all three facings carry the same
  // value (Mantle of Protection's uniform +25 across the lot).
  const ev = item.evasionMods;
  if (ev) {
    if (
      ev.front !== undefined &&
      ev.front === ev.side &&
      ev.side === ev.back
    ) {
      out.push(`All-facing evasion ${signed(ev.front)}`);
    } else {
      const facings: Array<[string, number | undefined]> = [
        ['front', ev.front],
        ['side', ev.side],
        ['back', ev.back],
      ];
      for (const [facing, value] of facings) {
        if (value !== undefined) out.push(`${titleCase(facing)} evasion ${signed(value)}`);
      }
    }
  }

  return out;
}

function hookEffects(item: ItemDefinition): string[] {
  const out: string[] = [];

  for (const statusId of item.statusGrants ?? []) {
    out.push(`Grants ${catalog().getStatusType(statusId).name}`);
  }

  for (const factor of item.mpCostMultipliers ?? []) {
    out.push(`MP cost ×${factor}`);
  }

  for (const mod of item.actionSpeedModifiers ?? []) {
    const gate = mod.tagFilter ? ` (${mod.tagFilter.join('/')})` : '';
    out.push(`Action speed ${signed(mod.delta)}${gate}`);
  }

  // Spell Power modifiers (S68, Wand of Potential) — additive on the
  // magical power coefficient, tag-gated to the holder's matching casts.
  for (const mod of item.spellPowerModifiers ?? []) {
    const gate = mod.tagFilter ? ` (${mod.tagFilter.join('/')})` : '';
    const per = mod.perExtraTarget ? ' per target beyond the first' : '';
    out.push(`Spell Power ${signed(mod.delta)}${gate}${per}`);
  }

  // Battle-start CT seed (Greaves of Seraphis): a unit begins the battle
  // at this CT. A full 100 means it acts first; lesser values are a head
  // start. Surfaced so the armory communicates the opener-guarantee.
  if (item.battleStartCt !== undefined) {
    out.push(
      item.battleStartCt >= 100
        ? 'Begins the battle at full CT (acts first)'
        : `Begins the battle at ${item.battleStartCt} CT`,
    );
  }

  // Spell-damage CT drain (Ring of Caliora): the wielder's damaging
  // spells push the target's CT back by this fraction of the damage
  // dealt. Spell damage only — weapon hits don't trigger it.
  if (item.damageCtDrainPercent !== undefined) {
    out.push(`Spell damage drains target CT by ${item.damageCtDrainPercent}% of damage dealt`);
  }

  // Outgoing-status magnitude modifiers (Pendant of Lumara): scale the
  // magnitude of a status the wielder applies — by status type or by
  // tag. Composes through the same chain Aura Mastery uses.
  for (const mod of item.outgoingStatusMagnitudeMods ?? []) {
    const subject = mod.statusTypeId
      ? catalog().getStatusType(mod.statusTypeId).name
      : mod.statusTag
        ? `${mod.statusTag}-tagged status`
        : 'status';
    out.push(`Applied ${subject} magnitude ×${mod.factor}`);
  }

  for (const mod of item.abilityRangeModifiers ?? []) {
    const axes: string[] = [];
    if (mod.deltaHorizontal) axes.push(`range ${signed(mod.deltaHorizontal)}`);
    if (mod.deltaVertical) axes.push(`vertical ${signed(mod.deltaVertical)}`);
    const gate = mod.tagFilter ? ` (${mod.tagFilter.join('/')})` : '';
    if (axes.length > 0) out.push(`Ability ${axes.join(', ')}${gate}`);
  }

  // AoE vertical-tolerance modifiers (S51, Battle Dictionary) — widen
  // which elevation bands an area spell actually covers, distinct from
  // the targeting reach above.
  for (const mod of item.aoeVerticalToleranceModifiers ?? []) {
    const gate = mod.tagFilter ? ` (${mod.tagFilter.join('/')})` : '';
    out.push(`AoE elevation ${signed(mod.delta)}${gate}`);
  }

  for (const mult of item.outgoingHitChanceMultipliers ?? []) {
    out.push(`Hit chance ×${mult}`);
  }

  for (const mod of item.incomingStatusModifiers ?? []) {
    const subject =
      mod.kind === 'by_type'
        ? catalog().getStatusType(mod.statusTypeId).name
        : `${mod.statusTag}-tagged`;
    out.push(`Incoming ${subject} chance ×${mod.chanceMultiplier}`);
  }

  for (const mult of item.statusTickAmountMultipliers ?? []) {
    const subject = mult.statusTypeId
      ? catalog().getStatusType(mult.statusTypeId).name
      : mult.statusTag
        ? `${mult.statusTag}-status`
        : 'status';
    out.push(`${titleCase(subject)} tick rate ×${mult.factor}`);
  }

  if (item.bucketCapacityMods && item.bucketCapacityMods.size > 0) {
    for (const [bucket, delta] of item.bucketCapacityMods.entries()) {
      const label = String(bucket).replace(/_/g, ' ');
      out.push(`${titleCase(label)} capacity ${signed(delta)}`);
    }
  }

  if (item.damageMpDrainPercent !== undefined) {
    out.push(`Drains ${item.damageMpDrainPercent}% of damage dealt as MP`);
  }

  if (item.physicalReflectPercent !== undefined) {
    out.push(`Reflects ${item.physicalReflectPercent}% of physical damage taken`);
  }

  // Swings-per-weapon multiplier (The Offering): the basic Attack swings
  // this many times per equipped weapon. Composes with Two Weapons —
  // dual-wield × the multiplier — so the line reads per-weapon, not total.
  if (item.attackSwingMultiplier !== undefined && item.attackSwingMultiplier > 1) {
    out.push(`Attack swings ×${item.attackSwingMultiplier} per weapon`);
  }

  for (const proc of item.attackProcs ?? []) {
    const abilityName = catalog().getAbility(proc.abilityId).name;
    const when = proc.chance >= 1 ? 'On every hit' : `${Math.round(proc.chance * 100)}% on hit`;
    out.push(`${when}: ${abilityName}`);
  }

  // Element tags on a weapon (Flametongue's 'fire') — composed into its
  // damage. Weapon-family tags are already in the weapon line.
  if (item.kind === 'weapon') {
    for (const tag of item.tags ?? []) {
      if (!WEAPON_FAMILIES.has(tag)) out.push(`${titleCase(tag)}-imbued`);
    }
  }

  // Physical variance — discriminated union of four arms:
  //  - static: a fixed band (War Axe, Bolt Hammer).
  //  - attacker_speed (S40): band centred at Speed/10 ± spread; the
  //    wielder's Speed sets the absolute numbers, so the armory entry
  //    communicates the principle, not a fixed range.
  //  - attacker_brave (S50, Knight Sword class): band centred at the
  //    wielder's Brave/100 ± spread. Absolom authors this.
  //  - height_delta (S45 bow class): deterministic given positions,
  //    1 ± falloffPerHeight × (attackerHeight − targetHeight). Above
  //    target → boost; below → cut. The armory communicates the lever.
  // Each kind is matched explicitly: an unknown arm prints nothing
  // rather than mis-reading another arm's field (which produced a
  // reader-facing "±NaN%" before attacker_brave was handled).
  if (item.kind === 'weapon' && item.physicalVariance) {
    const v = item.physicalVariance;
    if (v.kind === 'static') {
      out.push(`Variance ${v.min}–${v.max}`);
    } else if (v.kind === 'attacker_speed') {
      const pct = Math.round(v.spread * 100);
      out.push(`Variance scales with Speed (±${pct}%)`);
    } else if (v.kind === 'attacker_brave') {
      const pct = Math.round(v.spread * 100);
      out.push(`Variance scales with Brave (±${pct}%)`);
    } else if (v.kind === 'height_delta') {
      const pct = Math.round(v.falloffPerHeight * 100);
      out.push(`Variance scales with elevation (±${pct}% per level above/below target)`);
    }
  }

  // Status-application stack-count modifiers (S45+, Wand of Lumen). The
  // wielder's matching status applications add (or subtract) stacks —
  // e.g. Wand of Lumen lifts every fire-tagged Burn application by one
  // stack, so a Pyromancer's spells land that much heavier.
  for (const mod of item.statusApplicationStackCountModifiers ?? []) {
    const statusName = catalog().getStatusType(mod.statusTypeId).name;
    const tags = mod.sourceAbilityTagAll;
    const gate =
      tags && tags.length > 0
        ? ` per ${tags.join('/')}-tagged application`
        : ' per application';
    out.push(`${signed(mod.delta)} ${statusName} stack${gate}`);
  }

  return out;
}

/** Describe one item as structured, display-ready facts. */
export function describeItem(item: ItemDefinition): ItemFacts {
  const tier = gearTier(item);
  return {
    id: item.id,
    name: item.name,
    kindLabel: KIND_LABELS[item.kind] ?? item.kind,
    tier: tier === 'universal' ? undefined : tier,
    tierLabel: tier === 'universal' ? undefined : TIER_LABELS[tier],
    weaponLine: weaponLine(item),
    effects: [
      ...statEffects(item),
      ...defensiveEffects(item),
      ...hookEffects(item),
    ],
  };
}
