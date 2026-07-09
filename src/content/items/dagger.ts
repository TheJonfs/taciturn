// Dagger — TABA Ch1 setup knife (M3 equipment expansion). WP 2, accuracy
// 95, Speed-derived dynamic variance (knife family), 50% on-hit
// Vulnerable proc.
//
// The lineup doc's "setup weapon": near-zero damage (WP 2), but every
// other hit primes the target with Vulnerable (one-shot × 1.5 amp,
// consumed by the NEXT damage event) for an ally to collect. The proc
// fires from `onDamageDealt` after the dagger's own hit has resolved,
// so it never amplifies itself — the payoff always belongs to the
// follow-up, which is the teaching point.
//
// Flat 50% proc chance per the weapon-rider convention (apply-burn-proc
// doc note): weapon procs decouple from the wielder's Faith. The proc
// ability (`apply_vulnerable_proc`) lands with `applyAlways`.
//
// TABA-only: `hidden` + campaign pool (chapter 1, shop).

import { abilityId, itemId, type WeaponEquipment } from '@engine/index.ts';

export const dagger: WeaponEquipment = {
  id: itemId('dagger'),
  name: 'Dagger',
  availability: 'hidden',
  kind: 'weapon',
  weaponType: 'knife',
  wp: 2,
  accuracy: 95,
  tags: ['knife'],
  physicalVariance: { kind: 'attacker_speed', spread: 0.05 },
  attackProcs: [{ chance: 0.5, abilityId: abilityId('apply_vulnerable_proc') }],
};
