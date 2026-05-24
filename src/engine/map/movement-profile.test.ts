import { createCatalog, type ClassDefinition } from '../catalog/index.ts';
import { defaultTestRulesets } from '../catalog/test-fixtures.ts';
import { makeGameState, makeUnit } from '../ct/test-fixtures.ts';
import { statusHook } from '../status/index.ts';
import { catalogWith, makeStatusInstance, makeStatusType } from '../status/test-fixtures.ts';
import { classId, commandSetId } from '../types/index.ts';
import { computeMovementProfile } from './movement-profile.ts';

function knightDef(args?: {
  readonly moveRange?: number;
  readonly jump?: number;
  readonly canEnter?: ReadonlyArray<string>;
  readonly terrainCosts?: ReadonlyArray<readonly [string, number]>;
  readonly specialMovement?: 'fly' | 'teleport' | 'phase';
}): ClassDefinition {
  return {
    id: classId('knight'),
    name: 'Knight',
    movement: {
      moveRange: args?.moveRange ?? 3,
      jump: args?.jump ?? 2,
      terrainCosts: new Map(args?.terrainCosts ?? []),
      canEnter: new Set(args?.canEnter ?? ['ground']),
      ...(args?.specialMovement !== undefined ? { specialMovement: args.specialMovement } : {}),
    },
    evasion: { front: 0, side: 0, back: 0 },
    equipmentSlots: { leftHand: true, rightHand: true, headgear: true, armor: true, accessory: true },
    firstActionCommandSet: commandSetId('battle_skill'),
    freeAbilities: new Set(),
    dominantStat: 'pa',
  };
}

function makeCatalogWithKnight(args?: Parameters<typeof knightDef>[0]) {
  return createCatalog({
    statusTypes: [],
    abilities: [],
    commandSets: [],
    classes: [knightDef(args)],
    items: [],
    rulesets: defaultTestRulesets,
  });
}

describe('computeMovementProfile', () => {
  it('reads the class baseline when no modifiers apply', () => {
    const cat = makeCatalogWithKnight({ moveRange: 4, jump: 2 });
    const u = makeUnit({ id: 'u1', spd: 10 });
    const state = makeGameState({ units: [u] });
    const profile = computeMovementProfile(state, u.id, cat);
    expect(profile.moveRange).toBe(4);
    expect(profile.jump).toBe(2);
    expect(profile.canEnter.has('ground')).toBe(true);
    expect(profile.specialMovement).toBeUndefined();
  });

  it('exposes terrainCosts and canEnter from the class baseline as-is', () => {
    const cat = makeCatalogWithKnight({
      terrainCosts: [
        ['water', 2],
        ['sand', 1.5],
      ],
      canEnter: ['ground', 'sand'],
    });
    const u = makeUnit({ id: 'u1', spd: 10 });
    const state = makeGameState({ units: [u] });
    const profile = computeMovementProfile(state, u.id, cat);
    expect(profile.terrainCosts.get('water')).toBe(2);
    expect(profile.terrainCosts.get('sand')).toBe(1.5);
    expect(profile.canEnter.has('sand')).toBe(true);
    expect(profile.canEnter.has('water')).toBe(false);
  });

  it('passes through specialMovement from the class baseline', () => {
    const cat = makeCatalogWithKnight({ specialMovement: 'fly' });
    const u = makeUnit({ id: 'u1', spd: 10 });
    const state = makeGameState({ units: [u] });
    expect(computeMovementProfile(state, u.id, cat).specialMovement).toBe('fly');
  });

  it('runs modifyStatQuery for moveRange — additive bonus stacks on baseline', () => {
    const movePlusOne = makeStatusType({
      id: 'move_plus_one',
      hooks: [
        statusHook('modifyStatQuery', (args) =>
          args.statName === 'moveRange' ? args.baseValue + 1 : args.baseValue,
        ),
      ],
    });
    // Combine the knight class with the status type in one catalog.
    const cat = createCatalog({
      statusTypes: [movePlusOne],
      abilities: [],
      commandSets: [],
      classes: [knightDef()],
      items: [],
      rulesets: defaultTestRulesets,
    });
    const u = makeUnit({
      id: 'u1',
      spd: 10,
      statuses: [makeStatusInstance({ typeId: 'move_plus_one' })],
    });
    const state = makeGameState({ units: [u] });
    expect(computeMovementProfile(state, u.id, cat).moveRange).toBe(4);
  });

  it('runs modifyStatQuery for jump — additive bonus stacks on baseline', () => {
    const jumpPlusTwo = makeStatusType({
      id: 'jump_plus_two',
      hooks: [
        statusHook('modifyStatQuery', (args) =>
          args.statName === 'jump' ? args.baseValue + 2 : args.baseValue,
        ),
      ],
    });
    const cat = createCatalog({
      statusTypes: [jumpPlusTwo],
      abilities: [],
      commandSets: [],
      classes: [knightDef()],
      items: [],
      rulesets: defaultTestRulesets,
    });
    const u = makeUnit({
      id: 'u1',
      spd: 10,
      statuses: [makeStatusInstance({ typeId: 'jump_plus_two' })],
    });
    const state = makeGameState({ units: [u] });
    expect(computeMovementProfile(state, u.id, cat).jump).toBe(4);
  });

  it('handlers that target a different stat do not affect moveRange or jump', () => {
    // A 1.5x Speed multiplier (Haste-shaped) must NOT touch moveRange/jump.
    const haste = makeStatusType({
      id: 'haste',
      defaultMagnitude: 1.5,
      hooks: [
        statusHook('modifyStatQuery', (args, ctx) =>
          args.statName === 'spd' ? args.baseValue * (ctx.instance.magnitude ?? 1) : args.baseValue,
        ),
      ],
    });
    const cat = createCatalog({
      statusTypes: [haste],
      abilities: [],
      commandSets: [],
      classes: [knightDef()],
      items: [],
      rulesets: defaultTestRulesets,
    });
    const u = makeUnit({
      id: 'u1',
      spd: 10,
      statuses: [makeStatusInstance({ typeId: 'haste', magnitude: 1.5 })],
    });
    const state = makeGameState({ units: [u] });
    const profile = computeMovementProfile(state, u.id, cat);
    expect(profile.moveRange).toBe(3);
    expect(profile.jump).toBe(2);
  });

  it('throws UnknownDefinitionError when the unit references a class not in the catalog', () => {
    const cat = catalogWith([]); // no classes registered
    const u = makeUnit({ id: 'u1', spd: 10, classId: 'ghost_class' });
    const state = makeGameState({ units: [u] });
    expect(() => computeMovementProfile(state, u.id, cat)).toThrow();
    // The error from catalog.getClass — confirms the lookup chain is wired.
    expect(() => computeMovementProfile(state, u.id, cat)).toThrow(/ghost_class/);
  });
});
