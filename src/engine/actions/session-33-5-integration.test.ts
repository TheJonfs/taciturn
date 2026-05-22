// Session 33.5 integration tests — the River Ridge playtest bug cluster.
//
// The audit found that the engine's heal-application sites were already
// correctly gated on `hp <= 0` (ADR-0070 at `applyDamageToTarget`; the
// symmetric gate at `reduceSystemHeal`). The ghost-HP / missing-red-X
// playtest bugs were *not* an ungated heal site — they were the renderer
// re-deriving visual HP by arithmetic on the recorded `damage`/`healing`
// magnitudes, which diverge from engine truth whenever an application is
// gated. ADR-0074's fix: the per-target result carries `hpAfter` (the
// actual post-application engine HP), and the renderer settles from that.
//
// Coverage:
//   1. A native heal on a KO'd target: engine HP stays 0 AND the
//      per-target result reports `hpAfter: 0` (not the computed heal).
//   2. A damage hit on a live target: `hpAfter` equals the actual
//      post-damage engine HP (the field carries truth in the ordinary
//      case, not just the gated case).

import { describe, expect, it } from 'vitest';
import {
  abilityId,
  bucketId,
  type ActiveAbilityDefinition,
  type DamageTag,
} from '@engine/index.ts';
import { createCatalog } from '../catalog/index.ts';
import { defaultRuleset } from '../../content/rulesets/default.ts';
import { makeKnight } from '../abilities/test-fixtures.ts';
import { activeTurnFor, makeGameState, makeUnit } from '../ct/test-fixtures.ts';
import { reduceUseAbility } from './reducers.ts';

function healSpell(): ActiveAbilityDefinition {
  return {
    id: abilityId('test_heal'),
    name: 'Test Heal',
    kind: 'active',
    bucket: bucketId('first_action'),
    baseCost: 1,
    availability: 'hidden',
    targeting: { kind: 'single_unit', range: { horizontal: 4, vertical: 3 }, rangeMode: 'arc' },
    actionSpeed: 0,
    mpCost: 0,
    effects: {
      damage: {
        tags: ['magical', 'healing'] as DamageTag[],
        power_coefficient: 5,
        variance: { min: 1, max: 1 },
      },
    },
  };
}

function boltSpell(): ActiveAbilityDefinition {
  return {
    id: abilityId('test_bolt'),
    name: 'Test Bolt',
    kind: 'active',
    bucket: bucketId('first_action'),
    baseCost: 1,
    availability: 'hidden',
    targeting: { kind: 'single_unit', range: { horizontal: 4, vertical: 3 }, rangeMode: 'arc' },
    actionSpeed: 0,
    mpCost: 0,
    effects: {
      damage: {
        tags: ['magical'] as DamageTag[],
        power_coefficient: 4,
        variance: { min: 1, max: 1 },
      },
    },
  };
}

describe('Session 33.5 — per-target result carries actual post-application HP (ADR-0074)', () => {
  it("a native heal on a KO'd target does not raise HP, and the result reports hpAfter: 0", () => {
    const heal = healSpell();
    const cat = createCatalog({
      statusTypes: [],
      abilities: [heal],
      commandSets: [],
      classes: [makeKnight()],
      items: [],
      rulesets: [defaultRuleset],
    });
    const caster = makeUnit({ id: 'a', spd: 10, ma: 14, faith: 100 });
    const koTarget = makeUnit({ id: 't', spd: 10, hp: 0, faith: 100 });
    const state = makeGameState({
      units: [caster, koTarget],
      turnState: activeTurnFor(caster.id),
    });
    const action = {
      sequenceNumber: 1,
      source: 'player' as const,
      timestamp: { tick: 0, ct: 0 },
      seed: 42,
      chainDepth: 0,
      isReaction: false,
      actorId: caster.id,
      type: 'use_ability' as const,
      payload: {
        abilityId: heal.id,
        target: { kind: 'unit' as const, unitId: koTarget.id },
      },
    };
    const result = reduceUseAbility(state, action, cat);
    // Engine HP is unchanged — the KO'd-target gate held.
    expect(result.newState.units.get(koTarget.id)!.vitals.hp).toBe(0);
    // The per-target result reports the *applied* truth (0), even though
    // a positive `healing` magnitude was computed and recorded for the
    // action log. The renderer settles its visual from `hpAfter`.
    const r = result.outcome.perTargetResults[0]!;
    expect(r.healing).toBeGreaterThan(0);
    expect(r.hpAfter).toBe(0);
  });

  it('a damage hit on a live target reports hpAfter equal to the actual post-damage HP', () => {
    const bolt = boltSpell();
    const cat = createCatalog({
      statusTypes: [],
      abilities: [bolt],
      commandSets: [],
      classes: [makeKnight()],
      items: [],
      rulesets: [defaultRuleset],
    });
    const caster = makeUnit({ id: 'a', spd: 10, ma: 14, faith: 100 });
    const target = makeUnit({ id: 't', spd: 10, hp: 100, maxHpBase: 100, faith: 100 });
    const state = makeGameState({
      units: [caster, target],
      turnState: activeTurnFor(caster.id),
    });
    const action = {
      sequenceNumber: 1,
      source: 'player' as const,
      timestamp: { tick: 0, ct: 0 },
      seed: 42,
      chainDepth: 0,
      isReaction: false,
      actorId: caster.id,
      type: 'use_ability' as const,
      payload: {
        abilityId: bolt.id,
        target: { kind: 'unit' as const, unitId: target.id },
      },
    };
    const result = reduceUseAbility(state, action, cat);
    const engineHp = result.newState.units.get(target.id)!.vitals.hp;
    expect(engineHp).toBeLessThan(100);
    const r = result.outcome.perTargetResults[0]!;
    expect(r.hpAfter).toBe(engineHp);
  });
});
