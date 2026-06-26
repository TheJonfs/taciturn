// Ring of Caliora — Session 74 caster accessory (the CT-throughline's
// drain). MA +2, and the wearer's damaging *spells* also rob the target's
// momentum: a magical hit that lands reduces the target's CT by 20% of the
// damage dealt.
//
// Substrate: `damageCtDrainPercent: 20` rides the existing `onFinalDamage`
// hook (the Rasp Pendant MP-drain pattern), emitting a negative
// `system_ct_push` gated to magical, non-absorbed hits (ADR-0126). The
// CT-push reducer floors the target's CT at 0 — the only guardrail; there
// is no per-hit cap (Chris's S74 call: ship the strong version, tune from
// playtest).
//
// Balance watch (the batch epicenter): on a Calculator's field-wide Math
// Skill, the drain fires per matched enemy, so one cast can rob CT off the
// whole enemy team — repeatable into a tempo soft-lock. Deliberately
// uncapped for now; flagged in playtest-watch. Single-target nukes drain a
// modest slice (a 40-damage spell → 8 CT). Fire-resistance is no brake
// here (the gate is the `magical` tag, not an element).

import { itemId, type AccessoryEquipment } from '@engine/index.ts';

export const ringOfCaliora: AccessoryEquipment = {
  id: itemId('ring_of_caliora'),
  name: 'Ring of Caliora',
  availability: 'available',
  kind: 'accessory',
  statMods: { ma: 2 },
  damageCtDrainPercent: 20,
};
