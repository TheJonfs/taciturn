// Session 32 integration tests — coverage for Cluster 6 substrate items.
//
// Covers:
//   1. Item 16 — knockback-into-water end-to-end. A unit knocked off a
//      ridge into adjacent shallow water lands on the water tile, with
//      the fall-damage `system_damage` action emitted into the per-target
//      result's pipeline emissions and the unit's position updated.
//      The river-ridge.md "Knockback Into Water" scenario at full scale.
//
// Engine-internal: routes through `reduceUseAbility` rather than the full
// orchestrator, so the per-target result + engine state shape is asserted
// directly. The orchestrator's chain-fan-out behavior is exercised in the
// orchestrator-side tests.

import { describe, expect, it } from 'vitest';
import { createCatalog } from '../catalog/index.ts';
import { defaultRuleset } from '../../content/rulesets/default.ts';
import { makeKnight } from '../abilities/test-fixtures.ts';
import { activeTurnFor, makeGameState, makeUnit } from '../ct/test-fixtures.ts';
import { reduceUseAbility } from './reducers.ts';
import {
  abilityId,
  type ActiveAbilityDefinition,
  type BattleMap,
  type DamageTag,
} from '../types/index.ts';

// ===========================================================================
// Item 16 — Knockback-into-water (ridge elev 7 → shallow water elev 1)
// ===========================================================================

describe('Session 32 Item 16 — knockback-into-water end-to-end', () => {
  // A test ability that deals magical damage with a 1-tile knockback rider.
  // Damage stays low so the fall damage is what dominates; the rider's
  // direction resolves caster→target cardinal (E from the caster's POV).
  function knockSpell(): ActiveAbilityDefinition {
    return {
      id: abilityId('test_ridge_blast'),
      name: 'Test Ridge Blast',
      kind: 'active',
      bucket: 'first_action' as unknown as ActiveAbilityDefinition['bucket'],
      availability: 'hidden',
      cost: { mp: 0 },
      targeting: { kind: 'single_unit', range: { horizontal: 4, vertical: 8 } },
      effects: {
        damage: {
          tags: ['magical', 'water'] as DamageTag[],
          power_coefficient: 1,
          variance: { min: 1, max: 1 },
          knockback: { distance: 1 },
        },
      },
      actionSpeed: 0,
      aoe: { kind: 'single' },
    } as unknown as ActiveAbilityDefinition;
  }

  // 3×1 map. Caster at (0,0) elev 7 (will be displaced — not testing the
  // caster). Target at (1,0) elev 7 (ridge). Shallow water at (2,0) elev 1.
  // Cast on the target → knockback rider pushes E (from caster's POV) →
  // target ends at (2,0) on the water tile with dropDistance 6.
  function ridgeMap(): BattleMap {
    return {
      width: 3,
      height: 1,
      tiles: [
        { x: 0, y: 0, layer: 0, elevation: 7, terrain: 'ground', properties: [] },
        { x: 1, y: 0, layer: 0, elevation: 7, terrain: 'ground', properties: [] },
        { x: 2, y: 0, layer: 0, elevation: 1, terrain: 'water', properties: [] },
      ],
    };
  }

  it('target lands on shallow water at elev 1 with dropDistance 6 + fall-damage system_damage emission', () => {
    const ability = knockSpell();
    const cat = createCatalog({
      statusTypes: [],
      abilities: [ability],
      commandSets: [],
      classes: [makeKnight()],
      items: [],
      rulesets: [defaultRuleset],
    });

    const caster = makeUnit({
      id: 'caster',
      spd: 10,
      ma: 5,
      faith: 100,
      position: { x: 0, y: 0, layer: 0 },
    });
    const target = makeUnit({
      id: 'target',
      spd: 10,
      hp: 999,
      team: 'team_b',
      faith: 100,
      position: { x: 1, y: 0, layer: 0 },
    });

    const state = makeGameState({
      units: [caster, target],
      map: ridgeMap(),
      turnState: activeTurnFor(caster.id),
    });

    const action = {
      sequenceNumber: 1,
      source: 'player' as const,
      timestamp: { tick: 0, ct: 0 },
      seed: 1,
      chainDepth: 0,
      isReaction: false,
      actorId: caster.id,
      type: 'use_ability' as const,
      payload: {
        abilityId: ability.id,
        target: { kind: 'unit' as const, unitId: target.id },
      },
    };

    const result = reduceUseAbility(state, action, cat);
    const outcome = result.outcome;
    if (outcome.kind !== 'use_ability') throw new Error('expected use_ability outcome');
    expect(outcome.perTargetResults.length).toBeGreaterThan(0);
    const r = outcome.perTargetResults[0]!;
    expect(r.hit).toBe(true);

    // Engine state: the target is now on the water tile.
    expect(result.newState.units.get(target.id)!.position).toEqual({
      x: 2,
      y: 0,
      layer: 0,
    });

    // Per-target result records the displacement (renderer reads this).
    expect(r.displacedTo).toEqual({ x: 2, y: 0, layer: 0 });

    // Fall-damage `system_damage` action emitted into generatedActions
    // (the pipeline emissions get forwarded to the reaction chain). The
    // knockback primitive emits 10 × dropDistance per ADR-0026; here
    // dropDistance = 6 so amount = 60.
    const falling = result.generatedActions.find(
      (a) =>
        a.type === 'system_damage' &&
        a.payload.source.kind === 'falling' &&
        a.payload.targetId === target.id,
    );
    expect(falling).toBeDefined();
    if (falling !== undefined && falling.type === 'system_damage') {
      expect(falling.payload.amount).toBe(60);
      if (falling.payload.source.kind === 'falling') {
        expect(falling.payload.source.dropDistance).toBe(6);
      }
    }
  });
});
