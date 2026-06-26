// Session 74 — Ring of Caliora: magical-hit CT drain (ADR-0126).
//
// MA +2, and the wearer's damaging spells reduce the target's CT by 20% of
// the damage dealt — a negative `system_ct_push` fired from the existing
// `onFinalDamage` hook (the Rasp Pendant MP-drain pattern), gated to
// magical, non-absorbed hits. The CT-push reducer floors CT at 0 — the only
// guardrail (no per-hit cap, per Chris's S74 call).
//
// Two layers:
//   1. Contributor mechanics (constructed catalog): proportional drain on a
//      single magical hit; physical hits don't drain (the magical gate); the
//      0-floor holds.
//   2. Field-wide Calculator (default catalog): Precision Fire drains CT off
//      every matched enemy in one cast — the brief's epicenter case — and a
//      low-CT match floors at 0.

import { describe, expect, it } from 'vitest';
import {
  abilityId,
  bucketId,
  commandSetId,
  commitAction,
  teamId,
  unitId,
  type ActiveAbilityDefinition,
  type GameState,
  type ItemId,
  type ProposedAction,
  type UnitEquipment,
} from '@engine/index.ts';
import { createCatalog } from '../catalog/index.ts';
import { defaultRuleset } from '../../content/rulesets/default.ts';
import { makeKnight } from '../abilities/test-fixtures.ts';
import { makeGameState, makeUnit } from '../ct/test-fixtures.ts';
import { ringOfCaliora } from '../../content/items/ring-of-caliora.ts';
import { loadDefaultCatalog } from '../../content/index.ts';

const FIRST = bucketId('first_action');

function withRing(accessory: ItemId | null): UnitEquipment {
  return { leftHand: null, rightHand: null, headgear: null, armor: null, accessory };
}

function flatMap(w: number, h: number): GameState['map'] {
  return {
    width: w, height: h,
    tiles: Array.from({ length: w * h }, (_, i) => ({
      x: i % w, y: Math.floor(i / w), layer: 0, elevation: 0, terrain: 'ground' as const, properties: [],
    })),
  };
}

function turnState(actorId: string): GameState['turnState'] {
  return {
    unitId: unitId(actorId),
    budget: { movesAvailable: 1, actsAvailable: 1 },
    consumed: { movesConsumed: 0, actsConsumed: 0 },
    reactionsUsedThisTurn: new Map(),
  };
}

// ---------------------------------------------------------------------------
// 1. Contributor mechanics — constructed catalog, single hit.
// ---------------------------------------------------------------------------

const magicalBolt: ActiveAbilityDefinition = {
  id: abilityId('test_magical_bolt'),
  name: 'Test Magical Bolt',
  kind: 'active',
  bucket: FIRST,
  baseCost: 1,
  availability: 'hidden',
  targeting: { kind: 'single_unit', range: { horizontal: 9, vertical: 9 }, rangeMode: 'arc' },
  actionSpeed: 0,
  mpCost: 0,
  effects: { damage: { tags: ['magical'], power_coefficient: 5 } },
};

const physicalJab: ActiveAbilityDefinition = {
  id: abilityId('test_physical_jab'),
  name: 'Test Physical Jab',
  kind: 'active',
  bucket: FIRST,
  baseCost: 1,
  availability: 'hidden',
  targeting: { kind: 'single_unit', range: { horizontal: 9, vertical: 9 }, rangeMode: 'melee' },
  actionSpeed: 0,
  mpCost: 0,
  hitRoll: {},
  effects: { damage: { tags: ['physical'], power_coefficient: 5 } },
};

function customCatalog() {
  return createCatalog({
    statusTypes: [],
    abilities: [magicalBolt, physicalJab],
    commandSets: [{ id: commandSetId('test_spells'), name: 'TS', members: [magicalBolt.id, physicalJab.id], baseCost: 1, availability: 'hidden' }],
    classes: [makeKnight()],
    items: [ringOfCaliora],
    rulesets: [defaultRuleset],
  });
}

function caster(ringed: boolean) {
  return makeUnit({
    id: 'caster', spd: 10, ma: 6, pa: 6, mp: 20, faith: 100, ct: 100,
    position: { x: 0, y: 0, layer: 0 },
    loadout: { actionBuckets: { [FIRST]: [commandSetId('test_spells')] }, passiveBuckets: {} },
    equipment: withRing(ringed ? ringOfCaliora.id : null),
  });
}

function foe(ct: number, hp = 1000) {
  return makeUnit({
    id: 'foe', team: 'team_b', spd: 10, faith: 100, hp, ct,
    position: { x: 1, y: 0, layer: 0 },
  });
}

function castOf(actorId: string, abId: string): ProposedAction {
  return {
    type: 'use_ability', source: 'player', actorId: unitId(actorId),
    payload: { abilityId: abilityId(abId), target: { kind: 'unit', unitId: unitId('foe') } },
  };
}

function damageFrom(committed: ReadonlyArray<{ type: string; outcome?: unknown }>): number {
  const use = committed.find((a) => a.type === 'use_ability');
  const out = use?.outcome as { perTargetResults?: ReadonlyArray<{ damage?: number }> } | undefined;
  return out?.perTargetResults?.[0]?.damage ?? 0;
}

describe('S74 Ring of Caliora — contributor mechanics', () => {
  const cat = customCatalog();

  it('drains 20% of magical damage from the target CT', () => {
    const state = makeGameState({ units: [caster(true), foe(50)], map: flatMap(4, 4), turnState: turnState('caster') });
    const r = commitAction(state, castOf('caster', 'test_magical_bolt'), cat);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const dmg = damageFrom(r.committed);
    expect(dmg).toBeGreaterThan(0);
    const foeAfter = r.newState.units.get(unitId('foe'))!;
    expect(foeAfter.ct).toBe(50 - Math.floor(dmg * 0.2));
  });

  it('does not drain when the wearer is not equipped (control)', () => {
    const state = makeGameState({ units: [caster(false), foe(50)], map: flatMap(4, 4), turnState: turnState('caster') });
    const r = commitAction(state, castOf('caster', 'test_magical_bolt'), cat);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.newState.units.get(unitId('foe'))!.ct).toBe(50);
  });

  it('does not drain on a physical hit (the magical gate)', () => {
    const state = makeGameState({ units: [caster(true), foe(50)], map: flatMap(4, 4), turnState: turnState('caster') });
    const r = commitAction(state, castOf('caster', 'test_physical_jab'), cat);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.newState.units.get(unitId('foe'))!.ct).toBe(50);
    expect(r.committed.some((a) => a.type === 'system_ct_push')).toBe(false);
  });

  it('floors the target CT at 0 (no per-hit cap, but never negative)', () => {
    const state = makeGameState({ units: [caster(true), foe(3)], map: flatMap(4, 4), turnState: turnState('caster') });
    const r = commitAction(state, castOf('caster', 'test_magical_bolt'), cat);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    // 20% of ~30 damage = ~6 > the foe's CT of 3 → floored at 0.
    expect(r.newState.units.get(unitId('foe'))!.ct).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 2. Field-wide Calculator — the brief's epicenter case.
// ---------------------------------------------------------------------------

describe('S74 Ring of Caliora — field-wide Calculator (Precision Fire)', () => {
  const cat = loadDefaultCatalog();

  function calcCaster() {
    return makeUnit({
      id: 'calc', classId: 'calculator', spd: 10, ma: 12, mp: 99, faith: 100, ct: 97,
      position: { x: 0, y: 0, layer: 0 },
      loadout: { actionBuckets: { [FIRST]: [commandSetId('math_skill')] }, passiveBuckets: {} },
      equipment: withRing(ringOfCaliora.id),
    });
  }
  function enemy(id: string, ct: number, x: number) {
    return makeUnit({ id, team: 'team_b', spd: 10, faith: 100, hp: 1000, ct, position: { x, y: 1, layer: 0 } });
  }

  function castMath(): ProposedAction {
    return {
      type: 'use_ability', source: 'player', actorId: unitId('calc'),
      payload: { abilityId: abilityId('precision_fire'), target: { kind: 'math_skill', parameter: 'ct', value: 5 } },
    };
  }

  it('drains CT off every matched enemy in one cast; low-CT matches floor at 0', () => {
    // Three enemies at CT divisible by 5 (all match value 5). The caster at
    // CT 97 does not match. foe_low starts at CT 5 — below the per-hit drain
    // → floors at 0.
    const units = [calcCaster(), enemy('foe_a', 50, 1), enemy('foe_b', 50, 2), enemy('foe_low', 5, 3)];
    const state = makeGameState({
      units,
      map: { width: 6, height: 4, tiles: Array.from({ length: 24 }, (_, i) => ({
        x: i % 6, y: Math.floor(i / 6), layer: 0, elevation: 0, terrain: 'ground' as const, properties: [],
      })) },
      teams: [
        { id: teamId('team_a'), name: 'A', control: 'ai' },
        { id: teamId('team_b'), name: 'B', control: 'ai' },
      ],
      turnState: turnState('calc'),
    });
    const r = commitAction(state, castMath(), cat);
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    // Per-target damage from the cast outcome.
    const use = r.committed.find((a) => a.type === 'use_ability');
    const out = use?.outcome as { perTargetResults?: ReadonlyArray<{ target: unknown; damage?: number }> } | undefined;
    const results = out?.perTargetResults ?? [];
    expect(results.length).toBeGreaterThanOrEqual(3); // three enemies matched

    const drainOf = (dmg: number) => Math.floor(dmg * 0.2);
    const dmgA = damageToUnit(r.committed, 'foe_a');
    expect(dmgA).toBeGreaterThan(0);

    const foeA = r.newState.units.get(unitId('foe_a'))!;
    const foeB = r.newState.units.get(unitId('foe_b'))!;
    const foeLow = r.newState.units.get(unitId('foe_low'))!;
    expect(foeA.ct).toBe(50 - drainOf(dmgA));
    expect(foeB.ct).toBe(50 - drainOf(damageToUnit(r.committed, 'foe_b')));
    expect(foeLow.ct).toBe(0); // drain exceeds CT 5 → floored
    // The whole enemy team lost tempo from a single cast (the flagged
    // soft-lock pressure — deliberately uncapped).
    expect(foeA.ct).toBeLessThan(50);
    expect(foeB.ct).toBeLessThan(50);
  });
});

function damageToUnit(
  committed: ReadonlyArray<{ type: string; outcome?: unknown }>,
  id: string,
): number {
  const use = committed.find((a) => a.type === 'use_ability');
  const out = use?.outcome as
    | { perTargetResults?: ReadonlyArray<{ target: { kind: string; unitId?: string }; damage?: number }> }
    | undefined;
  const hit = out?.perTargetResults?.find((r) => r.target.kind === 'unit' && r.target.unitId === unitId(id));
  return hit?.damage ?? 0;
}
