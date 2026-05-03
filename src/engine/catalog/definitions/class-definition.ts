// ClassDefinition — the catalog definition of a unit class.
// See docs/design/ability-slots.md and the deferred class/progression doc.
//
// Session 4 added `movement` (the class baseline read by
// computeMovementProfile). Session 5 added `firstActionCommandSet` (the
// CommandSet pinned into the unit's First Action active bucket — class-
// determined per design) and `freeAbilities` (abilities the class grants
// at cost 0 per the design's "cost-0 modulation" mechanism). Session 6
// adds Speed and other stat baselines.
//
// `ClassMovementBaseline` is the per-class anchor for the move profile.
// Required so authors must consciously declare what their class can enter
// and how far it can move. Session 5 introduces hooks that let passive-
// bucket abilities (Float, Fly, Move+1, Jump+2) modify the profile; this
// baseline is the starting point those modifiers compose over.
//
// `freeAbilities` is the set of AbilityIds whose `getCost` is 0 when the
// unit is in this class. Per design, class is just one input to per-
// character cost computation; this is its v1 hook. Future modifier
// sources (equipment, status, traits) will compose on top in their
// respective sessions.

import type {
  AbilityId,
  ClassId,
  CommandSetId,
  SpecialMovementType,
  TerrainType,
} from '../../types/index.ts';

export interface ClassMovementBaseline {
  readonly moveRange: number;
  readonly jump: number;
  readonly terrainCosts: ReadonlyMap<TerrainType, number>;
  readonly canEnter: ReadonlySet<TerrainType>;
  readonly specialMovement?: SpecialMovementType;
}

export interface ClassDefinition {
  readonly id: ClassId;
  readonly name: string;
  readonly movement: ClassMovementBaseline;
  readonly firstActionCommandSet: CommandSetId;
  readonly freeAbilities: ReadonlySet<AbilityId>;
}
