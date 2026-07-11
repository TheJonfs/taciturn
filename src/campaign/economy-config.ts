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
