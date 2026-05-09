// Taunt — Knight Battle Skill that applies the Taunted status to a
// single ranged enemy. The status is engine-enforced (Taunted unit
// suffers a probabilistic block on actions targeting non-Knight
// units). v1's first consumer of `applyAlways: true` — the status
// lands deterministically, bypassing the Faith / MA / Brave formula.
// Knights have no MA spec to depress applications anyway; deterministic
// keeps the ability's tactical value clear.
//
// Numbers per session 17c plaintext review:
//   - range 4 horizontal / 2 vertical, line_of_sight: a tactical
//     range that lets the Knight pull aggro on an isolated enemy
//     without committing to melee.
//   - mpCost 4: gates use; Knight default 10 MP allows two Taunts
//     before MP is dry.
//   - Duration 12 ticks: a meaningful window for the Knight to act
//     against the target, but short enough that Taunt isn't a hard
//     pin.
//   - applyAlways: true — Taunt's value *is* the status; rolling for
//     it would dilute the ability.
//
// Source-anchored: the Taunted status carries the Knight's UnitId so
// the modifier knows whose to-attack-target counts as "the Knight."
// When the Knight KO's, the source-KO sweep auto-removes the Taunted
// status (per ADR-0028) — a dead Knight can no longer hold aggro.
//
// No damage component: Taunt is pure status application.

import {
  abilityId,
  bucketId,
  statusTypeId,
  type ActiveAbilityDefinition,
} from '@engine/index.ts';

export const taunt: ActiveAbilityDefinition = {
  id: abilityId('taunt'),
  name: 'Taunt',
  kind: 'active',
  bucket: bucketId('first_action'),
  baseCost: 1,
  targeting: {
    kind: 'single_unit',
    range: { horizontal: 4, vertical: 2 },
    rangeMode: 'straight_line',
  },
  actionSpeed: 0,
  mpCost: 4,
  effects: {
    statusEffects: [
      {
        typeId: statusTypeId('taunted'),
        target: 'primary_target',
        applyAlways: true,
        duration: 12,
      },
    ],
  },
};
