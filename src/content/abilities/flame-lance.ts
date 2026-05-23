// Flame Lance — Fire Mage's Ultimate.
//
// Charged caster-anchored line AoE. Magical fire damage in a length-4
// line projected forward from the caster's tile, with a guaranteed
// 1-stack Burn application per affected unit (`applyAlways: true`).
// First content consumer of the `'line'` AoeShape and the kinematic-
// stop semantic (per ADR-0031): a wall too tall for `verticalTolerance`
// terminates the line, sparing units beyond it.
//
// Per session 19 plaintext review:
//   - power_coefficient 6, mpCost 28, actionSpeed 18 (slowest tier;
//     parity with Maelstrom and Earth Cataclysm Ultimates)
//   - shape line length 4 (4 tiles forward from caster), anchorMode
//     'caster' (caster's tile is the projection origin; targeted tile
//     picks the cardinal direction via cardinalFromTo)
//   - verticalTolerance 5 — large enough to clear most terrain, low
//     enough that a true vertical wall blocks the line
//   - Burn rider: `applyAlways: true`, `stackQuantity: 1` — every hit
//     unit gets exactly 1 Burn stack regardless of Faith/resistance
//     (the damage already landed; the stack is a guaranteed rider)
//
// Direction snap: cardinal-only (per ADR-0031). A perfect-diagonal
// target snaps to one of the four axes (tie-break: horizontal). Future
// 8-direction line work extends `DIRECTION_BASIS` and `cardinalFromTo`.

import {
  abilityId,
  bucketId,
  statusTypeId,
  type ActiveAbilityDefinition,
} from '@engine/index.ts';

export const flameLance: ActiveAbilityDefinition = {
  id: abilityId('flame_lance'),
  name: 'Flame Lance',
  kind: 'active',
  bucket: bucketId('first_action'),
  baseCost: 1,
  availability: 'available',
  tags: ['magical', 'fire'],
  targeting: {
    kind: 'unit_or_tile',
    range: { horizontal: 4, vertical: 99 },
    rangeMode: 'arc',
  },
  actionSpeed: 18,
  mpCost: 28,
  effects: {
    damage: {
      tags: ['magical', 'fire'],
      power_coefficient: 10,
    },
    aoe: {
      shape: { kind: 'line', length: 4 },
      anchorMode: 'caster',
      verticalTolerance: 5,
    },
    statusEffects: [
      {
        typeId: statusTypeId('burn'),
        target: 'primary_target',
        applyAlways: true,
        stackQuantity: 1,
      },
    ],
  },
};
