// Magebane — Session 40. WP 5, accuracy 95, 50% on-hit Silence proc.
// The anti-mage knife: highest WP of the v1 knives, paired with a
// status-effect proc that shuts down a magical opponent for 4 turns.
//
// Per the S40 brief: Mages make up 4/5 of v1's class roster; Silence
// becomes a real angle of attack now that Remedy exists as the counter.
// Magebane wielded by a Knight or Alchemist applies real pressure on
// the opposing Mage line.
//
// Proc convention: matches Flametongue's Burn proc (Session 31,
// ADR-0064). The weapon-side `attackProcs[].chance` is a flat 50% — no
// Faith / Brave / wielder-stat gate. The ability fired (`apply_silence_
// proc`) uses `applyAlways: true`, so the application lands modulo the
// modifier hook chain (Pointy Hat × 0.5, Focus Band × 0.75, etc.). A
// mage wearing a Pointy Hat sees the effective Silence rate drop to
// 25% before crit/evade considerations — a real counter-pick gap.
//
// Weapon class: knife. Physical variance is Speed-derived per the
// session's dynamic-variance substrate.
//
// Per Chris's design call: 50% base is the starting rate; watch in
// playtest for whether mages need more defensive options (Remedy + the
// Pointy Hat reduction) or whether the rate is too low to feel
// threatening.

import { abilityId, itemId, type WeaponEquipment } from '@engine/index.ts';

export const magebane: WeaponEquipment = {
  id: itemId('magebane'),
  name: 'Magebane',
  availability: 'available',
  kind: 'weapon',
  wp: 5,
  accuracy: 95,
  tags: ['knife'],
  physicalVariance: { kind: 'attacker_speed', spread: 0.05 },
  attackProcs: [{ chance: 0.5, abilityId: abilityId('apply_silence_proc') }],
};
