// Aura Mastery — Enchanter's second Support (S72, ADR-0122). Free and native on
// the Enchanter; cross-class costs 1.
//
// The buff-amplifier: every `amplifiable` buff the wielder *casts* lands with a
// magnitude boosted by K (= 1.33, paralleling Short Charge's ×1.33). It fires
// the caster-side `modifyOutgoingStatusMagnitude` hook at apply time, so the
// boosted magnitude is baked into the instance (persists, is stealable, etc.).
//
// Curation lives on the statuses (`amplifiable` + `magnitudeKind`), not here, so
// new content opts in by tagging its status — Aura Mastery never needs
// re-touching. Today it deepens: cast Haste / Protect / Shell (Auramancy),
// Regen (Geosage's Life from the Loam), Engineered Defenses (Calculator), and
// Crit Modifier (Aethurge's Static Embrace). It does NOT touch equipment grants
// (those apply with `sourceKind: 'equipment'`, which the apply path gates out)
// or the flat stat-point / reaction self-buffs (PA/MA/Move/Jump Up, the
// stat-Saves), which aren't flagged amplifiable.
//
// Scaling is kind-aware: an additive magnitude (a resistance %, a heal
// coefficient, a crit bump) scales as `magnitude × K`; a multiplier magnitude
// (Haste's Speed ×1.5) scales the *bonus*, `1 + (magnitude − 1) × K`, so K
// deepens the buff rather than compounding the whole multiplier.

import {
  abilityId,
  bucketId,
  passiveHook,
  type PassiveAbilityDefinition,
} from '@engine/index.ts';

const AURA_MASTERY_FACTOR = 1.33;

export const auraMastery: PassiveAbilityDefinition = {
  id: abilityId('aura_mastery'),
  name: 'Aura Mastery',
  kind: 'passive',
  bucket: bucketId('support'),
  baseCost: 1,
  availability: 'available',
  hooks: [
    passiveHook('modifyOutgoingStatusMagnitude', (args) => {
      const type = args.statusType;
      if (type.amplifiable !== true) return args.baseMagnitude;
      if (type.magnitudeKind === 'multiplier') {
        return 1 + (args.baseMagnitude - 1) * AURA_MASTERY_FACTOR;
      }
      return args.baseMagnitude * AURA_MASTERY_FACTOR;
    }),
  ],
};
