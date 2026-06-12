// Tests for the detail-text formatters. Locks in the mechanical-summary
// shape per ability/equipment kind so future content authoring + format
// surfaces stay in sync.

import { describe, expect, it } from 'vitest';
import { createCatalog, statusTypeId } from '@engine/index.ts';
import { defaultTestRulesets } from '../engine/catalog/test-fixtures.ts';
import { makeKnight } from '../engine/abilities/test-fixtures.ts';
import { makeStatusInstance } from '../engine/status/test-fixtures.ts';
import { boltHammer } from '../content/items/bolt-hammer.ts';
import { longbow } from '../content/items/longbow.ts';
import { raspPendant } from '../content/items/rasp-pendant.ts';
import { wandOfDepths } from '../content/items/wand-of-depths.ts';
import { wandOfLumen } from '../content/items/wand-of-lumen.ts';
import { sorcerersRobe } from '../content/items/sorcerers-robe.ts';
import { magusCrown } from '../content/items/magus-crown.ts';
import { lightningStrike } from '../content/abilities/lightning-strike.ts';
import { counter } from '../content/abilities/counter.ts';
import { movePlus1 } from '../content/abilities/move-plus-1.ts';
import { tidalWave } from '../content/abilities/tidal-wave.ts';
import { maelstrom } from '../content/abilities/maelstrom.ts';
import { burn } from '../content/statuses/burn.ts';
import { shell } from '../content/statuses/shell.ts';
import { taggedResistanceShift } from '../content/statuses/tagged-resistance-shift.ts';
import { battleSkill } from '../content/command-sets/battle-skill.ts';
import { powerAttack } from '../content/abilities/power-attack.ts';
import { lightningStab } from '../content/abilities/lightning-stab.ts';
import { taunt } from '../content/abilities/taunt.ts';
import { pillar } from '../content/abilities/worldcraft/pillar.ts';
import { hill } from '../content/abilities/worldcraft/hill.ts';
import { valley } from '../content/abilities/worldcraft/valley.ts';
import { barrier } from '../content/abilities/worldcraft/barrier.ts';
import { faithstrider } from '../content/abilities/faithstrider.ts';
import { monkeygrip } from '../content/abilities/monkeygrip.ts';
import { emissary } from '../content/abilities/emissary.ts';
import { unifiedCalling } from '../content/abilities/unified-calling.ts';
import { cure } from '../content/abilities/cure.ts';
import { raise } from '../content/abilities/raise.ts';
import { jump } from '../content/abilities/jump.ts';
import {
  formatAbilityDetail,
  formatCommandSetDetail,
  formatItemDetail,
  formatStatusDetail,
} from './detail-text.ts';

function makeCat() {
  return createCatalog({
    statusTypes: [burn],
    abilities: [lightningStrike, counter, movePlus1, tidalWave, maelstrom],
    commandSets: [],
    classes: [makeKnight()],
    items: [boltHammer, raspPendant, wandOfDepths, sorcerersRobe, magusCrown, wandOfLumen],
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
    // S40 name-update: Lightning Strike → Lightning Bolt (display only).
    expect(joined).toContain('25% chance to trigger Lightning Bolt');
  });

  it('surfaces the Wand of Lumen extra-Burn-stack effect on fire casts', () => {
    const cat = makeCat();
    const d = formatItemDetail(wandOfLumen, cat);
    const joined = d.lines.join('\n');
    expect(joined).toContain('On fire-tagged casts: Burn applies with +1 stack');
  });

  it('summarizes a bow with range, two-handed, elevation variance, and range-from-height (S52)', () => {
    const cat = makeCat();
    const d = formatItemDetail(longbow, cat);
    const joined = d.lines.join('\n');
    expect(joined).toContain('Rng 2-5');
    expect(joined).toContain('Two-handed');
    expect(joined).toContain('Var by elevation');
    // S52: range-from-height advertised in the weapon block.
    expect(joined).toContain('+1 Rng per 2 elev down');
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
    // S51 refit: range carries only the +1H now; the prior +1V was dead
    // (every spell already targets at vertical: 99) so the wand moved
    // its +1 vertical onto AoE vertical tolerance — a value players can
    // actually feel on elevation-rich AoE casts.
    expect(joined).toContain('+1H on water-tagged casts');
    expect(joined).toContain('AoE elevation: +1 on water-tagged casts');
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
    // S40 name-update: Lightning Strike's display name is now 'Lightning Bolt';
    // the ability id (lightning_strike) is preserved for save-state continuity.
    expect(d.title).toBe('Lightning Bolt');
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

  // Regression for Session 37: Tidal Wave authors knockback chance in
  // the 0–100 scale (`chance: 50`), distinct from proc.chance's 0–1
  // probability scale. Pre-fix, this rendered as "5000%". Pin the
  // formatter to the correct in-range output.
  it("renders Tidal Wave's knockback chance within [0, 100]%", () => {
    const cat = makeCat();
    const d = formatAbilityDetail(tidalWave, cat);
    const joined = d.lines.join('\n');
    expect(joined).toContain('Knockback: 1 tiles at 50%');
    expect(joined).not.toMatch(/at \d{4,}%/);
  });

  it("renders Maelstrom's deterministic knockback as (always)", () => {
    const cat = makeCat();
    const d = formatAbilityDetail(maelstrom, cat);
    expect(d.lines.join('\n')).toContain('Knockback: 1 tiles (always)');
  });

  // S55: Worldcraft abilities had no damage/AoE spec to format, so their
  // tooltips read as a bare "Cost · Target". Each now leads with an authored
  // effect description (incl. the effect-queue interaction) ahead of the
  // auto cost/target lines.
  describe('Worldcraft tooltips', () => {
    function worldcraftCat() {
      return createCatalog({
        statusTypes: [],
        abilities: [pillar, hill, valley, barrier],
        commandSets: [],
        classes: [makeKnight()],
        items: [],
        rulesets: defaultTestRulesets,
      });
    }

    it('leads Pillar with its effect + queue description, then cost/target', () => {
      const d = formatAbilityDetail(pillar, worldcraftCat());
      expect(d.title).toBe('Pillar');
      expect(d.lines[0]).toMatch(/Raise a single tile by 4/);
      expect(d.lines[0]).toMatch(/1 active Worldcraft effect/);
      const joined = d.lines.join('\n');
      expect(joined).toContain('MP 8');
      expect(joined).toContain('Target: tile');
    });

    it('describes the Hill kernel (center +3, edges +2, corners +1)', () => {
      const d = formatAbilityDetail(hill, worldcraftCat());
      expect(d.lines[0]).toMatch(/3×3/);
      expect(d.lines[0]).toContain('center +3');
      expect(d.lines[0]).toContain('corners +1');
    });

    it('notes Valley deals fall damage', () => {
      const d = formatAbilityDetail(valley, worldcraftCat());
      expect(d.lines[0]).toMatch(/fall damage/i);
    });

    it('describes Barrier as a destructible line that blocks movement + sight', () => {
      const d = formatAbilityDetail(barrier, worldcraftCat());
      expect(d.lines[0]).toMatch(/3–5 barrier tiles/);
      expect(d.lines[0]).toMatch(/block movement and line of sight/i);
      expect(d.lines.join('\n')).toContain('MP 12');
    });
  });

  // S62: the Templar kit (four innates + Templar Arts) ships authored
  // tooltip descriptions — regression against the "not yet authored"
  // placeholder the picker showed when a new ability lacked a description.
  describe('Templar tooltips', () => {
    function templarCat() {
      return createCatalog({
        statusTypes: [],
        abilities: [faithstrider, monkeygrip, emissary, unifiedCalling, cure, raise, jump],
        commandSets: [],
        classes: [makeKnight()],
        items: [],
        rulesets: defaultTestRulesets,
      });
    }

    it('authors descriptions for the four innates and Templar Arts (no placeholder)', () => {
      const cat = templarCat();
      const cases: ReadonlyArray<readonly [Parameters<typeof formatAbilityDetail>[0], RegExp]> = [
        [faithstrider, /\+1 Move Range and \+10 Faith/i],
        [monkeygrip, /two-handed weapons need only one hand/i],
        [emissary, /\+25% to all healing/i],
        [unifiedCalling, /recover MP equal to your PA/i],
        [cure, /1-square cross/i],
        [raise, /revive/i],
        [jump, /leap off-field/i],
      ];
      for (const [ability, pattern] of cases) {
        const d = formatAbilityDetail(ability, cat);
        const joined = d.lines.join('\n');
        expect(joined, `${ability.name} description`).toMatch(pattern);
        expect(joined, `${ability.name} not placeholder`).not.toMatch(/not yet authored/i);
      }
    });
  });
});

// S48: command-set hover content for the team-builder ability picker.
describe('formatCommandSetDetail', () => {
  function makeCatWithBattleSkill() {
    return createCatalog({
      statusTypes: [],
      abilities: [powerAttack, lightningStab, taunt],
      commandSets: [battleSkill],
      classes: [makeKnight()],
      items: [],
      rulesets: defaultTestRulesets,
    });
  }

  it('lists every member ability of a command set with a compact one-liner', () => {
    const cat = makeCatWithBattleSkill();
    const d = formatCommandSetDetail(battleSkill, cat);
    expect(d.title).toBe('Battle Skill');
    expect(d.subtitle).toContain('Command Set');
    expect(d.subtitle).toContain('3 abilities');
    const joined = d.lines.join('\n');
    expect(joined).toContain('Power Attack');
    expect(joined).toContain('Lightning Stab');
    expect(joined).toContain('Taunt');
  });

  it("surfaces a member's MP cost and damage formula on its summary line", () => {
    const cat = makeCatWithBattleSkill();
    const d = formatCommandSetDetail(battleSkill, cat);
    const joined = d.lines.join('\n');
    // Power Attack is a physical damage active — MP cost + PA×WP×coef.
    expect(joined).toMatch(/Power Attack — MP \d+/);
    expect(joined).toMatch(/PA×WP×/);
  });

  it('renders the set-level cost line when nonzero', () => {
    const cat = makeCatWithBattleSkill();
    const d = formatCommandSetDetail(battleSkill, cat);
    expect(d.lines.join('\n')).toContain('Set cost:');
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
