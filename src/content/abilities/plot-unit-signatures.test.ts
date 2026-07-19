// TABA chapter-1 plot-unit signatures — integration against the real catalog.
//
// Each signature rides a seam that is itself unit-tested (Seam 1 scenarioTier +
// onTurnStart; Seam 2 cover). These tests prove the CONTENT wiring: Ascendant
// Flame's fire multiplier fires with the chapter-scaled factor, Bulwark Oath is
// found as a coverer and redirects, Tidal Cadence pushes chapter-scaled CT to
// allies only.

import { describe, expect, it } from 'vitest';
import {
  abilityId,
  bucketId,
  type Action,
  type GameState,
} from '@engine/index.ts';
import { loadDefaultCatalog } from '../index.ts';
import { runDamagePipeline } from '../../engine/damage/pipeline.ts';
import { defaultDamageHandlers } from '../../engine/damage/default-handlers.ts';
import { reduceTurnStart } from '../../engine/actions/reducers.ts';
import { expectActiveAbility } from '../../engine/actions/validate.ts';
import { makeGameState, makeUnit } from '../../engine/ct/test-fixtures.ts';
import { flatMap } from '../../engine/map/test-fixtures.ts';
import { loadoutOf } from '../../engine/abilities/test-fixtures.ts';
import { bulwarkOath } from './bulwark-oath.ts';

const catalog = loadDefaultCatalog();
const SUPPORT = bucketId('support');

function atTier(state: GameState, tier: number): GameState {
  return { ...state, scenarioTier: tier };
}

function turnStart(unitId: ReturnType<typeof makeUnit>['id']): Extract<Action, { type: 'turn_start' }> {
  return {
    type: 'turn_start',
    source: 'system',
    sequenceNumber: 1,
    timestamp: { tick: 0, ct: 0 },
    seed: 0,
    chainDepth: 0,
    isReaction: false,
    payload: { unitId },
  };
}

describe('Ascendant Flame (Lumen) — chapter-scaled fire multiplier', () => {
  const fire = expectActiveAbility(catalog, abilityId('fire_strike')); // ['magical','fire']
  const physical = expectActiveAbility(catalog, abilityId('power_attack')); // physical, no fire

  function lumenVs(ability: typeof fire, tier: number) {
    const lumen = makeUnit({
      id: 'lumen',
      spd: 10,
      ma: 8,
      pa: 8,
      classId: 'fire_mage',
      loadout: loadoutOf({ passive: [[SUPPORT, [abilityId('ascendant_flame')]]] }),
    });
    const target = makeUnit({ id: 't', spd: 10, team: 'team_b', hp: 200, maxHpBase: 200 });
    const state = atTier(makeGameState({ units: [lumen, target] }), tier);
    return runDamagePipeline({
      state,
      catalog,
      attacker: lumen,
      target,
      ability,
      sourceActionSeq: 0,
      seed: 0,
      registry: defaultDamageHandlers,
    });
  }

  it('multiplies fire damage by 1 + 0.1 × chapter (×1.1 / ×1.3)', () => {
    const flameMul = (ctx: ReturnType<typeof lumenVs>) =>
      ctx.multipliers.find((m) => m.source === 'ascendant_flame');
    expect(flameMul(lumenVs(fire, 1))?.factor).toBeCloseTo(1.1, 5);
    expect(flameMul(lumenVs(fire, 3))?.factor).toBeCloseTo(1.3, 5);
  });

  it('does NOT touch non-fire damage', () => {
    const ctx = lumenVs(physical, 3);
    expect(ctx.multipliers.some((m) => m.source === 'ascendant_flame')).toBe(false);
  });
});

describe('Bulwark Oath (Chris) — cover wiring', () => {
  it('declares the intended cover params', () => {
    expect(bulwarkOath.coverParams).toEqual({ redirectPerTier: 0.1, range: 1, verticalTolerance: 3 });
  });

  it('redirects a chapter-scaled share of an adjacent ally’s hit onto Chris', () => {
    const attacker = makeUnit({ id: 'att', spd: 10, pa: 8, team: 'team_b', position: { x: 5, y: 0, layer: 0 } });
    const ally = makeUnit({ id: 'ally', spd: 10, team: 'team_a', position: { x: 0, y: 0, layer: 0 }, hp: 200, maxHpBase: 200 });
    const chris = makeUnit({
      id: 'chris',
      spd: 10,
      team: 'team_a',
      position: { x: 1, y: 0, layer: 0 },
      hp: 200,
      maxHpBase: 200,
      loadout: loadoutOf({ passive: [[SUPPORT, [abilityId('bulwark_oath')]]] }),
    });
    const attack = expectActiveAbility(catalog, abilityId('power_attack'));
    // S96: the cover vertical gate reads tile elevations — supply a real map.
    const state = atTier(makeGameState({ units: [attacker, ally, chris], map: flatMap(6, 1) }), 2); // 20 % at chapter 2
    const ctx = runDamagePipeline({
      state,
      catalog,
      attacker,
      target: ally,
      ability: attack,
      sourceActionSeq: 0,
      seed: 0,
      registry: defaultDamageHandlers,
    });
    // The ally's hit is reduced (a negative cover additive) and a redirect is emitted at Chris.
    expect(ctx.additives.some((a) => a.source === 'cover' && a.amount < 0)).toBe(true);
    const redirect = (ctx.emittedActions ?? []).find((a) => a.type === 'system_cover_redirect');
    expect(redirect).toBeDefined();
    expect((redirect as Extract<Action, { type: 'system_cover_redirect' }>).payload.coverId).toBe(chris.id);
  });
});

describe('Tidal Cadence (Clio) — chapter-scaled team CT', () => {
  it('pushes 3 × chapter CT to each living ally, not to herself or enemies', () => {
    const clio = makeUnit({
      id: 'clio',
      spd: 10,
      team: 'team_a',
      classId: 'water_mage',
      loadout: loadoutOf({ passive: [[SUPPORT, [abilityId('tidal_cadence')]]] }),
    });
    const ally1 = makeUnit({ id: 'a1', spd: 8, team: 'team_a', hp: 100, maxHpBase: 100 });
    const ally2 = makeUnit({ id: 'a2', spd: 8, team: 'team_a', hp: 100, maxHpBase: 100 });
    const enemy = makeUnit({ id: 'e', spd: 8, team: 'team_b', hp: 100, maxHpBase: 100 });
    const koAlly = makeUnit({ id: 'ko', spd: 8, team: 'team_a', hp: 0, maxHpBase: 100 });
    const state = atTier(makeGameState({ units: [clio, ally1, ally2, enemy, koAlly] }), 2);

    const { generatedActions } = reduceTurnStart(state, turnStart(clio.id), catalog);
    const pushes = generatedActions.filter((a) => a.type === 'system_ct_push');
    const targets = new Set(
      pushes.map((a) => String((a as Extract<Action, { type: 'system_ct_push' }>).payload.targetId)),
    );
    // Both living allies, and nobody else.
    expect(targets).toEqual(new Set(['a1', 'a2']));
    for (const p of pushes) {
      expect((p as Extract<Action, { type: 'system_ct_push' }>).payload.delta).toBe(6); // 3 × chapter 2
    }
  });
});
