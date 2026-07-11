// Del's Stave — TABA Ch3 weapon unique. Staff, WP 5, accuracy 80; on
// any magical cast: spend ALL current MP, and the spell gains +1 Spell
// Power per 10 MP spent beyond its cost.
//
// The one-shot nova staff (`castMpDump` — the dynamic per-cast-SP seam
// shipped with this item). Load-bearing ruling: NO artificial cap — the
// MP economy self-caps it. The first cast off a stacked MaxMP pool hits
// enormous; restore rates of 10–20/tick never refill to peak, so later
// casts are ~normal. And the incentive deliberately favors the
// CHEAPEST spell — more leftover MP → more bonus SP — which is intended
// (watch whether it reads as design or exploit in play).
//
// Applies to ALL magical casts (Chris's ruling): a Spell-Power-scaling
// heal novas too; a buff cast just burns the tank. Commit-time bonus,
// carried on the ChargedAction for charged spells; AI projection and
// the UI forecast recompute the identical formula from live vitals
// (three-resolver discipline — see engine/abilities/mp-dump.ts).
//
// TABA-only: `hidden` + campaign pool (chapter 3, unique).

import { itemId, type WeaponEquipment } from '@engine/index.ts';

export const delsStave: WeaponEquipment = {
  id: itemId('dels_stave'),
  name: "Del's Stave",
  availability: 'hidden',
  kind: 'weapon',
  weaponType: 'staff',
  wp: 5,
  accuracy: 80,
  tags: ['staff'],
  castMpDump: { mpPerBonusSp: 10 },
};
