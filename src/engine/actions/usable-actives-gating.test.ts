// TABA M2 progression — engine-side active gating.
// `Unit.usableActives` is an opaque per-unit allowlist: when present, a
// VOLITIONAL `use_ability` is legal only if the ability is in the set; when
// absent, every active is usable (the Mage War default — engine stays
// progression-ignorant). Rider/reaction casts bypass the gate.

import { describe, expect, it } from 'vitest';
import { makeAbilitiesCatalog, makeActive } from '../abilities/test-fixtures.ts';
import { activeTurnFor, makeGameState, makeUnit } from '../ct/test-fixtures.ts';
import { flatMap } from '../map/test-fixtures.ts';
import { abilityId, unitId, type ProposedAction, type Unit } from '../types/index.ts';
import { validateAction } from './validate.ts';

const cat = makeAbilitiesCatalog({
  abilities: [makeActive({ id: 'unlocked_x' }), makeActive({ id: 'locked_x' })],
});

function selfCast(ability: string): ProposedAction {
  return {
    type: 'use_ability',
    source: 'player',
    actorId: unitId('u1'),
    payload: { abilityId: abilityId(ability), target: { kind: 'self' } },
  };
}

// A ready-to-act unit, optionally carrying a usableActives allowlist.
function actor(usable?: ReadonlyArray<string>): Unit {
  const base = makeUnit({ id: 'u1', spd: 10 });
  return usable === undefined
    ? base
    : { ...base, usableActives: new Set(usable.map((a) => abilityId(a))) };
}

function stateWith(u: Unit) {
  return makeGameState({ units: [u], map: flatMap(3, 3), turnState: activeTurnFor(u.id) });
}

describe('validateUseAbility — usableActives gate', () => {
  it('allows any active when the unit has NO allowlist (undefined ⇒ ungated)', () => {
    const res = validateAction(stateWith(actor()), selfCast('locked_x'), cat);
    expect(res.valid).toBe(true);
  });

  it('allows an active that IS in the allowlist', () => {
    const res = validateAction(stateWith(actor(['unlocked_x'])), selfCast('unlocked_x'), cat);
    expect(res.valid).toBe(true);
  });

  it('rejects an active that is NOT in the allowlist (locked)', () => {
    const res = validateAction(stateWith(actor(['unlocked_x'])), selfCast('locked_x'), cat);
    expect(res.valid).toBe(false);
    expect(res.reason).toMatch(/locked/i);
  });

  it('an empty allowlist locks everything', () => {
    const res = validateAction(stateWith(actor([])), selfCast('unlocked_x'), cat);
    expect(res.valid).toBe(false);
  });
});
