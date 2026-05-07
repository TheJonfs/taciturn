// Earth Communion — Earth Mage's Support.
//
// Status applications by this unit are 1.25× more likely. Multiplicative
// modifier on the BMG status application formula's
// `∏modifiers` term, hooked via the new `modifyStatusApplicationChance`
// chain (per ADR-0024). Universal scope per session 16 plaintext
// review — the modifier applies to ALL statuses this unit tries to
// apply, not only earth-tagged ones. Cost 1, intended as a building
// block for status-heavy builds across classes.
//
// Hook fires against the *caster's* hooks (Earth Mage equipping this
// passive boosts their own status applications). The chain runner
// composes returns multiplicatively: a unit equipping multiple
// status-chance modifiers (Earth Communion + a hypothetical future
// "Mediator Lore") would compose them.

import {
  abilityId,
  bucketId,
  passiveHook,
  type PassiveAbilityDefinition,
} from '@engine/index.ts';

const EARTH_COMMUNION_FACTOR = 1.25;

export const earthCommunion: PassiveAbilityDefinition = {
  id: abilityId('earth_communion'),
  name: 'Earth Communion',
  kind: 'passive',
  bucket: bucketId('support'),
  baseCost: 1,
  tags: ['magical', 'earth'],
  hooks: [
    passiveHook(
      'modifyStatusApplicationChance',
      (args) => args.baseChance * EARTH_COMMUNION_FACTOR,
    ),
  ],
};
