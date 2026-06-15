// Cross-check: every class's engine-side `ClassDefinition.defaultGender`
// matches the UI portrait module's `defaultGender`. Gender became *mechanical*
// when the Thief's Steal Heart started gender-gating (Male ↔ Female), so the
// engine carries its own copy of each class's default. This test pins the two
// sources together so a portrait default can never silently diverge from the
// gender the Steal Heart gate actually judges.

import { describe, expect, it } from 'vitest';
import { loadDefaultCatalog } from '../../content/index.ts';
import { defaultGenderFor } from './index.ts';

describe('class defaultGender — engine catalog ↔ portrait module sync', () => {
  it('ClassDefinition.defaultGender matches the portrait module for every class', () => {
    const cat = loadDefaultCatalog();
    for (const cls of cat.classes()) {
      // Both sources must define it (real classes always do) and agree.
      expect(cls.defaultGender, `${String(cls.id)} defines defaultGender`).toBeDefined();
      expect(cls.defaultGender, `${String(cls.id)} matches portrait module`).toBe(
        defaultGenderFor(cls.id),
      );
    }
  });
});
