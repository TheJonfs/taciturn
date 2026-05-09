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
    // Session 20 added Lightning Mage (5 actives + reaction + support +
    // hidden retaliation active + class + command set + 2 statuses):
    //   - statuses: 18 → 20 (vulnerable, crit_modifier)
    //   - abilities: 34 → 42 (8 new — 5 actives in lightning_spells +
    //     discharge passive + discharge_strike active emitted by the
    //     reaction + conductor support)
    //   - commandSets: 6 → 7 (lightning_spells)
    //   - classes: 4 → 5 (lightning_mage)
    //   - items: unchanged
    expect(cat.statusTypes()).toHaveLength(20);
    expect(cat.abilities()).toHaveLength(42);
    expect(cat.commandSets()).toHaveLength(7);
    expect(cat.classes()).toHaveLength(5);
    expect(cat.items()).toHaveLength(5);
    expect(cat.rulesets()).toHaveLength(1);
  });
});
