// Monk — the roster's 14th class and 6th physical, squaring the roster to
// 6 physical / 6 magical (+2 hybrids). A barehanded, PA-scaling, stance-
// dancing martial artist with self-sustain and a grapple-throw. Fills the
// "no physical class self-sustains" gap and folds the Grappler concept in
// (Bear's Heave is the throw). See `docs/thirtyNinePlanning/session-76-monk-brief.md`.
//
// PA is the monostat: it drives damage (Barehanded → WP=PA → the basic punch
// is PA²), evasion (Vigilance lifts all facings by PA), and retaliation
// (Counterpunch). It wears NO body and NO off-hand and holds NO weapon — its
// durability is evasion + counter + self-heal (all physical-only), making it
// a near-hard-counter to physical and genuinely fragile to magic.
//
// Stat line lives in baseline-stats.ts: HP 190 / MP 26 / PA 9 / MA 4 /
// Speed 10 (dominant 'pa'). HP 190 reads high but nets ~210 effective with a
// head — below the Knight (~314) and Hunter (~226) — because there's no body
// slot to stack. An evasion-and-sustain bruiser, not an HP wall.
//
// Evasion 11/8/3 — the highest base in the roster, and Vigilance lifts even
// the back facing off the floor (anti-flank). Move 3 / Jump 3.
//
// Equipment: Universal Head + Accessory only — NO body, NO off-hand, NO
// weapon. Barehanded (WP=PA) only fires while both hands are empty, which the
// class enforces structurally. `baselineResistances` is empty by design: the
// Monk's only elemental resistance comes from its active stance + a resistance
// head, thin on purpose.
//
// Innate kit (free; costed in the pool for others), one per passive bucket:
// Counterpunch (Reaction — PA×4 melee retaliation + knockback chance),
// Barehanded (Support — WP=PA while unarmed), Vigilance (Movement — PA→all-
// facing evasion). Default First Action: Martial Arts (Chakra + 4 Fists).

import {
  abilityId,
  classId,
  commandSetId,
  type ClassDefinition,
} from '@engine/index.ts';

export const monk: ClassDefinition = {
  id: classId('monk'),
  name: 'Monk',
  movement: {
    moveRange: 3,
    jump: 3,
    terrainCosts: new Map(),
    canEnter: new Set(['ground', 'water_shallow', 'water_deep', 'rampart', 'rock', 'grass_rock', 'bridge']),
  },
  evasion: { front: 11, side: 8, back: 3 },
  equipmentSlots: {
    leftHand: false,
    rightHand: false,
    headgear: true,
    armor: false,
    accessory: true,
  },
  firstActionCommandSet: commandSetId('martial_arts'),
  freeAbilities: new Set([
    abilityId('attack'),
    abilityId('counterpunch'),
    abilityId('barehanded'),
    abilityId('vigilance'),
  ]),
  // Empty by design — the Monk's only elemental resistance is its active
  // stance (+50 one element / −50 the paired one) plus any resistance head.
  baselineResistances: new Map(),
  dominantStat: 'pa',
  defaultGender: 'male',
};
