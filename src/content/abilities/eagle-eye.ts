// Eagle Eye — the Hunter's Support (Session 45). Free and native on the
// Hunter; cross-class costs 2 (the impact tier of Two Weapons / Martial
// Expertise — a meaningful, exclusive Support pick).
//
// Single contribution via `modifyOutgoingHitChance`: doubles the
// caster's physical hit chance. The hook only fires on physical attacks
// (`computeOutgoingHitChance` returns early for non-physical, so the
// multiplier never touches a status-application or magical chance), so
// the ×2 is unconditional here. On a bare bow (accuracy 33) it lifts the
// net to ~66%; on a high-accuracy melee weapon it saturates at the
// [0.05, 1.0] clamp. Composes multiplicatively with any other
// outgoing-hit-chance contributor.

import {
  abilityId,
  bucketId,
  passiveHook,
  type PassiveAbilityDefinition,
} from '@engine/index.ts';

const EAGLE_EYE_ACCURACY_MULTIPLIER = 2.0;

export const eagleEye: PassiveAbilityDefinition = {
  id: abilityId('eagle_eye'),
  name: 'Eagle Eye',
  kind: 'passive',
  bucket: bucketId('support'),
  baseCost: 2,
  availability: 'available',
  hooks: [
    passiveHook('modifyOutgoingHitChance', (args) => args.baseHitChance * EAGLE_EYE_ACCURACY_MULTIPLIER),
  ],
};
