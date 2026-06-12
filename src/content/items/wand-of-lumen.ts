// Wand of Lumen — Fire-themed wand (Session 45 follow-up). WP 2,
// accuracy 90, matching the Wand of the Depths / Wand of the Deepwood
// pattern.
//
// On-hit effect (`attackProcs` 100%): applies a `tagged_resistance_shift`
// with `+25 Earth / -25 Water` to the target (per plan-review). The
// three wands together rotate the shift across all four elements —
// Depths and Deepwood toggle the fire/lightning axis, Lumen rotates to
// the water/earth axis. Stacks additively across applications; persists
// battle-long via the status's `permanent` duration.
//
// Bonus effect: when this wand's wielder casts a fire-tagged ability
// that applies one or more stacks of Burn, the application lands with
// one additional stack. Wired via the new
// `modifyStatusApplicationStackCount` hook (ADR-0084) — the modifier
// fires inside `applyStatus` before Burn's composer builds its stack
// damages, so the extra stack flows through as a single application,
// no re-entry. Gated on both `statusTypeId: burn` AND
// `sourceAbilityTagAll: ['fire']` so the wand only bumps Fire Spells'
// Burns (Spark, Flame Lance, Smolder's procced Burn), never another
// Burn source applied to the wielder, and never any non-Burn status.

import { abilityId, itemId, type WeaponEquipment, statusTypeId } from '@engine/index.ts';

export const wandOfLumen: WeaponEquipment = {
  id: itemId('wand_of_lumen'),
  name: 'Wand of Lumen',
  availability: 'available',
  kind: 'weapon',
  weaponType: 'wand',
  wp: 2,
  accuracy: 90,
  tags: ['wand'],
  attackProcs: [
    { chance: 1.0, abilityId: abilityId('wand_of_lumen_apply_shift') },
  ],
  statusApplicationStackCountModifiers: [
    {
      delta: 1,
      statusTypeId: statusTypeId('burn'),
      sourceAbilityTagAll: ['fire'],
    },
  ],
};
