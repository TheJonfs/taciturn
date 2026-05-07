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

  it('contains the session-16 baseline content set', () => {
    // The default catalog is intentionally narrow — one demo per
    // mechanism. When real content lands, this assertion is expected
    // to change; failing it from new content additions is the correct
    // signal that the baseline expanded.
    //
    // Session 5 expanded abilities (4 new: attack, float, fly, move+1
    // alongside the existing cure) and added the first command set
    // (battle_skill). Session 6 added the default ruleset. Session 8
    // added the Counter passive (the v1 reaction demo). Session 9
    // added Stop (the v1 turn-skip demo) — second status type.
    // Session 13 added the white_magic command set so the demo battle
    // can equip Cure on the Second Action bucket. Session 15 added
    // Charging (third status type) and the throwaway charged ability
    // Bolt (seventh ability) plus its arcane_skill command set
    // (third command set) for the charged-action-lifecycle demo.
    // Session 16 added Earth Mage content: 5 new statuses (regen,
    // movement_debuff, movement_self_buff, blind, silence) for 8 total;
    // 5 new abilities (earth_strike, earth_blessing, earth_curse,
    // earth_resilience, earth_communion) for 12 total; the
    // earth_spells command set (4 total); the earth_mage class (2
    // total).
    expect(cat.statusTypes()).toHaveLength(8);
    expect(cat.abilities()).toHaveLength(12);
    expect(cat.commandSets()).toHaveLength(4);
    expect(cat.classes()).toHaveLength(2);
    expect(cat.items()).toHaveLength(1);
    expect(cat.rulesets()).toHaveLength(1);
  });
});
