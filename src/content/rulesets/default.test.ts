// Sanity checks on the v1 default ruleset. Locks in the shape so a
// future bucket addition or design-doc change trips the right test;
// content tuning lives in the rule file itself.

import {
  ALL_BUCKET_IDS,
  DEFAULT_HOOK_SOURCE_TIER_ORDER,
  rulesetId,
} from '@engine/index.ts';
import { defaultRuleset } from './default.ts';

describe('defaultRuleset', () => {
  it('has id "default"', () => {
    expect(defaultRuleset.id).toBe(rulesetId('default'));
  });

  it('has a capacity entry for every known bucket', () => {
    for (const b of ALL_BUCKET_IDS) {
      expect(defaultRuleset.bucketCapacities.has(b)).toBe(true);
    }
  });

  it('matches the session-5 baseline capacities (1/1/3/3/3)', () => {
    // The exact numbers — change here if the design moves.
    expect([...defaultRuleset.bucketCapacities.values()].sort()).toEqual([1, 1, 3, 3, 3]);
  });

  it('CT costs follow the design doc bands (Wait < Move < Act < Move+Act)', () => {
    const c = defaultRuleset.ctCosts;
    expect(c.wait).toBeLessThan(c.moveOnly);
    expect(c.moveOnly).toBeLessThan(c.actOnly);
    expect(c.actOnly).toBeLessThan(c.moveAndAct);
    expect(c.moveAndAct).toBe(100);
  });

  it('speed floor at 0; ceiling unset for v1', () => {
    expect(defaultRuleset.speedBounds.floor).toBe(0);
    expect(defaultRuleset.speedBounds.ceiling).toBeNull();
  });

  it('default turn budget is one Move + one Act', () => {
    expect(defaultRuleset.defaultTurnBudget).toEqual({
      movesAvailable: 1,
      actsAvailable: 1,
    });
  });

  it('v1 FFT-flavored behavior defaults: friendly fire on, friendly pass-through on, units do not block LoS', () => {
    expect(defaultRuleset.behaviors.friendlyFire).toBe(true);
    expect(defaultRuleset.behaviors.friendlyPassThrough).toBe(true);
    expect(defaultRuleset.behaviors.unitsBlockLineOfSight).toBe(false);
  });

  it('hook ordering matches the engine default (Equipment → Class → Passive → Status)', () => {
    expect(defaultRuleset.hookOrdering.sourceTiers).toEqual(DEFAULT_HOOK_SOURCE_TIER_ORDER);
  });

  it('damage pipeline ships the v1 stage handlers (physical + healing only; magical/elemental land later)', () => {
    const stages = defaultRuleset.damagePipeline.stages;
    expect(stages.base).toEqual(['physical_pa_wp', 'healing_base']);
    expect(stages.attacker).toEqual(['fire_on_damage_dealt']);
    expect(stages.target).toEqual(['fire_on_damage_received']);
    expect(stages.environment).toEqual([]);
    expect(stages.variance).toEqual(['variance_roll']);
    expect(stages.cap).toEqual(['clamp_min_max']);
    expect(stages.finalize).toEqual(['finalize']);
  });

  it("initialCT uses the v1 'fixed' kind", () => {
    expect(defaultRuleset.initialCT.kind).toBe('fixed');
  });

  it('chain termination caps follow the design doc defaults (1 reaction/turn, depth cap 8)', () => {
    expect(defaultRuleset.chainTermination.perUnitPerTurnReactions).toBe(1);
    expect(defaultRuleset.chainTermination.chainDepthCap).toBe(8);
  });

  it('range defaults match docs/design/map-and-battlefield.md ("v1 starting parameters")', () => {
    expect(defaultRuleset.rangeDefaults.meleeHorizontal).toBe(1);
    expect(defaultRuleset.rangeDefaults.minHorizontal).toBe(0);
    expect(defaultRuleset.rangeDefaults.aoeVerticalTolerance).toBe(1);
  });
});
