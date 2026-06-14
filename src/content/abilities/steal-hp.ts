// Steal HP — Thief Arts. A lifesteal weapon strike: 75% of a normal weapon
// attack's damage, healing the Thief for 50% of the HP actually dealt.
//
// Melee (1h × 3v), physical + weapon-tagged, so it rolls the standard
// evasion contest (a dodged strike steals nothing) and carries the equipped
// weapon's tags into resistance lookups. The `lifesteal` rider (ADR — Thief
// substrate) heals the caster off `damageDealt`, NOT off target survival —
// a killing blow still siphons, since the damage landed; a fully-resisted
// 0-damage hit heals nothing.
//
// Single swing (no `multiWeapon`): a deliberate siphoning strike, not the
// basic Attack's dual-wield flurry — the 0.75 coefficient and the heal are
// balanced around one hit. mpCost 5 — the kit's cheap sustain option, the
// Steal-MP-funded alternative to banking for Steal Heart.
//
// Lifesteal % is the "how self-sustaining" dial (concept-notes): 50% now,
// 60–75% if sustain should be more of the Thief's identity.

import {
  abilityId,
  bucketId,
  type ActiveAbilityDefinition,
} from '@engine/index.ts';

export const stealHp: ActiveAbilityDefinition = {
  id: abilityId('steal_hp'),
  name: 'Steal HP',
  kind: 'active',
  bucket: bucketId('first_action'),
  baseCost: 1,
  availability: 'available',
  targeting: {
    kind: 'single_unit',
    range: { horizontal: 1, vertical: 3 },
    rangeMode: 'melee',
  },
  actionSpeed: 0,
  mpCost: 5,
  hitRoll: {},
  effects: {
    damage: {
      tags: ['physical', 'weapon'],
      power_coefficient: 0.75,
      lifesteal: { percent: 50 },
    },
  },
};
