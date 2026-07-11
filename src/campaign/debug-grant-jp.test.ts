// TABA Ch3 brief, work item 1 — the dev JP grant (repeatable, unlock-respecting).

import { describe, expect, it } from 'vitest';
import { DEBUG_JP_GRANT, debugGrantJp } from './debug-grant-jp.ts';
import { newCampaign } from './loop.ts';
import { M1_NODES } from './node.ts';
import { m1Roster } from './roster.ts';
import { COMPONENT_CATALOG, COMPONENT_ENTRIES } from './progression/component-catalog-data.ts';
import { earnedInClass, reclassableClasses } from './progression/ledger.ts';
import { slotOf, tierEntryOf, tierSlot } from './progression/tier-map.ts';
import type { CampaignState, CampaignUnit } from './types.ts';

const CAT = COMPONENT_CATALOG;

function fresh(): CampaignState {
  return newCampaign(m1Roster, M1_NODES.riverRidge);
}

describe('debugGrantJp', () => {
  it('grants exactly 100 per unlocked class per active unit; locked classes get nothing', () => {
    const before = fresh();
    const after = debugGrantJp(before, CAT);
    for (const [i, unit] of before.roster.entries()) {
      const granted = after.roster[i]!;
      const unlocked = new Set(reclassableClasses(unit, CAT));
      expect(unlocked.size).toBeGreaterThan(0); // at least the current class's tier
      for (const classId of unlocked) {
        expect(earnedInClass(granted, classId), `${unit.name} / ${String(classId)}`).toBe(
          earnedInClass(unit, classId) + DEBUG_JP_GRANT,
        );
      }
      // Every class pool NOT in the unlocked set is untouched.
      for (const classId of Object.keys(granted.earnedByClass)) {
        if (!unlocked.has(classId as never)) {
          expect(granted.earnedByClass[classId]).toBe(unit.earnedByClass[classId]);
        }
      }
    }
  });

  it('accumulates across repeated presses', () => {
    const twice = debugGrantJp(debugGrantJp(fresh(), CAT), CAT);
    for (const unit of twice.roster) {
      for (const classId of reclassableClasses(unit, CAT)) {
        // Two presses on a fresh ledger → exactly 2 × grant in every
        // still-unlocked class (fresh units have no prior earnings).
        expect(earnedInClass(unit, classId)).toBe(2 * DEBUG_JP_GRANT);
      }
    }
  });

  it('a class unlocked between presses starts receiving on the next press', () => {
    const before = fresh();
    const unit = before.roster.find((u) => tierEntryOf(u.classId).half !== 'hybrid');
    expect(unit).toBeDefined();
    const half = tierEntryOf(unit!.classId).half as 'physical' | 'magical';
    const t1 = tierSlot(half, 1);

    // Cross the T2 threshold by appending ≥500 JP of this half's T1 unlocks
    // (tokens appended directly — this tests the derived grant set, not
    // affordability, which unlockComponent owns).
    const tokens = [];
    let spent = 0;
    for (const meta of COMPONENT_ENTRIES) {
      if (meta.restrictedToUnit !== undefined) continue;
      if (slotOf(tierEntryOf(meta.nativeClass)) !== t1) continue;
      tokens.push(meta.token);
      spent += meta.cost;
      if (spent >= 500) break;
    }
    expect(spent).toBeGreaterThanOrEqual(500);

    const crossed: CampaignUnit = { ...unit!, unlocks: [...unit!.unlocks, ...tokens] };
    const beforeSet = new Set(reclassableClasses(unit!, CAT));
    const afterSet = new Set(reclassableClasses(crossed, CAT));
    const newlyUnlocked = [...afterSet].filter((c) => !beforeSet.has(c));
    expect(newlyUnlocked.length).toBeGreaterThan(0); // T2 (+ other half T1) opened

    const state: CampaignState = { ...before, roster: [crossed] };
    const granted = debugGrantJp(state, CAT).roster[0]!;
    for (const classId of newlyUnlocked) {
      expect(earnedInClass(granted, classId), String(classId)).toBe(
        earnedInClass(crossed, classId) + DEBUG_JP_GRANT,
      );
    }
  });

  it('lost units are untouched', () => {
    const before = fresh();
    const lost: CampaignUnit = { ...before.roster[0]!, fate: 'lost' };
    const state: CampaignState = { ...before, roster: [lost, ...before.roster.slice(1)] };
    const after = debugGrantJp(state, CAT);
    expect(after.roster[0]).toBe(lost);
  });
});
