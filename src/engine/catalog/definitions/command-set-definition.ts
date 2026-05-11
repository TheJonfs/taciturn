// CommandSetDefinition — the catalog definition of a command set.
// See docs/design/ability-slots.md ("Bucket types") and ADR-0007.
//
// A command set is a named action group (typically associated with a
// class, e.g. "Battle Skill" from Knight). Active buckets hold
// CommandSetId references; the unit's per-(unit, command-set) learning
// state determines which member abilities are *available* during play
// (learning lands with the progression session — until then, "all
// members are usable" is the assumption).
//
// Cost asymmetry across command sets is supported via a per-set
// `baseCost` (defaulting to 1 in v1; future premium sets may price
// higher). Capacity is a property of the bucket, not the set.

import type { AbilityId, CommandSetId } from '../../types/index.ts';
import type { Availability } from './availability.ts';

export interface CommandSetDefinition {
  readonly id: CommandSetId;
  readonly name: string;
  readonly members: ReadonlyArray<AbilityId>;
  readonly baseCost: number;
  // Required per ADR-0049. Catalog construction throws if missing.
  // Hiding a command set keeps its members usable when authored onto
  // a unit's loadout but excludes the set from team-builder offerings —
  // appropriate when the set is too thin to surface (v1 `white_magic`)
  // or reserved for future progression content.
  readonly availability: Availability;
}
