// Tests for projectAoePreview.

import { describe, expect, it } from 'vitest';
import {
  abilityId,
  bucketId,
  classId,
  commandSetId,
  createCatalog,
  type ActiveAbilityDefinition,
  type ClassDefinition,
} from '../index.ts';
import type { AoeSpec } from '@engine/index.ts';
import { DEFAULT_TEST_DAMAGE_PIPELINE, makeTestRuleset } from '../catalog/test-fixtures.ts';
import { makeGameState, makeUnit } from '../ct/test-fixtures.ts';
import { projectAoePreview } from './aoe-preview.ts';

function knightClass(): ClassDefinition {
  return {
    id: classId('knight'),
    name: 'Knight',
    movement: { moveRange: 3, jump: 2, terrainCosts: new Map(), canEnter: new Set(['ground']) },
    evasion: { front: 0, side: 0, back: 0 },
    equipmentSlots: { leftHand: true, rightHand: true, headgear: true, armor: true, accessory: true },
    firstActionCommandSet: commandSetId('battle_skill'),
    freeAbilities: new Set(),
  };
}

function makeMap(w = 10, h = 10) {
  return {
    width: w,
    height: h,
    tiles: Array.from({ length: w * h }, (_, i) => ({
      x: i % w,
      y: Math.floor(i / w),
      layer: 0,
      elevation: 0,
      terrain: 'ground' as const,
      properties: [],
    })),
  };
}

function makeCat(ab: ActiveAbilityDefinition) {
  return createCatalog({
    statusTypes: [],
    abilities: [ab],
    commandSets: [],
    classes: [knightClass()],
    items: [],
    rulesets: [makeTestRuleset({ damagePipelineStages: DEFAULT_TEST_DAMAGE_PIPELINE })],
  });
}

describe('projectAoePreview', () => {
  it('returns a single tile for a non-AoE ability with the hovered occupant', () => {
    const ab: ActiveAbilityDefinition = {
      id: abilityId('strike'),
      name: 'Strike',
      kind: 'active',
      bucket: bucketId('first_action'),
      baseCost: 1,
      availability: 'hidden',
      targeting: { kind: 'single_unit', range: { horizontal: 4, vertical: 3 }, rangeMode: 'arc' },
      actionSpeed: 0,
      mpCost: 0,
      effects: { damage: { tags: ['physical'], power_coefficient: 4 } },
    };
    const cat = makeCat(ab);
    const caster = makeUnit({ id: 'a', spd: 10, position: { x: 0, y: 0, layer: 0 } });
    const target = makeUnit({ id: 'b', spd: 10, team: 'team_b', position: { x: 3, y: 3, layer: 0 } });
    const state = makeGameState({ units: [caster, target], map: makeMap() });
    const tiles = projectAoePreview({
      state,
      catalog: cat,
      caster,
      ability: ab,
      anchor: { x: 3, y: 3, layer: 0 },
    });
    expect(tiles).toHaveLength(1);
    expect(tiles[0]!.position).toEqual({ x: 3, y: 3, layer: 0 });
    expect(tiles[0]!.occupant?.id).toBe(target.id);
    expect(tiles[0]!.affected).toBe(true);
  });

  it('expands a diamond AoE around the anchor', () => {
    const aoe: AoeSpec = { shape: { kind: 'diamond', radius: 1 } };
    const ab: ActiveAbilityDefinition = {
      id: abilityId('quake'),
      name: 'Quake',
      kind: 'active',
      bucket: bucketId('first_action'),
      baseCost: 1,
      availability: 'hidden',
      targeting: { kind: 'tile', range: { horizontal: 4, vertical: 3 }, rangeMode: 'arc' },
      actionSpeed: 0,
      mpCost: 0,
      effects: { damage: { tags: ['magical'], power_coefficient: 4 }, aoe },
    };
    const cat = makeCat(ab);
    const caster = makeUnit({ id: 'a', spd: 10, position: { x: 0, y: 0, layer: 0 } });
    const enemy = makeUnit({ id: 'b', spd: 10, team: 'team_b', position: { x: 3, y: 3, layer: 0 } });
    const state = makeGameState({ units: [caster, enemy], map: makeMap() });
    const tiles = projectAoePreview({
      state,
      catalog: cat,
      caster,
      ability: ab,
      anchor: { x: 3, y: 3, layer: 0 },
    });
    // Diamond radius 1 covers 5 tiles (center + 4 orthogonal neighbors).
    expect(tiles).toHaveLength(5);
    const occupied = tiles.find((t) => t.occupant?.id === enemy.id);
    expect(occupied).toBeDefined();
    expect(occupied!.affected).toBe(true);
  });

  it('marks the caster tile as not-affected when excludeCaster is implicit-default', () => {
    const aoe: AoeSpec = { shape: { kind: 'diamond', radius: 1 } };
    const ab: ActiveAbilityDefinition = {
      id: abilityId('quake'),
      name: 'Quake',
      kind: 'active',
      bucket: bucketId('first_action'),
      baseCost: 1,
      availability: 'hidden',
      targeting: { kind: 'tile', range: { horizontal: 4, vertical: 3 }, rangeMode: 'arc' },
      actionSpeed: 0,
      mpCost: 0,
      effects: { damage: { tags: ['magical'], power_coefficient: 4 }, aoe },
    };
    const cat = makeCat(ab);
    const caster = makeUnit({ id: 'a', spd: 10, position: { x: 3, y: 3, layer: 0 } });
    const state = makeGameState({ units: [caster], map: makeMap() });
    // Anchor on the caster's tile — caster should appear in the footprint
    // but be marked unaffected.
    const tiles = projectAoePreview({
      state,
      catalog: cat,
      caster,
      ability: ab,
      anchor: { x: 3, y: 3, layer: 0 },
    });
    const casterTile = tiles.find((t) => t.occupant?.id === caster.id);
    expect(casterTile).toBeDefined();
    expect(casterTile!.affected).toBe(false);
  });
});
