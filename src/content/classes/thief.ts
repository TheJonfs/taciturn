// Thief — the roster's twelfth class and fifth physical (concept-notes
// "thief-concept-notes.md"). Fills the one mechanical axis the physical
// roster doesn't touch: resource interaction. Where every other class
// outputs damage, a control-status, a heal, or terrain, the Thief drains HP,
// drains MP, strips and wears enemy buffs, and (at capstone, chunk 2)
// temporarily steals a unit outright via Steal Heart.
//
// Lane boundary vs the Assassin: the Assassin denies what a unit can *do*
// (Stop, disable, debuffs); the Thief denies what a unit *has* (HP / MP /
// buffs). No action-denial statuses on the Thief — that blurs the two.
//
// Stat line lives in baseline-stats.ts: HP 90 / MP 28 / PA 7 / MA 3 /
// Speed 11 (dominant 'pa'). PA is the everything-stat — it drives Steal HP
// damage, Steal MP magnitude, and the Steal Buffs / Steal Heart contest
// chance. The 28-MP bar against the 24-MP Steal Heart bank is the core
// tension: every turn chooses between using the kit and banking for the
// capstone.
//
// Movement: Move 3 / Jump 3. The innate Move +2 lifts effective Move to 5 —
// the reach that lets the Thief get to a protected backline caster to drain
// it (Steal MP synergy).
//
// Equipment: all five slots open, universal gear (same as the non-Knight /
// non-Templar physical classes).
//
// Innate kit (free; costed in the pool for others): Slip Free (Reaction —
// shrug one tick off an applied debuff, Brave-gated), Momentum (Support —
// CT refund on any non-magical action incl. the basic Attack), Move +2
// (Movement). All three sit in different buckets, so the full native package
// runs together — a slippery, fast, control-resistant skirmisher — at the
// opportunity cost of cross-class R/S/M.
//
// Evasion 8 / 4 / 0 — evasive from the front, exposed from behind.

import {
  abilityId,
  classId,
  commandSetId,
  type ClassDefinition,
} from '@engine/index.ts';

export const thief: ClassDefinition = {
  id: classId('thief'),
  name: 'Thief',
  movement: {
    moveRange: 3,
    jump: 3,
    terrainCosts: new Map(),
    canEnter: new Set(['ground', 'water_shallow', 'water_deep']),
  },
  evasion: { front: 8, side: 4, back: 0 },
  equipmentSlots: {
    leftHand: true,
    rightHand: true,
    headgear: true,
    armor: true,
    accessory: true,
  },
  firstActionCommandSet: commandSetId('thief_arts'),
  freeAbilities: new Set([
    abilityId('attack'),
    abilityId('slip_free'),
    abilityId('momentum'),
    abilityId('move_plus_2'),
  ]),
  dominantStat: 'pa',
};
