// S75 — revive targeting + polarity-driven highlight tint.
//
// Two fixes verified here:
//   1. computeLegalTargets offers KO'd-but-not-removed allies as targets for
//      revive abilities (`effects.removeKO`, e.g. the Templar's Raise), which
//      the old `hp <= 0` pre-filter excluded — so Raise highlighted nothing.
//      Non-revive abilities (Cure) still skip corpses (a Cure on a KO'd unit
//      "validates" as a no-op, so the pre-filter is what keeps corpses out).
//   2. targetHighlightKind tints by polarity (beneficial → heal-green,
//      offensive → attack-magenta, pure utility → target-amber) instead of
//      the old binary "healing → green, else red", so a buff cast on allies
//      no longer reads as a hostile aim.

import { describe, expect, it } from 'vitest';
import { loadDefaultCatalog } from '../content/index.ts';
import { abilityId, type ActiveAbilityDefinition } from '@engine/index.ts';
import { makeGameState, makeUnit, activeTurnFor } from '../engine/ct/test-fixtures.ts';
import { flatMap } from '../engine/map/test-fixtures.ts';
import { computeLegalTargets, targetHighlightKind } from './use-turn-flow.ts';

const catalog = loadDefaultCatalog();

function active(id: string): ActiveAbilityDefinition {
  const a = catalog.getAbility(abilityId(id));
  if (a.kind !== 'active') throw new Error(`${id} is not an active ability`);
  return a;
}

describe("S75 — computeLegalTargets includes KO'd allies only for revives", () => {
  // A cleric next to one ally; the ally's HP is the variable under test.
  function scene(allyHp: number) {
    const actor = makeUnit({
      id: 'cleric', spd: 10, mp: 40, classId: 'templar', position: { x: 1, y: 1, layer: 0 },
    });
    const ally = makeUnit({
      id: 'ally', spd: 10, classId: 'knight', position: { x: 2, y: 1, layer: 0 }, hp: allyHp,
    });
    const state = makeGameState({
      units: [actor, ally], map: flatMap(6, 6), turnState: activeTurnFor(actor.id),
    });
    return { actor, ally, state };
  }

  it('Raise (removeKO) offers a KO’d ally', () => {
    const { actor, ally, state } = scene(0);
    const targets = computeLegalTargets(state, catalog, actor, active('raise'), false);
    expect(targets.unitIds.has(ally.id)).toBe(true);
  });

  it('Raise does NOT offer a living ally (removeKO gate)', () => {
    const { actor, ally, state } = scene(30);
    const targets = computeLegalTargets(state, catalog, actor, active('raise'), false);
    expect(targets.unitIds.has(ally.id)).toBe(false);
  });

  it('Cure (non-revive heal) does NOT offer a KO’d ally', () => {
    const { actor, ally, state } = scene(0);
    const targets = computeLegalTargets(state, catalog, actor, active('cure'), false);
    expect(targets.unitIds.has(ally.id)).toBe(false);
  });
});

describe('S75 — targetHighlightKind tints by polarity', () => {
  it('heal spell → heal (green)', () => {
    expect(targetHighlightKind(active('cure'), catalog)).toBe('heal');
  });
  it('revive → heal (green)', () => {
    expect(targetHighlightKind(active('raise'), catalog)).toBe('heal');
  });
  it('buff cast → heal (green), not a hostile aim', () => {
    expect(targetHighlightKind(active('enchant_protect'), catalog)).toBe('heal');
  });
  it('damage → attack (magenta)', () => {
    expect(targetHighlightKind(active('attack'), catalog)).toBe('attack');
  });
  it('debuff cast → attack (magenta)', () => {
    expect(targetHighlightKind(active('brine'), catalog)).toBe('attack');
  });
  it('pure utility (ally CT push) → target (neutral amber)', () => {
    expect(targetHighlightKind(active('tide_surge'), catalog)).toBe('target');
  });
});
