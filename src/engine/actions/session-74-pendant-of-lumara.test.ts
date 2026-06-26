// Session 74 — Pendant of Lumara: doubles the wearer's outgoing Burn
// (ADR-0128).
//
// MA +2, and each Burn stack the wearer applies is doubled. Burn's
// `composeApplyState` now routes its per-stack MA-derived damage through the
// caster-side `modifyOutgoingStatusMagnitude` hook (generalized from the S72
// buff-only Aura Mastery path); the Pendant contributes an equipment handler
// that ×2's Burn specifically. Aura Mastery's handler gates on `amplifiable`
// (Burn isn't), so the two amplifiers stay independent.
//
// Two layers:
//   1. Mechanics (constructed catalog): an applyAlways Burn-applier lands a
//      stack worth exactly 2× the base per-stack value (a same-MA non-wearer
//      control isolates the doubling from the flat MA +2). The doubled value
//      is baked into the stack (survives, FIFO-drops, etc.).
//   2. Field-wide Calculator (default catalog): Precision Fire's Burn is
//      doubled on a matched enemy — the amplifier reaches Math Skill.

import { describe, expect, it } from 'vitest';
import {
  abilityId,
  bucketId,
  commandSetId,
  commitAction,
  statusTypeId,
  teamId,
  unitId,
  type ActiveAbilityDefinition,
  type GameState,
  type ItemId,
  type ProposedAction,
  type StatusInstance,
  type UnitEquipment,
} from '@engine/index.ts';
import { createCatalog } from '../catalog/index.ts';
import { defaultRuleset } from '../../content/rulesets/default.ts';
import { makeKnight } from '../abilities/test-fixtures.ts';
import { makeGameState, makeUnit } from '../ct/test-fixtures.ts';
import { burn } from '../../content/statuses/burn.ts';
import { pendantOfLumara } from '../../content/items/pendant-of-lumara.ts';
import { loadDefaultCatalog } from '../../content/index.ts';

const FIRST = bucketId('first_action');
const BURN = statusTypeId('burn');

function equip(accessory: ItemId | null): UnitEquipment {
  return { leftHand: null, rightHand: null, headgear: null, armor: null, accessory };
}
function turnState(actorId: string): GameState['turnState'] {
  return {
    unitId: unitId(actorId),
    budget: { movesAvailable: 1, actsAvailable: 1 },
    consumed: { movesConsumed: 0, actsConsumed: 0 },
    reactionsUsedThisTurn: new Map(),
  };
}
function flatMap(w: number, h: number): GameState['map'] {
  return {
    width: w, height: h,
    tiles: Array.from({ length: w * h }, (_, i) => ({
      x: i % w, y: Math.floor(i / w), layer: 0, elevation: 0, terrain: 'ground' as const, properties: [],
    })),
  };
}
function burnStackDamages(unit: { statuses: ReadonlyArray<StatusInstance> } | undefined): ReadonlyArray<number> {
  const b = unit?.statuses.find((s) => s.typeId === BURN);
  const sd = (b?.customState as { stackDamages?: ReadonlyArray<number> } | undefined)?.stackDamages;
  return Array.isArray(sd) ? sd : [];
}

// An always-landing single-stack Burn applier (no damage) — deterministic.
const igniteOne: ActiveAbilityDefinition = {
  id: abilityId('test_ignite_one'),
  name: 'Test Ignite',
  kind: 'active',
  bucket: FIRST,
  baseCost: 1,
  availability: 'hidden',
  targeting: { kind: 'single_unit', range: { horizontal: 9, vertical: 9 }, rangeMode: 'arc' },
  actionSpeed: 0,
  mpCost: 0,
  effects: { statusEffects: [{ typeId: BURN, target: 'primary_target', applyAlways: true }] },
};

function customCatalog() {
  return createCatalog({
    statusTypes: [burn],
    abilities: [igniteOne],
    commandSets: [{ id: commandSetId('test_spells'), name: 'TS', members: [igniteOne.id], baseCost: 1, availability: 'hidden' }],
    classes: [makeKnight()],
    items: [pendantOfLumara],
    rulesets: [defaultRuleset],
  });
}

describe('S74 Pendant of Lumara — Burn doubling', () => {
  const cat = customCatalog();

  // Wearer: baseStats.ma 4 + Pendant +2 → effective MA 6.
  // Control: baseStats.ma 6, no Pendant → effective MA 6 (same base
  // per-stack), so the only difference is the ×2 amplifier.
  function applier(ma: number, ringed: boolean) {
    return makeUnit({
      id: 'applier', spd: 10, ma, mp: 20, faith: 100, ct: 100,
      position: { x: 0, y: 0, layer: 0 },
      loadout: { actionBuckets: { [FIRST]: [commandSetId('test_spells')] }, passiveBuckets: {} },
      equipment: equip(ringed ? pendantOfLumara.id : null),
    });
  }
  function victim() {
    return makeUnit({ id: 'foe', team: 'team_b', spd: 10, faith: 100, hp: 1000, position: { x: 1, y: 0, layer: 0 } });
  }
  function cast(): ProposedAction {
    return { type: 'use_ability', source: 'player', actorId: unitId('applier'),
      payload: { abilityId: igniteOne.id, target: { kind: 'unit', unitId: unitId('foe') } } };
  }

  it('doubles the per-stack Burn damage the wearer applies', () => {
    const ctrl = commitAction(
      makeGameState({ units: [applier(6, false), victim()], map: flatMap(4, 4), turnState: turnState('applier') }),
      cast(), cat,
    );
    const pend = commitAction(
      makeGameState({ units: [applier(4, true), victim()], map: flatMap(4, 4), turnState: turnState('applier') }),
      cast(), cat,
    );
    expect(ctrl.ok && pend.ok).toBe(true);
    if (!ctrl.ok || !pend.ok) return;
    const ctrlStacks = burnStackDamages(ctrl.newState.units.get(unitId('foe')));
    const pendStacks = burnStackDamages(pend.newState.units.get(unitId('foe')));
    expect(ctrlStacks.length).toBe(1);
    expect(pendStacks.length).toBe(1);
    // Same effective MA (6) → same base per-stack; Pendant doubles it.
    expect(ctrlStacks[0]).toBeGreaterThan(0);
    expect(pendStacks[0]).toBe(ctrlStacks[0]! * 2);
  });

  it('a non-wearer applies the base Burn (control already shown; sanity floor)', () => {
    const r = commitAction(
      makeGameState({ units: [applier(6, false), victim()], map: flatMap(4, 4), turnState: turnState('applier') }),
      cast(), cat,
    );
    if (!r.ok) throw new Error('commit failed');
    // MA 6 → floor(6 × 0.6) = 3 per stack, undoubled.
    expect(burnStackDamages(r.newState.units.get(unitId('foe')))[0]).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// Field-wide Calculator — the doubling reaches Precision Fire's Burn.
// ---------------------------------------------------------------------------

describe('S74 Pendant of Lumara — field-wide Calculator (Precision Fire Burn)', () => {
  const cat = loadDefaultCatalog();

  function calc(ringed: boolean) {
    return makeUnit({
      id: 'calc', classId: 'calculator', spd: 10, ma: 10, mp: 99, faith: 100, ct: 97,
      position: { x: 0, y: 0, layer: 0 },
      loadout: { actionBuckets: { [FIRST]: [commandSetId('math_skill')] }, passiveBuckets: {} },
      equipment: equip(ringed ? pendantOfLumara.id : null),
    });
  }
  function enemy(id: string, x: number) {
    return makeUnit({ id, team: 'team_b', spd: 10, faith: 100, hp: 1000, ct: 50, position: { x, y: 1, layer: 0 } });
  }
  function state(ringed: boolean) {
    return makeGameState({
      units: [calc(ringed), enemy('foe_a', 1), enemy('foe_b', 2), enemy('foe_c', 3)],
      map: flatMap(8, 4),
      teams: [
        { id: teamId('team_a'), name: 'A', control: 'ai' },
        { id: teamId('team_b'), name: 'B', control: 'ai' },
      ],
      turnState: turnState('calc'),
    });
  }
  function castMath(): ProposedAction {
    return { type: 'use_ability', source: 'player', actorId: unitId('calc'),
      payload: { abilityId: abilityId('precision_fire'), target: { kind: 'math_skill', parameter: 'ct', value: 5 } } };
  }

  // Effective MA 12 (base 10 + Pendant 2) → base per-stack floor(12×0.6)=7,
  // doubled → 14. Precision Fire's Burn is a probabilistic application, so
  // seed-search a cast where it lands on a matched enemy.
  function firstBurnStack(ringed: boolean): number | null {
    for (let seed = 1; seed <= 24; seed++) {
      const r = commitAction({ ...state(ringed), rng: { masterSeed: seed, nextSeq: 0 } }, castMath(), cat);
      if (!r.ok) continue;
      for (const id of ['foe_a', 'foe_b', 'foe_c']) {
        const stacks = burnStackDamages(r.newState.units.get(unitId(id)));
        if (stacks.length > 0) return stacks[0]!;
      }
    }
    return null;
  }

  it('doubles Precision Fire Burn on a matched enemy (amplifier reaches Math Skill)', () => {
    const withPendant = firstBurnStack(true);
    const without = firstBurnStack(false);
    expect(without).not.toBeNull();
    expect(withPendant).not.toBeNull();
    // Same effective MA path (Pendant adds +2 MA, but we compare the
    // amplifier: base per-stack at MA 12 is 7; Pendant doubles to 14, while
    // a non-wearer at MA 10 lands floor(10×0.6)=6). The wearer's stack is
    // strictly larger and specifically the doubled MA-12 value.
    expect(withPendant!).toBe(14);
    expect(without!).toBe(6);
  });
});
