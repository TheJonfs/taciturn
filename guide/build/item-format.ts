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

const WEAPON_FAMILIES = new Set(['sword', 'axe', 'staff', 'wand', 'bow', 'spear']);
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
  if (ids.length === 4 && ids.every((id) => MAGE_CLASS_IDS.has(String(id)))) {
    return 'Mages only';
  }
  return `${names.join(', ')} only`;
}

function weaponLine(item: ItemDefinition): string | undefined {
  if (item.kind !== 'weapon') return undefined;
  const parts = [`WP ${item.wp}`, `${item.accuracy}% accuracy`];
  const family = item.tags?.find((t) => WEAPON_FAMILIES.has(t));
  if (family) parts.push(family);
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

  // Resistances — collapse "all four elements, equal value" into one bit.
  if (item.resistanceMods && item.resistanceMods.size > 0) {
    const entries = [...item.resistanceMods.entries()];
    const values = new Set(entries.map(([, v]) => v));
    const elements = entries.map(([tag]) => tag);
    const isAllElements =
      entries.length === 4 &&
      ['fire', 'water', 'earth', 'lightning'].every((e) => elements.includes(e));
    if (isAllElements && values.size === 1) {
      out.push(`All elemental resistance ${signed(entries[0]![1])}`);
    } else {
      for (const [tag, value] of entries) {
        out.push(`${titleCase(tag)} resistance ${signed(value)}`);
      }
    }
  }

  // Per-facing evasion.
  const ev = item.evasionMods;
  if (ev) {
    const facings: Array<[string, number | undefined]> = [
      ['front', ev.front],
      ['side', ev.side],
      ['back', ev.back],
    ];
    for (const [facing, value] of facings) {
      if (value !== undefined) out.push(`${titleCase(facing)} evasion ${signed(value)}`);
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

  if (item.kind === 'weapon' && item.physicalVariance) {
    out.push(
      `Variance ${item.physicalVariance.min}–${item.physicalVariance.max}`,
    );
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
