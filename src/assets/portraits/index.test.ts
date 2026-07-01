// Session 55: portrait map now keys on class + gender (each class ships a male
// and a female variant). These pin the resolution rules: every class resolves
// both genders to distinct URLs, and an omitted gender falls back to the
// class's default (so pre-S55 callers / untouched units render unchanged).

import { describe, expect, it } from 'vitest';
import { classId, type ClassId } from '@engine/index.ts';
import { portraitUrlFor, defaultGenderFor, resolvePortraitUrl } from './index.ts';

const CLASSES: ReadonlyArray<ClassId> = [
  'alchemist', 'assassin', 'calculator', 'earth_mage', 'enchanter', 'fire_mage',
  'hunter', 'knight', 'lightning_mage', 'templar', 'terraformer', 'thief', 'water_mage',
].map(classId);

describe('portraitUrlFor — class + gender resolution', () => {
  it('resolves a distinct male and female portrait for every class', () => {
    for (const c of CLASSES) {
      const male = portraitUrlFor(c, 'male');
      const female = portraitUrlFor(c, 'female');
      expect(male, `${String(c)} male`).not.toBeNull();
      expect(female, `${String(c)} female`).not.toBeNull();
      expect(male, `${String(c)} variants differ`).not.toBe(female);
    }
  });

  it('falls back to the class default portrait when gender is omitted', () => {
    for (const c of CLASSES) {
      const def = defaultGenderFor(c);
      expect(def, `${String(c)} has a default gender`).not.toBeNull();
      expect(portraitUrlFor(c)).toBe(portraitUrlFor(c, def!));
    }
  });

  it('returns null for an unregistered class', () => {
    expect(portraitUrlFor(classId('nonexistent_class'))).toBeNull();
    expect(defaultGenderFor(classId('nonexistent_class'))).toBeNull();
  });

  it('matches the authored default-gender mapping (existing portraits unchanged)', () => {
    // The original (pre-S55) portrait gender per class — the fallback target.
    expect(defaultGenderFor(classId('knight'))).toBe('male');
    expect(defaultGenderFor(classId('earth_mage'))).toBe('male');
    expect(defaultGenderFor(classId('lightning_mage'))).toBe('male');
    expect(defaultGenderFor(classId('hunter'))).toBe('male');
    expect(defaultGenderFor(classId('templar'))).toBe('male');
    expect(defaultGenderFor(classId('terraformer'))).toBe('male');
    expect(defaultGenderFor(classId('alchemist'))).toBe('female');
    expect(defaultGenderFor(classId('assassin'))).toBe('female');
    expect(defaultGenderFor(classId('calculator'))).toBe('female');
    expect(defaultGenderFor(classId('enchanter'))).toBe('female');
    expect(defaultGenderFor(classId('fire_mage'))).toBe('female');
    expect(defaultGenderFor(classId('water_mage'))).toBe('female');
    expect(defaultGenderFor(classId('thief'))).toBe('female');
  });
});

describe('resolvePortraitUrl — the override seam', () => {
  it('a class ref resolves to the same URL as the class-derived primitive', () => {
    expect(resolvePortraitUrl({ kind: 'class', classId: classId('templar'), gender: 'male' })).toBe(
      portraitUrlFor(classId('templar'), 'male'),
    );
    // Omitted gender falls back to the class default, same as the primitive.
    expect(resolvePortraitUrl({ kind: 'class', classId: classId('knight') })).toBe(
      portraitUrlFor(classId('knight')),
    );
  });

  it('a fixed ref resolves to null until plot portraits are registered (M5)', () => {
    // The seam exists; the fixed registry is empty, so any key → colored-circle
    // fallback (null), not a crash.
    expect(resolvePortraitUrl({ kind: 'fixed', key: 'ramza' })).toBeNull();
  });
});
