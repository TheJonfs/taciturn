// Shadowblade — TABA Ch3 weapon unique. Knife, WP 6, accuracy 95,
// speed variance; 50% on-hit: Speed Up (self) + Speed Down (target),
// both permanent, both stacking.
//
// The tempo-vampire knife. Composes the knife family's Speed-derived
// variance, Magebane's proc convention (Chris's ruling for this weapon:
// flat weapon-side 50%, no Brave/PA gate; the fired ability's
// applications are `applyAlways`, bent only by the target's modifier
// chain), and the Speed Save / Speed Down accumulating-stat-status
// pattern (`speed_up` is authored alongside as Speed Down's positive
// mirror).
//
// Load-bearing ruling: BOTH directions stack PERMANENTLY. The widening
// gap is the design; the degenerate case (locking an HP-sponge boss) is
// answered by boss Speed-Down resistance if it ever lands, not by a
// change here.
//
// TABA-only: `hidden` + campaign pool (chapter 3, unique).

import { abilityId, itemId, type WeaponEquipment } from '@engine/index.ts';

export const shadowblade: WeaponEquipment = {
  id: itemId('shadowblade'),
  name: 'Shadowblade',
  availability: 'hidden',
  kind: 'weapon',
  weaponType: 'knife',
  wp: 6,
  accuracy: 95,
  tags: ['knife'],
  physicalVariance: { kind: 'attacker_speed', spread: 0.05 },
  attackProcs: [{ chance: 0.5, abilityId: abilityId('shadowblade_proc') }],
};
