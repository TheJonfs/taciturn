// Composer — assembles the handbook document.
//
// Phase 7: the document is now front-to-back: title page, table of
// contents, welcome letter, Foundations, the five Specialization
// spreads, the Armory, colophon. A single chapter can be previewed in
// dev with ?class=… or ?section=…

import { classId } from '@engine/index.ts';
import {
  titlePage,
  tableOfContents,
  colophon,
  specializationsHalfTitle,
  armoryHalfTitle,
  trainingFieldsHalfTitle,
} from '../pages/layout.ts';
import { spreadContextFor, SPREAD_ORDER } from './spread-context.ts';
import { variantE } from '../pages/variant-e.ts';
import { welcome } from '../pages/welcome.ts';
import { foundations } from '../pages/foundations.ts';
import { armory } from '../pages/armory.ts';
import { trainingField } from '../pages/training-field.ts';

const KNOWN_CLASSES = new Set(SPREAD_ORDER.map((id) => String(id)));

/** True when `value` is a class the handbook has a spread for. */
export function isKnownClass(value: string): boolean {
  return KNOWN_CLASSES.has(value);
}

/** Render a single class's Specialization spread (dev preview, ?class=). */
export function composeClassSpread(classKey: string): string {
  return variantE(spreadContextFor(classId(classKey)));
}

/** A chapter that can be previewed on its own via ?section=. */
export type SectionKey =
  | 'welcome'
  | 'foundations'
  | 'armory'
  | 'training'
  | 'toc'
  | 'colophon';

const SECTIONS: Record<SectionKey, () => string> = {
  welcome,
  foundations,
  armory,
  training: trainingField,
  toc: tableOfContents,
  colophon,
};

export function isSectionKey(value: string): value is SectionKey {
  return value in SECTIONS;
}

/** Render one chapter on its own (dev preview, ?section=). */
export function composeSection(key: SectionKey): string {
  return SECTIONS[key]();
}

/** Render the full handbook in reading order, front matter to back. */
export function composeHandbook(): string {
  const spreads = SPREAD_ORDER.map((id) => variantE(spreadContextFor(id)));
  return [
    titlePage(),
    tableOfContents(),
    welcome(),
    foundations(),
    // Half-title before the spreads, so each spread aligns to a
    // verso/recto facing pair in two-page view.
    specializationsHalfTitle(),
    ...spreads,
    armoryHalfTitle(),
    armory(),
    trainingFieldsHalfTitle(),
    trainingField(),
    colophon(),
  ].join('\n');
}
