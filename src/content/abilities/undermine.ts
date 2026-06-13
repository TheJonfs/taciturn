// Undermine — Assassin Command Set (Session 42). Instant, ranged (4h ×
// 3v, straight_line targeting — needs line of sight), no damage:
// permanently saps the target's Brave by 20.
//
// S65: rangeMode arc → straight_line (ADR-0108). Flipped with the rest of
// the Assassin dart family (Blowdart, Shadow Stitch, Sow Doubt) so a
// Barrier / intervening cover stops the dart. Consistent with the S60
// arc→straight_line cut (ADR-0097); bows / lobbed / area stay arc.
//
// Applies `brave_down` (magnitude 20) — a permadebuff that persists
// through KO (ADR-0079) and survives Remedy (`remedyImmune`). Best as an
// opening move against a priority target: dropping Brave suppresses the
// target's reaction-trigger chance (Brave/100) and any Brave-gated
// infliction for the rest of the battle.
//
// Brave-and-Speed formula `{ brave: true, speed: true }`, baseChance 80.
// Note the self-cancellation tension (a designed watch-for): once Brave
// Down lands, the target's lowered Brave makes *subsequent* Brave-gated
// Assassin moves (Shadow Stitch, Blowdart, a second Undermine) less
// likely on that same target. mpCost 6 — a cheap opener (four castings
// at base MP 24).

import {
  abilityId,
  bucketId,
  statusTypeId,
  type ActiveAbilityDefinition,
} from '@engine/index.ts';

export const undermine: ActiveAbilityDefinition = {
  id: abilityId('undermine'),
  name: 'Undermine',
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
        typeId: statusTypeId('brave_down'),
        target: 'primary_target',
        baseChance: 80,
        magnitude: 20,
        factors: { brave: true, speed: true },
      },
    ],
  },
};
