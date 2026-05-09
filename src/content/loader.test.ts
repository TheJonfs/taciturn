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

  it('contains the session-17c baseline content set', () => {
    // The default catalog is intentionally narrow — one demo per
    // mechanism. When real content lands, this assertion is expected
    // to change; failing it from new content additions is the correct
    // signal that the baseline expanded.
    //
    // Session 17c added Knight Battle Skill expansion (power_attack,
    // stasis_sword, taunt), Knight R/S/M passives (damage_reduction,
    // bulwark_stance), the Taunted status, and four new equipment
    // items (Strength Ring, Boots of Haste, Iron Helm, Iron Mail) on
    // top of the existing Long Sword.
    //   - statuses: 11 → 12 (taunted)
    //   - abilities: 14 → 19 (5 new — 3 Battle Skill + 2 R/S/M)
    //   - commandSets: unchanged (battle_skill members grew)
    //   - items: 1 → 5
    expect(cat.statusTypes()).toHaveLength(12);
    expect(cat.abilities()).toHaveLength(19);
    expect(cat.commandSets()).toHaveLength(4);
    expect(cat.classes()).toHaveLength(2);
    expect(cat.items()).toHaveLength(5);
    expect(cat.rulesets()).toHaveLength(1);
  });
});
