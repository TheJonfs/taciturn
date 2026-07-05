// TABA chapter-1 plot-unique units — the durable stable ids.
//
// Plot uniques get DURABLE, authored ids (not the positional `taba-m1-NN-slug`
// scheme) because two durable seams key on a specific unit: Seam 3
// (unit-restricted components — Thessaly's Math components, Sera's Hamstring) and
// the M5 story→roster-unit link. The id is also the portrait key and the plot
// portrait filename, so `plot-lumen` ↔ `plot-lumen.png` ↔ the unit line up.
//
// Kept in a tiny standalone module so both the plot-unit definitions
// (`plot-units.ts`) and the component catalog (which prices the restricted
// components against these ids) can import them without a cycle.

import { unitId, type UnitId } from '@engine/index.ts';

export const PLOT_UNIT_IDS = {
  lumen: unitId('plot-lumen'),
  chris: unitId('plot-chris'),
  clio: unitId('plot-clio'),
  thessaly: unitId('plot-thessaly'),
  sera: unitId('plot-sera'),
} as const satisfies Record<string, UnitId>;
