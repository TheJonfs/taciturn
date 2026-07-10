// Palliative Pike — TABA Ch3 hybrid battle-medic lance (M3 equipment
// expansion). WP 11, accuracy 95, the Lance package (2H, reach 2/4,
// pierce, [0.9, 1.1] band); every LANDED hit pulses a heal of MA × 4
// to allies in diamond-1 around the WIELDER.
//
// The PA-hit / MA-heal loop: only a dual-stat user collects both halves
// — a pure fighter wields a wet noodle of a heal, a pure caster swings
// a wet noodle of a spear. The pulse is `palliative_pulse` fired via a
// 100% attackProcs rider (proc gates on ctx.hit — the on-successful-hit
// confirm), ally-only (the new AoE teamFilter), wielder excluded, and
// expandable by Aether Bloom (the pulse is a real use_ability, so the
// modifyAoeShape chain applies — the doc's engine confirm).
//
// Aggregate-heal watch (open register): a landed pierce hits up to two
// targets → two pulses; playtest the sustain ceiling before tuning.
//
// TABA-only: `hidden` + campaign pool (chapter 3, shop).

import { abilityId, itemId, type WeaponEquipment } from '@engine/index.ts';

export const palliativePike: WeaponEquipment = {
  id: itemId('palliative_pike'),
  name: 'Palliative Pike',
  availability: 'hidden',
  kind: 'weapon',
  weaponType: 'polearm',
  wp: 11,
  accuracy: 95,
  tags: ['lance'],
  twoHanded: true,
  range: { min: 1, max: 2, vertical: 4 },
  pierces: true,
  physicalVariance: { kind: 'static', min: 0.9, max: 1.1 },
  attackProcs: [{ chance: 1, abilityId: abilityId('palliative_pulse') }],
};
