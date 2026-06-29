// TABA campaign — roster authoring + converter tests.
// Proves the BuiltUnit → CampaignUnit conversion stores INPUTS not derived
// state (D-A), mints a stable id (D-B), and that the authored M0 roster is
// well-formed (size N, unique ids, all active).

import { describe, expect, it } from 'vitest';
import { mageWar } from '@content/teams/index.ts';
import {
  M0_BASELINE_LEVEL,
  M0_ROSTER_SIZE,
  campaignUnitFromBuilt,
  m0Roster,
} from './roster.ts';

describe('campaignUnitFromBuilt', () => {
  const grant = mageWar.units[0]!; // Knight, slot-level 25 in the source

  it('carries the stored inputs (class, loadout, equipment, name) verbatim', () => {
    const u = campaignUnitFromBuilt(grant, 'test-grant');
    expect(u.name).toBe(grant.name);
    expect(u.classId).toBe(grant.classId);
    expect(u.loadout).toEqual(grant.loadout);
    expect(u.equipment).toEqual(grant.equipment);
  });

  it('does NOT carry the source baseStats (recomputed at fold time, D-A)', () => {
    const u = campaignUnitFromBuilt(grant, 'test-grant') as unknown as Record<string, unknown>;
    expect('baseStats' in u).toBe(false);
    // The durable inputs are present instead.
    expect(typeof (u['brave'] as number)).toBe('number');
    expect(typeof (u['faith'] as number)).toBe('number');
  });

  it('mints the provided id and defaults to the uniform baseline level', () => {
    const u = campaignUnitFromBuilt(grant, 'test-grant');
    expect(u.id).toBe('test-grant');
    expect(u.level).toBe(M0_BASELINE_LEVEL);
  });

  it('overrides level/brave/faith when asked, ignoring the source slot level', () => {
    const u = campaignUnitFromBuilt(grant, 'x', { level: 12, brave: 55, faith: 88 });
    expect(u.level).toBe(12);
    expect(u.brave).toBe(55);
    expect(u.faith).toBe(88);
  });

  it('starts active with positive full vitals', () => {
    const u = campaignUnitFromBuilt(grant, 'test-grant');
    expect(u.fate).toBe('active');
    expect(u.vitals.hp).toBeGreaterThan(0);
    expect(u.vitals.mp).toBeGreaterThanOrEqual(0);
  });

  it('attaches gender only when the source has one (exactOptionalPropertyTypes)', () => {
    const withGender = campaignUnitFromBuilt({ ...grant, gender: 'female' }, 'g') as unknown as Record<
      string,
      unknown
    >;
    expect(withGender['gender']).toBe('female');

    const withoutGenderSource = { ...grant };
    delete (withoutGenderSource as { gender?: unknown }).gender;
    const u = campaignUnitFromBuilt(withoutGenderSource, 'g2') as unknown as Record<string, unknown>;
    expect('gender' in u).toBe(false);
  });
});

describe('m0Roster', () => {
  it('has exactly N units', () => {
    expect(m0Roster).toHaveLength(M0_ROSTER_SIZE);
  });

  it('mints unique stable ids', () => {
    const ids = m0Roster.map((u) => u.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('authors a uniform baseline level across the roster', () => {
    for (const u of m0Roster) expect(u.level).toBe(M0_BASELINE_LEVEL);
  });

  it('starts every unit active', () => {
    for (const u of m0Roster) expect(u.fate).toBe('active');
  });
});
