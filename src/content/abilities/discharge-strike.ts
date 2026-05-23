// Discharge Strike — the active ability the Discharge reaction emits.
//
// Instant single-target magical lightning damage. Fired by the
// Discharge passive's compiled reaction (per the reaction compiler's
// `use_ability` effect kind, mirroring how Counter emits `attack`).
// Not visible in any First Action command set — it's a reaction-only
// payload, not a player-selectable spell.
//
// Per session 20 plaintext review:
//   - power_coefficient 4, mpCost 0, actionSpeed 0 (instant — reactions
//     resolve immediately, no charge time)
//   - tags: magical + lightning — composes with Conductor's MA × 1.25
//     and any future lightning-resistance content
//   - range horizontal 4 / vertical 2, arc — wide enough that a
//     ranged attacker still gets struck back
//
// Magical reactions confirmation (per session 20 work item): the
// reaction compiler's `damageTagsAny` filter on Discharge below catches
// any incoming damage (physical or magical), so this reaction fires on
// magical attacks too — confirming reactions are not pre-filtered to
// physical-only at the engine layer (per ADR-0021's framing).

import {
  abilityId,
  bucketId,
  type ActiveAbilityDefinition,
} from '@engine/index.ts';

export const dischargeStrike: ActiveAbilityDefinition = {
  id: abilityId('discharge_strike'),
  name: 'Discharge Strike',
  kind: 'active',
  bucket: bucketId('first_action'),
  baseCost: 1,
  availability: 'hidden',
  tags: ['magical', 'lightning'],
  targeting: {
    kind: 'single_unit',
    range: { horizontal: 4, vertical: 99 },
    rangeMode: 'arc',
  },
  actionSpeed: 0,
  mpCost: 0,
  effects: {
    damage: {
      tags: ['magical', 'lightning'],
      power_coefficient: 4,
    },
  },
};
