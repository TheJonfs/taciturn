// Bolt — the throwaway charged spell that lights up session 15's
// charged-action lifecycle end-to-end. Tile-anchored magical damage:
// the caster targets a tile, takes a few ticks to charge, and at
// resolution time damages whoever (if anyone) is standing on the
// targeted tile.
//
// Why this shape:
//
// - **Tile-anchored** exercises the `'tile'` TargetingSpec validation
//   landing this session. (Single-unit charged spells would also be a
//   valid throwaway; tile-anchored covers more surface in one ability.)
// - **Magical damage tag** exercises the magical pipeline shipped in
//   session 14, so the Faith-factor + resistance handlers see real
//   traffic. (Status-only charged spells are also valid; the more
//   meaningful exercise is the damage path.)
// - **No status rider** keeps the throwaway scope tight — session 16's
//   first real charged spell will exercise the status-rider-on-charged
//   axis.
//
// Numbers are placeholder. Real charged-spell tuning lands per-class
// in sessions 16+. `power: 5` in line with the BMG's "power_coefficient
// in the 4-12 range depending on tier" for Mage spells. `actionSpeed:
// 25` is a "fast spell" per BMG. `mpCost: 8` keeps casts strategic.
//
// FFT-pinning: a Bolt cast on tile (3, 4) hits whoever is on (3, 4)
// at resolution time, not at commit time. If the targeted tile is
// empty when Bolt resolves, Bolt resolves with no per-target effect
// (no damage applied, no reactions triggered). MP is not refunded —
// per BMG, MP is committed at cast time.
//
// Session 17b adds a Stop rider so the Stop status type has a content
// consumer. Bolt is throwaway content that may grow more effects before
// it's deleted (or Easter Egged elsewhere). The Stop rider is a low-
// chance "rare but real" tactical wrinkle, short enough to be
// interesting rather than punitive.

import {
  abilityId,
  bucketId,
  statusTypeId,
  type ActiveAbilityDefinition,
} from '@engine/index.ts';

export const bolt: ActiveAbilityDefinition = {
  id: abilityId('bolt'),
  name: 'Bolt',
  kind: 'active',
  bucket: bucketId('first_action'),
  baseCost: 1,
  availability: 'available',
  tags: ['magical', 'lightning'],
  targeting: {
    kind: 'tile',
    range: { horizontal: 4, vertical: 99 },
    rangeMode: 'arc',
  },
  actionSpeed: 25,
  mpCost: 8,
  effects: {
    damage: {
      tags: ['magical', 'lightning'],
      power_coefficient: 5,
      variance: { min: 0.95, max: 1.05 },
    },
    statusEffects: [
      {
        typeId: statusTypeId('stop'),
        target: 'primary_target',
        baseChance: 25,
        duration: 3,
      },
    ],
  },
};
