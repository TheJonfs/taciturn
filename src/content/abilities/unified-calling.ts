// Unified Calling — the Templar's Reaction passive (S62). On receiving a
// one-time heal, the recipient recovers MP equal to its own PA.
//
// Mechanism (ADR-0101): an `onHealingReceived` handler fired against the
// recipient after a one-time heal lands (Cure / Raise, or a Potion /
// Phoenix Down thrown at it) — NOT recurring-status healing (Regen). It
// emits a `system_mp_restore` of the recipient's PA (capped at maxMp by the
// reducer). MP, not HP, so it never re-triggers the hook (no loop).
//
// On the Templar (PA 6 → 6 MP) this closes a self-sustain loop: stand in
// your own Cure cross (excludeCaster false) → heal self → regain 6 MP →
// Cure costs net ~2. Uses base PA (`onHealingReceived` handlers receive the
// unit snapshot, not state/catalog — the established emission-hook pattern,
// cf. Thoughtful Pacing); effective-PA scaling is a possible later refinement.
//
// Cost-1 Reaction (concept-notes ability-budget model). Innate-free on the
// Templar is wired at class assembly; any class can slot it for 1 Reaction
// point.

import {
  abilityId,
  bucketId,
  passiveHook,
  type PassiveAbilityDefinition,
  type ProposedAction,
} from '@engine/index.ts';

const UNIFIED_CALLING_ID = abilityId('unified_calling');

export const unifiedCalling: PassiveAbilityDefinition = {
  id: UNIFIED_CALLING_ID,
  name: 'Unified Calling',
  kind: 'passive',
  bucket: bucketId('reaction'),
  baseCost: 1,
  availability: 'available',
  hooks: [
    passiveHook('onHealingReceived', (args): readonly ProposedAction[] => {
      const mp = args.unit.baseStats.pa;
      if (mp <= 0) return [];
      return [
        {
          type: 'system_mp_restore',
          source: 'system',
          payload: {
            targetId: args.unit.id,
            amount: mp,
            source: {
              kind: 'heal_reaction',
              abilityId: UNIFIED_CALLING_ID,
              unitId: args.unit.id,
            },
          },
        },
      ];
    }),
  ],
};
