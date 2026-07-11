// Excalibur — TABA Ch3 weapon unique (the post-game PREVIEW). Knight
// Sword (two-handed), WP 16, accuracy 95, Brave variance; Auto-Haste;
// Holy-imbued.
//
// Intentionally above-curve — the victory-lap reward behind a tough
// OPTIONAL Ch3 boss, previewing the post-game busted-gear ladder. Pure
// composition on three battle-tested precedents:
//
//   - Knight Sword family (D3: live already — Absolom and Defender).
//     `weaponType: 'knight_sword'`, two-handed, and the family contract:
//     the attacker-Brave variance band centers damage on Brave/100, so
//     effective output is WP 16 × PA × (Brave/100 ± 0.05) — full power
//     only at 100 Brave, self-limiting below. High WP + strong riders in
//     exchange for the Brave gamble and both hands.
//   - Auto-Haste: `statusGrants: ['haste']` (Boots of Haste's permanent
//     equipment-lifecycle status, battle-start application).
//   - Holy imbue (D2 payoff): the `'holy'` weapon tag rides ADR-0028's
//     weapon-tag merge into the damage pipeline, so strikes resolve
//     against the target's Holy resistance field — the vestige
//     (Engineered Defenses' +Holy arm etc.) finally has offense to
//     answer. No unit normally resists Holy without deliberate effort;
//     initial gameplay impact is deliberately minimal.
//
// TABA-only: `hidden` + campaign pool (chapter 3, unique).

import { itemId, statusTypeId, type WeaponEquipment } from '@engine/index.ts';

export const excalibur: WeaponEquipment = {
  id: itemId('excalibur'),
  name: 'Excalibur',
  availability: 'hidden',
  kind: 'weapon',
  weaponType: 'knight_sword',
  wp: 16,
  accuracy: 95,
  tags: ['sword', 'holy'],
  twoHanded: true,
  physicalVariance: { kind: 'attacker_brave', spread: 0.05 },
  statusGrants: [statusTypeId('haste')],
};
