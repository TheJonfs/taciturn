// Attack — the basic melee strike that lives in Knight's Battle Skill.
// Session 5 carried the slot/cost shape; session 7 added the targeting,
// charge, MP, and damage declaration. Session 8 wired it through the
// damage pipeline: 'physical' tag triggers the PA × power formula at
// the base stage. `power: 4` is a placeholder weapon power — when
// equipment lands, the equipped weapon's WP composes here instead of
// the ability's own coefficient. Session 14 declared `hitRoll: {}` so
// the evasion_check pipeline handler runs (per ADR-0019). Knight's
// class evasion baseline is 0/0/0 today, so against a Knight target
// the roll always lands at the [0.05, 1.0] clamp's upper edge — every
// attack hits in the v1 demo. The hit roll becomes meaningful when
// classes ship non-zero evasion (Thief in wave 2) or when Blind ships
// (session 16).
//
// `accuracy` defaults to 100 ("unarmed" per BMG); equipment integration
// in session 17 (per ADR-0014) replaces the per-ability default with
// weapon-sourced accuracy at the handler call site.

import {
  abilityId,
  bucketId,
  type ActiveAbilityDefinition,
} from '@engine/index.ts';

export const attack: ActiveAbilityDefinition = {
  id: abilityId('attack'),
  name: 'Attack',
  kind: 'active',
  bucket: bucketId('first_action'),
  baseCost: 1,
  targeting: {
    kind: 'single_unit',
    range: { horizontal: 1, vertical: 3 },
    rangeMode: 'melee',
  },
  actionSpeed: 0,
  mpCost: 0,
  hitRoll: {},
  effects: {
    damage: {
      tags: ['physical', 'weapon'],
      power: 4,
      variance: { min: 0.9, max: 1.1 },
    },
  },
};
