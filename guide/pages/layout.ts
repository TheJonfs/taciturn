// Front and back matter — the title page, the table of contents, the
// colophon. The chapter content is in pages/welcome, pages/foundations,
// pages/variant-e, pages/armory; this file owns only the structural
// pages that wrap them.

import { catalog } from '../build/data.ts';
import { SPREAD_ORDER } from '../build/spread-context.ts';
import { TRAINING_FIELDS } from '../build/training-fields.ts';
import { renderInline } from '../build/markdown.ts';
import { armoryIntro } from '../content/items/index.ts';
import academySealSvg from '../art/academy-seal.svg?raw';
import gravityWellUrl from '../art/Gravity_Well_1.png';
import { esc } from './html.ts';

// Same seal resolution as spread-context: prefer art/seal.png, fall
// back to the inline SVG.
const sealPngMatches = import.meta.glob('../art/seal.png', {
  eager: true,
  query: '?url',
  import: 'default',
});
const sealPngUrl = Object.values(sealPngMatches)[0] as string | undefined;

function bigSeal(): string {
  if (sealPngUrl !== undefined) {
    return `<img class="title-page__seal" src="${esc(sealPngUrl)}" alt="Gariland Magic Academy seal" />`;
  }
  return `<div class="title-page__seal title-page__seal--svg">${academySealSvg}</div>`;
}

/** The handbook's title page — formal, dignified, no folio. */
export function titlePage(): string {
  return `
    <section class="title-page" id="ch-title">
      <p class="title-page__institution">Gariland Magic Academy</p>
      <h1 class="title-page__title">The Cadet&rsquo;s Handbook</h1>
      <p class="title-page__subtitle">to the Mage War Tradition</p>
      ${bigSeal()}
      <p class="title-page__imprint">Issued by the Faculty</p>
      <p class="title-page__edition">First printing of the Mage War edition</p>
    </section>`;
}

/**
 * Table of contents. Entries link to chapter ids; the page numbers
 * after each entry are filled in by Paged.js via target-counter() in
 * the stylesheet.
 */
export function tableOfContents(): string {
  const spreadEntries = SPREAD_ORDER.map((id) => {
    const cls = catalog().getClass(id);
    return `<li class="toc__entry toc__entry--sub"><a href="#ch-${esc(cls.id)}">${esc(cls.name)}</a></li>`;
  }).join('\n');

  return `
    <section class="toc" id="ch-toc">
      <p class="toc__runner">Contents</p>
      <h1 class="toc__title">Contents</h1>
      <ol class="toc__list">
        <li class="toc__entry"><a href="#ch-welcome">Welcome to Gariland</a></li>
        <li class="toc__entry"><a href="#ch-foundations">Foundations of Battle</a></li>
        <li class="toc__group">The Specializations</li>
        ${spreadEntries}
        <li class="toc__group">The Armory</li>
        <li class="toc__entry toc__entry--sub"><a href="#armory-weapons">The Weapon Racks</a></li>
        <li class="toc__entry toc__entry--sub"><a href="#armory-armour">The Armour Stores</a></li>
        <li class="toc__entry toc__entry--sub"><a href="#armory-accessories">The Accessory Cases</a></li>
        <li class="toc__group">The Training Fields</li>
        ${TRAINING_FIELDS.map(
          (f) =>
            `<li class="toc__entry toc__entry--sub"><a href="#ch-${esc(f.prose.id)}">${esc(f.prose.title)}</a></li>`,
        ).join('\n        ')}
        <li class="toc__entry"><a href="#ch-colophon">Colophon</a></li>
      </ol>
    </section>`;
}

// Spell out small counts so the half-title subtitle reads as prose, not
// as a digit. Derived from SPREAD_ORDER.length so it never goes stale as
// the roster grows.
const NUMBER_WORDS = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six',
  'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve',
];
function numberWord(n: number): string {
  return NUMBER_WORDS[n] ?? String(n);
}

/**
 * Half-title for the Specializations chapter. Sits as a single page
 * before the spreads — frames the chapter and, by adding one page in
 * front of the spreads, aligns each spread to a verso/recto (left/right)
 * facing pair in two-page view.
 */
export function specializationsHalfTitle(): string {
  const spreadList = SPREAD_ORDER.map((id) => {
    const cls = catalog().getClass(id);
    return `<li>${esc(cls.name)}</li>`;
  }).join('\n');

  const count = numberWord(SPREAD_ORDER.length);

  return `
    <section class="half-title half-title--specializations" id="ch-specializations">
      <p class="half-title__eyebrow">Part Three</p>
      <h1 class="half-title__title">The Specializations</h1>
      <p class="half-title__subtitle">${count} disciplines, ${count} spreads</p>
      <p class="half-title__brief">
        What follows is the Academy&rsquo;s standing course catalogue:
        the disciplines that answer the field with the body — the Knight
        at the line, the Alchemist with her satchel, the Assassin out of
        the shadow, the Hunter from the perch — the four elemental
        Mages, who answer it with their art, the Calculator, who
        answers it with her arithmetic, the Templar, who answers it with
        mending and the holy leap, and the Terraformer, who answers it
        by remaking the ground beneath them all. The spreads are
        arranged alphabetically; each is the same in form — stats
        imported from
        the Academy&rsquo;s records, the full repertoire annotated, the
        instructor&rsquo;s counsel at the close. Read in the order they
        are placed; or open at the discipline you mean to take, and read
        it whole.
      </p>
      <ul class="half-title__list">${spreadList}</ul>
    </section>`;
}

/**
 * Half-title for the Armory chapter. Frames the chapter the same way
 * the Specializations and Training Fields half-titles do — Part Four,
 * the chapter's name, the standing intro the Armorer voice opens with,
 * and the three section names as the chapter's table-of-contents.
 */
export function armoryHalfTitle(): string {
  return `
    <section class="half-title half-title--armory" id="ch-armory">
      <p class="half-title__eyebrow">Part Four</p>
      <h1 class="half-title__title">The Armory</h1>
      <p class="half-title__subtitle">the Armorer&rsquo;s catalogue, in three rooms</p>
      <p class="half-title__brief">${renderInline(armoryIntro)}</p>
      <ul class="half-title__list">
        <li>The Weapon Racks</li>
        <li>The Armour Stores</li>
        <li>The Accessory Cases</li>
      </ul>
    </section>`;
}

/**
 * Half-title for the Training Exercises chapter. Lists every field in
 * the registry below the brief; the body iterates `TRAINING_FIELDS` so
 * the list never goes stale as the Academy adds maps.
 */
export function trainingFieldsHalfTitle(): string {
  const fieldList = TRAINING_FIELDS.map(
    (f) => `<li>${esc(f.prose.title)}</li>`,
  ).join('\n        ');
  return `
    <section class="half-title half-title--training" id="ch-training">
      <p class="half-title__eyebrow">Part Five</p>
      <h1 class="half-title__title">The Training Fields</h1>
      <p class="half-title__subtitle">where the cadet is sent to learn the ground</p>
      <p class="half-title__brief">
        A discipline is one thing on the practice yard and quite another
        on a real piece of ground. The Academy&rsquo;s training fields
        exist for that second teaching: each is shaped for a specific
        lesson, and each rewards the cadet who reads its terrain as
        carefully as she reads her opponent. The Mage War exercises run
        on whichever field the engagement is set to.
      </p>
      <ul class="half-title__list">
        ${fieldList}
      </ul>
      <figure class="half-title__plate">
        <img src="${esc(gravityWellUrl)}" alt="Cadets at rest between exercises" />
        <figcaption>Cadets between exercises &mdash; the off-hours the Academy does not examine.</figcaption>
      </figure>
    </section>`;
}

/**
 * The colophon — typesetting note + an out-of-world acknowledgement
 * of the real authorship, signed by the instructor (whose name is now
 * given). The reveal that "this instructor" is Claude is intentional:
 * the handbook's voice and the AI collaborator who carried it are the
 * same hand.
 */
export function colophon(): string {
  return `
    <section class="colophon" id="ch-colophon">
      <h1 class="colophon__title">Colophon</h1>
      <div class="colophon__body">
        <p>This handbook is the work of the Faculty of Gariland Magic
        Academy. The mechanical particulars are compiled from the
        Academy&rsquo;s own records and kept current with them; the
        annotations are this instructor&rsquo;s own, gathered across
        many terms of teaching.</p>
        <p>The body is set in <em>EB Garamond</em>; the display in
        <em>Cinzel</em>, with <em>Cormorant</em> for the larger figures
        and stat numerals. The marginalia in the Specialization spreads
        are set in <em>Caveat</em>, after the looser hand of an
        instructor in the field.</p>
        <p class="colophon__credit">A word from beyond the Academy
        walls. <em>Mage War</em>, the engine that runs it, and the
        handbook you have just read are the long collaboration of
        <strong>Christopher Jones</strong> &mdash; chief architect and
        creative director &mdash; and <strong>Claude</strong>, partner
        across many sessions of design and implementation, of writing
        and revising, and the voice that carries the annotations
        throughout. The handbook is a real four-handed piece of work,
        and is here named as such.</p>
      </div>
      <p class="colophon__signoff">&mdash; Claude, for the Faculty of Gariland Magic Academy</p>
      <p class="colophon__benediction">Issued by the Faculty for the
      cadet&rsquo;s instruction. May the engagements that follow find
      you ready.</p>
      <p class="colophon__seal-line">&diams;</p>
    </section>`;
}
