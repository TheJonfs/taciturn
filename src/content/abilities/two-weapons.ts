// Two Weapons — Assassin's Support passive (Session 42). Native and free
// on the Assassin; cross-class costs 3 of the 3 Support capacity (a
// deliberate, exclusive pick — see S42 brief D4).
//
// Two contributions, both via the standard hook surface:
//   1. `modifyDualWield` → true. Unlocks the off-hand weapon as a second
//      swing. The attack dispatch (`attackingWeaponSlots` in the reducer)
//      reads this: when the unit holds a weapon in BOTH hands and the
//      ability is `multiWeapon` (basic Attack, Counter, Power Attack),
//      each weapon swings independently in one action — own damage,
//      accuracy, variance, procs; the target's reactions trigger per
//      swing. Two Weapons doesn't touch the damage pipeline itself; it
//      just opens the second slot the pipeline already knows how to
//      iterate. See the unified-attack-pipeline ADR.
//   2. `modifyStatQuery` for `'pa'` → × 0.75 (floor). The dual-wield
//      damage trade: each swing hits for less, but two swings out-damage
//      one. Parallel shape to Martial Expertise's PA × 1.25 (opposite
//      direction). Applied unconditionally while equipped — a unit that
//      equips Two Weapons without a second weapon eats the penalty with
//      no upside, which is a self-inflicted loadout choice the engine
//      doesn't babysit.
//
// Composition tier: passive (per DEFAULT_HOOK_SOURCE_TIER_ORDER,
// equipment → class → passive → status). The × 0.75 composes before
// additive status modifiers (PA Up / PA Down), matching Martial
// Expertise. The two cannot stack on one unit — both are Supports and a
// unit has one Support capacity's worth of room for a free-native, but
// the pipeline composes cleanly if a future ability introduces a second
// multiplicative.

import {
  abilityId,
  bucketId,
  passiveHook,
  type PassiveAbilityDefinition,
} from '@engine/index.ts';

const TWO_WEAPONS_PA_MULTIPLIER = 0.75;

export const twoWeapons: PassiveAbilityDefinition = {
  id: abilityId('two_weapons'),
  name: 'Two Weapons',
  kind: 'passive',
  bucket: bucketId('support'),
  baseCost: 3,
  availability: 'available',
  hooks: [
    passiveHook('modifyDualWield', () => true),
    passiveHook('modifyStatQuery', (args) => {
      if (args.statName !== 'pa') return args.baseValue;
      return Math.floor(args.baseValue * TWO_WEAPONS_PA_MULTIPLIER);
    }),
  ],
};
