// ClassDefinition — the catalog definition of a unit class.
// See docs/design/ability-slots.md and the deferred class/progression doc.
//
// Session 4 added `movement` (the class baseline read by
// computeMovementProfile). Session 5 adds command sets and bucket
// capacities; session 6 adds Speed and other stat baselines.
//
// `ClassMovementBaseline` is the per-class anchor for the move profile.
// Required so authors must consciously declare what their class can enter
// and how far it can move. Session 5 introduces a hook surface that lets
// passive-bucket abilities (Float, Fly, Move+1, Jump+2) modify the
// non-stat fields; until then, this baseline is the whole story for
// terrain entry, terrain costs, and special movement.

import type { ClassId, SpecialMovementType, TerrainType } from '../../types/index.ts';

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
}
