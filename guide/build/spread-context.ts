// Spread context — the resolved data bundle every spread receives.
// Built from the catalog + the instructor's prose for any class.
// Generalised in Phase 4: the Knight and the four Mages all flow
// through `spreadContextFor`.

import { classId, type ClassDefinition, type ClassId } from '@engine/index.ts';
import type { ClassBaselineStats } from '@content/classes/baseline-stats.ts';
import {
  baselineStats,
  classAbilities,
  classById,
  type ClassAbilities,
} from './data.ts';
import { describeAbility, type AbilityFacts } from './ability-format.ts';
import { classProse } from '../content/classes/index.ts';
import type { ClassProse } from '../content/prose.ts';
import academySealSvg from '../art/academy-seal.svg?raw';
import knightPortraitUrl from '../art/knight_1.png';
import alchemistPortraitUrl from '../art/alchemist_1.png';
import assassinPortraitUrl from '../art/assassin_1.png';
import calculatorPortraitUrl from '../art/calculator_1.png';
import hunterPortraitUrl from '../art/hunter_1.png';
import earthMagePortraitUrl from '../art/earth_mage_1.png';
import waterMagePortraitUrl from '../art/water_mage_1.png';
import fireMagePortraitUrl from '../art/fire_mage_1.png';
import lightningMagePortraitUrl from '../art/lightning_mage_1.png';

// Prefer a provided raster seal (art/seal.png) over the inline SVG.
// import.meta.glob resolves to {} when the file is absent.
const sealPngMatches = import.meta.glob('../art/seal.png', {
  eager: true,
  query: '?url',
  import: 'default',
});
const sealPngUrl = Object.values(sealPngMatches)[0] as string | undefined;

/** Element identity — drives the per-element accent palette. */
export type ElementId =
  | 'knight'
  | 'alchemist'
  | 'assassin'
  | 'calculator'
  | 'hunter'
  | 'earth'
  | 'water'
  | 'fire'
  | 'lightning';

interface ClassMeta {
  readonly element: ElementId;
  readonly portraitUrl: string;
}

// Per-class build metadata: which accent palette, which portrait. The
// Knight's "element" is institutional — oxblood, steel band. The
// Alchemist's is brass / copper; the Assassin's is gunmetal / charcoal;
// the Hunter's is deep emerald / forest — distinct from Earth Mage's
// brighter olive-green by its bluer, darker cast. The Calculator's
// palette is parchment-ink (cool indigo over warm vellum) — a scholar's
// kit, distinct from the elemental hues. The elemental wheel's four
// hues finish the set.
const CLASS_META: Record<string, ClassMeta> = {
  knight: { element: 'knight', portraitUrl: knightPortraitUrl },
  alchemist: { element: 'alchemist', portraitUrl: alchemistPortraitUrl },
  assassin: { element: 'assassin', portraitUrl: assassinPortraitUrl },
  calculator: { element: 'calculator', portraitUrl: calculatorPortraitUrl },
  hunter: { element: 'hunter', portraitUrl: hunterPortraitUrl },
  earth_mage: { element: 'earth', portraitUrl: earthMagePortraitUrl },
  water_mage: { element: 'water', portraitUrl: waterMagePortraitUrl },
  fire_mage: { element: 'fire', portraitUrl: fireMagePortraitUrl },
  lightning_mage: { element: 'lightning', portraitUrl: lightningMagePortraitUrl },
};

/** Everything a variant template needs to render one class spread. */
export interface SpreadContext {
  readonly cls: ClassDefinition;
  readonly element: ElementId;
  readonly stats: ClassBaselineStats;
  readonly abilities: ClassAbilities;
  /** Ability id → display-ready mechanical facts. */
  readonly facts: ReadonlyMap<string, AbilityFacts>;
  readonly prose: ClassProse;
  /** Resolved URL of the class portrait, for <img src>. */
  readonly portraitUrl: string;
  /** Resolved URL of art/seal.png, if it exists; otherwise undefined. */
  readonly sealPngUrl: string | undefined;
  /** Inline SVG markup of the Academy seal — the fallback, inherits currentColor. */
  readonly sealSvg: string;
}

/** Build the spread context for any class. */
export function spreadContextFor(id: ClassId): SpreadContext {
  const cls = classById(id);

  const meta = CLASS_META[cls.id];
  if (!meta) {
    throw new Error(`No spread metadata (portrait / element) for class "${cls.id}".`);
  }
  const prose = classProse[cls.id];
  if (!prose) {
    throw new Error(`No instructor's prose registered for class "${cls.id}".`);
  }

  const abilities = classAbilities(cls);
  const facts = new Map<string, AbilityFacts>();
  for (const ability of [...abilities.actives, ...abilities.passives]) {
    facts.set(ability.id, describeAbility(ability));
  }

  return {
    cls,
    element: meta.element,
    stats: baselineStats(cls.id),
    abilities,
    facts,
    prose,
    portraitUrl: meta.portraitUrl,
    sealPngUrl,
    sealSvg: academySealSvg,
  };
}

/**
 * The nine classes, in handbook order — alphabetical by display name.
 * The order is intentionally not grouped by physical/magical or by
 * pedagogical sequence; a reader looking for a discipline finds it by
 * name and the alphabet, and any in-spread cross-references mention the
 * other class by name rather than relying on adjacency.
 *
 * Display-name → class id mapping (display order):
 *   Aethurge       → lightning_mage
 *   Alchemist      → alchemist
 *   Assassin       → assassin
 *   Calculator     → calculator
 *   Geosage        → earth_mage
 *   Hunter         → hunter
 *   Hydrologist    → water_mage
 *   Knight         → knight
 *   Pyromancer     → fire_mage
 */
export const SPREAD_ORDER: ReadonlyArray<ClassId> = [
  classId('lightning_mage'), // Aethurge
  classId('alchemist'),
  classId('assassin'),
  classId('calculator'),
  classId('earth_mage'),     // Geosage
  classId('hunter'),
  classId('water_mage'),     // Hydrologist
  classId('knight'),
  classId('fire_mage'),      // Pyromancer
];
