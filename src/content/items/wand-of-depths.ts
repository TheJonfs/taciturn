// Wand of the Depths — Water-themed wand. WP 2, accuracy 90.
//
// Passive: +1 horizontal / +1 vertical range on Water-tagged spells via
// the Session 29 `modifyAbilityRange` hook.
//
// Session 31: on-hit effect ships via `attackProcs`. The proc fires at
// 100% chance per physical hit, applying a `tagged_resistance_shift`
// instance with `+25 Fire / -25 Lightning` deltas to the target.
// Stacks additively with repeat applications; persists battle-long
// (`'permanent'` duration mode). The applying ability is hidden —
// only fired through the attackProcs path.
//
// Wand ally-targetability for swings (per the equipment doc:
// "Targetable on either allies or enemies") is deferred per Session 31
// decision 8 — v1 ships with enemy-only swings. The on-hit shift
// mechanic is fully demonstrable through enemy targets (setup for
// Lightning teammate strikes).

import { abilityId, itemId, type WeaponEquipment } from '@engine/index.ts';

export const wandOfDepths: WeaponEquipment = {
  id: itemId('wand_of_depths'),
  name: 'Wand of the Depths',
  availability: 'available',
  kind: 'weapon',
  wp: 2,
  accuracy: 90,
  tags: ['wand'],
  abilityRangeModifiers: [
    { deltaHorizontal: 1, deltaVertical: 1, tagFilter: ['water'] },
  ],
  attackProcs: [
    { chance: 1.0, abilityId: abilityId('wand_of_depths_apply_shift') },
  ],
};
