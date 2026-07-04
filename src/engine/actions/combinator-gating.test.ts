// TABA M2 — engine-side gating of the combinator components (Alchemist items,
// Calculator math parameters/values). Parallel to the `usableActives` gate:
// `usableItems` / `usableMathParameters` / `usableMathValues` are opaque
// per-unit allowlists; `undefined` ⇒ ungated (Mage War default).

import { describe, expect, it } from 'vitest';
import { loadDefaultCatalog } from '@content/index.ts';
import { activeTurnFor, makeGameState, makeUnit } from '../ct/test-fixtures.ts';
import { flatMap } from '../map/test-fixtures.ts';
import {
  abilityId,
  itemId,
  unitId,
  type MathSkillParameter,
  type MathSkillValue,
  type ProposedAction,
  type Unit,
} from '../types/index.ts';
import { validateAction } from './validate.ts';

const catalog = loadDefaultCatalog();

function stateWith(u: Unit) {
  return makeGameState({ units: [u], map: flatMap(5, 5), turnState: activeTurnFor(u.id) });
}

describe('Compound — usableItems gate', () => {
  const compound = (item: string): ProposedAction => ({
    type: 'use_compound',
    source: 'player',
    actorId: unitId('u1'),
    payload: { itemId: itemId(item) },
  });
  const actor = (usable?: ReadonlyArray<string>): Unit => {
    const base = makeUnit({ id: 'u1', spd: 10, mp: 99 });
    return usable === undefined
      ? base
      : { ...base, usableItems: new Set(usable.map((i) => itemId(i))) };
  };

  it('allows any consumable when ungated (undefined)', () => {
    expect(validateAction(stateWith(actor()), compound('potion'), catalog).valid).toBe(true);
  });
  it('allows an unlocked item', () => {
    expect(validateAction(stateWith(actor(['potion'])), compound('potion'), catalog).valid).toBe(true);
  });
  it('rejects a locked item', () => {
    const res = validateAction(stateWith(actor(['potion'])), compound('ether'), catalog);
    expect(res.valid).toBe(false);
    expect(res.reason).toMatch(/locked/i);
  });
});

describe('Throw Item — usableItems gate (fires before the target check)', () => {
  const throwIt = (item: string): ProposedAction => ({
    type: 'use_throw_item',
    source: 'player',
    actorId: unitId('u1'),
    payload: { itemId: itemId(item), target: { kind: 'unit', unitId: unitId('u1') } },
  });
  // Stockpile a locked item (a Field Kit could grant it) — the lock gate must
  // still reject the throw.
  const actor = makeUnit({
    id: 'u1',
    spd: 10,
    stockpile: new Map([[itemId('ether'), 1]]),
  });
  const gated: Unit = { ...actor, usableItems: new Set([itemId('potion')]) };

  it('rejects throwing a stockpiled-but-locked item', () => {
    const res = validateAction(stateWith(gated), throwIt('ether'), catalog);
    expect(res.valid).toBe(false);
    expect(res.reason).toMatch(/locked/i);
  });
});

describe('Math Skill — usableMathParameters / usableMathValues gate', () => {
  const cast = (parameter: MathSkillParameter, value: MathSkillValue): ProposedAction => ({
    type: 'use_ability',
    source: 'player',
    actorId: unitId('u1'),
    payload: { abilityId: abilityId('precision_fire'), target: { kind: 'math_skill', parameter, value } },
  });
  const actor = (params?: ReadonlyArray<MathSkillParameter>, values?: ReadonlyArray<MathSkillValue>): Unit => {
    let u = makeUnit({ id: 'u1', spd: 10, mp: 99 });
    if (params !== undefined) u = { ...u, usableMathParameters: new Set(params) };
    if (values !== undefined) u = { ...u, usableMathValues: new Set(values) };
    return u;
  };

  it('allows any parameter/value when ungated', () => {
    expect(validateAction(stateWith(actor()), cast('ct', 3), catalog).valid).toBe(true);
  });
  it('allows an unlocked parameter + value', () => {
    expect(validateAction(stateWith(actor(['level'], [3])), cast('level', 3), catalog).valid).toBe(true);
  });
  it('rejects a locked parameter', () => {
    const res = validateAction(stateWith(actor(['level'], [3])), cast('ct', 3), catalog);
    expect(res.valid).toBe(false);
    expect(res.reason).toMatch(/parameter.*locked/i);
  });
  it('rejects a locked value', () => {
    const res = validateAction(stateWith(actor(['level'], [3])), cast('level', 4), catalog);
    expect(res.valid).toBe(false);
    expect(res.reason).toMatch(/value.*locked/i);
  });
});
