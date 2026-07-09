// Mage War equipment regression pin (TABA M3 Stage 0 — equipment brief D1).
//
// Mage War's lineup is a validated, shipped showcase and is FROZEN: the TABA
// equipment expansion must not add to, remove from, or re-tune it. The team
// builder's `AVAILABLE_EQUIPMENT` filter is the single gate between the global
// item catalog and the Mage War product, so pinning its exact output pins the
// product's item pool.
//
// If this test fails, a TABA item leaked into Mage War (it was authored
// `availability: 'available'` — make it 'hidden'), or a Mage War item was
// removed/hidden. Either is a D1 violation; do NOT update the pin without an
// explicit decision that Mage War itself is changing.

import { describe, expect, it } from 'vitest';
import { AVAILABLE_EQUIPMENT } from './team-builder-state.ts';

// The frozen set as of 2026-07-09 (pre-expansion): 75 equipment items.
const FROZEN_MAGE_WAR_EQUIPMENT_IDS: ReadonlyArray<string> = [
  'absolom',
  'arcane_lens',
  'augmentor',
  'barbut',
  'battle_dictionary',
  'battle_gear',
  'battlemages_chain',
  'bolt_hammer',
  'boots_of_haste',
  'buckler',
  'capacitor_ring',
  'chefs_knife',
  'circlet',
  'crusaders_helm',
  'dark_robe',
  'defender',
  'diamond_bracelet',
  'escutcheon',
  'flametongue',
  'focus_band',
  'gauntlet_of_might',
  'glove_of_metria',
  'golden_hairpin',
  'greaves_of_seraphis',
  'guard_cap',
  'imp_halberd',
  'ironfoot',
  'lance',
  'light_robe',
  'lightfoot',
  'livre_of_urgency',
  'long_sword',
  'longbow',
  'lookouts_hood',
  'magebane',
  'magus_crown',
  'managuard',
  'mantle_of_protection',
  'parrying_sword',
  'pendant_of_lumara',
  'pointy_hat',
  'purifier',
  'rasp_pendant',
  'ring_of_caliora',
  'riptide_bow',
  'sai',
  'scimitar',
  'shimmer_cloak',
  'silvered_vest',
  'skullclamp',
  'soldiers_leathers',
  'sorcerers_robe',
  'soul_vest',
  'spiked_mail',
  'staff_of_abundance',
  'staff_of_power',
  'steel_helm',
  'tactical_mask',
  'talisman_of_conviction',
  'talisman_of_warding',
  'the_offering',
  'tintinibar',
  'tome_of_power',
  'travel_garb',
  'tricorn',
  'twist_headband',
  'vicious_dagger',
  'wand_of_deepwood',
  'wand_of_depths',
  'wand_of_lumen',
  'wand_of_potential',
  'war_axe',
  'war_plate',
  'warriors_aegis',
  'wizards_robe',
];

describe('Mage War frozen equipment pool (D1 regression pin)', () => {
  it('the team-builder equipment pool is exactly the frozen 75-item set', () => {
    const actual = AVAILABLE_EQUIPMENT.map((e) => String(e.id)).sort();
    expect(actual).toEqual([...FROZEN_MAGE_WAR_EQUIPMENT_IDS]);
  });
});
