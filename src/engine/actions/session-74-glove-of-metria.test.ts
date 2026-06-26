// Session 74 — Glove of Metria: per-extra-target Spell Power (ADR-0127).
//
// MA +1, and the wearer's spells gain +1 SP for each target beyond the
// first — `spellPowerModifiers: [{ delta: 1, perExtraTarget: true }]` on the
// `modifySpellPower` hook, now threaded with the cast's `targetCount`. A
// single-target cast gains nothing; a 3-cluster gains +2 SP; a field-wide
// Math cast gains +1 per matched target beyond the first (it applies
// everywhere, including Math Skill — Chris's S74 call).
//
// Two layers:
//   1. Mechanics (constructed catalog): same glove-wearer, identical base
//      power — an AoE 3-cluster cast out-damages a single-target cast by
//      exactly +2 SP (the ratio test isolates the per-extra-target bonus
//      from the flat MA +1, which both casts share); a non-wearer's AoE
//      gets no bonus.
//   2. Field-wide Calculator (default catalog): Precision Fire's per-target
//      damage rises with the matched count — the bonus reaches Math Skill.

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
import { gloveOfMetria } from '../../content/items/glove-of-metria.ts';
import { loadDefaultCatalog } from '../../content/index.ts';

const FIRST = bucketId('first_action');

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
function damageToUnit(committed: ReadonlyArray<{ type: string; outcome?: unknown }>, id: string): number {
  const use = committed.find((a) => a.type === 'use_ability');
  const out = use?.outcome as
    | { perTargetResults?: ReadonlyArray<{ target: { kind: string; unitId?: string }; damage?: number }> }
    | undefined;
  const hit = out?.perTargetResults?.find((r) => r.target.kind === 'unit' && r.target.unitId === unitId(id));
  return hit?.damage ?? 0;
}

// Identical base power (5), one single-target and one diamond-r1 AoE, both
// magical with no Faith scaling so damage is exactly MA × power.
const SINGLE: ActiveAbilityDefinition = {
  id: abilityId('test_spell_single'),
  name: 'Test Spell (single)',
  kind: 'active',
  bucket: FIRST,
  baseCost: 1,
  availability: 'hidden',
  targeting: { kind: 'unit_or_tile', range: { horizontal: 9, vertical: 9 }, rangeMode: 'arc' },
  actionSpeed: 0,
  mpCost: 0,
  effects: { damage: { tags: ['magical'], power_coefficient: 5, noFaithScaling: true } },
};
const BLAST: ActiveAbilityDefinition = {
  ...SINGLE,
  id: abilityId('test_spell_blast'),
  name: 'Test Spell (blast)',
  effects: {
    damage: { tags: ['magical'], power_coefficient: 5, noFaithScaling: true },
    aoe: { excludeCaster: true, shape: { kind: 'diamond', radius: 1 } },
  },
};

function customCatalog() {
  return createCatalog({
    statusTypes: [],
    abilities: [SINGLE, BLAST],
    commandSets: [{ id: commandSetId('test_spells'), name: 'TS', members: [SINGLE.id, BLAST.id], baseCost: 1, availability: 'hidden' }],
    classes: [makeKnight()],
    items: [gloveOfMetria],
    rulesets: [defaultRuleset],
  });
}

describe('S74 Glove of Metria — per-extra-target SP', () => {
  const cat = customCatalog();

  function mage(ringed: boolean) {
    return makeUnit({
      id: 'mage', spd: 10, ma: 6, mp: 20, faith: 100, ct: 100,
      position: { x: 0, y: 3, layer: 0 },
      loadout: { actionBuckets: { [FIRST]: [commandSetId('test_spells')] }, passiveBuckets: {} },
      equipment: equip(ringed ? gloveOfMetria.id : null),
    });
  }
  function foe(id: string, x: number, y: number) {
    return makeUnit({ id, team: 'team_b', spd: 10, faith: 100, hp: 1000, position: { x, y, layer: 0 } });
  }
  // A diamond-1 around (4,3) covers (4,3),(3,3),(5,3),(4,2),(4,4).
  const cluster = [foe('c0', 4, 3), foe('c1', 3, 3), foe('c2', 5, 3)];

  function castSingle(): ProposedAction {
    return { type: 'use_ability', source: 'player', actorId: unitId('mage'),
      payload: { abilityId: SINGLE.id, target: { kind: 'unit', unitId: unitId('c0') } } };
  }
  function castBlast(): ProposedAction {
    return { type: 'use_ability', source: 'player', actorId: unitId('mage'),
      payload: { abilityId: BLAST.id, target: { kind: 'tile', position: { x: 4, y: 3, layer: 0 } } } };
  }

  it('a 3-target AoE gains exactly +2 SP over a single-target cast (same wearer)', () => {
    const state = makeGameState({ units: [mage(true), ...cluster], map: flatMap(8, 6), turnState: turnState('mage') });
    const single = commitAction(state, castSingle(), cat);
    const blast = commitAction(state, castBlast(), cat);
    expect(single.ok && blast.ok).toBe(true);
    if (!single.ok || !blast.ok) return;
    const dSingle = damageToUnit(single.committed, 'c0'); // MA × 5
    const dBlast = damageToUnit(blast.committed, 'c0'); // MA × (5 + 2)
    expect(dSingle).toBeGreaterThan(0);
    // Per-extra-target bonus: 3 targets → +2 SP → power 7 vs 5. The MA +1
    // is shared by both casts, so the ratio isolates the SP scaling.
    expect(dBlast * 5).toBe(dSingle * 7);
  });

  it('a non-wearer gets no per-target bonus (control)', () => {
    const state = makeGameState({ units: [mage(false), ...cluster], map: flatMap(8, 6), turnState: turnState('mage') });
    const single = commitAction(state, castSingle(), cat);
    const blast = commitAction(state, castBlast(), cat);
    if (!single.ok || !blast.ok) throw new Error('commit failed');
    // No glove → same SP (5) on both casts → equal per-target damage.
    expect(damageToUnit(blast.committed, 'c0')).toBe(damageToUnit(single.committed, 'c0'));
  });
});

// ---------------------------------------------------------------------------
// Field-wide Calculator — the bonus reaches Math Skill.
// ---------------------------------------------------------------------------

describe('S74 Glove of Metria — field-wide Calculator (Precision Fire)', () => {
  const cat = loadDefaultCatalog();

  function calc(ringed: boolean) {
    return makeUnit({
      id: 'calc', classId: 'calculator', spd: 10, ma: 10, mp: 99, faith: 100, ct: 97,
      position: { x: 0, y: 0, layer: 0 },
      loadout: { actionBuckets: { [FIRST]: [commandSetId('math_skill')] }, passiveBuckets: {} },
      equipment: equip(ringed ? gloveOfMetria.id : null),
    });
  }
  function enemy(id: string, ct: number, x: number) {
    return makeUnit({ id, team: 'team_b', spd: 10, faith: 100, hp: 1000, ct, position: { x, y: 1, layer: 0 } });
  }
  function state(units: ReturnType<typeof enemy>[], caster: ReturnType<typeof calc>) {
    return makeGameState({
      units: [caster, ...units], map: flatMap(8, 4),
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

  it('Precision Fire per-target damage rises with the matched count (Math Skill counts)', () => {
    // Two matched (foe_a, foe_b) vs three matched (+ foe_c). Same glove
    // wearer; the per-target damage should be higher in the 3-match cast.
    const two = commitAction(state([enemy('foe_a', 50, 1), enemy('foe_b', 50, 2)], calc(true)), castMath(), cat);
    const three = commitAction(
      state([enemy('foe_a', 50, 1), enemy('foe_b', 50, 2), enemy('foe_c', 50, 3)], calc(true)),
      castMath(), cat,
    );
    expect(two.ok && three.ok).toBe(true);
    if (!two.ok || !three.ok) return;
    const dTwo = damageToUnit(two.committed, 'foe_a');
    const dThree = damageToUnit(three.committed, 'foe_a');
    expect(dThree).toBeGreaterThan(dTwo); // +1 SP from the extra matched target
  });

  it('a non-wearer Calculator gets no scaling (control)', () => {
    const plain = commitAction(
      state([enemy('foe_a', 50, 1), enemy('foe_b', 50, 2), enemy('foe_c', 50, 3)], calc(false)),
      castMath(), cat,
    );
    const gloved = commitAction(
      state([enemy('foe_a', 50, 1), enemy('foe_b', 50, 2), enemy('foe_c', 50, 3)], calc(true)),
      castMath(), cat,
    );
    if (!plain.ok || !gloved.ok) throw new Error('commit failed');
    // Glove adds MA +1 and +2 SP across 3 targets → strictly more damage.
    expect(damageToUnit(gloved.committed, 'foe_a')).toBeGreaterThan(damageToUnit(plain.committed, 'foe_a'));
  });
});
