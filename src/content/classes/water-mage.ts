// Water Mage — second Mage class. Tempo manipulator: pushes enemy CT
// back, brings ally CT forward, and uses positional displacement
// (knockback) as area control.
//
// Movement baseline: moveRange 4, jump 3, ground-only. Faster movement
// than Earth Mage (3/3) — fits the tempo / mobility identity. Float /
// water-walking is left as an equipped passive choice rather than a
// class baseline (per session 18 plaintext review).
//
// Default First Action command set: `water_spells` — the 5 active
// abilities (strike, surge, wave, brine, maelstrom). The reaction
// (tidal_pull) and support (flow_state) live in their respective
// passive buckets.
//
// Class-inherent passives: none. Identity comes from the Water Spells
// command set + equipped passives.

import {
  abilityId,
  classId,
  commandSetId,
  type ClassDefinition,
  type DamageTag,
} from '@engine/index.ts';

export const waterMage: ClassDefinition = {
  id: classId('water_mage'),
  name: 'Water Mage',
  movement: {
    moveRange: 4,
    jump: 3,
    terrainCosts: new Map(),
    canEnter: new Set(['ground']),
  },
  // Slightly higher front evade than Earth Mage (8/5/0) — Water's
  // mobility identity nudges into evasion. Real numbers land in the
  // post-session-20 tuning pass.
  evasion: { front: 10, side: 6, back: 0 },
  equipmentSlots: {
    leftHand: true,
    rightHand: true,
    headgear: true,
    armor: true,
    accessory: true,
  },
  firstActionCommandSet: commandSetId('water_spells'),
  freeAbilities: new Set([
    abilityId('attack'),
    abilityId('tidal_pull'),
    abilityId('flow_state'),
  ]),
  // Elemental wheel (designer call 2026-05-10): +50 vs Fire (water
  // douses), -50 vs Lightning (conductor in water).
  baselineResistances: new Map<DamageTag, number>([
    ['fire', 50],
    ['lightning', -50],
  ]),
};
