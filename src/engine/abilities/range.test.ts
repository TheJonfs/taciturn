// S96 — weapon-delivered abilities are ALWAYS weapon-ranged (Chris's ruling).
//
// The Session-45 fork read the weapon's range only when the weapon DECLARED
// one; a rangeless weapon fell back to the ability's authored band, so a
// Dagger Hunter fired Charged Attack at the ability's bow-flavored 5 tiles
// (the Ch1 playtest repro). Now: declared range → that; rangeless weapon or
// bare hands → the melee band (MELEE_WEAPON_RANGE), never the authored band.
// Real content catalog throughout — these pin the shipped abilities.

import { describe, expect, it } from 'vitest';
import { loadDefaultCatalog } from '@content/index.ts';
import { makeGameState, makeUnit } from '../ct/test-fixtures.ts';
import { flatMap } from '../map/test-fixtures.ts';
import {
  abilityId,
  itemId,
  type UnitEquipment,
} from '../types/index.ts';
import { computeAbilityRange, MELEE_WEAPON_RANGE } from './range.ts';
import { expectActiveAbility, validateAction } from '../actions/validate.ts';
import { activeTurnFor } from '../ct/test-fixtures.ts';
import { loadoutOf } from './test-fixtures.ts';
import { bucketId, commandSetId } from '../types/index.ts';

const catalog = loadDefaultCatalog();

function equipRight(id: string | null): UnitEquipment {
  return {
    leftHand: null,
    rightHand: id === null ? null : itemId(id),
    headgear: null,
    armor: null,
    accessory: null,
  };
}

function rangeFor(ability: string, weapon: string | null) {
  const u = makeUnit({
    id: 'u',
    spd: 10,
    position: { x: 0, y: 0, layer: 0 },
    equipment: equipRight(weapon),
  });
  const state = makeGameState({ units: [u], map: flatMap(8, 8) });
  return computeAbilityRange(state, catalog, u.id, expectActiveAbility(catalog, abilityId(ability)));
}

describe('weapon-delivered range (S96 — always the weapon, never the authored band)', () => {
  it('Charged Attack with a Dagger is melee reach, not the authored 5-tile band', () => {
    const r = rangeFor('charged_attack', 'dagger');
    expect(r.horizontal).toBe(MELEE_WEAPON_RANGE.horizontal);
    expect(r.vertical).toBe(MELEE_WEAPON_RANGE.vertical);
    expect(r.minHorizontal).toBeUndefined(); // no bow dead-zone on a stab
  });

  it('Charged Attack with a bow keeps the declared bow band', () => {
    const r = rangeFor('charged_attack', 'longbow');
    expect(r.horizontal).toBeGreaterThan(1);
    expect(r.minHorizontal).toBeGreaterThan(1); // the bow's dead zone
  });

  it('Charged Attack bare-handed is melee reach', () => {
    const r = rangeFor('charged_attack', null);
    expect(r.horizontal).toBe(MELEE_WEAPON_RANGE.horizontal);
    expect(r.minHorizontal).toBeUndefined();
  });

  it('Pin Down with a Dagger is melee reach with no dead zone', () => {
    const r = rangeFor('pin_down', 'dagger');
    expect(r.horizontal).toBe(MELEE_WEAPON_RANGE.horizontal);
    expect(r.minHorizontal).toBeUndefined();
  });

  it("a Knight Battle Skill rides a bow's reach (weapon-ranged both ways)", () => {
    const r = rangeFor('power_attack', 'longbow');
    expect(r.horizontal).toBeGreaterThan(1); // authored melee 1, bow extends it
  });

  it('validation rejects a Dagger Charged Attack at 4 tiles (the Ch1 repro)', () => {
    const hunter = makeUnit({
      id: 'hu',
      spd: 10,
      position: { x: 0, y: 0, layer: 0 },
      equipment: equipRight('dagger'),
      loadout: loadoutOf({
        active: [[bucketId('first_action'), commandSetId('marksmanship')]],
      }),
      mp: 20,
    });
    const mark = makeUnit({
      id: 'mk',
      spd: 10,
      team: 'team_b',
      position: { x: 4, y: 0, layer: 0 },
    });
    const state = makeGameState({
      units: [hunter, mark],
      map: flatMap(8, 8),
      turnState: activeTurnFor(hunter.id),
    });
    const distant = validateAction(
      state,
      {
        type: 'use_ability',
        source: 'player',
        actorId: hunter.id,
        payload: {
          abilityId: abilityId('charged_attack'),
          target: { kind: 'tile', position: { x: 4, y: 0, layer: 0 } },
        },
        sequenceNumber: 0,
        seed: 1,
        timestamp: { tick: 0, ct: 0 },
        chainDepth: 0,
        isReaction: false,
      },
      catalog,
    );
    expect(distant.valid).toBe(false); // dagger reach is 1 — no more 5-tile stabs
    const adjacent = validateAction(
      state,
      {
        type: 'use_ability',
        source: 'player',
        actorId: hunter.id,
        payload: {
          abilityId: abilityId('charged_attack'),
          target: { kind: 'tile', position: { x: 1, y: 0, layer: 0 } },
        },
        sequenceNumber: 0,
        seed: 1,
        timestamp: { tick: 0, ct: 0 },
        chainDepth: 0,
        isReaction: false,
      },
      catalog,
    );
    expect(adjacent.valid).toBe(true); // …but the melee stab itself is legal
  });

  it('a NON-weapon ability ignores the equipped weapon entirely (Foxfire)', () => {
    const withBow = rangeFor('foxfire', 'longbow');
    const bare = rangeFor('foxfire', null);
    expect(withBow.horizontal).toBe(bare.horizontal); // authored band both times
  });
});
