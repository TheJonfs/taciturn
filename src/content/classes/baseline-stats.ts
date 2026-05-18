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
  // Session 39b. Per the S39 brief L25 reference: 126 HP / 36 MP / 8 PA
  // / 5 MA / spd 8. HP between Knight (144) and Earth Mage (112);
  // MP between Knight (20) and Mages (60) — enough to Compound a few
  // items per battle without being unlimited; PA second-highest of v1
  // classes (Knight 11 > Alchemist 8 > Mages 4) so Throw Item HP/MP
  // coefficients land meaningfully.
  [classId('alchemist'),      { maxHpBase: 126, maxMpBase: 36, pa: 8,  ma: 5,  spd: 8  }],
]);
