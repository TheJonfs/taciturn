// Steal Heart — the Thief's capstone (Thief Arts). Charms a valid target for
// 3 turns: the puppet acts for the Thief's team (the `enthralled`
// control-override) while it stays, on paper, an enemy — friend/foe and
// win/loss still key off its real team (v1 control-only scope, ADR-0111).
//
// The biggest swing in the game, and the hardest to land. The contest is the
// additive Brave/PA form at base 10 — `10 + 3·PA + 0.5·(Thief_Brave −
// Target_Brave)`, clamped [1, 95]: ~31% naked, ~48% fully equipped, ~58% after
// an Undermine on the target. A set-up-or-don't-bother capstone; the 95 cap
// means it's never a guaranteed lock.
//
// Gender-gated Male ↔ Female (FFT-canonical v1; the gate + liveness + the
// re-charm ward are enforced in validation). 24 MP against the Thief's 28-MP
// bar — the perpetual use-the-kit-or-bank tension. Instant. Ranged 3 with
// line of sight (a tunable reach — close enough to commit, not point-blank).
//
// Fragility & anti-chain: any attack damage the puppet takes rolls 50% to snap
// the charm early; a `heartwarded` immunity (applied alongside, outlasting the
// charm) blocks re-charm for a window after it ends. See enthralled.ts /
// heartwarded.ts.

import {
  abilityId,
  bucketId,
  statusTypeId,
  type ActiveAbilityDefinition,
} from '@engine/index.ts';

export const stealHeart: ActiveAbilityDefinition = {
  id: abilityId('steal_heart'),
  name: 'Steal Heart',
  kind: 'active',
  bucket: bucketId('first_action'),
  baseCost: 1,
  availability: 'available',
  tags: ['mental'],
  targeting: {
    kind: 'single_unit',
    range: { horizontal: 3, vertical: 3 },
    rangeMode: 'straight_line',
  },
  actionSpeed: 0,
  mpCost: 24,
  effects: {
    stealHeart: {
      baseChance: 10,
      charmStatus: statusTypeId('enthralled'),
      charmDuration: 3,
      immunityStatus: statusTypeId('heartwarded'),
      immunityDuration: 5,
    },
  },
};
