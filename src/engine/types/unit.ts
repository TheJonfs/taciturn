// Unit — a participant in combat.
// See docs/design/core-types.md ("Unit").
//
// Session 1 includes only fields needed by the CT system. Equipment, loadout,
// classState, and learning land as their owning sessions arrive (5, 5, 6, 5
// respectively per the roadmap). The shape is open for those additions.

import type { TeamId, UnitId } from './ids.ts';
import type { Direction, Position } from './spatial.ts';
import type { BaseStats, Vitals } from './stats.ts';
import type { StatusInstance } from './status.ts';

export interface Unit {
  readonly id: UnitId;
  readonly team: TeamId;
  readonly name: string;

  position: Position;
  facing: Direction;

  ct: number;

  readonly baseStats: BaseStats;
  vitals: Vitals;

  statuses: ReadonlyArray<StatusInstance>;
}
