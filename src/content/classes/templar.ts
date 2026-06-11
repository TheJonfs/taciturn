// Templar — a hybrid White Mage + Dragoon for the Glabados Church (S62);
// precursor to FFT's Holy Knights. Distils healing/revival (Cure, Raise)
// and the Lance/Jump Dragoon kit into one slow, balanced body. Two donor
// targets: other classes raid its Command Set (Templar Arts) for healing,
// or its innate Monkeygrip for weapon-economy shenanigans.
//
// Stat line lives in baseline-stats.ts: HP 132 / MP 36 / PA 6 / MA 6 /
// Speed 8 (dominant 'ma'). PA 6 sits well below the Knight's functional 12
// (10 × Martial Expertise 1.25), so on shared Knight gear the Knight roughly
// doubles the Templar's physical output — the gap that protects the Knight's
// identity even with shared armor.
//
// Movement: Move 2 (slow-caster tier), Jump 3. Faithstrider (innate) lifts
// Move to 3 — no base-4, per the Move-tier principle.
//
// Equipment: all five slots open. Second class (after the Knight) with
// Knight gear access — the six Knight headgear/body pieces AND the three
// Knight shields list `templar` in `classRestrictions` (Chris, S62). Weapons
// are universal. With innate Monkeygrip the Templar pairs a shield (Knight or
// universal) with a two-handed weapon.
//
// Innate kit (free; costed in the pool for others): Emissary of Murond
// (Support, +25% healing), Monkeygrip (Support, two-handers one-handed),
// Unified Calling (Reaction, +PA MP on a one-time heal), Faithstrider
// (Movement, +1 Move / +10 Faith). Generous in count (four) but in line
// with other classes in value — its innate Support value (Monkeygrip 2 +
// Emissary 1 = 3) ≈ the Assassin's Two Weapons (3).
//
// Evasion 10 / 6 / 2 — NOTE: the concept-notes give a non-zero BACK evade
// (2), the first class to break the uniform back-zero every other class
// shares. Authored to spec; flagged for Chris at plan-review.

import {
  abilityId,
  classId,
  commandSetId,
  type ClassDefinition,
} from '@engine/index.ts';

export const templar: ClassDefinition = {
  id: classId('templar'),
  name: 'Templar',
  movement: {
    moveRange: 2,
    jump: 3,
    terrainCosts: new Map(),
    canEnter: new Set(['ground', 'water_shallow', 'water_deep']),
  },
  evasion: { front: 10, side: 6, back: 2 },
  equipmentSlots: {
    leftHand: true,
    rightHand: true,
    headgear: true,
    armor: true,
    accessory: true,
  },
  firstActionCommandSet: commandSetId('templar_arts'),
  freeAbilities: new Set([
    abilityId('attack'),
    abilityId('emissary'),
    abilityId('monkeygrip'),
    abilityId('unified_calling'),
    abilityId('faithstrider'),
  ]),
  dominantStat: 'ma',
};
