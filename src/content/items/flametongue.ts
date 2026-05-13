// Flametongue — Fire-tagged sword. WP 6, accuracy 90, 25% Burn proc.
//
// Per the equipment doc: counter-pick weapon. WP drop vs. Long Sword
// (8 → 6) is the cost; the Fire tag means physical hits compose with
// the target's Fire resistance through the elemental wheel.
//
// Session 31: the Burn proc rider ships via `attackProcs` (ADR-0064).
// The procced ability is `apply_burn_proc` — a hidden single-target
// Burn-application ability that lives next to Smolder (the existing
// Burn-applying reaction). Distinct from Smolder because Smolder is a
// reaction-compiled passive (per Session 16 / ADR-0024) that fires
// against the *attacker* of a magical hit; this proc fires against
// the *target* of Flametongue's physical hit.

import { abilityId, itemId, type WeaponEquipment } from '@engine/index.ts';

export const flametongue: WeaponEquipment = {
  id: itemId('flametongue'),
  name: 'Flametongue',
  availability: 'available',
  kind: 'weapon',
  wp: 6,
  accuracy: 90,
  tags: ['sword', 'fire'],
  attackProcs: [{ chance: 0.25, abilityId: abilityId('apply_burn_proc') }],
};
