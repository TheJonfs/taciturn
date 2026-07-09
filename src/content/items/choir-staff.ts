// Choir Staff — TABA Ch2 second-pass buff-caster staff (M3 equipment
// expansion). WP 4, accuracy 80; the wearer's buffs last +1 duration
// unit, and magical casts charge +5 faster.
//
// The Enchanter's staff. The duration rider is the first consumer of
// the `modifyOutgoingStatusDuration` hook (the fourth quadrant of
// incoming/outgoing × magnitude/duration — Chris's M3 call): +1 to any
// finite-duration positive-tagged status the wearer applies, self-casts
// included. Permanent-mode buffs (equipment grants, permanent_per_unit_ct
// applications with no explicit duration) pass through untouched — there
// is no duration to extend.
//
// The +5 magical action speed matches Livre of Urgency's rider (and
// stacks with it — the tempo-Enchanter's pairing), riding the
// union-read tag gate so buff casts genuinely benefit (the M3 fix).
//
// TABA-only: `hidden` + campaign pool (chapter 2, shop).

import { itemId, type WeaponEquipment } from '@engine/index.ts';

export const choirStaff: WeaponEquipment = {
  id: itemId('choir_staff'),
  name: 'Choir Staff',
  availability: 'hidden',
  kind: 'weapon',
  weaponType: 'staff',
  wp: 4,
  accuracy: 80,
  tags: ['staff'],
  outgoingStatusDurationMods: [{ delta: 1, statusTag: 'positive' }],
  actionSpeedModifiers: [{ delta: 5, tagFilter: ['magical'] }],
};
