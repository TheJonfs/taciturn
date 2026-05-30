// Session 54 — Terraformer equipment access. The Terraformer equips the
// mage gear tier (mage armor + mage headgear + the three Books off-hands)
// plus all universal items. Mage-restricted items list it in
// `classRestrictions`; knight-only items don't.

import { describe, expect, it } from 'vitest';
import { classId } from '@engine/index.ts';
import { darkRobe } from './dark-robe.ts';
import { sorcerersRobe } from './sorcerers-robe.ts';
import { magusCrown } from './magus-crown.ts';
import { pointyHat } from './pointy-hat.ts';
import { tomeOfPower } from './tome-of-power.ts';
import { livreOfUrgency } from './livre-of-urgency.ts';
import { battleDictionary } from './battle-dictionary.ts';
import { warriorsAegis } from './warriors-aegis.ts';

const TERRAFORMER = classId('terraformer');

describe('Terraformer equipment access', () => {
  it('can equip mage armor (restriction lists Terraformer)', () => {
    expect(darkRobe.classRestrictions).toContain(TERRAFORMER);
    expect(sorcerersRobe.classRestrictions).toContain(TERRAFORMER);
  });

  it('can equip mage headgear', () => {
    expect(magusCrown.classRestrictions).toContain(TERRAFORMER);
    expect(pointyHat.classRestrictions).toContain(TERRAFORMER);
  });

  it('can equip the Books (mage off-hands) — Battle Dictionary’s +1 PA matters for Barrier HP', () => {
    expect(tomeOfPower.classRestrictions).toContain(TERRAFORMER);
    expect(livreOfUrgency.classRestrictions).toContain(TERRAFORMER);
    expect(battleDictionary.classRestrictions).toContain(TERRAFORMER);
  });

  it('cannot equip Knight-only gear', () => {
    expect(warriorsAegis.classRestrictions).not.toContain(TERRAFORMER);
  });
});
