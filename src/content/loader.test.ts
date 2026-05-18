import { abilityId, classId, itemId, rulesetId, statusTypeId } from '@engine/index.ts';
import { loadDefaultCatalog } from './index.ts';

describe('loadDefaultCatalog', () => {
  const cat = loadDefaultCatalog();

  it('constructs without throwing — the stub content has no duplicate ids', () => {
    expect(() => loadDefaultCatalog()).not.toThrow();
  });

  it('exposes the stub StatusEffectType', () => {
    expect(cat.hasStatusType(statusTypeId('haste'))).toBe(true);
    expect(cat.getStatusType(statusTypeId('haste')).name).toBe('Haste');
  });

  it('exposes the stub Ability', () => {
    expect(cat.hasAbility(abilityId('cure'))).toBe(true);
    expect(cat.getAbility(abilityId('cure')).name).toBe('Cure');
  });

  it('exposes the stub Class', () => {
    expect(cat.hasClass(classId('knight'))).toBe(true);
    expect(cat.getClass(classId('knight')).name).toBe('Knight');
  });

  it('exposes the stub Item', () => {
    expect(cat.hasItem(itemId('long_sword'))).toBe(true);
    expect(cat.getItem(itemId('long_sword')).name).toBe('Long Sword');
  });

  it('exposes the default Ruleset', () => {
    expect(cat.hasRuleset(rulesetId('default'))).toBe(true);
    expect(cat.getRuleset(rulesetId('default')).name).toBe('Default');
  });

  it('contains the session-26 baseline content set', () => {
    // The default catalog is intentionally narrow — one demo per
    // mechanism. When real content lands, this assertion is expected
    // to change; failing it from new content additions is the correct
    // signal that the baseline expanded.
    //
    // Session 20 added Lightning Mage (5 actives + reaction + support +
    // hidden retaliation active + class + command set + 2 statuses):
    //   - statuses: 18 → 20 (vulnerable, crit_modifier)
    //   - abilities: 34 → 42 (8 new — 5 actives in lightning_spells +
    //     discharge passive + discharge_strike active emitted by the
    //     reaction + conductor support)
    //   - commandSets: 6 → 7 (lightning_spells)
    //   - classes: 4 → 5 (lightning_mage)
    //   - items: unchanged
    //
    // Session 26 added the four R/S/M-parity Movement passives
    // (bedrock_stride, hotfoot, tidewalker, quickstep):
    //   - abilities: 42 → 46
    //
    // Session 29 added Shell and Protect statuses (Auto-Shell from
    // Sorcerer's Robe is the v1 consumer; Auto-Protect substrate
    // staged for future Knight gear):
    //   - statuses: 20 → 22
    //
    // Session 29 Equipment Batch A: 28 new items authored (6 weapons,
    // 3 shields, 6 body, 6 head, 7 accessories):
    //   - items: 5 → 33
    //
    // Session 31 Cluster 5 content + tagged_resistance_shift substrate:
    //   - statuses: 22 → 24 (tagged_resistance_shift; regen_auto sibling
    //     authored to give Tintinibar an Auto-Regen with battle-long
    //     duration — the cast `regen` keeps `'per_unit_ct'` for Earth
    //     Blessing)
    //   - abilities: 46 → 49 (apply_burn_proc + the two wand apply_shift
    //     abilities; hidden, fired by attackProcs)
    //   - items: 33 → 35 (bolt_hammer + rasp_pendant; existing items
    //     extended in place)
    //   - items: 35 → 42 (Session 37 batch: travel_garb, lookouts_hood,
    //     crusaders_helm, light_robe, dark_robe, tricorn, spiked_mail)
    //   - items: 42 → 46 (Session 39a Alchemist consumables: potion,
    //     phoenix_down, remedy, ether)
    //   - statuses: 24 → 25 (Session 39b combat_focus)
    //   - abilities: 49 → 54 (Session 39b: compound, throw_item ability
    //     shells; combat_focus, field_recovery, field_kit passives)
    //   - commandSets: 7 → 8 (Session 39b alchemy)
    //   - classes: 5 → 6 (Session 39b alchemist)
    expect(cat.statusTypes()).toHaveLength(25);
    expect(cat.abilities()).toHaveLength(54);
    expect(cat.commandSets()).toHaveLength(8);
    expect(cat.classes()).toHaveLength(6);
    expect(cat.items()).toHaveLength(46);
    expect(cat.rulesets()).toHaveLength(1);
  });
});
