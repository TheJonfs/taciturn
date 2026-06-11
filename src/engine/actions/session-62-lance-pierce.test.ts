// Session 62 — Lance pierce (ADR-0102). A basic Attack with a piercing
// weapon (Lance / Imp Halberd) resolves as a caster-anchored 2-tile line:
// it strikes the targeted unit AND the one behind it, and friendly-fires an
// intervening ally. A non-piercing weapon leaves the attack single-target.

import { describe, expect, it } from 'vitest';
import { createCatalog } from '../catalog/index.ts';
import {
  DEFAULT_TEST_DAMAGE_PIPELINE,
  makeTestRuleset,
} from '../catalog/test-fixtures.ts';
import { makeGameState, makeUnit } from '../ct/test-fixtures.ts';
import { flatMap } from '../map/test-fixtures.ts';
import { ACTIVE_BUCKET_IDS, PASSIVE_BUCKET_IDS } from '../abilities/constants.ts';
import { commitAction } from './commit.ts';
import {
  abilityId,
  bucketId,
  classId,
  commandSetId,
  unitId,
  type AbilityId,
  type ClassDefinition,
  type Loadout,
  type UnitEquipment,
} from '@engine/index.ts';
import { attack } from '../../content/abilities/attack.ts';
import { lance } from '../../content/items/lance.ts';
import { longSword } from '../../content/items/long-sword.ts';

function knightClass(): ClassDefinition {
  return {
    id: classId('knight'),
    name: 'Knight',
    movement: { moveRange: 3, jump: 2, terrainCosts: new Map(), canEnter: new Set(['ground']) },
    evasion: { front: 0, side: 0, back: 0 },
    equipmentSlots: { leftHand: true, rightHand: true, headgear: true, armor: true, accessory: true },
    firstActionCommandSet: commandSetId('battle_skill'),
    freeAbilities: new Set([abilityId('attack')]),
    dominantStat: 'pa',
  };
}

function loadoutFirstAction(): Loadout {
  const actionBuckets: Record<string, ReadonlyArray<ReturnType<typeof commandSetId>>> = {};
  for (const b of ACTIVE_BUCKET_IDS) actionBuckets[b] = [];
  actionBuckets[bucketId('first_action')] = [commandSetId('battle_skill')];
  const passiveBuckets: Record<string, ReadonlyArray<AbilityId>> = {};
  for (const b of PASSIVE_BUCKET_IDS) passiveBuckets[b] = [];
  return { actionBuckets, passiveBuckets };
}

function weapon(id: string): UnitEquipment {
  return { rightHand: id as never, leftHand: null, headgear: null, armor: null, accessory: null };
}

function turnFor(id: string) {
  return {
    unitId: unitId(id),
    budget: { movesAvailable: 1, actsAvailable: 1 },
    consumed: { movesConsumed: 0, actsConsumed: 0 },
    reactionsUsedThisTurn: new Map(),
  };
}

function catalog() {
  return createCatalog({
    statusTypes: [],
    abilities: [attack],
    commandSets: [
      { id: commandSetId('battle_skill'), name: 'BS', members: [abilityId('attack')], baseCost: 1, availability: 'hidden' },
    ],
    classes: [knightClass()],
    items: [lance, longSword],
    rulesets: [makeTestRuleset({ damagePipelineStages: DEFAULT_TEST_DAMAGE_PIPELINE })],
  });
}

// Attacker at (0,0) facing east; the picked target sets the line direction.
function attacker(weaponId: string) {
  return makeUnit({
    id: 'atk', team: 'team_a', spd: 10, pa: 6, brave: 100, faith: 80,
    equipment: weapon(weaponId), loadout: loadoutFirstAction(),
    position: { x: 0, y: 0, layer: 0 },
  });
}

describe('Lance pierce — basic Attack hits a 2-tile line', () => {
  it('strikes the targeted unit AND the one behind it', () => {
    const cat = catalog();
    const atk = attacker(lance.id);
    const mid = makeUnit({ id: 'mid', team: 'team_b', spd: 10, hp: 100, maxHpBase: 100, position: { x: 1, y: 0, layer: 0 } });
    const far = makeUnit({ id: 'far', team: 'team_b', spd: 10, hp: 100, maxHpBase: 100, position: { x: 2, y: 0, layer: 0 } });
    const state = makeGameState({ units: [atk, mid, far], map: flatMap(6, 6), turnState: turnFor('atk'), masterSeed: 7 });
    // Target the far unit (tile 2); the 2-tile line east covers tiles 1 and 2.
    const r = commitAction(state, {
      type: 'use_ability', source: 'player', actorId: atk.id,
      payload: { abilityId: abilityId('attack'), target: { kind: 'unit', unitId: far.id } },
    }, cat);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.newState.units.get(far.id)!.vitals.hp).toBeLessThan(100);
    expect(r.newState.units.get(mid.id)!.vitals.hp).toBeLessThan(100); // pierced
  });

  it('friendly-fires an intervening ally', () => {
    const cat = catalog();
    const atk = attacker(lance.id);
    const ally = makeUnit({ id: 'ally', team: 'team_a', spd: 10, hp: 100, maxHpBase: 100, position: { x: 1, y: 0, layer: 0 } });
    const enemy = makeUnit({ id: 'enemy', team: 'team_b', spd: 10, hp: 100, maxHpBase: 100, position: { x: 2, y: 0, layer: 0 } });
    const state = makeGameState({ units: [atk, ally, enemy], map: flatMap(6, 6), turnState: turnFor('atk'), masterSeed: 7 });
    const r = commitAction(state, {
      type: 'use_ability', source: 'player', actorId: atk.id,
      payload: { abilityId: abilityId('attack'), target: { kind: 'unit', unitId: enemy.id } },
    }, cat);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.newState.units.get(enemy.id)!.vitals.hp).toBeLessThan(100);
    expect(r.newState.units.get(ally.id)!.vitals.hp).toBeLessThan(100); // clipped
  });

  it('a non-piercing weapon (Long Sword) hits only the target', () => {
    const cat = catalog();
    const atk = attacker(longSword.id); // range 1, no pierce
    const adj = makeUnit({ id: 'adj', team: 'team_b', spd: 10, hp: 100, maxHpBase: 100, position: { x: 1, y: 0, layer: 0 } });
    const behind = makeUnit({ id: 'behind', team: 'team_b', spd: 10, hp: 100, maxHpBase: 100, position: { x: 2, y: 0, layer: 0 } });
    const state = makeGameState({ units: [atk, adj, behind], map: flatMap(6, 6), turnState: turnFor('atk'), masterSeed: 7 });
    const r = commitAction(state, {
      type: 'use_ability', source: 'player', actorId: atk.id,
      payload: { abilityId: abilityId('attack'), target: { kind: 'unit', unitId: adj.id } },
    }, cat);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.newState.units.get(adj.id)!.vitals.hp).toBeLessThan(100);
    expect(r.newState.units.get(behind.id)!.vitals.hp).toBe(100); // not pierced
  });
});
