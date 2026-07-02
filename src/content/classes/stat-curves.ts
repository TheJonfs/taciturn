// Per-class base-stat curves — the level → base-stat function for the
// five level-driven stats (PA, MA, HP, MP, Speed). See the M2 brief
// `docs/TABADesign/m2-stat-curves-brief.md` and ADR-0137.
//
// WHY THIS EXISTS. Mage War is a single-battle game whose units cluster
// at L25 (the tuning anchor). The campaign (TABA) grows units across the
// full level range, so it needs a real per-level curve, not the crude
// S49/S50 ±10% slot-modifier this replaces. The curves are anchored so
// that **at L25 they return the exact §5 stat block** (the values in
// `classBaselineStats`); ceil/floor of an integer is itself, so
// `leveledClassStats(class, 25)` reproduces today's numbers exactly. The
// curves only diverge from the L25 anchor *away* from 25 — which is the
// campaign's domain.
//
// CONSTANTS, NOT TABLES. Each stat's curve is a pure function of the
// class's §5 L25 anchor and a small set of shared constants (the L1 and,
// for MA/Speed, L50 factors below). Retuning a curve is a constant edit
// here, never a 14-row table rewrite.
//
// ROUNDING is applied only to the *final* per-level output — the float
// curve is continuous; rounding is a storage/display step. ceil for the
// magnitude stats (PA/MA/HP/MP — generous, lifts dump stats off zero);
// floor for Speed (the stat that compounds into turn economy — kept tight).
//
// TWO SPECIAL CASES (see the brief §"The method"):
//   - MA is **quadratic and deliberately uncapped past L50** (a grinding
//     mage's MA accelerates by design — "sufficiently advanced wizardry
//     eclipses a grandmaster's swordarm"). Its counterplay is a gear/access
//     concern for M3, not a curve concern. Do not linearize or clamp MA.
//   - Speed is **floored, plateaus at L50, and keeps its 99 cap**. Base
//     Speed stops climbing at L50; the "devastating fast build" comes from
//     the Haste/gear multiplier stack, not base growth. Speed is the
//     anti-MA: bounded by design.

import { type ClassId } from '@engine/index.ts';
import { classBaselineStats, type ClassBaselineStats } from './baseline-stats.ts';

// ── Pure interpolation helpers ──────────────────────────────────────────

// The line through (x1, y1) and (x2, y2), evaluated at x. Extends
// linearly outside [x1, x2] (used for the PA/HP/MP past-L50 continuation).
function linearThrough(x1: number, y1: number, x2: number, y2: number, x: number): number {
  return y1 + ((y2 - y1) * (x - x1)) / (x2 - x1);
}

// The parabola through three points, evaluated at x (Lagrange form).
// Extends as the quadratic outside the anchor span (the MA runaway).
function quadraticThrough(
  p1: readonly [number, number],
  p2: readonly [number, number],
  p3: readonly [number, number],
  x: number,
): number {
  const [x1, y1] = p1;
  const [x2, y2] = p2;
  const [x3, y3] = p3;
  const l1 = ((x - x2) * (x - x3)) / ((x1 - x2) * (x1 - x3));
  const l2 = ((x - x1) * (x - x3)) / ((x2 - x1) * (x2 - x3));
  const l3 = ((x - x1) * (x - x2)) / ((x3 - x1) * (x3 - x2));
  return y1 * l1 + y2 * l2 + y3 * l3;
}

// ── Curve constants (the retuning surface) ──────────────────────────────
//
// Each factor multiplies the class's §5 L25 anchor to produce a curve
// anchor. Fractions kept exact (not pre-divided) so the derivation stays
// legible against the brief's method table.
const PA_L1_FACTOR = 4 / 13; // PA: linear through (1, f·L25), (25, L25)
const MA_L1_FACTOR = 3 / 17; // MA: quadratic through (1, f1·L25), (25, L25), (50, f50·L25)
const MA_L50_FACTOR = 40 / 17;
const HP_L1_FACTOR = 60 / 190; // HP: linear
const MP_L1_FACTOR = 13 / 48; // MP: linear
// Speed: piecewise-linear through (1, 0.5·L25 + 1.5), (25, L25), (50, (4/3)·L25).
const SPD_L1_SLOPE = 0.5;
const SPD_L1_OFFSET = 1.5;
const SPD_L50_FACTOR = 4 / 3;

// The one stat that keeps a hard ceiling (see header). MA is intentionally
// absent — it is uncapped by design.
const SPEED_MAX_CAP = 99;

const ANCHOR_LEVEL = 25;
const PLATEAU_LEVEL = 50;

// ── The curve evaluator ─────────────────────────────────────────────────

// The float PA/MA/HP/MP/Speed curves, evaluated at `level` against a §5
// L25 anchor value. Exposed (pre-rounding) for tests and tooling that
// want the continuous curve; `leveledClassStats` rounds per the per-stat
// rule.
export function paCurve(l25: number, level: number): number {
  return linearThrough(1, PA_L1_FACTOR * l25, ANCHOR_LEVEL, l25, level);
}
export function maCurve(l25: number, level: number): number {
  return quadraticThrough(
    [1, MA_L1_FACTOR * l25],
    [ANCHOR_LEVEL, l25],
    [PLATEAU_LEVEL, MA_L50_FACTOR * l25],
    level,
  );
}
export function hpCurve(l25: number, level: number): number {
  return linearThrough(1, HP_L1_FACTOR * l25, ANCHOR_LEVEL, l25, level);
}
export function mpCurve(l25: number, level: number): number {
  return linearThrough(1, MP_L1_FACTOR * l25, ANCHOR_LEVEL, l25, level);
}
export function spdCurve(l25: number, level: number): number {
  const l1 = SPD_L1_SLOPE * l25 + SPD_L1_OFFSET;
  const l50 = SPD_L50_FACTOR * l25;
  // Plateau: base Speed stops climbing at L50 (clamp to the L50 value).
  if (level >= PLATEAU_LEVEL) return l50;
  if (level >= ANCHOR_LEVEL) return linearThrough(ANCHOR_LEVEL, l25, PLATEAU_LEVEL, l50, level);
  return linearThrough(1, l1, ANCHOR_LEVEL, l25, level);
}

// The five level-driven base stats for a class at a given level, rounded
// per the per-stat rule. Reads the §5 L25 anchor from `classBaselineStats`
// (the single source of truth). Throws loud if the class is unregistered —
// a missing baseline is a content bug, not a silent zero.
export function leveledClassStats(classId: ClassId, level: number): ClassBaselineStats {
  const anchor = classBaselineStats.get(classId);
  if (anchor === undefined) {
    throw new Error(
      `leveledClassStats: no baseline stats registered for class ${String(classId)}`,
    );
  }
  return {
    // ceil for the magnitude stats.
    pa: Math.ceil(paCurve(anchor.pa, level)),
    ma: Math.ceil(maCurve(anchor.ma, level)), // uncapped — MA runaway is by design
    maxHpBase: Math.ceil(hpCurve(anchor.maxHpBase, level)),
    maxMpBase: Math.ceil(mpCurve(anchor.maxMpBase, level)),
    // floor for Speed, and the one stat that keeps a 99 cap.
    spd: Math.min(SPEED_MAX_CAP, Math.floor(spdCurve(anchor.spd, level))),
  };
}
