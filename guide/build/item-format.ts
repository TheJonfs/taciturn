// Item formatter — turns a catalog ItemDefinition into structured
// display facts the armory template can lay out.
//
// Like ability-format.ts, this is presentation logic, not game logic:
// it reads the engine's item shapes and produces human-readable fields.
// Every value traces straight back to the catalog.

import { catalog } from './data.ts';
import type { ItemDefinition } from '@engine/index.ts';

/** Structured, display-ready facts about one item. */
export interface ItemFacts {
  readonly id: string;
  readonly name: string;
  /** 'Weapon' | 'Shield' | 'Armour' | 'Headgear' | 'Accessory'. */
  readonly kindLabel: string;
  /** Class restriction, e.g. "Knight only" / "Mages only"; undefined = any. */
  readonly restriction: string | undefined;
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
const MAGE_CLASS_IDS = new Set(['earth_mage', 'water_mage', 'fire_mage', 'lightning_mage']);

function signed(n: number): string {
  return n >= 0 ? `+${n}` : `−${Math.abs(n)}`;
}

function titleCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function restrictionText(item: ItemDefinition): string | undefined {
  const ids = item.classRestrictions;
  if (!ids || ids.length === 0) return undefined;
  const names = ids.map((id) => catalog().getClass(id).name);
  if (ids.length === 1) return `${names[0]} only`;
  const allMages = (subset: ReadonlyArray<unknown>) =>
    [...MAGE_CLASS_IDS].every((m) => subset.some((id) => String(id) === m));
  if (ids.length === 4 && ids.every((id) => MAGE_CLASS_IDS.has(String(id)))) {
    return 'Mages only';
  }
  // The four Mages + the Calculator — the books' arcane readership. Listed
  // out, the five display names overflow the entry's column; collapse them.
  if (
    ids.length === 5 &&
    allMages(ids) &&
    ids.some((id) => String(id) === 'calculator')
  ) {
    return 'Mages & Calculator only';
  }
  // Two classes — the Knight & Templar shared-gear case (S62). Read as
  // prose with "&", not a bare comma list.
  if (ids.length === 2) return `${names[0]} & ${names[1]} only`;
  return `${names.join(', ')} only`;
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
  return {
    id: item.id,
    name: item.name,
    kindLabel: KIND_LABELS[item.kind] ?? item.kind,
    restriction: restrictionText(item),
    weaponLine: weaponLine(item),
    effects: [
      ...statEffects(item),
      ...defensiveEffects(item),
      ...hookEffects(item),
    ],
  };
}
