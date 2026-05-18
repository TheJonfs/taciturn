// Water Strike — Water Mage's Base spell.
//
// Charged single-target magical damage with a deterministic CT-push
// rider. The first content consumer of `damage.ctPush`: on hit, the
// target's CT is pushed back by `floor(2 × caster.MA)`, floored at 0.
// No Faith multiplier on the CT push — it's a clean damage rider gated
// only on the damage actually landing.
//
// Per session 18 plaintext review:
//   - power_coefficient 5, mpCost 10, actionSpeed 30 (parity with Earth
//     Strike's tier — bread-and-butter cast charges quickly)
//   - range horizontal 4 / vertical 2, arc
//   - ctPush factor 2.0 (target CT -= 2 × MA on hit)
//
// Tactical comparison vs. Earth Strike: lower power (5 vs 6) because
// the CT-push rider is significant — at MA 7, a hit pushes the target
// back ~14 CT, often delaying their next turn by a tick or two. The
// damage trade is the tempo budget for the rider.

import {
  abilityId,
  bucketId,
  type ActiveAbilityDefinition,
} from '@engine/index.ts';

export const waterStrike: ActiveAbilityDefinition = {
  id: abilityId('water_strike'),
  // S40 name-update pass: display name 'Water Lash'; id preserved.
  name: 'Water Lash',
  kind: 'active',
  bucket: bucketId('first_action'),
  baseCost: 1,
  availability: 'available',
  tags: ['magical', 'water'],
  targeting: {
    kind: 'unit_or_tile',
    range: { horizontal: 4, vertical: 2 },
    rangeMode: 'arc',
  },
  actionSpeed: 30,
  mpCost: 10,
  effects: {
    damage: {
      tags: ['magical', 'water'],
      power_coefficient: 8,
      ctPush: { factor: 2 },
    },
  },
};
