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

export interface CommandSetDefinition {
  readonly id: CommandSetId;
  readonly name: string;
  readonly members: ReadonlyArray<AbilityId>;
  readonly baseCost: number;
}
