// Public API of src/engine/catalog.
// See ADR-0004 (catalog injection pattern) and
// docs/architecture/architecture-overview.md ("Catalogs vs. instances").

export { Catalog, createCatalog, type CatalogInput } from './catalog.ts';
export {
  type AbilityDefinition,
  type AbilityEffects,
  type AbilityRange,
  type ActiveAbilityDefinition,
  type ClassDefinition,
  type ClassMovementBaseline,
  type CommandSetDefinition,
  type DamageSpec,
  type ItemDefinition,
  type PassiveAbilityDefinition,
  type RangeMode,
  type RulesetDefinition,
  type StatusEffectSpec,
  type StatusEffectType,
  type TargetingSpec,
} from './definitions/index.ts';
export { DuplicateDefinitionError, UnknownDefinitionError } from './errors.ts';
