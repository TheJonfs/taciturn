// TABA M2 progression — the production component-cost catalog (~110 entries).
//
// The real JP costs from `docs/TABADesign/m2-jp-costing-budget.md`, entered as
// data (the content half of ADR-0138). Every ability/item/math-component a
// unit can unlock, with its cost and native class. Verified id-by-id against
// the catalog + `docs/content-id-registry.md`; per-class sums are asserted in
// `component-catalog-data.test.ts` against the budget doc's near-master totals.
//
// `nativeClass` fixes the (half, tier) slot the cost accrues to for tier-
// gating AND the class the JP is spent from (per-class pools). Every passive is
// exportable — the enabler passives (Expert Former, Mathematician) equip
// anywhere once unlocked, just inert without their Command Set.
//
// NOTE: the four `mathParameter` + four `mathValue` tokens are Calculator
// COMPONENTS, not catalog abilities — their ids are the closed
// MathSkillParameter / MathSkillValue literals. The content-half combinator
// wiring (filtering the Calculator picker by these unlocks) is separate; this
// file only prices them.

import {
  abilityId,
  classId,
  itemId,
  type MathSkillParameter,
  type MathSkillValue,
} from '@engine/index.ts';
import { buildComponentCatalog, type ComponentMeta } from './component-catalog.ts';

// Compact constructors so the ~110 rows read as a cost table.
function a(id: string, cost: number, nativeClass: string): ComponentMeta {
  return { token: { kind: 'ability', id: abilityId(id) }, cost, nativeClass: classId(nativeClass) };
}
function item(id: string, cost: number, nativeClass: string): ComponentMeta {
  return { token: { kind: 'item', id: itemId(id) }, cost, nativeClass: classId(nativeClass) };
}
function mparam(id: MathSkillParameter, cost: number): ComponentMeta {
  return { token: { kind: 'mathParameter', id }, cost, nativeClass: classId('calculator') };
}
function mval(id: MathSkillValue, cost: number): ComponentMeta {
  return { token: { kind: 'mathValue', id }, cost, nativeClass: classId('calculator') };
}

export const COMPONENT_ENTRIES: ReadonlyArray<ComponentMeta> = [
  // Monk — physical:1 — 1750
  a('bears_heave', 100, 'monk'),
  a('serpents_coil', 150, 'monk'),
  a('foxfire', 150, 'monk'),
  a('storm_stoop', 150, 'monk'),
  a('chakra', 300, 'monk'),
  a('barehanded', 200, 'monk'),
  a('vigilance', 300, 'monk'),
  a('counterpunch', 400, 'monk'),

  // Geosage — magical:1 — 1800
  a('earth_strike', 100, 'earth_mage'),
  a('earth_blessing', 200, 'earth_mage'),
  a('earth_curse', 150, 'earth_mage'),
  a('earth_quake', 250, 'earth_mage'),
  a('earth_cataclysm', 300, 'earth_mage'),
  a('earth_resilience', 150, 'earth_mage'),
  a('bedrock_stride', 200, 'earth_mage'),
  a('earth_communion', 450, 'earth_mage'), // Biomastery — capped at Conductor parity

  // Pyromancer — magical:1 — 1850
  a('fire_strike', 100, 'fire_mage'),
  a('spark', 100, 'fire_mage'), // Slow Burn
  a('fire_storm', 200, 'fire_mage'), // Fireball
  a('fire_embrace', 150, 'fire_mage'), // Inner Warmth
  a('flame_lance', 300, 'fire_mage'),
  a('aether_bloom', 300, 'fire_mage'),
  a('ignition', 200, 'fire_mage'),
  a('hotfoot', 350, 'fire_mage'),
  a('smolder', 150, 'fire_mage'),

  // Hydrologist — magical:1 — 1550
  a('water_strike', 100, 'water_mage'),
  a('brine', 150, 'water_mage'),
  a('tide_surge', 200, 'water_mage'), // Rapids Rush
  a('tidal_wave', 200, 'water_mage'),
  a('maelstrom', 300, 'water_mage'),
  a('flow_state', 250, 'water_mage'),
  a('tidal_pull', 200, 'water_mage'),
  a('tidewalker', 150, 'water_mage'),

  // Alchemist — physical:1 — 1350
  item('potion', 100, 'alchemist'),
  item('phoenix_down', 150, 'alchemist'),
  item('remedy', 150, 'alchemist'),
  item('ether', 200, 'alchemist'),
  a('combat_focus', 250, 'alchemist'),
  a('field_kit', 250, 'alchemist'), // Travel Preparations
  a('field_recovery', 250, 'alchemist'), // Healthy Stride

  // Hunter — physical:1 — 1350
  a('charged_attack', 100, 'hunter'),
  a('pin_down', 200, 'hunter'),
  a('scramble', 100, 'hunter'),
  a('eagle_eye', 300, 'hunter'),
  a('vantage', 300, 'hunter'),
  a('high_jump', 200, 'hunter'),
  a('updraft', 150, 'hunter'),

  // Aethurge — magical:2 — 1950
  a('lightning_strike', 100, 'lightning_mage'),
  a('magnetic_mark', 150, 'lightning_mage'),
  a('static_embrace', 150, 'lightning_mage'),
  a('chain_lightning', 200, 'lightning_mage'),
  a('storm_caller', 450, 'lightning_mage'), // Megavolt
  a('conductor', 450, 'lightning_mage'),
  a('discharge', 250, 'lightning_mage'),
  a('quickstep', 200, 'lightning_mage'),

  // Knight — physical:2 — 1450
  a('power_attack', 100, 'knight'),
  a('bull_rush', 150, 'knight'),
  a('lightning_stab', 150, 'knight'),
  a('counter', 400, 'knight'),
  a('bravestrider', 200, 'knight'),
  a('martial_expertise', 450, 'knight'),

  // Thief — physical:2 — 1600
  a('steal_hp', 100, 'thief'),
  a('steal_mp', 150, 'thief'),
  a('steal_buffs', 250, 'thief'),
  a('steal_heart', 300, 'thief'),
  a('slip_free', 200, 'thief'),
  a('momentum', 300, 'thief'),
  a('move_plus_2', 300, 'thief'),

  // Enchanter — magical:2 — 1750
  a('enchant_protect', 100, 'enchanter'),
  a('enchant_shell', 150, 'enchanter'),
  a('esuna', 150, 'enchanter'),
  a('enchant_haste', 250, 'enchanter'),
  a('short_charge', 400, 'enchanter'),
  a('aura_mastery', 300, 'enchanter'),
  a('resistance_save', 200, 'enchanter'),
  a('float', 200, 'enchanter'),

  // Templar — hybrid:2 — 1400
  a('jump', 100, 'templar'),
  a('cure', 200, 'templar'),
  a('raise', 300, 'templar'),
  a('emissary', 250, 'templar'), // Emissary of Murond
  a('unified_calling', 150, 'templar'),
  a('monkeygrip', 200, 'templar'),
  a('faithstrider', 200, 'templar'),

  // Terraformer — hybrid:2 — 1800
  a('pillar', 100, 'terraformer'),
  a('pit', 100, 'terraformer'),
  a('hill', 300, 'terraformer'),
  a('valley', 300, 'terraformer'),
  a('barrier', 200, 'terraformer'),
  a('damage_split', 400, 'terraformer'),
  a('ignore_height', 200, 'terraformer'),
  a('expert_former', 200, 'terraformer'), // enabler — inert without Worldcraft, but equippable

  // Assassin — physical:3 — 1550
  a('undermine', 150, 'assassin'),
  a('sow_doubt', 150, 'assassin'),
  a('blowdart', 100, 'assassin'),
  a('shadow_stitch', 350, 'assassin'),
  a('speed_save', 200, 'assassin'),
  a('two_weapons', 400, 'assassin'),
  a('fleet_of_foot', 200, 'assassin'),

  // Calculator — magical:3 — 2400 (payloads + parameters + values + R/S/M)
  a('precision_fire', 100, 'calculator'),
  a('targeted_treatment', 150, 'calculator'),
  a('sculpted_enhancement', 200, 'calculator'),
  a('engineered_defenses', 200, 'calculator'),
  a('exact_rhythm', 200, 'calculator'),
  mparam('ct', 150), // Current CT
  mparam('level', 150),
  mparam('height', 100),
  mparam('current_hp', 100),
  mval('prime', 150),
  mval(3, 100),
  mval(4, 75),
  mval(5, 75),
  a('mathematician', 200, 'calculator'), // enabler — inert without Math Skill, but equippable
  a('thoughtful_pacing', 250, 'calculator'),
  a('cornered_focus', 200, 'calculator'),
];

export const COMPONENT_CATALOG = buildComponentCatalog(COMPONENT_ENTRIES);
