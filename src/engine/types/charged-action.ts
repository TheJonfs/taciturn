// Charged Action — first-class CT entity for in-progress spells/abilities.
// See docs/design/ct-system.md ("Charged Actions") and ADR-0003.
//
// Mirrors the Unit CT shape: `ct` accumulates each tick at `speed`, triggers
// at the universal threshold of 100. The projection queue treats Units and
// ChargedActions through one code path because of this symmetry.

import type { AbilityId, ChargedActionId, UnitId } from './ids.ts';
import type { Position } from './spatial.ts';

export type TargetRef =
  | { readonly kind: 'unit'; readonly unitId: UnitId }
  | { readonly kind: 'tile'; readonly position: Position };

export interface ChargedAction {
  readonly id: ChargedActionId;
  readonly casterId: UnitId;
  ct: number;
  speed: number;
  readonly abilityId: AbilityId;
  readonly targets: ReadonlyArray<TargetRef>;
  readonly sourceSequenceNumber: number;
  // TABA Ch3 (Del's Stave): extra Spell Power banked at COMMIT by the
  // cast-time MP dump (+1 SP per `mpPerBonusSp` MP spent beyond the
  // cost). Carried here because the MP is already gone when a charged
  // spell resolves — resolution can't recompute it from vitals. Threads
  // into the damage pipeline as `additionalPowerCoefficient`. Omitted
  // (not 0) when no dump occurred.
  readonly bonusSpellPower?: number;
}
