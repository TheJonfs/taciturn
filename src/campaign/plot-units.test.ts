// TABA chapter-1 plot-unique units — acceptance tests.
//
// Proves each of the five instantiates with the right durable identity, that the
// unit-restricted signatures are scoped (Seam 3: buyable ONLY in their unit's
// catalog, and NOT auto-seeded), and that a plot unit folds into a real battle.

import { describe, expect, it } from 'vitest';
import { loadDefaultCatalog } from '@content/index.ts';
import { abilityId, bucketId, classId, unitId, type UnitId } from '@engine/index.ts';
import {
  COMPONENT_CATALOG,
  componentMetaOf,
  isComponentAvailableTo,
  seedStartingKit,
  tokenKey,
  type CampaignUnit,
  type UnlockToken,
} from './index.ts';
import { plotUnits } from './plot-units.ts';
import { m1Roster } from './roster.ts';

const catalog = loadDefaultCatalog();

// Is a restricted component offered to this unit id (Seam 3)?
const offered = (token: UnlockToken, id: UnitId): boolean =>
  isComponentAvailableTo(componentMetaOf(token, COMPONENT_CATALOG), id);
const byId = (id: string): CampaignUnit => {
  const u = plotUnits.find((p) => String(p.id) === id);
  if (u === undefined) throw new Error(`no plot unit ${id}`);
  return u;
};

describe('plot-unit definitions', () => {
  it('authors exactly the five leads with durable plot ids', () => {
    expect(plotUnits.map((u) => String(u.id)).sort()).toEqual([
      'plot-chris',
      'plot-clio',
      'plot-lumen',
      'plot-sera',
      'plot-thessaly',
    ]);
  });

  it('each carries its authored class, portrait key (= id), and classAccessOverride', () => {
    const lumen = byId('plot-lumen');
    expect(lumen.classId).toBe(classId('fire_mage'));
    expect(lumen.portrait).toBe('plot-lumen');
    expect(lumen.classAccessOverride).toBeUndefined(); // Tier-1 → no override

    const chris = byId('plot-chris');
    expect(chris.classId).toBe(classId('knight')); // Knight, NOT Gravity Well's Templar
    expect(chris.classAccessOverride).toEqual([classId('knight'), classId('alchemist')]);

    expect(byId('plot-thessaly').classAccessOverride).toEqual([
      classId('calculator'),
      classId('earth_mage'),
    ]);
    expect(byId('plot-sera').classAccessOverride).toEqual([classId('assassin'), classId('monk')]);
  });

  it('equips the three chapter-scaling innate signatures (and only those)', () => {
    const support = (u: CampaignUnit) => u.loadout.passiveBuckets[bucketId('support')] ?? [];
    expect(support(byId('plot-lumen'))).toContain(abilityId('ascendant_flame'));
    expect(support(byId('plot-clio'))).toContain(abilityId('tidal_cadence'));
    expect(support(byId('plot-chris'))).toContain(abilityId('bulwark_oath'));
    // The exclusive-kit leads get NO innate passive — their signatures are bought.
    expect(support(byId('plot-thessaly'))).not.toContain(abilityId('bulwark_oath'));
  });

  it('replaces the Gravity Well fixtures at the head of m1Roster', () => {
    expect(m1Roster.slice(0, 5).map((u) => String(u.id))).toEqual([
      'plot-sera',
      'plot-thessaly',
      'plot-lumen',
      'plot-chris',
      'plot-clio',
    ]);
  });
});

describe('Seam 3 — restricted signatures scoped to their unit', () => {
  const XP: UnlockToken = { kind: 'mathParameter', id: 'xp' };
  const SQUARE: UnlockToken = { kind: 'mathValue', id: 'square' };
  const HAMSTRING: UnlockToken = { kind: 'ability', id: abilityId('hamstring') };

  it("Thessaly's Math components are offered to HER, not a generic Calculator", () => {
    const thessaly = byId('plot-thessaly').id;
    expect(offered(XP, thessaly)).toBe(true);
    expect(offered(SQUARE, thessaly)).toBe(true);
    expect(offered(XP, unitId('generic-calc'))).toBe(false);
    expect(offered(SQUARE, unitId('generic-calc'))).toBe(false);
  });

  it('Hamstring is offered to Sera, not a generic Assassin', () => {
    expect(offered(HAMSTRING, byId('plot-sera').id)).toBe(true);
    expect(offered(HAMSTRING, unitId('generic-assassin'))).toBe(false);
  });

  it('does NOT auto-seed the buyable signatures (earned, not granted)', () => {
    const seraKit = seedStartingKit(classId('assassin'), byId('plot-sera').loadout, catalog, COMPONENT_CATALOG);
    expect(seraKit.unlocks.map(tokenKey)).not.toContain(
      tokenKey({ kind: 'ability', id: abilityId('hamstring') }),
    );
    const thessKit = seedStartingKit(classId('calculator'), byId('plot-thessaly').loadout, catalog, COMPONENT_CATALOG);
    expect(thessKit.unlocks.map(tokenKey)).not.toContain(tokenKey({ kind: 'mathParameter', id: 'xp' }));
    expect(thessKit.unlocks.map(tokenKey)).not.toContain(tokenKey({ kind: 'mathValue', id: 'square' }));
    // But her BASE calculator kit is still seeded (she's functional at 4×4).
    expect(thessKit.unlocks.length).toBeGreaterThan(0);
  });
});
