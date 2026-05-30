// Battle Dictionary — Book (mage off-hand). The reach Book: +1 PA plus
// +1 horizontal range AND +1 AoE vertical tolerance on every magical
// cast.
//
// The +1 PA is an intentional plant for a future hybrid class +
// Alchemy-secondary builds — a Mage equipping Battle Dictionary today
// gets little from +1 PA (their offense is MA-scaled), but Alchemy items
// scale on PA, and any future PA-scaling magical hybrid will read it.
//
// Magical-tag-gated range / AoE-elevation bumps borrow the Wand of the
// Depths refit pattern: horizontal +1 lives on `abilityRangeModifiers`,
// AoE vertical tolerance +1 lives on the new S51
// `aoeVerticalToleranceModifiers` surface. Both gated on the
// `'magical'` damage tag, matching how the Tome of Power and Livre of
// Urgency cover the rest of a mage's caster axes.
//
// Math Skill abilities have no targeting range concept (battlefield-wide)
// and no AoE shape, so the range/tolerance bumps don't apply there;
// the +1 PA still propagates if a Calculator's secondary command set
// is something PA-scaling.

import { classId, itemId, type ShieldEquipment } from '@engine/index.ts';

export const battleDictionary: ShieldEquipment = {
  id: itemId('battle_dictionary'),
  name: 'Battle Dictionary',
  availability: 'available',
  kind: 'shield',
  classRestrictions: [
    classId('earth_mage'),
    classId('water_mage'),
    classId('fire_mage'),
    classId('lightning_mage'),
    classId('calculator'),
    classId('terraformer'),
  ],
  statMods: { pa: 1 },
  abilityRangeModifiers: [{ deltaHorizontal: 1, tagFilter: ['magical'] }],
  aoeVerticalToleranceModifiers: [{ delta: 1, tagFilter: ['magical'] }],
};
