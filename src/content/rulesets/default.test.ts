// Sanity checks on the v1 default ruleset. Locks in the shape so a
// future bucket addition or design-doc change trips the right test;
// content tuning lives in the rule file itself.

import {
  ALL_BUCKET_IDS,
  DEFAULT_HOOK_SOURCE_TIER_ORDER,
  rulesetId,
  type DamageStage,
} from '@engine/index.ts';
import { DEFAULT_TEST_DAMAGE_PIPELINE } from '@engine/catalog/test-fixtures.ts';
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

  it('damage pipeline ships the v1 stage handlers (physical, magical, healing; elemental amplification lands later)', () => {
    const stages = defaultRuleset.damagePipeline.stages;
    expect(stages.base).toEqual(['physical_pa_wp', 'lance_bonus', 'magical_ma_power', 'healing_base']);
    // Session 31.5 / ADR-0069: `fire_on_damage_dealt` moved from
    // `attacker` to the target stage post-`evasion_check` so the proc
    // gate (`ctx.hit === true` in Bolt Hammer's contributor) reads the
    // resolved hit value rather than the pipeline-default `true`.
    expect(stages.attacker).toEqual([]);
    // Target-stage order matters: evasion_check first (ADR-0019), then
    // fire_on_damage_dealt (post-evasion so attack-proc gates see the
    // resolved hit), then resistance_check, then onDamageReceived hooks
    // see the resolved hit + post-resistance ctx.
    expect(stages.target).toEqual([
      'evasion_check',
      'cover_redirect',
      'fire_on_damage_dealt',
      'resistance_check',
      'fire_on_damage_received',
    ]);
    expect(stages.environment).toEqual([]);
    // Variance-stage order matters: variance_roll first, then crit_roll
    // layered on top (ADR-0032 — crit composes as a separate multiplier
    // on top of variance, not as a replacement).
    expect(stages.variance).toEqual(['variance_roll', 'crit_roll']);
    expect(stages.cap).toEqual(['clamp_min_max']);
    expect(stages.finalize).toEqual(['finalize']);
    // Session 30 / ADR-0065: `postFinalize` is an emission-only stage
    // after the integer `damageDealt` is locked in. Rasp Pendant's
    // `system_mp_drain` emits here via `fire_on_final_damage`.
    //
    // Session 37: extended with `fire_on_final_damage_received` — the
    // target-side mirror that Spiked Mail's revenge emission uses.
    expect(stages.postFinalize).toEqual([
      'fire_on_final_damage',
      'fire_on_final_damage_received',
    ]);
  });

  // Session 32 defensive: `DEFAULT_TEST_DAMAGE_PIPELINE` (test fixture)
  // must match `defaultRuleset.damagePipeline.stages` (production) in
  // shape AND handler arrays. Pre-32, the test fixture lagged production
  // (missing `postFinalize` entirely) which let bug 4 (proc-on-miss) slip
  // through the test surface (the test pipeline didn't carry the
  // `fire_on_damage_dealt` ordering bug because it was reconstructed
  // manually). This assertion catches the next divergence class.
  // See S31.5 handoff carry-forward.
  it('DEFAULT_TEST_DAMAGE_PIPELINE is structurally equivalent to production', () => {
    const productionStages = defaultRuleset.damagePipeline.stages;
    const testStages = DEFAULT_TEST_DAMAGE_PIPELINE;
    const productionKeys = (Object.keys(productionStages) as DamageStage[]).sort();
    const testKeys = (Object.keys(testStages) as DamageStage[]).sort();
    expect(testKeys).toEqual(productionKeys);
    for (const stage of productionKeys) {
      expect(testStages[stage]).toEqual(productionStages[stage]);
    }
  });

  it("initialCT uses uniform_int in [0, 20] per session 25 / ADR-0050", () => {
    expect(defaultRuleset.initialCT.kind).toBe('uniform_int');
    if (defaultRuleset.initialCT.kind !== 'uniform_int') return;
    expect(defaultRuleset.initialCT.min).toBe(0);
    expect(defaultRuleset.initialCT.max).toBe(20);
  });

  it('chain termination caps follow the design doc defaults (1 reaction/turn, depth cap 8)', () => {
    expect(defaultRuleset.chainTermination.perUnitPerTurnReactions).toBe(1);
    expect(defaultRuleset.chainTermination.chainDepthCap).toBe(8);
  });

  it('range defaults match docs/design/map-and-battlefield.md ("v1 starting parameters")', () => {
    expect(defaultRuleset.rangeDefaults.meleeHorizontal).toBe(1);
    expect(defaultRuleset.rangeDefaults.minHorizontal).toBe(0);
    expect(defaultRuleset.rangeDefaults.aoeVerticalTolerance).toBe(3);
  });
});

