// Wand of the Depths — Water-themed wand. WP 2, accuracy 90.
//
// Passive: +1 horizontal targeting range on Water-tagged spells via the
// Session 29 `modifyAbilityRange` hook, plus +1 AoE vertical tolerance
// on Water-tagged spells via the S51 `aoeVerticalToleranceModifiers`
// surface.
//
// S51 refit: pre-S51 the wand declared `deltaVertical: 1` on
// `abilityRangeModifiers`, but every v1 spell already targets at vertical
// 99 (effectively infinite). That bonus was unobservable. Now the wand
// invests the +1 elevation budget where it bites: the AoE vertical
// tolerance, expanding which elevation bands a water AoE actually
// covers. Same +1 magnitude, different lever.
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
  weaponType: 'wand',
  wp: 2,
  accuracy: 90,
  tags: ['wand'],
  abilityRangeModifiers: [
    { deltaHorizontal: 1, tagFilter: ['water'] },
  ],
  aoeVerticalToleranceModifiers: [
    { delta: 1, tagFilter: ['water'] },
  ],
  attackProcs: [
    { chance: 1.0, abilityId: abilityId('wand_of_depths_apply_shift') },
  ],
};
