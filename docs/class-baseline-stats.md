# Class Baseline Stats

A clean summary of each class's baseline stats — the values a unit has
*before* any equipment, abilities, statuses, or class traits modify them.

## Calibration anchor

All five classes are tuned to a single reference level, **L25**. There is
**no level-based stat-generation curve in the implementation** — units do
not carry a `level` field, and no curve function generates stats above or
below L25. Every unit in v1 is implicitly L25, and the values below are
authored directly.

A future progression curve is anticipated (`docs/mage-war-content-spec.md`
notes the L25 targets "should be defined to produce these values at L25,
linear-ish progression from L1; specific coefficient choices left to
implementation") — but it is **deferred and unbuilt**. When it lands,
Move/Jump and Evasion are intended to stay flat across levels; only the
numeric stats (HP, MP, PA, MA, Speed) would scale.

## Numeric base stats (L25)

| Class | HP | MP | PA | MA | Speed |
|---|---|---|---|---|---|
| **Knight** | 144 | 20 | 11 | 4 | 9 |
| **Earth Mage** | 112 | 60 | 4 | 12 | 8 |
| **Water Mage** | 102 | 60 | 4 | 12 | 10 |
| **Fire Mage** | 97 | 60 | 4 | 13 | 9 |
| **Lightning Mage** | 87 | 60 | 4 | 14 | 9 |

HP/MP here are the stored `maxHpBase` / `maxMpBase` baselines; effective
max HP/MP are computed on read (base + equipment + class + free-passive
contributions).

## Movement, evasion, resistances

| Class | Move | Jump | Evasion (F/S/B) | Baseline resistances |
|---|---|---|---|---|
| **Knight** | 3 | 2 | 0 / 0 / 0 | — none — |
| **Earth Mage** | 3 | 3 | 8 / 5 / 0 | Lightning +50, Fire −50 |
| **Water Mage** | 4 | 3 | 10 / 6 / 0 | Fire +50, Lightning −50 |
| **Fire Mage** | 3 | 3 | 6 / 4 / 0 | Earth +50, Water −50 |
| **Lightning Mage** | 4 | 3 | 7 / 4 / 0 | Water +50, Earth −50 |

Evasion is per-facing (front / side / back), percentages on the [0, 99]
scale. Baseline resistances are signed percentages (capped ±100). The four
mages form the elemental wheel; the Knight has no elemental affinity.

All five classes can enter `ground`, `water_shallow`, and `water_deep`
terrain (water is universally enterable — the movement cost is the
tactical gate, not access). All five equip into all five slots
(left hand, right hand, headgear, armor, accessory).

## Shared placement defaults (not class-differentiated)

These are uniform across all v1 units — set per-placement, not per-class:

| Stat | Value | Notes |
|---|---|---|
| Brave | 70 | Brave_factor 0.70; team-builder range 40–90 |
| Faith | 70 | Faith_factor 0.49 (0.7 × 0.7) for symmetric magical interactions |
| Crit chance | 5% | engine-clamped to [0, 100] |
| Crit multiplier | 1.5× | applied on top of all other multipliers |

## Sources of truth

- **Numeric base stats** — `src/content/classes/baseline-stats.ts` (the
  `classBaselineStats` map; battle configs consume it, they do not
  re-declare the values). Re-exported from `src/content/classes/index.ts`.
- **Movement / evasion / resistances / slots** — the per-class
  `ClassDefinition` files in `src/content/classes/`.
- **Shared placement defaults** (Brave / Faith / crit) — `SHARED_STAT_DEFAULTS`
  in `src/content/battles/demo.ts`; not class-differentiated.
- **Calibration intent** — `docs/mage-war-content-spec.md` §1 ("Class
  baselines at L25").
