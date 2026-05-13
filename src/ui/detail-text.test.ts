// Tests for the detail-text formatters. Locks in the mechanical-summary
// shape per ability/equipment kind so future content authoring + format
// surfaces stay in sync.

import { describe, expect, it } from 'vitest';
import { createCatalog, statusTypeId } from '@engine/index.ts';
import { defaultTestRulesets } from '../engine/catalog/test-fixtures.ts';
import { makeKnight } from '../engine/abilities/test-fixtures.ts';
import { makeStatusInstance } from '../engine/status/test-fixtures.ts';
import { boltHammer } from '../content/items/bolt-hammer.ts';
import { raspPendant } from '../content/items/rasp-pendant.ts';
import { wandOfDepths } from '../content/items/wand-of-depths.ts';
import { sorcerersRobe } from '../content/items/sorcerers-robe.ts';
import { magusCrown } from '../content/items/magus-crown.ts';
import { lightningStrike } from '../content/abilities/lightning-strike.ts';
import { counter } from '../content/abilities/counter.ts';
import { movePlus1 } from '../content/abilities/move-plus-1.ts';
import { burn } from '../content/statuses/burn.ts';
import { shell } from '../content/statuses/shell.ts';
import { taggedResistanceShift } from '../content/statuses/tagged-resistance-shift.ts';
import { formatAbilityDetail, formatItemDetail, formatStatusDetail } from './detail-text.ts';

function makeCat() {
  return createCatalog({
    statusTypes: [],
    abilities: [lightningStrike, counter, movePlus1],
    commandSets: [],
    classes: [makeKnight()],
    items: [boltHammer, raspPendant, wandOfDepths, sorcerersRobe, magusCrown],
    rulesets: defaultTestRulesets,
  });
}

describe('formatItemDetail', () => {
  it('summarizes a weapon with attackProcs + physicalVariance', () => {
    const cat = makeCat();
    const d = formatItemDetail(boltHammer, cat);
    expect(d.title).toBe('Bolt Hammer');
    expect(d.subtitle).toContain('Weapon');
    const joined = d.lines.join('\n');
    expect(joined).toContain('WP 10');
    expect(joined).toContain('Acc 75');
    expect(joined).toContain('Var [0.90, 1.30]');
    expect(joined).toContain('25% chance to trigger Lightning Strike');
  });

  it('summarizes an accessory with damageMpDrainPercent', () => {
    const cat = makeCat();
    const d = formatItemDetail(raspPendant, cat);
    expect(d.title).toBe('Rasp Pendant');
    expect(d.subtitle).toBe('Accessory');
    expect(d.lines.join('\n')).toContain('drain 10% of final damage');
  });

  it('summarizes a wand with abilityRangeModifiers + attackProc', () => {
    const cat = makeCat();
    const d = formatItemDetail(wandOfDepths, cat);
    const joined = d.lines.join('\n');
    expect(joined).toContain('+1H · +1V on water-tagged casts');
    expect(joined).toContain('100% chance to trigger');
  });

  it('summarizes body armor with stat mods + statusGrants + class restrictions', () => {
    const cat = makeCat();
    const d = formatItemDetail(sorcerersRobe, cat);
    expect(d.subtitle).toBe('Body Armor');
    const joined = d.lines.join('\n');
    expect(joined).toMatch(/\+30 HP|\+30 MP/);
    expect(joined).toContain('Movement: +1 Move');
    expect(joined).toContain('Grants at battle start');
    expect(joined).toContain('Class restricted:');
  });

  it('summarizes a headgear with bucketCapacityMods (Magus Crown)', () => {
    const cat = makeCat();
    const d = formatItemDetail(magusCrown, cat);
    expect(d.subtitle).toBe('Headgear');
    expect(d.lines.join('\n')).toContain('Secondary Action(s) capacity');
  });
});

describe('formatAbilityDetail', () => {
  it('summarizes an active spell with damage spec + cost + targeting', () => {
    const cat = makeCat();
    const d = formatAbilityDetail(lightningStrike, cat);
    expect(d.title).toBe('Lightning Strike');
    const joined = d.lines.join('\n');
    expect(joined).toContain('MP 10');
    expect(joined).toContain('Charge 30');
    expect(joined).toContain('Target: unit');
    expect(joined).toMatch(/MA × 12/);
  });

  it('renders authored description for a known passive (Counter)', () => {
    const cat = makeCat();
    const d = formatAbilityDetail(counter, cat);
    expect(d.title).toBe('Counter');
    expect(d.subtitle).toContain('passive');
    expect(d.lines[0]).toMatch(/swing back/i);
  });

  it('renders authored description for a known passive (Move +1)', () => {
    const cat = makeCat();
    const d = formatAbilityDetail(movePlus1, cat);
    expect(d.lines[0]).toContain('+1 Move Range');
  });
});

// Session 31.5: formatStatusDetail
describe('formatStatusDetail', () => {
  it('summarizes Burn with authored description + duration + tags', () => {
    const d = formatStatusDetail(burn, null);
    expect(d.title).toBe('Burn');
    expect(d.subtitle).toContain('Debuff');
    const joined = d.lines.join('\n');
    expect(joined).toMatch(/fire damage|periodic/i);
    expect(joined).toContain('Stacking:');
    expect(joined).toContain('Tags:');
  });

  it("uses an instance's customState displayName as the title (tagged_resistance_shift)", () => {
    const instance = makeStatusInstance({
      typeId: statusTypeId('tagged_resistance_shift'),
      customState: {
        tagDeltas: { fire: 25, lightning: -25 },
        displayName: 'Wand of the Depths Resonance',
      },
    });
    const d = formatStatusDetail(taggedResistanceShift, instance);
    expect(d.title).toBe('Wand of the Depths Resonance');
    expect(d.lines.join('\n')).toContain('fire +25');
    expect(d.lines.join('\n')).toContain('lightning -25');
  });

  it("renders the instance's remainingDuration when the type is per_unit_ct", () => {
    const instance = makeStatusInstance({
      typeId: statusTypeId('shell'),
      remainingDuration: 240,
      magnitude: 50,
    });
    const d = formatStatusDetail(shell, instance);
    const joined = d.lines.join('\n');
    expect(joined).toContain('permanent');
    expect(joined).toContain('Magnitude: 50');
  });

  it('falls back to a hook list when no authored description exists', () => {
    // Construct a synthetic status type that the description map
    // doesn't know about.
    const synthetic = {
      ...shell,
      id: statusTypeId('synthetic_unknown_status'),
      name: 'Synthetic',
    };
    const d = formatStatusDetail(synthetic, null);
    expect(d.lines.join('\n')).toContain('Hooks:');
  });
});
