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
// (story and skirmish alike). PLACEHOLDER (D-econ-6).
export const GIL_PER_ENEMY_LEVEL = 10;

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

// Per-item price overrides (keyed by item id as a plain string). Empty today
// — this is the seam the real pricing pass fills in. PLACEHOLDER.
export const ITEM_PRICE_OVERRIDES: Readonly<Record<string, number>> = {};
