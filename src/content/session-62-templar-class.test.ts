// Session 62 — Templar class assembly. Wires the (already-built and tested)
// abilities, weapons, and innates into a registered, playable class: the
// stat block, the Templar Arts command set (Cure / Raise / Jump), the four
// innates as free abilities, and Knight head/body gear permission.

import { describe, expect, it } from 'vitest';
import { abilityId, classId, commandSetId } from '@engine/index.ts';
import { loadDefaultCatalog } from './index.ts';
import { templar } from './classes/templar.ts';
import { templarArts } from './command-sets/templar-arts.ts';
import { classBaselineStats } from './classes/baseline-stats.ts';
import { cure } from './abilities/cure.ts';
import { raise } from './abilities/raise.ts';
import { jump } from './abilities/jump.ts';
import { crusadersHelm } from './items/crusaders-helm.ts';
import { steelHelm } from './items/steel-helm.ts';
import { tacticalMask } from './items/tactical-mask.ts';
import { soldiersLeathers } from './items/soldiers-leathers.ts';
import { spikedMail } from './items/spiked-mail.ts';
import { warPlate } from './items/war-plate.ts';
import { escutcheon } from './items/escutcheon.ts';

const TEMPLAR = classId('templar');

describe('Templar class — registration + stat line', () => {
  const cat = loadDefaultCatalog();

  it('is registered in the default catalog', () => {
    expect(cat.hasClass(TEMPLAR)).toBe(true);
    expect(cat.getClass(TEMPLAR).name).toBe('Templar');
  });

  it('has the spec stat block (HP 132 / MP 36 / PA 6 / MA 6 / Speed 8), dominant MA', () => {
    expect(classBaselineStats.get(TEMPLAR)).toEqual({
      maxHpBase: 132,
      maxMpBase: 36,
      pa: 6,
      ma: 6,
      spd: 8,
    });
    expect(templar.dominantStat).toBe('ma');
  });

  it('has Move 2 / Jump 3 and evasion 10 / 6 / 2', () => {
    expect(templar.movement.moveRange).toBe(2);
    expect(templar.movement.jump).toBe(3);
    expect(templar.evasion).toEqual({ front: 10, side: 6, back: 2 });
  });
});

describe('Templar class — command set + innates', () => {
  it('first action is Templar Arts (Cure / Raise / Jump)', () => {
    expect(templar.firstActionCommandSet).toBe(commandSetId('templar_arts'));
    expect(templarArts.members).toEqual([
      abilityId('cure'),
      abilityId('raise'),
      abilityId('jump'),
    ]);
    expect(templarArts.availability).toBe('available');
  });

  it('grants Attack + the four innates free', () => {
    for (const id of ['attack', 'emissary', 'monkeygrip', 'unified_calling', 'faithstrider']) {
      expect(templar.freeAbilities.has(abilityId(id))).toBe(true);
    }
  });

  it('surfaces Cure / Raise / Jump (availability flipped to available)', () => {
    expect(cure.availability).toBe('available');
    expect(raise.availability).toBe('available');
    expect(jump.availability).toBe('available');
  });
});

describe('Templar class — gear permission', () => {
  it('may wear the six Knight head/body pieces (and Knight still can)', () => {
    for (const item of [crusadersHelm, steelHelm, tacticalMask, soldiersLeathers, spikedMail, warPlate]) {
      expect(item.classRestrictions).toContain(TEMPLAR);
      expect(item.classRestrictions).toContain(classId('knight'));
    }
  });

  it('does NOT gain Knight shields (head/body only — shields stay Knight-only)', () => {
    expect(escutcheon.classRestrictions ?? []).not.toContain(TEMPLAR);
  });
});
