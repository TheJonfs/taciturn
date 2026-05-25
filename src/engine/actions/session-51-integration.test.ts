// Session 51 integration tests — universal off-hand substrate +
// equipment-driven AoE vertical-tolerance + Aether Bloom queue-tower
// preview fix.
//
// Covers (Pt 1 substrate/bug-fix slice):
//   1. New `aoeVerticalToleranceModifiers` field on EquipmentBase: a
//      water-tag-gated wand adds +1 to the vertical-tolerance hook
//      output for water-tagged magical casts and is a no-op for
//      non-matching tags.
//   2. Wand of the Depths refit: the real item composes through both
//      `modifyAbilityRange` (horizontal only, post-refit) and
//      `modifyAoeVerticalTolerance` (+1 on water-tagged casts), with
//      the prior dead `deltaVertical: 1` removed from the range path.
//   3. Queue-tower AoE preview fix: `computeChargedAoe` threads through
//      `runModifyAoeShape`, so an in-flight Fire Storm whose caster has
//      Aether Bloom equipped previews the enlarged diamond r2 footprint
//      (matching what resolution casts), not the base diamond r1.

import { describe, expect, it } from 'vitest';
import { createCatalog } from '../catalog/index.ts';
import { defaultTestRulesets } from '../catalog/test-fixtures.ts';
import { makeKnight } from '../abilities/test-fixtures.ts';
import { makeGameState, makeUnit } from '../ct/test-fixtures.ts';
import { flatMap } from '../map/test-fixtures.ts';
import { runModifyAoeVerticalTolerance } from '../hooks/runners.ts';
import { computeAbilityRange } from '../abilities/range.ts';
import { wandOfDepths } from '../../content/items/wand-of-depths.ts';
import { fireStorm } from '../../content/abilities/fire-storm.ts';
import { aetherBloom } from '../../content/abilities/aether-bloom.ts';
import { fireMage } from '../../content/classes/fire-mage.ts';
import { fireSpells } from '../../content/command-sets/fire-spells.ts';
import { spark } from '../../content/abilities/spark.ts';
import { fireStrike } from '../../content/abilities/fire-strike.ts';
import { fireEmbrace } from '../../content/abilities/fire-embrace.ts';
import { flameLance } from '../../content/abilities/flame-lance.ts';
import { computeChargedAoe } from '../../ui/charged-action-detail-panel.tsx';
import {
  abilityId,
  bucketId,
  chargedActionId,
  itemId,
  type ChargedAction,
  type DamageTag,
} from '../types/index.ts';
import type {
  ActiveAbilityDefinition,
  ItemDefinition,
  WeaponEquipment,
} from '../catalog/index.ts';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function catalogWith(items: ReadonlyArray<ItemDefinition>) {
  return createCatalog({
    statusTypes: [],
    abilities: [],
    commandSets: [],
    classes: [makeKnight()],
    items,
    rulesets: defaultTestRulesets,
  });
}

function makeWandLike(args: {
  readonly id: string;
  readonly aoeVerticalToleranceModifiers: NonNullable<WeaponEquipment['aoeVerticalToleranceModifiers']>;
}): WeaponEquipment {
  return {
    id: itemId(args.id),
    name: args.id,
    availability: 'available',
    kind: 'weapon',
    wp: 2,
    accuracy: 90,
    aoeVerticalToleranceModifiers: args.aoeVerticalToleranceModifiers,
  };
}

// A minimal magical ability. Mirrors the catalog convention that real
// content (Water Strike, Fire Storm, etc.) tags both the top-level
// `tags` field AND the `effects.damage.tags` set with the element.
// `modifyAoeVerticalTolerance` contributors gate on `ability.tags` (per
// Aether Bloom's reference handler), while `modifyAbilityRange` gates on
// `effects.damage.tags`. Honoring both surfaces with the same tag list
// keeps test casts production-shaped.
function makeMagicalAbility(args: {
  readonly id: string;
  readonly tags: ReadonlyArray<DamageTag>;
}): ActiveAbilityDefinition {
  // Damage tags must include the element for `modifyAbilityRange` to fire.
  const damageTags: ReadonlyArray<DamageTag> = args.tags.includes('magical')
    ? args.tags
    : ['magical', ...args.tags];
  return {
    id: abilityId(args.id),
    name: args.id,
    kind: 'active',
    bucket: bucketId('first_action'),
    baseCost: 1,
    availability: 'hidden',
    tags: args.tags,
    targeting: {
      kind: 'tile',
      range: { horizontal: 4, vertical: 99 },
      rangeMode: 'arc',
    },
    actionSpeed: 25,
    mpCost: 10,
    effects: {
      damage: { tags: damageTags, power_coefficient: 1 },
      aoe: { shape: { kind: 'diamond', radius: 1 } },
    },
  };
}

// ===========================================================================
// 1. aoeVerticalToleranceModifiers — new field
// ===========================================================================

describe('S51 aoeVerticalToleranceModifiers', () => {
  it('adds +1 to vertical tolerance on a tag-matching cast', () => {
    const wand = makeWandLike({
      id: 'test_wand',
      aoeVerticalToleranceModifiers: [{ delta: 1, tagFilter: ['water'] }],
    });
    const cat = catalogWith([wand]);
    const u = makeUnit({
      id: 'u',
      spd: 10,
      equipment: { leftHand: null, rightHand: wand.id, headgear: null, armor: null, accessory: null },
    });
    const state = makeGameState({ units: [u] });
    const waterSpell = makeMagicalAbility({ id: 'water_aoe', tags: ['magical', 'water'] });
    const out = runModifyAoeVerticalTolerance(state, cat, {
      unit: u,
      ability: waterSpell,
      baseValue: 1,
    });
    expect(out).toBe(2);
  });

  it('does not modify a non-matching cast', () => {
    const wand = makeWandLike({
      id: 'test_wand',
      aoeVerticalToleranceModifiers: [{ delta: 1, tagFilter: ['water'] }],
    });
    const cat = catalogWith([wand]);
    const u = makeUnit({
      id: 'u',
      spd: 10,
      equipment: { leftHand: null, rightHand: wand.id, headgear: null, armor: null, accessory: null },
    });
    const state = makeGameState({ units: [u] });
    const fireSpell = makeMagicalAbility({ id: 'fire_aoe', tags: ['magical', 'fire'] });
    const out = runModifyAoeVerticalTolerance(state, cat, {
      unit: u,
      ability: fireSpell,
      baseValue: 1,
    });
    expect(out).toBe(1);
  });

  it('untagged modifier (no tagFilter) applies to every magical cast', () => {
    const tome = makeWandLike({
      id: 'book_like',
      aoeVerticalToleranceModifiers: [{ delta: 1, tagFilter: ['magical'] }],
    });
    const cat = catalogWith([tome]);
    const u = makeUnit({
      id: 'u',
      spd: 10,
      equipment: { leftHand: null, rightHand: tome.id, headgear: null, armor: null, accessory: null },
    });
    const state = makeGameState({ units: [u] });
    const fireSpell = makeMagicalAbility({ id: 'fire_aoe', tags: ['magical', 'fire'] });
    const out = runModifyAoeVerticalTolerance(state, cat, {
      unit: u,
      ability: fireSpell,
      baseValue: 1,
    });
    expect(out).toBe(2);
  });
});

// ===========================================================================
// 2. Wand of the Depths refit — real item
// ===========================================================================

describe('S51 Wand of the Depths refit', () => {
  it('moves the dead deltaVertical onto aoeVerticalTolerance for water casts', () => {
    const cat = catalogWith([wandOfDepths]);
    const u = makeUnit({
      id: 'u',
      spd: 10,
      equipment: {
        leftHand: null,
        rightHand: wandOfDepths.id,
        headgear: null,
        armor: null,
        accessory: null,
      },
    });
    const state = makeGameState({ units: [u] });
    const waterAoe = makeMagicalAbility({ id: 'water_aoe', tags: ['magical', 'water'] });
    const tolerance = runModifyAoeVerticalTolerance(state, cat, {
      unit: u,
      ability: waterAoe,
      baseValue: 1,
    });
    expect(tolerance).toBe(2);

    // The range path now carries only the horizontal bump; the old
    // `+1V` lived on `abilityRangeModifiers` pre-S51 and was unobservable
    // (every spell targets at vertical 99 already). Confirm the
    // horizontal still bumps and vertical stays at the ability's base.
    const rangeOut = computeAbilityRange(state, cat, u.id, waterAoe);
    expect(rangeOut.horizontal).toBe(5); // 4 base + 1 wand
    expect(rangeOut.vertical).toBe(99); // base preserved (no vertical bump now)
  });

  it('leaves non-water magical casts at base tolerance', () => {
    const cat = catalogWith([wandOfDepths]);
    const u = makeUnit({
      id: 'u',
      spd: 10,
      equipment: {
        leftHand: null,
        rightHand: wandOfDepths.id,
        headgear: null,
        armor: null,
        accessory: null,
      },
    });
    const state = makeGameState({ units: [u] });
    const fireAoe = makeMagicalAbility({ id: 'fire_aoe', tags: ['magical', 'fire'] });
    const tolerance = runModifyAoeVerticalTolerance(state, cat, {
      unit: u,
      ability: fireAoe,
      baseValue: 1,
    });
    expect(tolerance).toBe(1);
  });
});

// ===========================================================================
// 3. computeChargedAoe — Aether Bloom queue-tower preview fix
// ===========================================================================

describe('S51 computeChargedAoe — modifyAoeShape threading', () => {
  // Sketched Pyromancer with Aether Bloom in their free abilities (the
  // catalog's real fireMage already lists aether_bloom in freeAbilities,
  // so the hook is collected from the class tier just from being equipped
  // to the class).
  function buildCatalog() {
    return createCatalog({
      statusTypes: [],
      abilities: [fireStorm, aetherBloom, spark, fireStrike, fireEmbrace, flameLance],
      commandSets: [fireSpells],
      classes: [fireMage],
      items: [],
      rulesets: defaultTestRulesets,
    });
  }

  it('returns the enlarged AoE footprint when caster has Aether Bloom (queue inspector path)', () => {
    const cat = buildCatalog();
    // 5x5 flat map at elevation 0, so the AoE footprint is unconstrained
    // by terrain. Per the existing test-fixtures pattern.
    const map = flatMap(5, 5);
    const caster = makeUnit({
      id: 'pyromancer',
      spd: 10,
      classId: 'fire_mage',
      position: { x: 0, y: 0, layer: 0 },
      loadout: {
        actionBuckets: {},
        passiveBuckets: {
          [bucketId('support')]: [aetherBloom.id],
        },
      },
    });
    const state = makeGameState({ units: [caster], map });

    const charged: ChargedAction = {
      id: chargedActionId('cast_1'),
      casterId: caster.id,
      abilityId: fireStorm.id,
      targets: [{ kind: 'tile', position: { x: 2, y: 2, layer: 0 } }],
      ct: 50,
      speed: 25,
      sourceSequenceNumber: 0,
    };

    const tiles = computeChargedAoe(state, cat, charged);
    // Fire Storm base shape is diamond r1 (5 tiles: center + 4 orth).
    // Aether Bloom enlarges magical AoE shapes by one step → diamond r2
    // (13 tiles). The bug pre-S51 returned 5; the fix returns 13.
    expect(tiles.length).toBe(13);
  });

  it('returns the base AoE footprint when caster has no shape-modifier passive', () => {
    const cat = buildCatalog();
    const map = flatMap(5, 5);
    // Same caster shape but using a Knight class with no fire passives.
    // Aether Bloom is on the Pyromancer's free abilities — a non-fire-mage
    // unit won't collect the hook handler.
    const caster = makeUnit({
      id: 'plain_caster',
      spd: 10,
      classId: 'knight',
      position: { x: 0, y: 0, layer: 0 },
    });
    const state = makeGameState({ units: [caster], map });

    const charged: ChargedAction = {
      id: chargedActionId('cast_2'),
      casterId: caster.id,
      abilityId: fireStorm.id,
      targets: [{ kind: 'tile', position: { x: 2, y: 2, layer: 0 } }],
      ct: 50,
      speed: 25,
      sourceSequenceNumber: 0,
    };

    const tiles = computeChargedAoe(state, cat, charged);
    // Diamond r1 base shape: 5 tiles.
    expect(tiles.length).toBe(5);
  });
});

