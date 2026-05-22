// Undertow — the Riptide Bow's on-hit CT-push proc (Session 45). Hidden,
// MP-free, fired by the bow's `attackProcs` (30% on a connecting physical
// hit), never selectable from a command menu.
//
// Mechanically symmetric to the Water Mage's CT manipulation (Tide Surge
// / Water Strike's `ctPush`) — a `system_ct_push` against the target —
// but scaled on the wielder's PA rather than MA (D9). The bow is a
// physical PA weapon; a low-MA archer would otherwise push a trivial
// amount. `factor: -3` with `stat: 'pa'` → `delta = floor(-3 × PA)`: a
// Hunter (PA 6) pushes the target's CT back ~18 (≈2 ticks for a mid-Speed
// target — a real timing slip, not a full-turn lockout). The negative
// factor is the enemy-push direction (positive would bump CT forward, the
// Tide Surge ally case).
//
// No `baseChance` → the CT effect fires deterministically once the proc
// lands; the 30% gate is the weapon-side proc chance, not a Faith/Brave
// roll (weapon procs use flat percentages, per the equipment doc). Range
// is irrelevant — the proc emits against the hit target directly.

import {
  abilityId,
  bucketId,
  type ActiveAbilityDefinition,
} from '@engine/index.ts';

export const undertow: ActiveAbilityDefinition = {
  id: abilityId('undertow'),
  name: 'Undertow',
  kind: 'active',
  bucket: bucketId('first_action'),
  baseCost: 1,
  availability: 'hidden',
  tags: ['water'],
  targeting: {
    kind: 'single_unit',
    range: { horizontal: 1, vertical: 1 },
    rangeMode: 'melee',
  },
  actionSpeed: 0,
  mpCost: 0,
  effects: {
    ctEffects: [
      {
        target: 'primary_target',
        factor: -3,
        stat: 'pa',
      },
    ],
  },
};
