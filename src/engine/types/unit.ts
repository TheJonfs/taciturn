// Unit — a participant in combat.
// See docs/design/core-types.md ("Unit").
//
// Session 1 carried the CT-relevant fields; session 4 added `classState`
// (just `currentClass` for now) so the movement subsystem can find the
// unit's class baseline. The grouping shape matches the design doc's
// `classState: { currentClass; classProgress }`; the progression map
// (`classProgress`) lands with the progression session.
//
// Equipment, loadout, and learning land as their owning sessions arrive
// (5, 5, 5 per the roadmap). The shape stays open for those additions.

import type { ClassId, TeamId, UnitId } from './ids.ts';
import type { Direction, Position } from './spatial.ts';
import type { BaseStats, Vitals } from './stats.ts';
import type { StatusInstance } from './status.ts';

export interface UnitClassState {
  readonly currentClass: ClassId;
  // classProgress: Map<ClassId, ClassProgressionState>; — added with the
  // progression session.
}

export interface Unit {
  readonly id: UnitId;
  readonly team: TeamId;
  readonly name: string;

  readonly classState: UnitClassState;

  position: Position;
  facing: Direction;

  ct: number;

  readonly baseStats: BaseStats;
  vitals: Vitals;

  statuses: ReadonlyArray<StatusInstance>;
}
