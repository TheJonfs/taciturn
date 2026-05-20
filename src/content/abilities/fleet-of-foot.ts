// Fleet of Foot — Assassin's Movement passive (Session 42). Free and
// native on the Assassin; cross-class costs 1.
//
// Single dual-axis `modifyStatQuery` contribution: +1 moveRange AND +1
// jump. Takes the Assassin's base Move 4 / Jump 4 to 5 / 5 — the most
// mobile profile in v1, fitting the glass-cannon skirmisher identity.
//
// Cost tier: the existing landscape prices single-effect Movement at
// cost 1 (Move +1, Tidewalker, Quickstep) and dual-effect at cost 2
// (Bedrock Stride, Hotfoot, Bravestrider). Fleet of Foot bumps two axes
// of the *same* concept (mobility: reach + climb) rather than two
// distinct stats, so it sits at cost 1 — a mobility package, not a
// mobility-plus-something bundle.

import {
  abilityId,
  bucketId,
  passiveHook,
  type PassiveAbilityDefinition,
} from '@engine/index.ts';

export const fleetOfFoot: PassiveAbilityDefinition = {
  id: abilityId('fleet_of_foot'),
  name: 'Fleet of Foot',
  kind: 'passive',
  bucket: bucketId('movement'),
  baseCost: 1,
  availability: 'available',
  hooks: [
    passiveHook('modifyStatQuery', (args) => {
      if (args.statName === 'moveRange') return args.baseValue + 1;
      if (args.statName === 'jump') return args.baseValue + 1;
      return args.baseValue;
    }),
  ],
};
