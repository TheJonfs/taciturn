// TABA equipment pool — the campaign-owned item-scoping manifest (M3 Stage 0).
//
// THE isolation mechanism between TABA's expanding gear roster and Mage War's
// frozen lineup (equipment brief D1/D1a). The rule:
//
//   - Items shared with Mage War keep `availability: 'available'` — Mage War's
//     team-builder filter (`AVAILABLE_EQUIPMENT` in ui/team-builder-state.ts)
//     is untouched and its pool is pinned by a snapshot test.
//   - TABA-only items are authored `availability: 'hidden'` — invisible to
//     Mage War by construction — and become reachable ONLY by appearing here.
//
// So the engine catalog stays product-agnostic (no campaign field on
// ItemDefinition); the campaign layer owns which items exist in TABA and from
// which chapter. Tests in equipment-pool.test.ts enforce both directions:
// every TABA-new id is hidden, and the Mage War–shared sections reconstruct
// the frozen Mage War set exactly (TABA's Ch2 anchor = Mage War, by identity).
//
// `chapter` is the FIRST chapter the item can appear in TABA (a demoted Ch2
// item has chapter 1). This doubles as the brief's interim chapter tagging so
// Ch3 gear doesn't leak into Ch1 testing. The full availability/economy pass
// (story-gated shop stock per location, costs, currency) is deferred — when it
// lands, it enriches these entries rather than replacing them.
//
// `acquisition` records the lineup doc's settled shop-vs-unique calls for
// items that already exist. Uniques are countable inventory (supply cap 1),
// not unit-locked; the acquisition *flow* (story pickups, boss rewards) is
// story/economy-pass work. Still-open unique fates (Defender unique-vs-shop,
// the Ch3 findable-unique slate, Tailored Outfit) are NOT represented here.

import { itemId, type ItemId } from '@engine/index.ts';

export type GearChapter = 1 | 2 | 3;
export type GearAcquisition = 'shop' | 'unique';

export interface TabaGearEntry {
  readonly itemId: ItemId;
  /** First chapter the item can appear in TABA. */
  readonly chapter: GearChapter;
  readonly acquisition: GearAcquisition;
}

const entry = (id: string, chapter: GearChapter, acquisition: GearAcquisition): TabaGearEntry => ({
  itemId: itemId(id),
  chapter,
  acquisition,
});

// --- Sections shared with Mage War (availability 'available'; frozen) -------

// Ch2 items demoted to Ch1 availability in TABA (a TABA-availability fact
// only — Mage War is untouched). Per the lineup doc's demotion tables.
export const MAGE_WAR_SHARED_DEMOTED_TO_CH1: ReadonlyArray<TabaGearEntry> = [
  // weapons (element wands keep tier-agnostic identity; the lone stat-stick staff)
  entry('wand_of_depths', 1, 'shop'),
  entry('wand_of_deepwood', 1, 'shop'),
  entry('wand_of_lumen', 1, 'shop'),
  entry('staff_of_abundance', 1, 'shop'),
  // heads
  entry('guard_cap', 1, 'shop'),
  entry('focus_band', 1, 'shop'),
  entry('lookouts_hood', 1, 'shop'),
  entry('steel_helm', 1, 'shop'),
  entry('pointy_hat', 1, 'shop'),
  entry('tricorn', 1, 'shop'),
  // off-hands
  entry('buckler', 1, 'shop'),
  entry('talisman_of_warding', 1, 'shop'),
  entry('talisman_of_conviction', 1, 'shop'),
  entry('tome_of_power', 1, 'shop'),
  entry('livre_of_urgency', 1, 'shop'),
  entry('battle_dictionary', 1, 'shop'),
  entry('warriors_aegis', 1, 'shop'),
  // accessories
  entry('lightfoot', 1, 'shop'),
  entry('augmentor', 1, 'shop'),
  entry('diamond_bracelet', 1, 'shop'),
  entry('purifier', 1, 'shop'),
  entry('arcane_lens', 1, 'shop'),
  entry('capacitor_ring', 1, 'shop'),
];

// Ch1 uniques that already exist as Mage War items (settled: they *teach* —
// Pendant + Flametongue seed the fire/Burn discovery around Lumen + Chris).
export const MAGE_WAR_SHARED_CH1_UNIQUES: ReadonlyArray<TabaGearEntry> = [
  entry('pendant_of_lumara', 1, 'unique'),
  entry('flametongue', 1, 'unique'),
];

// Ch2 uniques (settled: build-warping scarcity — see lineup doc).
export const MAGE_WAR_SHARED_CH2_UNIQUES: ReadonlyArray<TabaGearEntry> = [
  entry('greaves_of_seraphis', 2, 'unique'),
  entry('ring_of_caliora', 2, 'unique'),
  entry('glove_of_metria', 2, 'unique'),
  entry('absolom', 2, 'unique'),
];

// The rest of the Mage War set: TABA's Ch2 shop anchor. (Defender stays shop
// pending its unique-vs-shop call — open-decisions register.)
export const MAGE_WAR_SHARED_CH2_SHOP: ReadonlyArray<TabaGearEntry> = [
  // weapons
  entry('long_sword', 2, 'shop'),
  entry('parrying_sword', 2, 'shop'),
  entry('scimitar', 2, 'shop'),
  entry('defender', 2, 'shop'),
  entry('war_axe', 2, 'shop'),
  entry('bolt_hammer', 2, 'shop'),
  entry('wand_of_potential', 2, 'shop'),
  entry('staff_of_power', 2, 'shop'),
  entry('chefs_knife', 2, 'shop'),
  entry('magebane', 2, 'shop'),
  entry('sai', 2, 'shop'),
  entry('vicious_dagger', 2, 'shop'),
  entry('longbow', 2, 'shop'),
  entry('riptide_bow', 2, 'shop'),
  entry('lance', 2, 'shop'),
  entry('imp_halberd', 2, 'shop'),
  // bodies
  entry('battle_gear', 2, 'shop'),
  entry('silvered_vest', 2, 'shop'),
  entry('travel_garb', 2, 'shop'),
  entry('shimmer_cloak', 2, 'shop'),
  entry('soul_vest', 2, 'shop'),
  entry('soldiers_leathers', 2, 'shop'),
  entry('war_plate', 2, 'shop'),
  entry('spiked_mail', 2, 'shop'),
  entry('battlemages_chain', 2, 'shop'),
  entry('wizards_robe', 2, 'shop'),
  entry('sorcerers_robe', 2, 'shop'),
  entry('light_robe', 2, 'shop'),
  entry('dark_robe', 2, 'shop'),
  // heads
  entry('twist_headband', 2, 'shop'),
  entry('golden_hairpin', 2, 'shop'),
  entry('skullclamp', 2, 'shop'),
  entry('tactical_mask', 2, 'shop'),
  entry('barbut', 2, 'shop'),
  entry('crusaders_helm', 2, 'shop'),
  entry('magus_crown', 2, 'shop'),
  entry('circlet', 2, 'shop'),
  // off-hands
  entry('escutcheon', 2, 'shop'),
  entry('managuard', 2, 'shop'),
  // accessories
  entry('boots_of_haste', 2, 'shop'),
  entry('tintinibar', 2, 'shop'),
  entry('rasp_pendant', 2, 'shop'),
  entry('the_offering', 2, 'shop'),
  entry('ironfoot', 2, 'shop'),
  entry('gauntlet_of_might', 2, 'shop'),
  entry('mantle_of_protection', 2, 'shop'),
];

// --- TABA-only sections (availability 'hidden'; never in Mage War) ----------
// Populated by the Stage 2–4 authoring batches.

export const TABA_NEW_CH1: ReadonlyArray<TabaGearEntry> = [
  // weapons (Stage 2a)
  entry('iron_sword', 1, 'shop'),
  entry('cutlass', 1, 'shop'),
  entry('woodmans_axe', 1, 'shop'),
  entry('short_bow', 1, 'shop'),
  entry('dagger', 1, 'shop'),
  // bodies (Stage 2a)
  entry('padded_vest', 1, 'shop'),
  entry('padded_jacket', 1, 'shop'),
  entry('chain_shirt', 1, 'shop'),
  entry('linen_robe', 1, 'shop'),
  entry('arcane_robe', 1, 'shop'),
];

export const TABA_NEW_CH2: ReadonlyArray<TabaGearEntry> = [];

export const TABA_NEW_CH3: ReadonlyArray<TabaGearEntry> = [];

// --- The assembled pool + reads ----------------------------------------------

export const MAGE_WAR_SHARED_ENTRIES: ReadonlyArray<TabaGearEntry> = [
  ...MAGE_WAR_SHARED_DEMOTED_TO_CH1,
  ...MAGE_WAR_SHARED_CH1_UNIQUES,
  ...MAGE_WAR_SHARED_CH2_UNIQUES,
  ...MAGE_WAR_SHARED_CH2_SHOP,
];

export const TABA_NEW_ENTRIES: ReadonlyArray<TabaGearEntry> = [
  ...TABA_NEW_CH1,
  ...TABA_NEW_CH2,
  ...TABA_NEW_CH3,
];

export const TABA_GEAR_POOL: ReadonlyArray<TabaGearEntry> = [
  ...MAGE_WAR_SHARED_ENTRIES,
  ...TABA_NEW_ENTRIES,
];

// The buyable pool as of a chapter (entries whose first chapter has arrived).
// Interim semantics pending the economy pass: everything unlocked-so-far is
// broadly available (no per-location story gating yet).
export function tabaShopPool(chapter: GearChapter): ReadonlyArray<TabaGearEntry> {
  return TABA_GEAR_POOL.filter((e) => e.acquisition === 'shop' && e.chapter <= chapter);
}

export function tabaGearEntry(id: ItemId): TabaGearEntry | undefined {
  return TABA_GEAR_POOL.find((e) => e.itemId === id);
}
