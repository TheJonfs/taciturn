// Enchanter — the dedicated ally-enhancement caster (S72), the 13th class
// and 6th magical one. Fills the buff-application gap the roster lacked:
// Haste / Protect / Shell existed only as equipment auto-status, never as a
// cast a player could place where they wanted. Auramancy (the First Action
// set) is support-only by design — the Enchanter's offense comes from a
// secondary command set, and Auramancy-as-secondary hands any class a buff
// suite. It also feeds the Thief's buff economy: the buffs it casts are
// stealable.
//
// Stat line (baseline-stats.ts): HP 103 / MP 40 / PA 3 / MA 10 / Speed 10.
// "A notch below the elemental mages on output, normal mage durability" —
// MP 40 and MA 10 are the tier-downs vs the elementals' 48 / 12-14; HP 103
// is mid-band. Move 3 / Jump 2 (below); Eva 6/4/0.
//
// Gear: universal + magical (added to the mage-gear classRestrictions tier —
// robes, wands/staves/books, mage headgear). All five equipment slots open.
//
// Innate kit (free; costed in the pool for others): Auramancy (First Action),
// plus the native R/S/M — Resistance Save (Reaction), two Supports (Short
// Charge + Aura Mastery, the buff-amplifier), and Float (Movement). Support
// capacity 3 fits Short Charge (1) + Aura Mastery (1) together.

import {
  abilityId,
  classId,
  commandSetId,
  type ClassDefinition,
} from '@engine/index.ts';

export const enchanter: ClassDefinition = {
  id: classId('enchanter'),
  name: 'Enchanter',
  movement: {
    moveRange: 3,
    jump: 2,
    terrainCosts: new Map(),
    canEnter: new Set(['ground', 'water_shallow', 'water_deep', 'rock', 'grass_rock']),
  },
  evasion: { front: 6, side: 4, back: 0 },
  equipmentSlots: {
    leftHand: true,
    rightHand: true,
    headgear: true,
    armor: true,
    accessory: true,
  },
  firstActionCommandSet: commandSetId('auramancy'),
  freeAbilities: new Set([
    abilityId('attack'),
    abilityId('resistance_save'),
    abilityId('short_charge'),
    abilityId('aura_mastery'),
    abilityId('float'),
  ]),
  dominantStat: 'ma',
  defaultGender: 'female',
};
