// Unit — a participant in combat.
// See docs/design/core-types.md ("Unit").
//
// Session 1 carried the CT-relevant fields; session 4 added `classState`
// (just `currentClass` for now); session 5 added `loadout` so the
// ability-slot system has somewhere to read equip state from. The
// grouping shapes match the design doc; the deferred fields
// (`classProgress`, `equipment`, per-command-set `learning`) land
// alongside their owning sessions.

import type { DamageTag } from './damage.ts';
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

  // Per-tag resistance map. Sparse — missing tags default to 0 (no
  // resistance). Range per-entry is [-100, 200] per the Battle Mechanics
  // Guide. Composition across sources (class baseline + equipment +
  // statuses) is additive; consumers ship in session 14's resistance
  // stage handler. Multi-tag composition follows ADR-0015 (signed
  // maximum). Effects with the 'healing' tag opt out of resistance
  // modulation entirely (ADR-0016) — the resistance stage handler reads
  // the tag set and short-circuits.
  readonly resistances: ReadonlyMap<DamageTag, number>;

  statuses: ReadonlyArray<StatusInstance>;
}
