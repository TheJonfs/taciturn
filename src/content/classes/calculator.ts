// Calculator — the 9th class (Session 49). The magical-knowledge
// specialist defined by the Math Skill command set: parameter-based
// instant-cast targeting across every unit on the battlefield. Slow,
// back-line caster with limited mobility and modest magical output;
// reach comes from Math Skill's battlefield-wide targeting, not from
// physical positioning.
//
// Stats (see classBaselineStats): HP 101 / MP 47 / PA 5 / MA 8 /
// Speed 7. Movement 2 / Jump 2 — lowest tier (with Knight, Geosage,
// Pyromancer post-S46). MP 47 is moderate; Thoughtful Pacing extends
// sustain meaningfully on Move-heavy turns.
//
// Evasion 7 / 3 / 0: decent front (between Hunter's 6 and Assassin's 8),
// minimal side, exposed back. Combined with 101 HP the Calculator needs
// positioning behind front-line allies to operate.
//
// Native R/S/M (free; cross-class costs per ability):
//   - Reaction: Cornered Focus (free; cross-class 1) — +1 MA permanent
//     on being hit for damage; accumulates over the battle.
//   - Support: Mathematician (free; cross-class 2) — +1 SP on Math
//     abilities + per-target MP discount 3 → 1.
//   - Movement: Thoughtful Pacing (free; cross-class 1) — +2 MP per
//     space moved on each Move action.
//
// Equipment: Mage + Universal armor (per blueprint). v1 keeps all five
// slots permitted uniformly across classes; armor-tier gating (mage-only
// armor) is wave-2 work via item-side class restrictions.

import {
  abilityId,
  classId,
  commandSetId,
  type ClassDefinition,
} from '@engine/index.ts';

export const calculator: ClassDefinition = {
  id: classId('calculator'),
  name: 'Calculator',
  movement: {
    moveRange: 2,
    jump: 2,
    terrainCosts: new Map(),
    // Universal water-enterable (ADR-0073). See knight.ts for the
    // convention.
    canEnter: new Set(['ground', 'water_shallow', 'water_deep', 'rampart']),
  },
  evasion: { front: 7, side: 3, back: 0 },
  equipmentSlots: {
    leftHand: true,
    rightHand: true,
    headgear: true,
    armor: true,
    accessory: true,
  },
  firstActionCommandSet: commandSetId('math_skill'),
  freeAbilities: new Set([
    abilityId('attack'),
    abilityId('cornered_focus'),
    abilityId('mathematician'),
    abilityId('thoughtful_pacing'),
  ]),
  // S49 Level system: Calculator is MA-dominant (Math damage / heal /
  // CT scale off MA).
  dominantStat: 'ma',
};
