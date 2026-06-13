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
import type { DominantStat } from '@engine/index.ts';

// The class-differentiated subset of `BaseStats`. Derived via `Pick` so
// a rename in the engine's `BaseStats` propagates here automatically.
export type ClassBaselineStats = Pick<
  BaseStats,
  'maxHpBase' | 'maxMpBase' | 'pa' | 'ma' | 'spd'
>;

// Session 49: per-class dominant stat — the stat that bumps ±1 at level
// ±2 from baseline (L23 → -1, L27 → +1). Mirrors the `dominantStat`
// field on each `ClassDefinition`; a loader-side cross-check pins the
// two in sync. `buildBaseStats` reads from this map directly (no
// catalog dependency at template-author time).
export const classDominantStats: ReadonlyMap<ClassId, DominantStat> = new Map([
  [classId('knight'),         'pa'],
  [classId('earth_mage'),     'ma'],
  [classId('water_mage'),     'ma'],
  [classId('fire_mage'),      'ma'],
  [classId('lightning_mage'), 'ma'],
  [classId('alchemist'),      'pa'],
  [classId('assassin'),       'spd'],
  [classId('hunter'),         'pa'],
  // S49: Calculator is MA-dominant — Math Skill damage / heal / CT
  // scale off MA × Faith, and the +1 at L≥27 / -1 at L≤23 axis is the
  // class's identity stat.
  [classId('calculator'),     'ma'],
  // S54: Terraformer is the first hybrid PA/MA class. PA and MA sit close
  // (6 / 8) to signal the hybrid identity, but MA takes the single
  // dominant-stat pick — most Worldcraft casting reads as magical.
  [classId('terraformer'),    'ma'],
  // S62: Templar is a PA/MA hybrid (6/6). MA takes the single dominant pick
  // — its headline kit (Cure / Raise) is magical (Terraformer precedent).
  [classId('templar'),        'ma'],
]);

export const classBaselineStats: ReadonlyMap<ClassId, ClassBaselineStats> = new Map([
  // S46 tuning: PA 11 → 10. Knight's raw output read a touch too high
  // alongside Battle Skill + Martial Expertise's ×1.25.
  [classId('knight'),         { maxHpBase: 144, maxMpBase: 20, pa: 10, ma: 4,  spd: 9  }],
  // S65 MP rebaseline: the four elemental mages 60 → 48. MP shifts from a
  // non-constraint into a managed resource — sustain options (Circlet's
  // MA/2 per-turn regen, Thoughtful Pacing, Ethers, Rasp Pendant) become
  // real choices rather than redundant. Tuned alongside the Circlet (the
  // regen only earns its slot because MP is now scarce).
  [classId('earth_mage'),     { maxHpBase: 112, maxMpBase: 48, pa: 4,  ma: 12, spd: 8  }],
  [classId('water_mage'),     { maxHpBase: 102, maxMpBase: 48, pa: 4,  ma: 12, spd: 10 }],
  [classId('fire_mage'),      { maxHpBase: 97,  maxMpBase: 48, pa: 4,  ma: 13, spd: 9  }],
  [classId('lightning_mage'), { maxHpBase: 87,  maxMpBase: 48, pa: 4,  ma: 14, spd: 9  }],
  // Session 39b. HP between Knight (144) and Earth Mage (112); MP
  // between Knight (20) and Mages (60) — enough to Compound a few
  // items per battle without being unlimited; PA second-highest of v1
  // classes (Knight 11 > Alchemist 8 > Mages 4) so Throw Item HP/MP
  // coefficients land meaningfully. Speed 10 ties Water Mage (the
  // fastest base) — the Alchemist needs to act often enough to keep
  // the team supplied; lower Speed left them too slow in playtest.
  // S46 tuning: spd 10 → 11. The Alchemist's support-tempo role wants
  // more turns per battle than the prior 10 was producing.
  [classId('alchemist'),      { maxHpBase: 126, maxMpBase: 36, pa: 8,  ma: 5,  spd: 11 }],
  // Session 42. Glass-cannon skirmisher: lowest HP (96) and a low PA (6,
  // halved again to effective ~4 by Two Weapons) — its damage comes from
  // two swings and tempo, not raw stats. MP 24 gates the Command Set
  // (~2–3 castings). Speed 14 is the highest base in v1 (next: Water
  // Mage / Alchemist 10) — the Assassin acts most often, the core of its
  // action-economy identity. MA 3 (lowest) — not a caster.
  // S46 tuning: spd 14 → 13. The +1 Speed Save snowball ramps quickly
  // off 14; 13 keeps the Assassin the fastest base in v1 (next: Alchemist
  // 11 / Water Mage 10) while easing the early-fight tempo lead.
  [classId('assassin'),       { maxHpBase: 96,  maxMpBase: 24, pa: 6,  ma: 3,  spd: 13 }],
  // Session 45. The 8th class, balancing the roster at 4 physical / 4
  // magical. HP 116 sits between Assassin (96) and Earth Mage (112)-ish —
  // sturdier than the glass-cannon Assassin but a back-line shooter, not
  // a front-liner. MP 28 is a light caster supplement (the bow kit spends
  // no MP). PA 6 medium-strong physical; MA 3 (lowest, tied Assassin) —
  // not a caster. Speed 9 medium (below Assassin 14, at the Knight tier).
  [classId('hunter'),         { maxHpBase: 116, maxMpBase: 28, pa: 6,  ma: 3,  spd: 9  }],
  // Session 49 (Calculator, the 9th class). HP 101 sits between
  // Assassin (96) and Earth Mage (112) — modest. MP 47 is moderate
  // (between Knight 20 and Mages 60); Mathematician + Thoughtful
  // Pacing extends sustain. PA 5 (low; Calculator doesn't do physical
  // damage). MA 9 (S51 bump 8 → 9; raises Math Skill damage / heal /
  // CT ~12.5% per cast — early playtest read the Calculator's per-cast
  // payoff as undersized relative to the action-economy cost of casting
  // it). Still below a fully-equipped Mage. Speed 7 (slow; fewer turns
  // per battle). Per blueprint + S51 tuning.
  // S65 MP rebaseline: Calculator 47 → 37. Watch (per playtest): the −10
  // MP composes with the recent faith buff (harder per cast, fewer casts) —
  // it may quietly resolve the "slightly strong" flag without a separate
  // nerf. Terraformer below deliberately stays at 35 (its flat-cost
  // Worldcraft loop is the intended MP sink; rebaselining would starve it).
  [classId('calculator'),     { maxHpBase: 101, maxMpBase: 37, pa: 5,  ma: 9,  spd: 7  }],
  // Session 54 (Terraformer, the 10th class — first hybrid PA/MA). HP 105
  // is moderate (above Calculator 101 / Pyromancer 97, well below Knight
  // 144). MP 35 funds ~3-4 flat-cost Worldcraft casts (lower than
  // Calculator's 47 — Worldcraft is flat-cost, not per-target). PA 6 / MA 8
  // are co-close: both feed Barrier HP (PA × MA = 48 at baseline), the
  // first class to use PA for ability scaling. Speed 8 — slow, like the
  // Calculator tier; the Terraformer sets up the field and acts seldom.
  [classId('terraformer'),    { maxHpBase: 105, maxMpBase: 35, pa: 6,  ma: 8,  spd: 8  }],
  // S62: Templar — hybrid White Mage + Dragoon. HP between the Knight (144)
  // and the mages; MP 36 for the spell kit; PA 6 / MA 6 (well below the
  // Knight's functional 12 and the mages' MA); Speed 8 (slow-caster tier).
  [classId('templar'),        { maxHpBase: 132, maxMpBase: 36, pa: 6,  ma: 6,  spd: 8  }],
]);
