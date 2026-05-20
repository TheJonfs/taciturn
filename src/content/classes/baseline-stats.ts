// Per-class baseline numeric stats — the class-differentiated values a
// unit has before any equipment, ability, status, or trait modifies
// them. Calibrated to the L25 reference level (see
// docs/mage-war-content-spec.md §1 and docs/class-baseline-stats.md).
//
// This module is the **single source of truth** for these five numbers
// per class. `src/content/battles/demo.ts` consumes this map to build
// its placements' `BaseStats` — it does not re-declare the values.
// External tooling (game-guide generators) reads this map directly.
//
// Scope: only the class-differentiated stats live here. Brave, Faith,
// and the crit baseline are uniform placement defaults, not per-class
// values, and stay with the placement author (see `demo.ts`). There is
// no level-generation curve in the implementation — every v1 unit is
// implicitly L25 and these values are authored directly.

import { classId, type BaseStats, type ClassId } from '@engine/index.ts';

// The class-differentiated subset of `BaseStats`. Derived via `Pick` so
// a rename in the engine's `BaseStats` propagates here automatically.
export type ClassBaselineStats = Pick<
  BaseStats,
  'maxHpBase' | 'maxMpBase' | 'pa' | 'ma' | 'spd'
>;

export const classBaselineStats: ReadonlyMap<ClassId, ClassBaselineStats> = new Map([
  [classId('knight'),         { maxHpBase: 144, maxMpBase: 20, pa: 11, ma: 4,  spd: 9  }],
  [classId('earth_mage'),     { maxHpBase: 112, maxMpBase: 60, pa: 4,  ma: 12, spd: 8  }],
  [classId('water_mage'),     { maxHpBase: 102, maxMpBase: 60, pa: 4,  ma: 12, spd: 10 }],
  [classId('fire_mage'),      { maxHpBase: 97,  maxMpBase: 60, pa: 4,  ma: 13, spd: 9  }],
  [classId('lightning_mage'), { maxHpBase: 87,  maxMpBase: 60, pa: 4,  ma: 14, spd: 9  }],
  // Session 39b. HP between Knight (144) and Earth Mage (112); MP
  // between Knight (20) and Mages (60) — enough to Compound a few
  // items per battle without being unlimited; PA second-highest of v1
  // classes (Knight 11 > Alchemist 8 > Mages 4) so Throw Item HP/MP
  // coefficients land meaningfully. Speed 10 ties Water Mage (the
  // fastest base) — the Alchemist needs to act often enough to keep
  // the team supplied; lower Speed left them too slow in playtest.
  [classId('alchemist'),      { maxHpBase: 126, maxMpBase: 36, pa: 8,  ma: 5,  spd: 10 }],
  // Session 42. Glass-cannon skirmisher: lowest HP (96) and a low PA (6,
  // halved again to effective ~4 by Two Weapons) — its damage comes from
  // two swings and tempo, not raw stats. MP 24 gates the Command Set
  // (~2–3 castings). Speed 14 is the highest base in v1 (next: Water
  // Mage / Alchemist 10) — the Assassin acts most often, the core of its
  // action-economy identity. MA 3 (lowest) — not a caster.
  [classId('assassin'),       { maxHpBase: 96,  maxMpBase: 24, pa: 6,  ma: 3,  spd: 14 }],
]);
