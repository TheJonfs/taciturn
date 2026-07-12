// Gear valuation (S89 WI4b) — the M4 generator's item-choice floor.
//
// The contract is RELATIVE ordering within a slot: a caster takes the MA
// staff over the bigger-WP sword, a Knight takes the bigger sword, stat
// bodies and effect gear score positive, illegal gear scores 0. Absolute
// magnitudes are playtest dials.

import { describe, expect, it } from 'vitest';
import { classId } from '@engine/index.ts';
import { loadDefaultCatalog } from '../content/index.ts';
import { battleStaff } from '../content/items/battle-staff.ts';
import { longSword } from '../content/items/long-sword.ts';
import { ironSword } from '../content/items/iron-sword.ts';
import { ironMail } from '../content/items/iron-mail.ts';
import { capacitorRing } from '../content/items/capacitor-ring.ts';
import { bootsOfHaste } from '../content/items/boots-of-haste.ts';
import { spikedMail } from '../content/items/spiked-mail.ts';
import { scoreItemForUnit, rankItemsForUnit, type GearScoreProfile } from './gear-valuation.ts';

const cat = loadDefaultCatalog();

const MAGE: GearScoreProfile = { classId: classId('fire_mage'), pa: 4, ma: 9, usesMp: true };
const KNIGHT: GearScoreProfile = { classId: classId('knight'), pa: 9, ma: 4 };

describe('S89 WI4b — scoreItemForUnit ordering', () => {
  it('a caster takes the MA staff over the bigger-WP PA sword', () => {
    const staff = scoreItemForUnit(cat, battleStaff, MAGE);
    const sword = scoreItemForUnit(cat, longSword, MAGE);
    expect(staff).toBeGreaterThan(sword);
  });

  it('a Knight takes the bigger sword — and never the staff', () => {
    const long = scoreItemForUnit(cat, longSword, KNIGHT);
    const iron = scoreItemForUnit(cat, ironSword, KNIGHT);
    const staff = scoreItemForUnit(cat, battleStaff, KNIGHT);
    expect(long).toBeGreaterThan(iron);
    expect(long).toBeGreaterThan(staff);
  });

  it('stat bodies, resist accessories, and buff-grant boots all score positive', () => {
    expect(scoreItemForUnit(cat, ironMail, KNIGHT)).toBeGreaterThan(0); // +30 maxHP
    expect(scoreItemForUnit(cat, capacitorRing, KNIGHT)).toBeGreaterThan(0); // +100 lightning resist
    expect(scoreItemForUnit(cat, bootsOfHaste, KNIGHT)).toBeGreaterThan(0); // permanent Haste grant
  });

  it('class-illegal gear scores 0 (Spiked Mail on a Fire Mage)', () => {
    expect(scoreItemForUnit(cat, spikedMail, MAGE)).toBe(0);
  });
});

describe('S89 WI4b — rankItemsForUnit', () => {
  it('ranks a mixed weapon pool correctly per profile, deterministically', () => {
    const pool = [ironSword, battleStaff, longSword];
    const forMage = rankItemsForUnit(cat, pool, MAGE);
    const forKnight = rankItemsForUnit(cat, pool, KNIGHT);
    expect(forMage[0]!.id).toEqual(battleStaff.id);
    expect(forKnight[0]!.id).toEqual(longSword.id);
    expect(forKnight[1]!.id).toEqual(ironSword.id);
    // Determinism: same input, same order.
    expect(rankItemsForUnit(cat, pool, MAGE).map((i) => i.id)).toEqual(forMage.map((i) => i.id));
  });
});
