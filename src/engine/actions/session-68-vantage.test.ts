// Session 68 — Vantage (offensive elevation +2, ADR-0115).
//
// Vantage makes the wielder's own offensive computations resolve as if it
// stood +2 tiles higher: height_delta damage variance, the high-ground
// accuracy modifier, bow reach-from-height, and the SOURCE endpoint of
// attack line-of-sight ("shoot over cover"). It is offensive-only and
// attacker-only — it never changes the unit's elevation as a target, nor
// any defensive / Math Skill / pathfinding read.

import { describe, expect, it } from 'vitest';
import { createCatalog } from '../catalog/index.ts';
import { defaultTestRulesets } from '../catalog/test-fixtures.ts';
import { makeKnight } from '../abilities/test-fixtures.ts';
import { makeGameState, makeUnit } from '../ct/test-fixtures.ts';
import { runModifyAttackerElevation } from '../hooks/runners.ts';
import { resolvePhysicalVarianceBand } from '../damage/handlers.ts';
import { computeElevationModifier } from '../damage/hit-chance-internals.ts';
import { hasLineOfSight } from '../map/line-of-sight.ts';
import { rangeFromHeightBonus, maxRangeFromHeightBonus } from '../abilities/range-height.ts';
import { vantage } from '../../content/abilities/vantage.ts';
import { longbow } from '../../content/items/longbow.ts';
import {
  abilityId,
  bucketId,
  itemId,
  unitId,
  type BattleMap,
  type Loadout,
  type Tile,
  type UnitEquipment,
} from '../types/index.ts';
import type { ActiveAbilityDefinition } from '../catalog/index.ts';

// A flat elevation-0 ground map of the given width (1 row).
function flatMap(width: number): BattleMap {
  const tiles: Tile[] = [];
  for (let x = 0; x < width; x++) {
    tiles.push({ x, y: 0, layer: 0, elevation: 0, terrain: 'ground', properties: [] });
  }
  return { width, height: 1, tiles };
}

const vantageLoadout: Loadout = {
  actionBuckets: {},
  passiveBuckets: { [bucketId('support')]: [abilityId('vantage')] },
};

const bowEquip: UnitEquipment = {
  leftHand: null,
  rightHand: itemId('longbow'),
  headgear: null,
  armor: null,
  accessory: null,
};

// Weapon-delivered physical bow attack (drives WP / variance / accuracy
// off the equipped longbow).
const bowAttack: ActiveAbilityDefinition = {
  id: abilityId('bow_shot_test'),
  name: 'Shot',
  kind: 'active',
  bucket: bucketId('first_action'),
  baseCost: 1,
  availability: 'hidden',
  targeting: { kind: 'single_unit', range: { horizontal: 5, vertical: 99 }, rangeMode: 'straight_line' },
  actionSpeed: 0,
  mpCost: 0,
  hitRoll: {},
  effects: { damage: { tags: ['physical', 'weapon'], power_coefficient: 1 } },
};

function cat() {
  return createCatalog({
    statusTypes: [],
    abilities: [vantage, bowAttack],
    commandSets: [],
    classes: [makeKnight()],
    items: [longbow],
    rulesets: defaultTestRulesets,
  });
}

describe('Session 68 Vantage — the elevation offset', () => {
  it('grants +2 attacker elevation when equipped; 0 without', () => {
    const c = cat();
    const withV = makeUnit({ id: 'v', spd: 10, loadout: vantageLoadout });
    const without = makeUnit({ id: 'p', spd: 10 });
    const state = makeGameState({ units: [withV, without] });
    expect(runModifyAttackerElevation(state, c, { unit: withV, baseValue: 0 })).toBe(2);
    expect(runModifyAttackerElevation(state, c, { unit: without, baseValue: 0 })).toBe(0);
  });
});

describe('Session 68 Vantage — height_delta damage variance', () => {
  const atkPos = { x: 0, y: 0, layer: 0 };
  const tgtPos = { x: 1, y: 0, layer: 0 };

  it('a Vantage bow on level ground shoots as if +2 downhill (factor 1.0 → 1.4)', () => {
    const c = cat();
    const attacker = makeUnit({ id: 'a', spd: 10, loadout: vantageLoadout, equipment: bowEquip, position: atkPos });
    const target = makeUnit({ id: 'b', spd: 10, hp: 100, maxHpBase: 100, position: tgtPos });
    const state = makeGameState({ units: [attacker, target], map: flatMap(2) });
    // Longbow falloff 0.2; level ground both at elev 0; +2 → 1 − 0.2×(0−2) = 1.4.
    const band = resolvePhysicalVarianceBand(state, c, attacker, target, bowAttack);
    expect(band).toEqual({ min: 1.4, max: 1.4 });
  });

  it('without Vantage the same level shot is 1.0', () => {
    const c = cat();
    const attacker = makeUnit({ id: 'a', spd: 10, equipment: bowEquip, position: atkPos }); // no vantage
    const target = makeUnit({ id: 'b', spd: 10, hp: 100, maxHpBase: 100, position: tgtPos });
    const state = makeGameState({ units: [attacker, target], map: flatMap(2) });
    const band = resolvePhysicalVarianceBand(state, c, attacker, target, bowAttack);
    expect(band).toEqual({ min: 1.0, max: 1.0 });
  });

  it('is attacker-only: a Vantage TARGET does not change a plain attacker’s incoming variance', () => {
    const c = cat();
    const attacker = makeUnit({ id: 'a', spd: 10, equipment: bowEquip, position: atkPos }); // plain attacker
    const target = makeUnit({ id: 'b', spd: 10, hp: 100, maxHpBase: 100, loadout: vantageLoadout, position: tgtPos });
    const state = makeGameState({ units: [attacker, target], map: flatMap(2) });
    const band = resolvePhysicalVarianceBand(state, c, attacker, target, bowAttack);
    expect(band).toEqual({ min: 1.0, max: 1.0 }); // target's Vantage is irrelevant
  });
});

describe('Session 68 Vantage — high-ground accuracy modifier', () => {
  it('+2 makes a level attacker count as "higher" (1.0 → 1.05)', () => {
    const tiles: Tile[] = [
      { x: 0, y: 0, layer: 0, elevation: 0, terrain: 'ground', properties: [] },
      { x: 1, y: 0, layer: 0, elevation: 0, terrain: 'ground', properties: [] },
    ];
    const map: BattleMap = { width: 2, height: 1, tiles };
    const state = makeGameState({ map });
    const atk = { x: 0, y: 0, layer: 0 };
    const tgt = { x: 1, y: 0, layer: 0 };
    expect(computeElevationModifier(state, atk, tgt, 0)).toBe(1.0);
    expect(computeElevationModifier(state, atk, tgt, 2)).toBe(1.05);
  });
});

describe('Session 68 Vantage — bow reach-from-height', () => {
  it('the +2 source adds a height-range increment on level ground', () => {
    const spec = longbow.rangeFromHeightBonus; // { perDeltaVertical: 2, deltaHorizontal: 1 }
    expect(rangeFromHeightBonus(spec, 0, 0)).toBe(0); // raw level → no bonus
    expect(rangeFromHeightBonus(spec, 2, 0)).toBe(1); // +2 source → floor(2/2)×1 = 1
    expect(maxRangeFromHeightBonus(spec, 2)).toBe(1);
  });
});

describe('Session 68 Vantage — shoot over cover (LoS source raised)', () => {
  it('a raised source clears a Barrier the level shot is stopped by (Aethurge over a Terraformer wall)', () => {
    // A Barrier on the middle tile blocks a level shot (inclusive `>=`
    // lower bound, unlike grazes-pass terrain). This is the intended case:
    // a straight-line caster perched via Vantage clears a Barrier wall.
    const barrier = { hp: 49, ttl: 5, ownerId: unitId('wall_owner') };
    const tiles: Tile[] = [
      { x: 0, y: 0, layer: 0, elevation: 0, terrain: 'ground', properties: [] },
      { x: 1, y: 0, layer: 0, elevation: 0, terrain: 'ground', properties: [], barrier },
      { x: 2, y: 0, layer: 0, elevation: 0, terrain: 'ground', properties: [] },
    ];
    const map: BattleMap = { width: 3, height: 1, tiles };
    // Raw level shot is blocked by the Barrier (ray at the wall = 0, 0 ≥ 0)…
    expect(hasLineOfSight(map, { x: 0, y: 0, elevation: 0 }, { x: 2, y: 0, elevation: 0 })).toBe(false);
    // …but a +2 source (Vantage) clears it (ray at the wall = 1, 1 < 1 false).
    expect(hasLineOfSight(map, { x: 0, y: 0, elevation: 2 }, { x: 2, y: 0, elevation: 0 })).toBe(true);
  });
});
