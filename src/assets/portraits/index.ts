// Portrait asset URL map per class id and gender. Vite resolves the `?url`
// suffix to the final hashed asset URL at build time; consumers (renderer for
// canvas via Pixi `Assets.load`, React for HTML `<img src>`) read the same URL.
//
// Session 55: each class now ships two portraits — a male and a female variant
// (gender-flipped art). `Unit.gender` selects which renders; when a consumer
// has no gender (or a unit hasn't been assigned one), we fall back to the
// class's *default* gender — the gender of the original pre-S55 portrait — so
// existing teams/fixtures render exactly as before.
//
// Per session 24.5: portraits are square 512×512 PNGs. Pixi downscales for the
// map token (~32px); React `<img>` with CSS sizing handles the larger variants.
//
// Falls back to the colored-circle render when a class id has no entry.

import alchemistFemale from './alchemist-female.png';
import alchemistMale from './alchemist-male.png';
import assassinFemale from './assassin-female.png';
import assassinMale from './assassin-male.png';
import calculatorFemale from './calculator-female.png';
import calculatorMale from './calculator-male.png';
import earthMageFemale from './earth-mage-female.png';
import earthMageMale from './earth-mage-male.png';
import enchantressFemale from './enchantress-female.png';
import enchantressMale from './enchantress-male.png';
import fireMageFemale from './fire-mage-female.png';
import fireMageMale from './fire-mage-male.png';
import hunterFemale from './hunter-female.png';
import hunterMale from './hunter-male.png';
import knightFemale from './knight-female.png';
import knightMale from './knight-male.png';
import lightningMageFemale from './lightning-mage-female.png';
import lightningMageMale from './lightning-mage-male.png';
import monkFemale from './monk-female.png';
import monkMale from './monk-male.png';
import templarFemale from './templar-female.png';
import templarMale from './templar-male.png';
import thiefFemale from './thief-female.png';
import thiefMale from './thief-male.png';
import terraformerFemale from './terraformer-female.png';
import terraformerMale from './terraformer-male.png';
import waterMageFemale from './water-mage-female.png';
import waterMageMale from './water-mage-male.png';
import { classId, type ClassId, type Gender } from '@engine/index.ts';
// TABA chapter-1 plot-unique portraits — one bespoke face per character (512×512,
// top-anchored crop), keyed by the durable unit id (= portrait key = filename).
import plotLumen from './plot-lumen.png';
import plotChris from './plot-chris.png';
import plotClio from './plot-clio.png';
import plotThessaly from './plot-thessaly.png';
import plotSera from './plot-sera.png';

interface PortraitPair {
  readonly male: string;
  readonly female: string;
  // The gender of the original (pre-S55) portrait — used as the fallback when
  // a consumer doesn't supply a gender, so untouched units render unchanged.
  readonly defaultGender: Gender;
}

const PORTRAITS: ReadonlyMap<ClassId, PortraitPair> = new Map([
  [classId('alchemist'), { male: alchemistMale, female: alchemistFemale, defaultGender: 'female' }],
  [classId('assassin'), { male: assassinMale, female: assassinFemale, defaultGender: 'female' }],
  [classId('calculator'), { male: calculatorMale, female: calculatorFemale, defaultGender: 'female' }],
  [classId('earth_mage'), { male: earthMageMale, female: earthMageFemale, defaultGender: 'male' }],
  [classId('enchanter'), { male: enchantressMale, female: enchantressFemale, defaultGender: 'female' }],
  [classId('fire_mage'), { male: fireMageMale, female: fireMageFemale, defaultGender: 'female' }],
  [classId('hunter'), { male: hunterMale, female: hunterFemale, defaultGender: 'male' }],
  [classId('knight'), { male: knightMale, female: knightFemale, defaultGender: 'male' }],
  [classId('lightning_mage'), { male: lightningMageMale, female: lightningMageFemale, defaultGender: 'male' }],
  [classId('monk'), { male: monkMale, female: monkFemale, defaultGender: 'male' }],
  [classId('templar'), { male: templarMale, female: templarFemale, defaultGender: 'male' }],
  [classId('thief'), { male: thiefMale, female: thiefFemale, defaultGender: 'female' }],
  [classId('terraformer'), { male: terraformerMale, female: terraformerFemale, defaultGender: 'male' }],
  [classId('water_mage'), { male: waterMageMale, female: waterMageFemale, defaultGender: 'female' }],
]);

// Portrait URL for a class + (optional) gender. When `gender` is omitted, uses
// the class's default-gender portrait (the original art). Returns `null` when
// the class has no portrait registered (renderer falls back to colored circle).
export function portraitUrlFor(id: ClassId, gender?: Gender): string | null {
  const pair = PORTRAITS.get(id);
  if (pair === undefined) return null;
  const g = gender ?? pair.defaultGender;
  return g === 'male' ? pair.male : pair.female;
}

// The canonical default gender for a class (the gender of its original
// portrait). The team builder seeds a new/loaded unit's gender from this so the
// portrait toggle starts on the class's canonical side. Null for classes with
// no registered portrait.
export function defaultGenderFor(id: ClassId): Gender | null {
  return PORTRAITS.get(id)?.defaultGender ?? null;
}

// --- Portrait REFERENCE + resolution (the override seam) ---------------------
//
// `portraitUrlFor` above is the pure CLASS-DERIVED primitive. A `PortraitRef`
// is the layer over it: "which portrait", expressed as a first-class value so a
// consumer can name a portrait that is NOT derived from a unit's current class.
// Two variants:
//   - `class` — derive from a class (+ optional gender). Today's behavior, and
//     what generic units use. Also serves as a "pin": an authored ref that
//     always shows, say, the Templar face even after the unit reclasses.
//   - `fixed` — a plot character's ENDURING portrait, a stable key independent
//     of class/gender. The key space + backing art are FUTURE (M5 plot
//     characters); the seam exists now so content references a portrait, not a
//     class, and the override lands in ONE resolver rather than an N-site edit.
//
// The intended durable home of an override is `CampaignUnit.portrait?` (added
// when the first plot character lands), threaded to the engine `Unit` alongside
// `gender` — the exact cosmetic-field-the-engine-carries-but-never-acts-on
// precedent (S55). Until then, only authored content (story-scene dialogue)
// carries a ref, and only this resolver + the `fixed` registry grow.

// A stable key for a bespoke/plot portrait. Plain string for now (no entries
// yet); a branded id can replace it when the fixed registry is populated.
export type PortraitKey = string;

export type PortraitRef =
  | { readonly kind: 'class'; readonly classId: ClassId; readonly gender?: Gender }
  | { readonly kind: 'fixed'; readonly key: PortraitKey };

// Bespoke/plot portraits by stable key (= the durable `plot-*` unit id). An
// unknown key resolves to `null` (colored-circle fallback), same as an
// unregistered class. TABA chapter-1 registered the five plot leads; more land
// as M5 plot characters get art.
const FIXED_PORTRAITS: ReadonlyMap<PortraitKey, string> = new Map([
  ['plot-lumen', plotLumen],
  ['plot-chris', plotChris],
  ['plot-clio', plotClio],
  ['plot-thessaly', plotThessaly],
  ['plot-sera', plotSera],
]);

// Resolve a portrait ref to a URL (or `null` → colored-circle fallback). The
// single override-aware entry point: when durable `portrait` overrides exist,
// consumers resolve `unit.portrait ?? { kind: 'class', classId, gender }`
// through here, so an enduring face wins over class derivation in one place.
export function resolvePortraitUrl(ref: PortraitRef): string | null {
  switch (ref.kind) {
    case 'class':
      return portraitUrlFor(ref.classId, ref.gender);
    case 'fixed':
      return FIXED_PORTRAITS.get(ref.key) ?? null;
  }
}

// TABA (ADR-0136 completion) — the durable-override resolver used by unit
// render sites. Given a unit's optional enduring `portrait` KEY plus its class +
// gender, return the bespoke plot face if the key is registered, else the
// class+gender portrait. PLACEHOLDER-TOLERANT: an absent or not-yet-registered
// key falls through to the class portrait, so plot units render sensibly before
// their art lands. This is the one function the ~7 `portraitUrlFor` call sites
// migrate to as they become override-aware.
export function resolveUnitPortrait(
  portraitKey: string | undefined,
  classId: ClassId,
  gender?: Gender,
): string | null {
  if (portraitKey !== undefined) {
    const bespoke = FIXED_PORTRAITS.get(portraitKey);
    if (bespoke !== undefined) return bespoke;
  }
  return portraitUrlFor(classId, gender);
}
