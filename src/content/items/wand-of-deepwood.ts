// Wand of the Deepwood — Earth-themed wand. WP 2, accuracy 90.
//
// Passive: +5 Spell Speed (faster charge) on Earth-tagged spells via
// the Session 27 `modifyActionSpeed` hook. The action speed boost
// shortens cast turnaround for Earth's status-application spells.
//
// Session 31: on-hit effect ships via `attackProcs`. The proc fires at
// 100% chance per physical hit, applying a `tagged_resistance_shift`
// instance with `+25 Lightning / -25 Fire` deltas to the target.
// Stacks additively; cancels additively with Wand of the Depths
// applications on a shared target.

import { abilityId, itemId, type WeaponEquipment } from '@engine/index.ts';

export const wandOfDeepwood: WeaponEquipment = {
  id: itemId('wand_of_deepwood'),
  name: 'Wand of the Deepwood',
  availability: 'available',
  kind: 'weapon',
  wp: 2,
  accuracy: 90,
  tags: ['wand'],
  // `+5` is a speed bonus (higher actionSpeed value charges faster — see
  // ADR-0056). Tag-gated on 'earth' damage tag.
  actionSpeedModifiers: [{ delta: 5, tagFilter: ['earth'] }],
  attackProcs: [
    { chance: 1.0, abilityId: abilityId('wand_of_deepwood_apply_shift') },
  ],
};
