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

  it('contains the session-19 baseline content set', () => {
    // The default catalog is intentionally narrow — one demo per
    // mechanism. When real content lands, this assertion is expected
    // to change; failing it from new content additions is the correct
    // signal that the baseline expanded.
    //
    // Session 19 added Fire Mage (5 actives + reaction + 2 supports +
    // class + command set + 5 statuses):
    //   - statuses: 13 → 18 (burn, pa_up, pa_down, ma_up, ma_down)
    //   - abilities: 26 → 34 (8 new — 5 actives + reaction + 2 supports)
    //   - commandSets: 5 → 6 (fire_spells)
    //   - classes: 3 → 4 (fire_mage)
    //   - items: unchanged
    expect(cat.statusTypes()).toHaveLength(18);
    expect(cat.abilities()).toHaveLength(34);
    expect(cat.commandSets()).toHaveLength(6);
    expect(cat.classes()).toHaveLength(4);
    expect(cat.items()).toHaveLength(5);
    expect(cat.rulesets()).toHaveLength(1);
  });
});
