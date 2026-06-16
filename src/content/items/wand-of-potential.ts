// Wand of Potential — Session 68. Lightning-support wand. WP 2,
// accuracy 90, matching the Depths / Deepwood / Lumen wand pattern.
//
// Two independent riders:
//
//  1. On-hit Resonance (`attackProcs` 100%): applies `{ water: +25,
//     earth: -25 }` to the struck target via the parametric
//     `tagged_resistance_shift` status. This *completes the four-element
//     wand rotation* — the reversed earth/water shift the family was
//     missing (Lumen does +earth/-water; this does the inverse). Stacks
//     additively, persists battle-long. NOTE: the Resonance is water/
//     earth, not lightning — it is the "complete the circle" half, not
//     the lightning-support half.
//
//  2. Spell Power rider (`spellPowerModifiers`): +1 Spell Power to the
//     holder's lightning-tagged magic, via the new `modifySpellPower`
//     hook (ADR-0113). This is the wand's lightning identity: Lightning
//     Bolt's SP 12 → 13 (~+8% damage), Bolt's SP 5 → 6 (~+20%) — bigger
//     proportionally on low-SP spells, intended. Tag-gated (lightning
//     only) and holder-gated (only the equipper's casts); physical
//     lightning (Lightning Stab) and non-holders are unaffected.
//
// The Aethurge is the natural wielder — the SP rider hardens its
// lightning while the wand's basic swings spread the resonance for the
// team's elemental coverage.

import { abilityId, itemId, type WeaponEquipment } from '@engine/index.ts';

export const wandOfPotential: WeaponEquipment = {
  id: itemId('wand_of_potential'),
  name: 'Wand of Potential',
  availability: 'available',
  kind: 'weapon',
  weaponType: 'wand',
  wp: 2,
  accuracy: 90,
  tags: ['wand'],
  attackProcs: [
    { chance: 1.0, abilityId: abilityId('wand_of_potential_apply_shift') },
  ],
  spellPowerModifiers: [{ delta: 1, tagFilter: ['lightning'] }],
};
