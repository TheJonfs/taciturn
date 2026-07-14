// TABA economy — the ONE tunable-constants module (M3 economy brief).
//
// Every economic dial lives here so balance retunes without touching logic
// (brief: "config-centralized"). EVERY VALUE IS A PLACEHOLDER — the real
// coefficients are D-econ-6, pending balance data. Tune freely; nothing
// downstream hard-codes these.
//
// Constants land here stage-by-stage as the economy brief ships (Stage 0:
// currency; Stage 2: shop; Stage 3: recruitment), so an absent dial means
// its stage hasn't landed, not that it lives elsewhere.

// --- Stage 0: currency + reward wiring ---

// X in the gil award `gil = X × Σ(enemy_levels)` paid once per battle win
// (story and skirmish alike). PLACEHOLDER (D-econ-6); doubled 10 → 20 in
// S94 batch three (Chris: 10/level reads too lean in the early game).
export const GIL_PER_ENEMY_LEVEL = 20;

// S94 — the enemy kit framework's one dial: a generated level-L enemy has
// L × this much JP to "spend" down its class's component list (authoring
// order, stop at the first unaffordable — a coherent curriculum prefix).
// L2 ≈ two basics; L10 ≈ most of a Tier-1 tree. PLACEHOLDER; tune from
// playtest alongside the offset curve.
export const ENEMY_JP_PER_LEVEL = 100;

// The party's opening purse at campaign start. PLACEHOLDER (D-econ-6).
export const STARTING_GIL = 0;

// --- Stage 2: shops ---

// Sell-back rate (D1): the shop buys at this fraction of the buy price,
// floored — forgiving of mistakes (no equip-undo exists) without being
// exploitable. PLACEHOLDER refinement pending, but ~0.5 is the settled call.
export const SELL_RATE = 0.5;

// The flat buy price for any stocked item without an override — PLACEHOLDER
// (D-econ-6; real per-item pricing arrives with balance data).
export const DEFAULT_ITEM_PRICE = 500;

// Per-item price overrides (keyed by item id as a plain string). Ch1 stub
// prices per taba-ch1-gear-bundles.md — banded by role (basics ~150–300 ·
// standard ~300–500 · premium ~500–700), anchored to the ~500-gil baseline
// from the S88 income probe. RELATIVE ORDERING is the signal; absolute
// values are PLACEHOLDER pending the tuning pass (D-econ-6).
export const ITEM_PRICE_OVERRIDES: Readonly<Record<string, number>> = {
  // Zarghidas starter kit
  iron_sword: 200,
  woodmans_axe: 220,
  short_bow: 200,
  dagger: 180,
  padded_vest: 200,
  padded_jacket: 220,
  guard_cap: 150,
  lookouts_hood: 160,
  buckler: 150,
  talisman_of_warding: 160,
  lightfoot: 200,
  diamond_bracelet: 220,
  // Alvera caster wave 1
  wand_of_depths: 400,
  wand_of_deepwood: 400,
  wand_of_lumen: 400,
  linen_robe: 350,
  pointy_hat: 250,
  tricorn: 220,
  focus_band: 250,
  livre_of_urgency: 300,
  battle_dictionary: 320,
  arcane_lens: 280,
  capacitor_ring: 280,
  talisman_of_conviction: 200,
  // Zelmonia Castle armory (Heavy lane)
  chain_shirt: 500,
  steel_helm: 350,
  warriors_aegis: 400,
  // Fort Cator ("Sword Town")
  cutlass: 300,
  augmentor: 300,
  purifier: 280,
  // Alvera back-half refreshes
  staff_of_abundance: 600,
  tome_of_power: 450,
  arcane_robe: 450,
};

// --- Stage 3: recruitment ---

// The hire-cost curve `cost(L) = BASE + PER_LEVEL × L` — a linear PLACEHOLDER
// (D-econ-6-adjacent); the convenience premium is the CAP (never above party
// average), not the price shape.
export const HIRE_COST_BASE = 200;
export const HIRE_COST_PER_LEVEL = 60;

// Tier-1 JP signing bonus by hire level: the highest step at or below the
// chosen level applies, banked into the hire's (Tier-1) class pool so a
// high-level hire arrives functional, not a stat-shell — the tree itself
// stays earned. PLACEHOLDER steps.
export const HIRE_JP_TIER1_STEPS: ReadonlyArray<{
  readonly minLevel: number;
  readonly jp: number;
}> = [
  { minLevel: 10, jp: 200 },
  { minLevel: 20, jp: 500 },
  { minLevel: 30, jp: 900 },
];
