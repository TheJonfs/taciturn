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
import { armoryIntro, sectionIntros, itemNotes } from '../content/items/index.ts';
import type { ItemDefinition } from '@engine/index.ts';
import { esc, join } from './html.ts';

interface ArmorySection {
  readonly key: string;
  readonly title: string;
  readonly intro: string;
  readonly kinds: ReadonlyArray<ItemDefinition['kind']>;
}

const SECTIONS: ReadonlyArray<ArmorySection> = [
  {
    key: 'weapons',
    title: 'The Weapon Racks',
    intro: sectionIntros.weapons ?? '',
    kinds: ['weapon', 'shield'],
  },
  {
    key: 'armour',
    title: 'The Armour Stores',
    intro: sectionIntros.armour ?? '',
    kinds: ['armor', 'headgear'],
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

  const kindLine = f.restriction
    ? `${esc(f.kindLabel)} &middot; ${esc(f.restriction)}`
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
  const breakClass = index > 0 ? ' armory-section--break' : '';
  return `
    <section class="armory-section${breakClass}" id="armory-${esc(sec.key)}">
      <h2 class="armory-section__title">${esc(sec.title)}</h2>
      <div class="armory-section__intro">${renderProse(sec.intro)}</div>
      <div class="armory-items">
        ${join(sectionItems.map(itemEntry))}
      </div>
    </section>`;
}

/** Render the full Armory chapter — masthead, then the three sections. */
export function armory(): string {
  return `
    <div class="armory" id="ch-armory">
      <header class="armory__masthead">
        <h1 class="armory__title">The Armory</h1>
        <div class="armory__intro">${renderProse(armoryIntro)}</div>
      </header>
      ${join(SECTIONS.map(section))}
    </div>`;
}
