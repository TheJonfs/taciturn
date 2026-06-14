// Steal Buffs — Thief Arts. Strips every positive-polarity status off the
// target and wears them itself. The roster's only buff-theft — the Thief
// denies what a unit *has* (here, its buffs), never what it can *do*.
//
// Ranged (4h × 3v, straight_line — needs line of sight, like the Assassin's
// darts) so the Thief can peel a buffed backliner without committing to
// melee. The contest IS the gate (not evadable): the additive Brave/PA form
// `33 + 3·PA + 0.5·(Thief_Brave − Target_Brave)`, clamped [1, 95]. On
// success, every `aiHints.polarity === 'buff'`, non-equipment status leaves
// the target and lands on the Thief, preserving magnitude / remaining
// duration / stacks. "neither"/debuff statuses (Stop, Charging, DoTs) and
// equipment-granted buffs are excluded.
//
// mpCost 4. Snowball watch (concept-notes): a stolen Haste → more Thief
// turns → more steals; Brave-resisting buff-theft is a mild thematic stretch
// justified by reusing the contest formula.

import {
  abilityId,
  bucketId,
  type ActiveAbilityDefinition,
} from '@engine/index.ts';

export const stealBuffs: ActiveAbilityDefinition = {
  id: abilityId('steal_buffs'),
  name: 'Steal Buffs',
  kind: 'active',
  bucket: bucketId('first_action'),
  baseCost: 1,
  availability: 'available',
  targeting: {
    kind: 'single_unit',
    range: { horizontal: 4, vertical: 3 },
    rangeMode: 'straight_line',
  },
  actionSpeed: 0,
  mpCost: 4,
  effects: {
    stealBuffs: { baseChance: 33 },
  },
};
