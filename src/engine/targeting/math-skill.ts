// Math Skill targeting predicate enumerator (Session 49 / ADR-0086).
//
// The Calculator's signature mechanic: at cast time the controller picks
// a `parameter` (CT / Height / Level / Current HP) and a `value` (Prime,
// 3, 4, or 5); the engine enumerates every unit on the field whose
// parameter matches the value's predicate and dispatches the ability's
// effect to each. Friendly fire applies; self-targeting applies; KO'd
// and removed units are excluded.
//
// Pure: same `(state, catalog, parameter, value)` always produces the
// same set (with the same lex-id sort). The resolver layer
// (`resolveMathSkillDispatch` in `engine/actions/reducers.ts`) consumes
// this and runs the per-target dispatch with branched seeds.

import { tileAt } from '../map/accessors.ts';
import type { GameState, MathSkillParameter, MathSkillValue, Unit } from '../types/index.ts';

// Primality test — used by the `'prime'` value branch of every Math
// Skill cast. Trial division up to √n; v1 parameters all sit comfortably
// inside Number.MAX_SAFE_INTEGER. The well-known smalls (0, 1, 2, 3) are
// handled inline so the loop body stays clean.
//
// Negative inputs are not prime by convention; the v1 parameters (CT,
// height, level, current_hp) all return non-negative numbers, but the
// guard means future signed parameters (e.g., a debt counter) don't
// surface false positives.
export function isPrime(n: number): boolean {
  if (!Number.isFinite(n) || !Number.isInteger(n)) return false;
  if (n < 2) return false;
  if (n === 2 || n === 3) return true;
  if (n % 2 === 0 || n % 3 === 0) return false;
  // 6k ± 1 wheel: after handling 2 and 3, every prime > 3 sits at
  // ±1 (mod 6). The loop probes those two residues per step of 6.
  for (let i = 5; i * i <= n; i += 6) {
    if (n % i === 0 || n % (i + 2) === 0) return false;
  }
  return true;
}

// Predicate: does `unit`'s reading of `parameter` satisfy `value`?
//
// Parameter reads:
//   - 'ct'         — current Charge Time (unit.ct).
//   - 'height'     — elevation of the unit's tile (tileAt(...).elevation,
//                    or 0 if the position resolves to no tile — defensive
//                    against a deployed unit on a removed tile).
//   - 'level'      — unit.level (Session 49: slot-derived level).
//   - 'current_hp' — unit.vitals.hp.
//
// Value tests:
//   - 'prime' → `isPrime(reading)`.
//   - 3 / 4 / 5 → `reading % value === 0`. Per FFT canon, 0 IS divisible
//     by every positive integer (0 % 3 === 0 in JavaScript), so a unit
//     at CT 0 / HP 0 / Level 0 matches every numeric divisor — careful
//     when KO'd-unit exclusion is the operative filter (see
//     `enumerateMathSkillTargets`).
export function unitMatchesMathSkill(
  state: GameState,
  unit: Unit,
  parameter: MathSkillParameter,
  value: MathSkillValue,
): boolean {
  const reading = readParameter(state, unit, parameter);
  if (value === 'prime') return isPrime(reading);
  if (value === 'square') return isPerfectSquare(reading);
  return reading % value === 0;
}

// Perfect-square test for the `'square'` value (TABA, Thessaly-exclusive):
// selects units whose parameter is 0, 1, 4, 9, 16, 25, … Negatives are never
// squares. Uses an integer-rounded sqrt then verifies (avoids float error).
export function isPerfectSquare(n: number): boolean {
  if (n < 0 || !Number.isInteger(n)) return false;
  const r = Math.round(Math.sqrt(n));
  return r * r === n;
}

function readParameter(
  state: GameState,
  unit: Unit,
  parameter: MathSkillParameter,
): number {
  switch (parameter) {
    case 'ct':
      return unit.ct;
    case 'height': {
      const tile = tileAt(state.map, unit.position.x, unit.position.y, unit.position.layer);
      return tile?.elevation ?? 0;
    }
    case 'level':
      return unit.level;
    case 'current_hp':
      return unit.vitals.hp;
    case 'xp':
      // TABA (Thessaly-exclusive): the target's between-level XP carry.
      return unit.xp;
  }
}

// Enumerate matching units for a Math Skill cast. The returned array is
// sorted by `unit.id` for stable per-target dispatch order (mirrors
// `resolveAoeDispatch`'s lex-id sort). Filters:
//   - Removed units are always excluded (engine convention).
//   - KO'd units (vitals.hp <= 0) are excluded per ADR-0086 — a Math
//     cast on a corpse adds noise without consequence; and KO'd units'
//     CT freezes at the trigger moment, which would distort 'ct'-based
//     calculations.
//
// Self-targeting: the caster is INCLUDED when their reading matches.
// The dispatcher applies the same per-target body to the caster — no
// special self-effect path.
export function enumerateMathSkillTargets(
  state: GameState,
  parameter: MathSkillParameter,
  value: MathSkillValue,
): ReadonlyArray<Unit> {
  const matched: Unit[] = [];
  for (const unit of state.units.values()) {
    if (unit.removed) continue;
    if (unit.vitals.hp <= 0) continue;
    if (unitMatchesMathSkill(state, unit, parameter, value)) {
      matched.push(unit);
    }
  }
  // Stable lex-id ordering for replay determinism (matches AoE dispatch).
  matched.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return matched;
}
