// Unit — a participant in combat.
// See docs/design/core-types.md ("Unit").
//
// Session 1 carried the CT-relevant fields; session 4 added `classState`
// (just `currentClass` for now); session 5 added `loadout` so the
// ability-slot system has somewhere to read equip state from. The
// grouping shapes match the design doc; the deferred fields
// (`classProgress`, `equipment`, per-command-set `learning`) land
// alongside their owning sessions.

import type { ClassId, TeamId, UnitId } from './ids.ts';
import type { Loadout } from './loadout.ts';
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
  readonly loadout: Loadout;

  position: Position;
  facing: Direction;

  ct: number;

  readonly baseStats: BaseStats;
  vitals: Vitals;

  statuses: ReadonlyArray<StatusInstance>;
}
