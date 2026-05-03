// Catalog — the lookup database for static definitions.
// See ADR-0004 for how engine functions reach the catalog (injected
// alongside `state`, never stored on `GameState`, never a singleton).
// See docs/architecture/architecture-overview.md ("Catalogs vs. instances").
//
// One `Catalog` is constructed at app startup from `src/content/` and
// passed to engine functions that read static definitions. Definitions
// themselves grow per kind in their owning sessions; this file owns the
// lookup surface only.

import type {
  AbilityDefinition,
  ClassDefinition,
  CommandSetDefinition,
  ItemDefinition,
  StatusEffectType,
} from './definitions/index.ts';
import { Registry } from './registry.ts';
import type {
  AbilityId,
  ClassId,
  CommandSetId,
  ItemId,
  StatusTypeId,
} from '../types/index.ts';

export interface CatalogInput {
  readonly statusTypes: ReadonlyArray<StatusEffectType>;
  readonly abilities: ReadonlyArray<AbilityDefinition>;
  readonly commandSets: ReadonlyArray<CommandSetDefinition>;
  readonly classes: ReadonlyArray<ClassDefinition>;
  readonly items: ReadonlyArray<ItemDefinition>;
}

export class Catalog {
  private readonly statusTypeRegistry: Registry<StatusTypeId, StatusEffectType>;
  private readonly abilityRegistry: Registry<AbilityId, AbilityDefinition>;
  private readonly commandSetRegistry: Registry<CommandSetId, CommandSetDefinition>;
  private readonly classRegistry: Registry<ClassId, ClassDefinition>;
  private readonly itemRegistry: Registry<ItemId, ItemDefinition>;

  constructor(input: CatalogInput) {
    this.statusTypeRegistry = new Registry(input.statusTypes, 'StatusEffectType');
    this.abilityRegistry = new Registry(input.abilities, 'Ability');
    this.commandSetRegistry = new Registry(input.commandSets, 'CommandSet');
    this.classRegistry = new Registry(input.classes, 'Class');
    this.itemRegistry = new Registry(input.items, 'Item');
  }

  getStatusType(id: StatusTypeId): StatusEffectType {
    return this.statusTypeRegistry.get(id);
  }
  hasStatusType(id: StatusTypeId): boolean {
    return this.statusTypeRegistry.has(id);
  }
  statusTypes(): ReadonlyArray<StatusEffectType> {
    return this.statusTypeRegistry.all();
  }

  getAbility(id: AbilityId): AbilityDefinition {
    return this.abilityRegistry.get(id);
  }
  hasAbility(id: AbilityId): boolean {
    return this.abilityRegistry.has(id);
  }
  abilities(): ReadonlyArray<AbilityDefinition> {
    return this.abilityRegistry.all();
  }

  getCommandSet(id: CommandSetId): CommandSetDefinition {
    return this.commandSetRegistry.get(id);
  }
  hasCommandSet(id: CommandSetId): boolean {
    return this.commandSetRegistry.has(id);
  }
  commandSets(): ReadonlyArray<CommandSetDefinition> {
    return this.commandSetRegistry.all();
  }

  getClass(id: ClassId): ClassDefinition {
    return this.classRegistry.get(id);
  }
  hasClass(id: ClassId): boolean {
    return this.classRegistry.has(id);
  }
  classes(): ReadonlyArray<ClassDefinition> {
    return this.classRegistry.all();
  }

  getItem(id: ItemId): ItemDefinition {
    return this.itemRegistry.get(id);
  }
  hasItem(id: ItemId): boolean {
    return this.itemRegistry.has(id);
  }
  items(): ReadonlyArray<ItemDefinition> {
    return this.itemRegistry.all();
  }
}

export function createCatalog(input: CatalogInput): Catalog {
  return new Catalog(input);
}
