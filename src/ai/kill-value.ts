// "Kill value" of a target — the shared currency weight that makes the AI
// prefer hitting targets closer to death. Higher when the target is closer to
// dead; the inverse-HP shape gives diminishing returns at high HP and rapid
// escalation as HP → 0, so a lethal hit dominates. Used by both the unified
// scorer (`basic.ts`) and the Calculator Math-skill scorer
// (`math-skill-scoring.ts`) — extracted here so the two share one definition
// without a circular import.

import type { Unit } from '@engine/index.ts';

export function killValue(target: Unit): number {
  const maxHp = Math.max(1, target.baseStats.maxHpBase);
  // 1 / (hp/maxHp + 0.05) — 0.05 floor avoids divide-by-zero on a unit with
  // 0 HP (which the AI shouldn't reach but is defensive).
  return 1 / Math.max(0.05, target.vitals.hp / maxHp);
}
