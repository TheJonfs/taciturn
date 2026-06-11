// Monkeygrip — the Templar's Support passive (S62, from FFTA). Two-handed
// weapons require only one hand, so the bearer can pair a two-hander with
// an off-hand item: a shield (Defender + Escutcheon), or — with Two
// Weapons (which grants the second swing at attack time) — a second
// two-hander (the budget-gated dual-two-hander combo).
//
// Mechanism (ADR-0100): purely declarative. `relaxesTwoHandedGrip: true`
// is read by the equip validator (`validateEquipmentPlacement`) off the
// loadout's passives; it relaxes the two-handed-occupies-both-hands rule
// at setup. No runtime hook — equip legality is a static property, not an
// in-battle behavior, so it lives as an ability-definition flag rather
// than on the closed runtime hook surface. `hooks: []` accordingly.
//
// Cost-2 Support in v1 (per the concept-notes ability-budget model):
// innate (free) on the Templar; cross-class costs 2 of the 3 Support
// capacity. The dual-two-hander combo needs Monkeygrip (2) + Two Weapons
// (3) = 5 against a 3(+1 accessory) budget, so it's reachable only by a
// class that has one half innate — see templar-concept-notes "Build
// interactions".

import {
  abilityId,
  bucketId,
  type PassiveAbilityDefinition,
} from '@engine/index.ts';

export const monkeygrip: PassiveAbilityDefinition = {
  id: abilityId('monkeygrip'),
  name: 'Monkeygrip',
  kind: 'passive',
  bucket: bucketId('support'),
  baseCost: 2,
  availability: 'available',
  hooks: [],
  relaxesTwoHandedGrip: true,
};
