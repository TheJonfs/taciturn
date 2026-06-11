// Spiked Mail — Knight-only body armor. Heavier than Iron Mail with a
// reactive punishment: 20% of post-mitigation physical damage taken is
// emitted back at the attacker as a revenge-sourced `system_damage`.
//
// Mechanics (per S37 plan-review):
//   - Reflect is deterministic (not Brave-gated). The wearer is
//     equipment-driven, not reaction-driven, so the runner's Brave roll
//     doesn't apply.
//   - Only physical damage triggers reflect; magical / status-tick
//     damage does not. (The equipment doc reserves "reflect" naming for
//     a future magic-spell variant; this one is "[revenge]" in the log.)
//   - Absorbed hits (resistance > 100 tag-flip, ADR-0057) don't reflect —
//     no damage actually landed.
//   - KO'd wearers don't reflect (engagement-inactive).
//   - The revenge `system_damage` bypasses the seven-stage damage
//     pipeline, so it can't trigger further reflects — loop-safe by
//     construction.
//   - Reflect to attacker can KO the attacker (it's outgoing from the
//     wearer's perspective); reflect cannot KO the wearer (no self-
//     damage path).
//
// Substrate: the new `onFinalDamageReceived` hook + `physicalReflectPercent`
// contributor introduced this session. See `docs/decisions/ADR-0075-on-final-
// damage-received.md`.

import { classId, itemId, type ArmorEquipment } from '@engine/index.ts';

export const spikedMail: ArmorEquipment = {
  id: itemId('spiked_mail'),
  name: 'Spiked Mail',
  availability: 'available',
  kind: 'armor',
  classRestrictions: [classId('knight'), classId('templar')], // S62: Templar shares Knight head/body gear
  statMods: { maxHpBase: 100 },
  physicalReflectPercent: 20,
};
