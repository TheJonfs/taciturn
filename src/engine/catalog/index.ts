// Public API of src/engine/catalog.
// See ADR-0004 (catalog injection pattern) and
// docs/architecture/architecture-overview.md ("Catalogs vs. instances").

export { Catalog, createCatalog, type CatalogInput } from './catalog.ts';
export {
  type AbilityDefinition,
  type ClassDefinition,
  type ItemDefinition,
  type StatusEffectType,
} from './definitions/index.ts';
export { DuplicateDefinitionError, UnknownDefinitionError } from './errors.ts';
