// Livre of Urgency — Book (mage off-hand). The tempo Book: +1 Speed
// plus +5 charged action speed on every magical cast (Deepwood pattern
// generalized to all spells via the `tagFilter: ['magical']` gate).
// The Speed bump compounds with the spell-speed bump — faster turns
// per battle AND faster cast resolution per turn.
//
// Math Skill abilities are instant-cast (actionSpeed 0), so the +5
// charged speed contribution doesn't shorten their resolution; the
// +1 Speed still lifts the Calculator's turn cadence.

import { classId, itemId, type ShieldEquipment } from '@engine/index.ts';

export const livreOfUrgency: ShieldEquipment = {
  id: itemId('livre_of_urgency'),
  name: 'Livre of Urgency',
  availability: 'available',
  kind: 'shield',
  classRestrictions: [
    classId('earth_mage'),
    classId('water_mage'),
    classId('fire_mage'),
    classId('lightning_mage'),
    classId('calculator'),
    classId('terraformer'),
    classId('enchanter'),
  ],
  statMods: { spd: 1 },
  actionSpeedModifiers: [{ delta: 5, tagFilter: ['magical'] }],
};
