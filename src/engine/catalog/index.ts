// Public API of src/engine/catalog.
// See ADR-0004 (catalog injection pattern) and
// docs/architecture/architecture-overview.md ("Catalogs vs. instances").

export { Catalog, createCatalog, type CatalogInput } from './catalog.ts';
export {
  type AbilityDefinition,
  type AbilityEffects,
  type AbilityRange,
  type AbilityRangeModifier,
  type AccessoryEquipment,
  type ActiveAbilityDefinition,
  type AoeSpec,
  type ArmorEquipment,
  type Availability,
  type ClassDefinition,
  type ClassEquipmentSlots,
  type ClassEvasionBaseline,
  type ClassMovementBaseline,
  type CommandSetDefinition,
  type ConsumableDefinition,
  type ConsumableEffects,
  type ConsumableHpRestoreSpec,
  type ConsumableMpRestoreSpec,
  type ConsumableStatusClearSpec,
  type DamageSpec,
  type EquipmentDefinition,
  type EvasionMods,
  type HeadgearEquipment,
  type ItemDefinition,
  type PassiveAbilityDefinition,
  type RangeMode,
  type RulesetDefinition,
  type ShieldEquipment,
  type StockpileGrantEntry,
  type StatusAiHints,
  type StatusEffectSpec,
  type StatusEffectType,
  type TargetingSpec,
  type WeaponEquipment,
  type WeaponPhysicalVariance,
} from './definitions/index.ts';
export {
  DuplicateDefinitionError,
  MissingAvailabilityError,
  UnknownDefinitionError,
} from './errors.ts';
