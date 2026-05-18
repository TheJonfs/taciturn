// Storm Caller — Lightning Mage's Ultimate.
//
// Charged single-target burst with self-cost. Power 36 (3× the already-
// premium Lightning Strike at power 12) plus a 25% maxHpBase
// `system_damage` self-cost emitted via the dispatcher's `selfDamage`
// path.
//
// Per session 20 plaintext review:
//   - power_coefficient 36 baked directly (no separate multiplier
//     decomposition) — single v1 consumer, simpler shape
//   - mpCost 28, actionSpeed 18 (Ultimate tier — parity with Maelstrom,
//     Earth Cataclysm, Flame Lance)
//   - selfDamage.fraction 0.25 → 25% of caster's maxHpBase, emitted as
//     `system_damage` with source `{ kind: 'ability_self_cost',
//     abilityId, casterId }`
//   - range horizontal 4 / vertical 2, arc — parity with Lightning Strike
//
// Self-cost design (per ADR-0032):
//   - Untyped (`tags: []`) — bypasses resistance and reactions; it's a
//     cost paid for casting, not a hit on the caster
//   - Routed through `system_damage` so HP is floored at 0 (a Lightning
//     Mage at 11 HP casting Storm Caller dies on the cost — by design)
//   - Fires after per-target dispatch completes, regardless of cluster
//     size, hit, or KO of the target
//   - The labeled action source enables a future preventer (item /
//     ability) to register an `onActionAttempted` handler matching on
//     `payload.source.kind === 'ability_self_cost'` and return
//     `blocked` to neutralize the cost
//
// At Lightning Mage maxHpBase 44: self-cost = floor(0.25 × 44) = 11.
// Two casts back-to-back drops the caster from 44 → 33 → 22 — possible
// but starts gating on healing or risk.

import {
  abilityId,
  bucketId,
  type ActiveAbilityDefinition,
} from '@engine/index.ts';

export const stormCaller: ActiveAbilityDefinition = {
  id: abilityId('storm_caller'),
  // S40 name-update pass: display name 'Megavolt'; id preserved.
  name: 'Megavolt',
  kind: 'active',
  bucket: bucketId('first_action'),
  baseCost: 1,
  availability: 'available',
  tags: ['magical', 'lightning'],
  targeting: {
    kind: 'unit_or_tile',
    range: { horizontal: 4, vertical: 2 },
    rangeMode: 'arc',
  },
  actionSpeed: 18,
  mpCost: 28,
  selfDamage: { fraction: 0.25 },
  effects: {
    damage: {
      tags: ['magical', 'lightning'],
      power_coefficient: 36,
    },
  },
};
