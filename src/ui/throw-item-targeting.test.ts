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
import { phoenixDown } from '../content/items/phoenix-down.ts';
import { remedy } from '../content/items/remedy.ts';
import { computeAbilityDisableReason, computeLegalTargets } from './use-turn-flow.ts';

function cat() {
  return createCatalog({
    statusTypes: [],
    abilities: [throwItem],
    commandSets: [],
    classes: [makeKnight()],
    items: [ether, potion, phoenixDown, remedy],
    rulesets: [makeTestRuleset({ damagePipelineStages: DEFAULT_TEST_DAMAGE_PIPELINE })],
  });
}

// "Can I throw any stocked item at this target?" — the rule the throw
// target-click now uses (the reported bug was probing a single arbitrary
// item that happened to be incompatible).
function anyThrowableAt(
  s: ReturnType<typeof makeGameState>,
  c: ReturnType<typeof cat>,
  actorId: ReturnType<typeof unitId>,
  stockpile: ReadonlyMap<ReturnType<typeof itemId>, number>,
  targetUnitId: ReturnType<typeof unitId>,
): boolean {
  for (const [id, count] of stockpile) {
    if (count <= 0) continue;
    const v = validateAction(s, {
      type: 'use_throw_item', source: 'player', actorId,
      payload: { itemId: id, target: { kind: 'unit', unitId: targetUnitId } },
    }, c);
    if (v.valid) return true;
  }
  return false;
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

  // The exact reported scenario: Phoenix Down (first in stock), Remedy, Ether,
  // no Potion, full HP. Phoenix Down on a living target is invalid (KO-only),
  // but Ether/Remedy are valid — so the target is legal. The old click probe
  // validated only the first item (Phoenix Down) and silently cancelled.
  it('a full-HP unit holding Phoenix Down + Ether is still a legal self-throw target', () => {
    const c = cat();
    const stock = new Map([
      [itemId('phoenix_down'), 1],
      [itemId('remedy'), 1],
      [itemId('ether'), 1],
    ]);
    const u = makeUnit({
      id: 'a', spd: 10, hp: 50, maxHpBase: 50, mp: 10,
      position: { x: 1, y: 1, layer: 0 },
      stockpile: stock,
    });
    const s = makeGameState({ units: [u], map: flatMap(5, 5), turnState: turnFor('a') });
    const throwOf = (id: string) =>
      validateAction(s, {
        type: 'use_throw_item', source: 'player', actorId: u.id,
        payload: { itemId: itemId(id), target: { kind: 'unit', unitId: u.id } },
      }, c);
    // Phoenix Down can't be thrown at a living target...
    expect(throwOf('phoenix_down').valid).toBe(false);
    // ...but Ether and Remedy can.
    expect(throwOf('ether').valid).toBe(true);
    expect(throwOf('remedy').valid).toBe(true);
    // So the target is legal under the "any stocked item is throwable" rule.
    expect(anyThrowableAt(s, c, u.id, stock, u.id)).toBe(true);
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

  // The KO'd-target highlight gap: a downed (not removed) ally is a valid
  // Phoenix Down target, but the generic single-target highlight excludes
  // hp<=0 units. The throw highlight now includes them, in lockstep with
  // the target-click.
  it("highlights a KO'd (not removed) ally as a Throw target when holding a revive", () => {
    const c = cat();
    const actor = makeUnit({
      id: 'a', spd: 10, hp: 50, maxHpBase: 50,
      position: { x: 1, y: 1, layer: 0 },
      stockpile: new Map([[itemId('phoenix_down'), 1]]),
    });
    const downed = makeUnit({
      id: 'd', spd: 10, team: 'team_a', hp: 0, maxHpBase: 50,
      position: { x: 2, y: 1, layer: 0 },
    });
    const s = makeGameState({ units: [actor, downed], map: flatMap(5, 5), turnState: turnFor('a') });
    const targets = computeLegalTargets(s, c, actor, throwAbility(c), false);
    expect(targets.unitIds.has(downed.id)).toBe(true);
  });

  // Lockstep the other way: a revive-only bag can't throw at a living unit,
  // so a living target is not highlighted (matching the click).
  it('does not highlight a living unit when the only held item is a revive', () => {
    const c = cat();
    const actor = makeUnit({
      id: 'a', spd: 10, hp: 50, maxHpBase: 50,
      position: { x: 1, y: 1, layer: 0 },
      stockpile: new Map([[itemId('phoenix_down'), 1]]),
    });
    const livingAlly = makeUnit({
      id: 'b', spd: 10, team: 'team_a', hp: 40, maxHpBase: 40,
      position: { x: 2, y: 1, layer: 0 },
    });
    const downed = makeUnit({
      id: 'd', spd: 10, team: 'team_a', hp: 0, maxHpBase: 50,
      position: { x: 1, y: 2, layer: 0 },
    });
    const s = makeGameState({ units: [actor, livingAlly, downed], map: flatMap(5, 5), turnState: turnFor('a') });
    const targets = computeLegalTargets(s, c, actor, throwAbility(c), false);
    expect(targets.unitIds.has(downed.id)).toBe(true); // revivable
    expect(targets.unitIds.has(livingAlly.id)).toBe(false); // can't revive the living
    expect(targets.unitIds.has(actor.id)).toBe(false); // nor self (alive)
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
