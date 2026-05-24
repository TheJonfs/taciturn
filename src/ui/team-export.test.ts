// Team export — exporter shape + round-trip tests (S48).

import { describe, expect, it } from 'vitest';
import { loadDefaultCatalog } from '@content/index.ts';
import {
  buildBaseStats,
  currentTestTeam,
  type BuiltTeam,
} from '@content/teams/index.ts';
import { classId } from '@engine/index.ts';
import { exportBuiltTeamJson, exportBuiltTeamThin } from './team-export.ts';

const catalog = loadDefaultCatalog();

describe('exportBuiltTeamThin', () => {
  it('preserves the team name', () => {
    const out = exportBuiltTeamThin(currentTestTeam);
    expect(out.name).toBe(currentTestTeam.name);
  });

  it('emits one unit per source unit', () => {
    const out = exportBuiltTeamThin(currentTestTeam);
    expect(out.units).toHaveLength(currentTestTeam.units.length);
  });

  it('coerces branded ids to plain strings (classId, equipment slots, loadout buckets)', () => {
    const out = exportBuiltTeamThin(currentTestTeam);
    for (const unit of out.units) {
      expect(typeof unit.classId).toBe('string');
      for (const slotValue of Object.values(unit.equipment)) {
        if (slotValue !== null) expect(typeof slotValue).toBe('string');
      }
      for (const bucketIds of Object.values(unit.loadout.actionBuckets)) {
        for (const id of bucketIds) expect(typeof id).toBe('string');
      }
      for (const bucketIds of Object.values(unit.loadout.passiveBuckets)) {
        for (const id of bucketIds) expect(typeof id).toBe('string');
      }
    }
  });

  it('thin form omits baseStats — stats derive from (classId, brave, faith) at load time', () => {
    const out = exportBuiltTeamThin(currentTestTeam);
    for (const unit of out.units) {
      // The exporter intentionally does NOT serialize baseStats; the
      // values are recomputed via buildBaseStats on the loading side.
      expect((unit as Record<string, unknown>).baseStats).toBeUndefined();
      expect(typeof unit.brave).toBe('number');
      expect(typeof unit.faith).toBe('number');
    }
  });

  it('round-trip — every export unit reassembles into a matching BuiltUnit via buildBaseStats', () => {
    const out = exportBuiltTeamThin(currentTestTeam);
    out.units.forEach((unitOut, i) => {
      const source = currentTestTeam.units[i]!;
      // classId equality (string-coerced).
      expect(unitOut.classId).toBe(String(source.classId));
      // brave / faith stay numeric and match the source baseStats.
      expect(unitOut.brave).toBe(source.baseStats.brave);
      expect(unitOut.faith).toBe(source.baseStats.faith);
      // Reassembling baseStats from (classId, brave, faith) reproduces
      // the source's baseStats (modulo branding, which is structural in
      // TS but plain runtime values).
      const reassembled = buildBaseStats(
        classId(unitOut.classId),
        unitOut.brave,
        unitOut.faith,
      );
      expect(reassembled).toEqual(source.baseStats);
    });
  });

  it('preserves equipment slot fills (null + non-null) by id', () => {
    const out = exportBuiltTeamThin(currentTestTeam);
    out.units.forEach((unitOut, i) => {
      const source = currentTestTeam.units[i]!;
      const slots = ['leftHand', 'rightHand', 'headgear', 'armor', 'accessory'] as const;
      for (const slot of slots) {
        const sourceVal = source.equipment[slot];
        const outVal = unitOut.equipment[slot];
        if (sourceVal === null) {
          expect(outVal).toBeNull();
        } else {
          expect(outVal).toBe(String(sourceVal));
        }
      }
    });
  });
});

describe('exportBuiltTeamJson', () => {
  it('produces valid JSON that round-trips through JSON.parse to the thin form', () => {
    const json = exportBuiltTeamJson(currentTestTeam);
    const parsed = JSON.parse(json);
    const expected: TeamExportThinParsed = exportBuiltTeamThin(currentTestTeam) as unknown as TeamExportThinParsed;
    expect(parsed).toEqual(expected);
  });

  it('emits a 2-space-indented JSON string (matching the existing template-file convention)', () => {
    const json = exportBuiltTeamJson(currentTestTeam);
    // The opening object has a 2-space indent on its first field.
    expect(json).toMatch(/^\{\n  "name":/);
  });
});

// Type-only narrowing helper for the JSON.parse round-trip — keeps the
// parsed value's shape lined up with the exporter's interface so the
// equality check is precise.
type TeamExportThinParsed = ReturnType<typeof exportBuiltTeamThin>;

// Used by the import shape so `catalog` isn't an unused import.
void catalog;
