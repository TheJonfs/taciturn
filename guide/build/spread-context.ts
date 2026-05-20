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
  | 'earth'
  | 'water'
  | 'fire'
  | 'lightning';

interface ClassMeta {
  readonly element: ElementId;
  readonly portraitUrl: string;
}

// Per-class build metadata: which accent palette, which portrait. The
// Knight's "element" is its institutional self — oxblood, steel band.
// The Alchemist's is amber / copper — apothecary brass; the Assassin's
// is gunmetal / charcoal — moonlit steel, distinct from both the
// Knight's oxblood and the elemental wheel's four hues.
const CLASS_META: Record<string, ClassMeta> = {
  knight: { element: 'knight', portraitUrl: knightPortraitUrl },
  alchemist: { element: 'alchemist', portraitUrl: alchemistPortraitUrl },
  assassin: { element: 'assassin', portraitUrl: assassinPortraitUrl },
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
 * The seven classes, in handbook order: the three non-caster
 * disciplines first — the Knight (the armoured anchor), the Alchemist
 * (field support, sharing much of the Knight's gear), and the Assassin
 * (the Speed-defined skirmisher) — then the elemental wheel of four
 * Mages.
 */
export const SPREAD_ORDER: ReadonlyArray<ClassId> = [
  classId('knight'),
  classId('alchemist'),
  classId('assassin'),
  classId('earth_mage'),
  classId('water_mage'),
  classId('fire_mage'),
  classId('lightning_mage'),
];
