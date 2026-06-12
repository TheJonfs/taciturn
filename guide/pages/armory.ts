// The Armory — the equipment catalogue.
//
// In-world: the Academy armory's standing inventory, catalogued by the
// Master Armorer and annotated by the instructor. Three sections —
// weapon racks, armour stores, accessory cases — each a fresh page,
// the items flowing two columns. Mechanical data is imported and
// formatted; the flavour and tactical notes are hand-authored.

import { items } from '../build/data.ts';
import { describeItem, type ItemFacts } from '../build/item-format.ts';
import { renderProse, renderInline } from '../build/markdown.ts';
import { sectionIntros, itemNotes } from '../content/items/index.ts';
import type { ItemDefinition } from '@engine/index.ts';
import { esc, join } from './html.ts';

interface ArmorySection {
  readonly key: string;
  readonly title: string;
  readonly intro: string;
  readonly kinds: ReadonlyArray<ItemDefinition['kind']>;
  /**
   * Optional ordering key for sub-category sorting within the section.
   * Items with equal keys keep their catalog order (Array.sort is
   * stable). Sections without a sortKey render in catalog order.
   */
  readonly sortKey?: (item: ItemDefinition) => number;
}

// Weapon Racks: weapons first (grouped by family — sword, knife, axe,
// bow, staff, wand), shields last. Items without a recognised family
// tag fall to the end of the weapons block; shields fall after that.
const WEAPON_FAMILY_ORDER: ReadonlyArray<string> = [
  'sword',
  'knife',
  'axe',
  'bow',
  'staff',
  'wand',
];

function weaponSortKey(item: ItemDefinition): number {
  if (item.kind === 'shield') return 200; // shields come last
  const family = item.tags?.find((t) => WEAPON_FAMILY_ORDER.includes(t));
  const familyIdx = family ? WEAPON_FAMILY_ORDER.indexOf(family) : 100;
  return familyIdx;
}

// Armour Stores: armour first, then headgear; within each, by gear tier
// — Universal, then Heavy, then Magical — so a cadet scanning the page
// finds the open pieces first and the line-restricted ones grouped after.
const TIER_RANK: Record<string, number> = { universal: 0, heavy: 1, magical: 2 };

function armourSortKey(item: ItemDefinition): number {
  const kindRank = item.kind === 'armor' ? 0 : item.kind === 'headgear' ? 1 : 2;
  const tier = describeItem(item).tier ?? 'universal';
  return kindRank * 10 + (TIER_RANK[tier] ?? 9);
}

const SECTIONS: ReadonlyArray<ArmorySection> = [
  {
    key: 'weapons',
    title: 'The Weapon Racks',
    intro: sectionIntros.weapons ?? '',
    kinds: ['weapon', 'shield'],
    sortKey: weaponSortKey,
  },
  {
    key: 'armour',
    title: 'The Armour Stores',
    intro: sectionIntros.armour ?? '',
    kinds: ['armor', 'headgear'],
    sortKey: armourSortKey,
  },
  {
    key: 'accessories',
    title: 'The Accessory Cases',
    intro: sectionIntros.accessories ?? '',
    kinds: ['accessory'],
  },
];

function itemEntry(item: ItemDefinition): string {
  const f: ItemFacts = describeItem(item);
  const note = itemNotes[item.id];

  const kindLine = f.tierLabel
    ? `${esc(f.kindLabel)} &middot; ${esc(f.tierLabel)}`
    : esc(f.kindLabel);

  const weaponLine = f.weaponLine
    ? `<p class="armory-item__weapon">${esc(f.weaponLine)}</p>`
    : '';

  const effectsLine =
    f.effects.length > 0
      ? `<p class="armory-item__effects">${esc(f.effects.join('  ·  '))}</p>`
      : '';

  const flavor = note
    ? `<p class="armory-item__flavor">${renderInline(note.flavor)}</p>`
    : '';
  const tactical = note
    ? `<p class="armory-item__tactical"><span class="armory-item__use">Use &mdash;</span> ${renderInline(note.tactical)}</p>`
    : '';

  return `
    <div class="armory-item">
      <p class="armory-item__head">
        <span class="armory-item__name">${esc(f.name)}</span>
        <span class="armory-item__kind">${kindLine}</span>
      </p>
      ${weaponLine}
      ${effectsLine}
      ${flavor}
      ${tactical}
    </div>`;
}

function section(sec: ArmorySection, index: number): string {
  // Hidden items are catalogued for the engine but withheld from
  // cadets — the armory shows only what may be requisitioned.
  const sectionItems = items().filter(
    (it) => it.availability === 'available' && sec.kinds.includes(it.kind),
  );
  // Within the section, sub-category sort if the section declares one.
  // Array.sort is stable, so items within a sub-category preserve their
  // catalog order.
  const sortKey = sec.sortKey;
  const orderedItems = sortKey
    ? sectionItems.slice().sort((a, b) => sortKey(a) - sortKey(b))
    : sectionItems;
  const breakClass = index > 0 ? ' armory-section--break' : '';
  return `
    <section class="armory-section${breakClass}" id="armory-${esc(sec.key)}">
      <h2 class="armory-section__title">${esc(sec.title)}</h2>
      <div class="armory-section__intro">${renderProse(sec.intro)}</div>
      <div class="armory-items">
        ${join(orderedItems.map(itemEntry))}
      </div>
    </section>`;
}

/**
 * Render the full Armory chapter — the three sections, flowing in
 * order. The chapter intro (`armoryIntro`) is no longer surfaced here:
 * it lives on the Armory half-title (`pages/layout.ts → armoryHalfTitle`),
 * which sits before this chapter and carries the Armorer's framing for
 * the section. The chapter container's id is dropped for the same reason
 * — the half-title now owns `#ch-armory`.
 */
export function armory(): string {
  return `
    <div class="armory">
      ${join(SECTIONS.map(section))}
    </div>`;
}
