// Sow Doubt — Assassin Command Set (Session 42). Instant, ranged (4h ×
// 3v, straight_line targeting — needs line of sight), no damage:
// permanently saps the target's Faith by 20.
//
// S65: rangeMode arc → straight_line (ADR-0108). Flipped with the rest of
// the Assassin dart family (Blowdart, Shadow Stitch, Undermine) so a
// Barrier / intervening cover stops the dart. Consistent with the S60
// arc→straight_line cut (ADR-0097); bows / lobbed / area stay arc.
//
// Applies `faith_down` (magnitude 20) — a permadebuff that persists
// through KO (ADR-0079) and survives Remedy (`remedyImmune`). Strong
// against enemy mages: Faith scales magical damage, so a Faith-sapped
// caster hits softer for the rest of the battle.
//
// Faith-and-Speed formula `{ faith: true, speed: true }` (the only
// Command Set member gated on Faith rather than Brave), baseChance 80.
// Double-edged (a designed watch-for): Faith is symmetric on magical
// effects, so lowering the target's Faith also reduces the Assassin's
// allied mages' damage into that target — net value is team-comp
// dependent. mpCost 6 — a cheap opener (four castings at base MP 24).

import {
  abilityId,
  bucketId,
  statusTypeId,
  type ActiveAbilityDefinition,
} from '@engine/index.ts';

export const sowDoubt: ActiveAbilityDefinition = {
  id: abilityId('sow_doubt'),
  name: 'Sow Doubt',
  kind: 'active',
  bucket: bucketId('first_action'),
  baseCost: 1,
  availability: 'available',
  targeting: {
    kind: 'single_unit',
    range: { horizontal: 4, vertical: 3 },
    rangeMode: 'straight_line',
  },
  actionSpeed: 0,
  mpCost: 6,
  effects: {
    statusEffects: [
      {
        typeId: statusTypeId('faith_down'),
        target: 'primary_target',
        baseChance: 80,
        magnitude: 20,
        factors: { faith: true, speed: true },
      },
    ],
  },
};
