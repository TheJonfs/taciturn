// Knight — heavy-armor melee frontline. Battle Skill command set (Power
// Attack / Stasis Sword / Taunt); class-free R/S/M passives are Counter
// (Reaction), Martial Expertise (Support, PA × 1.25), Bravestrider
// (Movement, +1 moveRange + 10 brave).
//
// Movement values (moveRange 3, jump 2, ground + water with cost gate)
// match FFT's iconic Knight.

import {
  abilityId,
  classId,
  commandSetId,
  type ClassDefinition,
} from '@engine/index.ts';

export const knight: ClassDefinition = {
  id: classId('knight'),
  name: 'Knight',
  movement: {
    moveRange: 3,
    jump: 2,
    terrainCosts: new Map(),
    // Session 33 (ADR-0073): water is universally enterable; the cost
    // (ruleset default: water_shallow 2, water_deep 3) is the tactical
    // gate, not access. A Knight can wade through water at penalty
    // cost or leap over it via jump-over-water pathfinding.
    canEnter: new Set(['ground', 'water_shallow', 'water_deep', 'rampart']),
  },
  // S41 review: heavy-armor class identity. Best front evade in v1 —
  // beats Water Mage (10) clearly; middling side; uniform back-zero
  // matches every class.
  evasion: { front: 12, side: 7, back: 0 },
  // Knight equips into all five slots (per ADR-0028). v1 demo Knights
  // start with a Long Sword in the right hand; armor / headgear /
  // accessory slots stay open for tuning passes.
  equipmentSlots: {
    leftHand: true,
    rightHand: true,
    headgear: true,
    armor: true,
    accessory: true,
  },
  firstActionCommandSet: commandSetId('battle_skill'),
  // S41 R/S/M review: Counter retained as-is. Damage Reduction →
  // Martial Expertise (PA × 1.25, Conductor parallel). Move +1 →
  // Bravestrider (+1 moveRange + 10 brave; Hotfoot-tier dual-effect at
  // cost 2). Damage Reduction and Move +1 remain in the catalog as
  // cross-class options; they're just no longer the Knight's free kit.
  freeAbilities: new Set([
    abilityId('attack'),
    abilityId('counter'),
    abilityId('martial_expertise'),
    abilityId('bravestrider'),
  ]),
  // S49 Level system: Knight's identity is physical attack — at L23 the
  // dominant-stat modifier drops PA by 1; at L27 boosts by 1.
  dominantStat: 'pa',
  defaultGender: 'male',
};
