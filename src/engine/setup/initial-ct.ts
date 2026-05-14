// Initial-CT randomization — pure function of (ruleset, placement,
// masterSeed). Lifted out of `create-initial-state.ts` in Session 32
// (ADR-0071) so the orchestrator's pre-battle phase can re-resolve the
// value and emit `system_set_ct` actions through the reducer without
// pulling in the rest of the setup module's surface.
//
// Stable by construction: same masterSeed + same unit id → same draw.
// The exhaustive switch on `ruleset.initialCT.kind` lights up when a new
// kind ships so the new variant is consciously handled.

import { TRIGGER_THRESHOLD } from '../ct/constants.ts';
import type { RulesetDefinition, UnitPlacement } from '../types/index.ts';

export function resolveInitialCT(
  ruleset: RulesetDefinition,
  placement: UnitPlacement,
  masterSeed: number,
): number {
  switch (ruleset.initialCT.kind) {
    case 'fixed':
      return ruleset.initialCT.value;
    case 'speed_with_variance': {
      const { speedFactor, variancePct } = ruleset.initialCT;
      const base = placement.baseStats.spd * speedFactor;
      const v = unitFloatFromKey(masterSeed, placement.id);
      const swing = (variancePct / 100) * TRIGGER_THRESHOLD;
      const offset = (v - 0.5) * swing;
      const raw = base + offset;
      return Math.max(0, Math.min(TRIGGER_THRESHOLD - 1, Math.round(raw)));
    }
    case 'uniform_int': {
      const { min, max } = ruleset.initialCT;
      const lo = Math.min(min, max);
      const hi = Math.max(min, max);
      const span = hi - lo + 1;
      const v = unitFloatFromKey(masterSeed, placement.id);
      const draw = lo + Math.floor(v * span);
      return Math.max(0, Math.min(TRIGGER_THRESHOLD - 1, draw));
    }
  }
}

// mulberry32-style mixer over (masterSeed XOR string-hash(id)) → unit
// float in [0, 1). Stable by construction: same masterSeed + same
// unit id always produces the same value.
function unitFloatFromKey(masterSeed: number, key: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < key.length; i++) {
    h = Math.imul(h ^ key.charCodeAt(i), 16777619);
  }
  let s = (masterSeed ^ h) >>> 0;
  s = (s + 0x6d2b79f5) >>> 0;
  let t = s;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
