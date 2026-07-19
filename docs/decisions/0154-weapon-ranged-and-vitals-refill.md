# ADR-0154: Weapon-delivered ⇒ weapon-ranged; vitals follow max out of battle

**Status:** Accepted (2026-07-18, Session 96 — same-day Ch1 playtest batch)

**Context:** Two Chris reports from the continuing Chapter 1 playtest.

## 1. Weapon-delivered abilities are ALWAYS weapon-ranged (design ruling)

An enemy Hunter wielding only a Dagger hit at several tiles with Charged
Attack. Intent: the Hunter's Marksmanship skills and the Knight's Battle
Skills derive their reach from the equipped weapon, not a fixed band.

**The mechanism already existed** — Session 45's weapon-range fork in
`computeAbilityRange`, gated on `isWeaponDelivered` (a `'weapon'` damage
tag or ability tag — the "weapon-ranged" marker Chris asked about is this
existing tag, no new field needed). The gap was the fallback: the fork read
the weapon's range only when the weapon *declared* one, and a rangeless
weapon fell back to the **ability's authored band** — Charged Attack and
Pin Down author a bow-flavored `h5 / min2 / arc`, so a Dagger (or bare
hands) inherited a 5-tile reach.

**Ruling:** weapon-delivered ⇒ weapon-ranged, unconditionally. Declared
weapon range (bows 2-5) → that band, including its dead zone; rangeless
weapon or unarmed → `MELEE_WEAPON_RANGE` (h1 / v3, **no** dead zone — the
authored `minHorizontal` belongs to the ranged delivery, not the stab).
The authored bands on the two bow-flavored abilities remain as
documentation only and are never the live reach. Affected in practice:
`charged_attack` and `pin_down` with non-bow weapons (every other
weapon-delivered ability was already authored at melee — the change also
means a bow-wielding Knight's Battle Skills reach 2-5, which is the
intended "both ways" of weapon-ranged). Scramble is untouched — its range
is the hop, not a swing. One seam (`computeAbilityRange`) feeds
validation, AI, forecast, and the target overlay alike; tooltips now say
"weapon range" instead of numbers true for one weapon class.

## 2. Out-of-battle max changes re-normalize stored vitals (bug fix)

Equipping a Padded Jacket (+15 MaxMP) in Manage Roster left Chris at his
old 6 current MP at the next battle. The between-battles invariant is
"roster units sit at effective full" (apply-back heals to full; the fold
only clamps DOWN) — but the heal is computed with the gear worn *at battle
end*, so any later mutation that moves a max (equip/unequip, reclass onto
different curves) stranded the stored vitals at the stale full.

**Fix:** `refillVitalsToEffectiveFull` (canonical-probe-based; the
invalid-loadout contract matches `debugGrantLevel` — unprobeable units
pass through and catch up at the fold clamp) now runs at every seam that
can move a max out of battle: `equipItem`, `unequipItem`, the Formation
gear UI's apply, and `reclassUnit`. Preview/try-on paths stay bare.
Works both directions: a +MaxMP piece tops current MP up; removing it
pulls current down to the new max.

**Attrition-carry note:** these seams assume the current full-heal model.
If wounds ever persist between battles, this refill is exactly where
"a gear swap must not be a free heal" gets decided — flagged in vitals.ts.
