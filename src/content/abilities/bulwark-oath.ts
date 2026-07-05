// Bulwark Oath — Chris's signature (TABA chapter-1 plot unit).
//
// A free, innate, always-equipped Knight passive built on Seam 2 (cover): an
// ally within adjacency (+ vertical tolerance 3) of Chris has `10 % × chapter`
// (10/20/30 % across the 3-chapter campaign) of its incoming damage redirected
// onto Chris as RAW, which then runs through HIS own Protect / resistances /
// armor — so his defenses make the soak better (the point of a tank).
//
// This carries NO hooks: the generic `cover_redirect` damage handler scans for a
// nearby unit whose passive declares `coverParams` and reads them. Chris is
// instance one; future generic tanks / boss minions reuse the same primitive
// with different params. Not a purchasable component (innate; 0 cost).

import {
  abilityId,
  bucketId,
  type PassiveAbilityDefinition,
} from '@engine/index.ts';

export const bulwarkOath: PassiveAbilityDefinition = {
  id: abilityId('bulwark_oath'),
  name: 'Bulwark Oath',
  kind: 'passive',
  bucket: bucketId('support'),
  baseCost: 0, // free innate
  availability: 'hidden', // unit-specific signature — not in the picker
  hooks: [],
  // 10 % redirect per chapter; strict adjacency; vertical tolerance 3.
  coverParams: { redirectPerTier: 0.1, range: 1, verticalTolerance: 3 },
};
