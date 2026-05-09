import {
  abilityId,
  bucketId,
  classId,
  commandSetId,
  itemId,
  statusTypeId,
} from '../types/index.ts';
import {
  createCatalog,
  DuplicateDefinitionError,
  UnknownDefinitionError,
  type AbilityDefinition,
  type ClassDefinition,
  type CommandSetDefinition,
  type ItemDefinition,
  type StatusEffectType,
} from './index.ts';

function makeStatusType(id: string, name: string): StatusEffectType {
  return {
    id: statusTypeId(id),
    name,
    tags: [],
    durationMode: 'per_unit_ct',
    stackingRule: 'REFRESH',
    hooks: [],
  };
}

const haste: StatusEffectType = makeStatusType('haste', 'Haste');
const slow: StatusEffectType = makeStatusType('slow', 'Slow');
const cure: AbilityDefinition = {
  id: abilityId('cure'),
  name: 'Cure',
  kind: 'active',
  bucket: bucketId('second_action'),
  baseCost: 1,
  targeting: { kind: 'self' },
  actionSpeed: 0,
  mpCost: 0,
  effects: {},
};
const fire: AbilityDefinition = {
  id: abilityId('fire'),
  name: 'Fire',
  kind: 'active',
  bucket: bucketId('second_action'),
  baseCost: 1,
  targeting: { kind: 'self' },
  actionSpeed: 0,
  mpCost: 0,
  effects: {},
};
const battleSkill: CommandSetDefinition = {
  id: commandSetId('battle_skill'),
  name: 'Battle Skill',
  members: [],
  baseCost: 1,
};
const knight: ClassDefinition = {
  id: classId('knight'),
  name: 'Knight',
  movement: {
    moveRange: 3,
    jump: 2,
    terrainCosts: new Map(),
    canEnter: new Set(['ground']),
  },
  evasion: { front: 0, side: 0, back: 0 },
  equipmentSlots: { leftHand: true, rightHand: true, headgear: true, armor: true, accessory: true },
  firstActionCommandSet: commandSetId('battle_skill'),
  freeAbilities: new Set(),
};
const longSword: ItemDefinition = { id: itemId('long_sword'), name: 'Long Sword' };

function defaults() {
  return {
    statusTypes: [haste, slow],
    abilities: [cure, fire],
    commandSets: [battleSkill],
    classes: [knight],
    items: [longSword],
    rulesets: [],
  };
}

describe('createCatalog', () => {
  it('constructs a Catalog from valid input', () => {
    const cat = createCatalog(defaults());
    expect(cat.statusTypes()).toHaveLength(2);
    expect(cat.abilities()).toHaveLength(2);
    expect(cat.classes()).toHaveLength(1);
    expect(cat.items()).toHaveLength(1);
  });

  it('throws DuplicateDefinitionError when a kind has duplicate ids', () => {
    const dupe = makeStatusType('haste', 'Haste (dupe)');
    expect(() => createCatalog({ ...defaults(), statusTypes: [haste, dupe] })).toThrowError(
      DuplicateDefinitionError,
    );
  });

  it('reports the kind name in the duplicate error', () => {
    const dupe: AbilityDefinition = {
      id: abilityId('cure'),
      name: 'Cure (dupe)',
      kind: 'active',
      bucket: bucketId('second_action'),
      baseCost: 1,
      targeting: { kind: 'self' },
      actionSpeed: 0,
      mpCost: 0,
      effects: {},
    };
    try {
      createCatalog({ ...defaults(), abilities: [cure, dupe] });
      throw new Error('expected throw');
    } catch (e: unknown) {
      expect(e).toBeInstanceOf(DuplicateDefinitionError);
      expect((e as DuplicateDefinitionError).kindName).toBe('Ability');
      expect((e as DuplicateDefinitionError).id).toBe('cure');
    }
  });

  it('treats duplicates as a per-kind concern; the same id in different kinds is fine', () => {
    // ItemId 'haste' and StatusTypeId 'haste' are different brands; the
    // registries are independent. The catalog should accept both.
    const dualUse: ItemDefinition = { id: itemId('haste'), name: 'Haste Belt' };
    const cat = createCatalog({ ...defaults(), items: [longSword, dualUse] });
    expect(cat.hasStatusType(statusTypeId('haste'))).toBe(true);
    expect(cat.hasItem(itemId('haste'))).toBe(true);
  });
});

describe('Catalog lookup', () => {
  const cat = createCatalog(defaults());

  it('getStatusType returns the definition by id', () => {
    expect(cat.getStatusType(statusTypeId('haste'))).toBe(haste);
  });

  it('getStatusType throws UnknownDefinitionError on miss', () => {
    expect(() => cat.getStatusType(statusTypeId('unknown_status'))).toThrowError(
      UnknownDefinitionError,
    );
  });

  it('hasStatusType reflects presence without throwing', () => {
    expect(cat.hasStatusType(statusTypeId('haste'))).toBe(true);
    expect(cat.hasStatusType(statusTypeId('unknown_status'))).toBe(false);
  });

  it('getAbility/getClass/getItem behave consistently', () => {
    expect(cat.getAbility(abilityId('cure'))).toBe(cure);
    expect(cat.getClass(classId('knight'))).toBe(knight);
    expect(cat.getItem(itemId('long_sword'))).toBe(longSword);

    expect(() => cat.getAbility(abilityId('missing'))).toThrowError(UnknownDefinitionError);
    expect(() => cat.getClass(classId('missing'))).toThrowError(UnknownDefinitionError);
    expect(() => cat.getItem(itemId('missing'))).toThrowError(UnknownDefinitionError);
  });

  it('listing methods return every definition of a kind', () => {
    expect(cat.statusTypes()).toEqual(expect.arrayContaining([haste, slow]));
    expect(cat.abilities()).toEqual(expect.arrayContaining([cure, fire]));
    expect(cat.classes()).toEqual([knight]);
    expect(cat.items()).toEqual([longSword]);
  });

  it('the unknown error names the kind it was looking up', () => {
    try {
      cat.getClass(classId('squire'));
      throw new Error('expected throw');
    } catch (e: unknown) {
      expect(e).toBeInstanceOf(UnknownDefinitionError);
      expect((e as UnknownDefinitionError).kindName).toBe('Class');
      expect((e as UnknownDefinitionError).id).toBe('squire');
    }
  });
});

describe('Catalog with empty kinds', () => {
  it('accepts empty arrays for any kind', () => {
    const cat = createCatalog({
      statusTypes: [],
      abilities: [],
      commandSets: [],
      classes: [],
      items: [],
      rulesets: [],
    });
    expect(cat.statusTypes()).toEqual([]);
    expect(cat.abilities()).toEqual([]);
    expect(cat.commandSets()).toEqual([]);
    expect(cat.classes()).toEqual([]);
    expect(cat.items()).toEqual([]);
    expect(cat.rulesets()).toEqual([]);
    expect(cat.hasAbility(abilityId('cure'))).toBe(false);
  });
});
