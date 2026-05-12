// Hit-chance internal helpers — facing classification, per-facing evasion
// lookup, elevation modifier. Extracted from `handlers.ts` so both the
// pipeline-stage handler (`evasionCheck`) and the pure forecast helper
// (`computeOutgoingHitChance` in `hit-chance.ts`) read from one source.
//
// All three functions are pure given (input arguments). No state
// mutations. Per Session 30 fold-in (preparation for the forecast
// hit-chance / accuracy / range projection).

import type { Direction, GameState, Position } from '../types/index.ts';

// Classify the attacker's position relative to the target's facing as
// front, side, or back. Per the Battle Mechanics Guide:
//   - within ±45° of facing → Front
//   - within 45-135° on either side → Side
//   - within 135-180° → Back
//
// Edge case: attacker on the same tile as target is degenerate and
// shouldn't happen in v1 (an ability targets self via `'self'`
// targeting, not by passing the attacker's own position). When it does,
// returns 'front' as a safe default.
export function computeAttackerFacing(
  attacker: Position,
  target: Position,
  facing: Direction,
): 'front' | 'side' | 'back' {
  const dx = attacker.x - target.x;
  const dy = attacker.y - target.y;
  if (dx === 0 && dy === 0) return 'front';
  const mag = Math.sqrt(dx * dx + dy * dy);
  const ux = dx / mag;
  const uy = dy / mag;
  // Facing vector. y increases downward (S = +y, N = -y).
  let fx = 0;
  let fy = 0;
  switch (facing) {
    case 'N': fy = -1; break;
    case 'S': fy = 1; break;
    case 'E': fx = 1; break;
    case 'W': fx = -1; break;
  }
  const cos = ux * fx + uy * fy;
  const COS_45 = Math.SQRT1_2; // √2 / 2 ≈ 0.7071
  if (cos >= COS_45) return 'front';
  if (cos <= -COS_45) return 'back';
  return 'side';
}

export function pickEvasion(
  evasion: { readonly front: number; readonly side: number; readonly back: number },
  facing: 'front' | 'side' | 'back',
): number {
  if (facing === 'front') return evasion.front;
  if (facing === 'side') return evasion.side;
  return evasion.back;
}

// Elevation modifier per BMG: attacker higher → 1.05; attacker lower →
// 0.95; same elevation → 1.0. Reads tile elevation at the attacker's
// and target's positions. If either tile is missing (impossible in v1
// well-formed maps but defensive), returns 1.0.
export function computeElevationModifier(
  state: GameState,
  attacker: Position,
  target: Position,
): number {
  const attackerTile = state.map.tiles.find(
    (t) => t.x === attacker.x && t.y === attacker.y && t.layer === attacker.layer,
  );
  const targetTile = state.map.tiles.find(
    (t) => t.x === target.x && t.y === target.y && t.layer === target.layer,
  );
  if (attackerTile === undefined || targetTile === undefined) return 1.0;
  if (attackerTile.elevation > targetTile.elevation) return 1.05;
  if (attackerTile.elevation < targetTile.elevation) return 0.95;
  return 1.0;
}
