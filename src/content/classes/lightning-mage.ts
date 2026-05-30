// Lightning Mage — fourth Mage class. Speed-leaning crit specialist:
// fastest of the four mages with moderate raw MA, but burst potential
// through the v1 crit infrastructure (Static Embrace boosts an ally's
// crit_chance; Lightning Strike's premium power coefficient feeds
// reliable damage).
//
// Per session 20 plaintext review:
//   - spd 12 / pa 3 / ma 8 / hp 44 / mp 44 (highest Speed among Mages)
//   - evasion 7/4/0 (between Fire and Water)
//   - moveRange 3, jump 3, ground-only
//   (the spd/hp/mp figures in this S20-review snapshot are pre-retune;
//   classBaselineStats is the source of truth)
//
// Movement baseline: ground-only, no float/water-walking. Lightning's
// identity is "be where you need to be quickly" via Speed. Float / fly
// is left as an equipped passive for cross-classed builds.
//
// Default First Action command set: `lightning_spells` (Strike,
// Embrace, Chain, Mark, Storm Caller).
//
// Class-inherent free passives: `discharge` (magical reaction),
// `conductor` (× 1.25 MA support), and `quickstep` (session 26 —
// Lightning's Movement-bucket parity passive: refunds MA CT on
// turn-end if a Move was committed). All listed in `freeAbilities`,
// so a Lightning Mage equipping them pays 0 capacity. Cross-classed
// units pay the standard baseCost each.

import {
  abilityId,
  classId,
  commandSetId,
  type ClassDefinition,
  type DamageTag,
} from '@engine/index.ts';

export const lightningMage: ClassDefinition = {
  id: classId('lightning_mage'),
  // S40 name-update pass: display name updated to 'Aethurge';
  // underlying classId preserved for save-state continuity.
  name: 'Aethurge',
  movement: {
    moveRange: 3,
    jump: 3,
    terrainCosts: new Map(),
    // Session 33 (ADR-0073): water is universally enterable; cost is
    // the gate. See knight.ts for the convention.
    canEnter: new Set(['ground', 'water_shallow', 'water_deep', 'rampart']),
  },
  evasion: { front: 7, side: 4, back: 0 },
  equipmentSlots: {
    leftHand: true,
    rightHand: true,
    headgear: true,
    armor: true,
    accessory: true,
  },
  firstActionCommandSet: commandSetId('lightning_spells'),
  // Both class signature passives free — the Lightning Mage's identity
  // (magical retaliation + multiplicative MA) is fully on by default.
  // `attack` is universally free (designer call 2026-05-10).
  freeAbilities: new Set([
    abilityId('attack'),
    abilityId('discharge'),
    abilityId('conductor'),
    abilityId('quickstep'),
  ]),
  // Elemental wheel (designer call 2026-05-10): +50 vs Water (insulated
  // by charge), -50 vs Earth (grounding).
  baselineResistances: new Map<DamageTag, number>([
    ['water', 50],
    ['earth', -50],
  ]),
  // S49 Level system: mage class — MA-dominant.
  dominantStat: 'ma',
};
