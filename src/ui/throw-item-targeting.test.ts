// Throw Item targeting + availability (S71 follow-up, playtest report:
// "couldn't target self with Throw Item"). The engine allows a unit to
// throw a consumable at itself (an Ether on your own caster is a real
// play); the reported failure was the empty-stockpile dead-end — Throw
// Item was offered with nothing to throw, so target clicks silently
// cancelled. These tests pin that self-target validates + is offered, and
// that Throw Item is disabled when the stockpile is empty.

import { describe, expect, it } from 'vitest';
import { abilityId, createCatalog, itemId, unitId } from '@engine/index.ts';
import { makeTestRuleset, DEFAULT_TEST_DAMAGE_PIPELINE } from '../engine/catalog/test-fixtures.ts';
import { makeGameState, makeUnit } from '../engine/ct/test-fixtures.ts';
import { makeKnight } from '../engine/abilities/test-fixtures.ts';
import { flatMap } from '../engine/map/test-fixtures.ts';
import { validateAction } from '../engine/actions/validate.ts';
import { throwItem } from '../content/abilities/throw-item.ts';
import { ether } from '../content/items/ether.ts';
import { potion } from '../content/items/potion.ts';
import { computeAbilityDisableReason, computeLegalTargets } from './use-turn-flow.ts';

function cat() {
  return createCatalog({
    statusTypes: [],
    abilities: [throwItem],
    commandSets: [],
    classes: [makeKnight()],
    items: [ether, potion],
    rulesets: [makeTestRuleset({ damagePipelineStages: DEFAULT_TEST_DAMAGE_PIPELINE })],
  });
}

function turnFor(id: string) {
  return {
    unitId: unitId(id),
    budget: { movesAvailable: 1, actsAvailable: 1 },
    consumed: { movesConsumed: 0, actsConsumed: 0 },
    reactionsUsedThisTurn: new Map(),
  };
}

const throwAbility = (c: ReturnType<typeof cat>) =>
  c.getAbility(abilityId('throw_item')) as Extract<
    ReturnType<typeof c.getAbility>,
    { kind: 'active' }
  >;

describe('Throw Item — self-target works at full HP (engine)', () => {
  it('validates use_throw_item on self with an item in stock, even at full HP', () => {
    const c = cat();
    const u = makeUnit({
      id: 'a', spd: 10, hp: 50, maxHpBase: 50, mp: 30,
      position: { x: 1, y: 1, layer: 0 },
      stockpile: new Map([[itemId('ether'), 1]]),
    });
    const s = makeGameState({ units: [u], map: flatMap(5, 5), turnState: turnFor('a') });
    const v = validateAction(s, {
      type: 'use_throw_item', source: 'player', actorId: u.id,
      payload: { itemId: itemId('ether'), target: { kind: 'unit', unitId: u.id } },
    }, c);
    expect(v.valid).toBe(true);
  });

  it('offers self as a legal Throw target', () => {
    const c = cat();
    const u = makeUnit({
      id: 'a', spd: 10, hp: 50, maxHpBase: 50, mp: 30,
      position: { x: 1, y: 1, layer: 0 },
      stockpile: new Map([[itemId('ether'), 1]]),
    });
    const ally = makeUnit({ id: 'b', spd: 10, team: 'team_a', position: { x: 2, y: 1, layer: 0 } });
    const s = makeGameState({ units: [u, ally], map: flatMap(5, 5), turnState: turnFor('a') });
    const targets = computeLegalTargets(s, c, u, throwAbility(c), false);
    expect(targets.unitIds.has(u.id)).toBe(true);
    expect(targets.unitIds.has(ally.id)).toBe(true);
  });
});

describe('Throw Item — disabled when the stockpile is empty', () => {
  it('disables Throw Item with a Compound-first hint when nothing is stocked', () => {
    const c = cat();
    const u = makeUnit({
      id: 'a', spd: 10, hp: 50, maxHpBase: 50, mp: 30,
      position: { x: 1, y: 1, layer: 0 },
      stockpile: new Map(),
    });
    const s = makeGameState({ units: [u], map: flatMap(5, 5), turnState: turnFor('a') });
    const reason = computeAbilityDisableReason(s, c, u, throwAbility(c));
    expect(reason).toMatch(/no items to throw/i);
  });

  it('enables Throw Item once at least one consumable is stocked', () => {
    const c = cat();
    const u = makeUnit({
      id: 'a', spd: 10, hp: 50, maxHpBase: 50, mp: 30,
      position: { x: 1, y: 1, layer: 0 },
      stockpile: new Map([[itemId('potion'), 1]]),
    });
    const s = makeGameState({ units: [u], map: flatMap(5, 5), turnState: turnFor('a') });
    expect(computeAbilityDisableReason(s, c, u, throwAbility(c))).toBeNull();
  });
});
