// Emissary of Murond — the Templar's Support passive (S62). All healing the
// bearer applies is boosted +25%.
//
// Mechanism (ADR-0101): a `modifyOutgoingHealing` handler queried against the
// healer. It multiplies the running healing-output factor by 1.25, applied to
// one-time-source healing only — the ability-heal pipeline (Cure / Raise,
// where it composes multiplicatively with faith / MA at the finalize fold)
// and consumable hpRestore (a Potion / Phoenix Down the bearer throws). NOT
// applied to recurring-status healing (Regen) — per the S62 scope.
//
// Cost-1 Support (concept-notes ability-budget model): a strong donor for
// other healer-secondary builds; on the Templar it always multiplies
// Cure / Raise. Innate-free on the Templar is wired at class assembly; any
// class can slot it for 1 Support point.
//
// Watch (playtest, not a per-number concern): the healing stack is
// multiplicative — Emissary (×1.25) × Faithstrider (faith ↑) × Imp Halberd
// (MA +1) × high-faith targets compound. Tracked in templar-concept-notes.

import {
  abilityId,
  bucketId,
  passiveHook,
  type PassiveAbilityDefinition,
} from '@engine/index.ts';

export const emissary: PassiveAbilityDefinition = {
  id: abilityId('emissary'),
  name: 'Emissary of Murond',
  kind: 'passive',
  bucket: bucketId('support'),
  baseCost: 1,
  availability: 'available',
  hooks: [
    passiveHook('modifyOutgoingHealing', (args) => args.baseValue * 1.25),
  ],
};
