// Ironfoot — the reverse-Lightfoot accessory (Session 45 follow-up). A
// tradeoff slot: shed basic mobility (Move / Jump / Speed) to free up a
// Movement bucket slot AND gain a flat PA + MA bump.
//
//   - `statMods`: −1 Speed, +1 PA, +1 MA. Speed lives on BaseStats, so
//     it rides `statMods` like the Lightfoot's +1 Speed (mirrored).
//   - `movementMods`: −1 Move, −1 Jump. Composes additively with class
//     baseline via `modifyStatQuery` (parallel to Lightfoot +1 / +1).
//   - `bucketCapacityMods`: +1 Movement capacity. Lets the wearer slot a
//     second Movement passive — a high-cost dual-axis Movement, or two
//     cost-1 Movement passives, without competing for the usual single
//     Movement slot.
//
// Intended for a unit that *isn't* chasing a "Move +1 with a rider"
// passive (the natural counter-fit) but wants two Movement passives
// composed — e.g. a tank stacking Bulwark Stance + Healthy Stride. The
// mobility-stat tax pays for the bucket-capacity unlock; the +1 PA / +1
// MA softens the trade for hybrid attackers.

import { bucketId, itemId, type AccessoryEquipment } from '@engine/index.ts';

export const ironfoot: AccessoryEquipment = {
  id: itemId('ironfoot'),
  name: 'Ironfoot',
  availability: 'available',
  kind: 'accessory',
  statMods: { spd: -1, pa: 1, ma: 1 },
  movementMods: { moveRange: -1, jump: -1 },
  bucketCapacityMods: new Map([[bucketId('movement'), 1]]),
};
