# Chapter 1 gear — availability & cost plan (finalized first pass)

*Maps the Ch1 equipment pool (`taba-equipment-lineup.md` §Ch1) to the Ch1 node layout, with availability
waves and stub costs. Feeds the economy content pass (`firstAvailableAt` per item; `ITEM_PRICE_OVERRIDES`).
**Costs are placeholders** — rough relative-tier stubs for a future balance/tuning pass (`D-econ-6`).*

---

## The model — two gating axes

Ch1 is a **single gear generation** (~L5–10), so there's no power-tier gating *within* the chapter.
Availability is gated on two separable axes:

- **Hub** — *where* you buy (the four commerce locations; the only purchase points).
- **Wave** — *when* an item enters that hub's stock. `firstAvailableAt` is per-item, so a hub's stock
  **grows** across the chapter as later beats unlock it.

**Hubs:** Zarghidas (0), Alvera (2), Zelmonia Castle, Fort Cator (5).
**Back-half refresh triggers:** clearing **Old Ordal (7)** and **Mount Eska (8)** expand existing hubs'
stock — giving nodes 6–10 real "new gear in town" moments without a back-half hub. Return-travel makes the
trip back painless; nodes 9–10 play in quick succession, so the refreshes land just before the finale run.

**Pacing that falls out:** gear access tracks roster growth (Lumen/Chris start · Clio@2 · Thessaly@4 ·
Sera@6), then the back half deepens *existing* hubs rather than opening new ones — "use and upgrade your
toolkit," on-theme with Ch1's pedagogical job.

*Prices below are placeholder gil, banded by role (basics ~150–300 · standard ~300–500 · premium
~500–700), anchored to the ~500-gil "baseline item" from the S88 income probe. Relative ordering is the
signal; absolute values await the tuning pass.*

---

## Zarghidas Trade City — Node 0 (from start)

The universal starter kit; outfits the mixed opening party.

| Item | Slot | Stub ¢ |
|---|---|---|
| Iron Sword | sword | 200 |
| Woodman's Axe | axe | 220 |
| Short Bow | bow | 200 |
| Dagger | knife | 180 |
| Padded Vest | body · univ | 200 |
| Padded Jacket | body · univ | 220 |
| Guard Cap | head · univ | 150 |
| Lookout's Hood | head · univ | 160 |
| Buckler | off · univ | 150 |
| Talisman of Warding | off · univ | 160 |
| Lightfoot | acc | 200 |
| Diamond Bracelet | acc | 220 |

> **Start-loadout note (Q1):** the element wands are **handed to the mage units at campaign start** (Lumen
> gets Wand of Lumen; magic-side generics get their matching wands) — a *granted starting loadout*, not
> shop stock. So nobody must *buy* a wand until they branch into a class they didn't start in. The wands'
> *shop* availability is still Alvera (below). This is a starting-loadout authoring detail: the campaign-
> start roll must give class-appropriate weapons (a Pyromancer generic starts with a fire wand, not an Iron
> Sword) — worth a line in the Ch1 content notes.

## Alvera Village — Node 2 (the magic town; Clio joins)

The caster hub — stock expands twice in the back half.

**Wave 1 — unlock (Node 2):**

| Item | Slot | Stub ¢ |
|---|---|---|
| Wand of the Depths (water) | wand | 400 |
| Wand of the Deepwood (earth) | wand | 400 |
| Wand of Lumen (fire) | wand | 400 |
| Linen Robe | body · mag | 350 |
| Pointy Hat | head · mag | 250 |
| Tricorn | head · mag | 220 |
| Focus Band | head · univ | 250 |
| Livre of Urgency | off · mag | 300 |
| Battle Dictionary | off · mag | 320 |
| Arcane Lens | acc | 280 |
| Capacitor Ring | acc | 280 |
| Talisman of Conviction | off · univ | 200 |

**Refresh — Old Ordal (Node 7) clear:** premium caster power as the mages mature.

| Item | Slot | Stub ¢ |
|---|---|---|
| Staff of Abundance | staff | 600 |
| Tome of Power | off · mag | 450 |

**Refresh — Mount Eska (Node 8) clear:** the all-res generalist robe as the hardest fights loom.

| Item | Slot | Stub ¢ |
|---|---|---|
| Arcane Robe | body · mag | 450 |

## Zelmonia Castle — hub (the armory; Heavy lane)

Small by design — Heavy is skeletal in Ch1, Chris the lone early customer. All at unlock.

| Item | Slot | Stub ¢ |
|---|---|---|
| Chain Shirt | body · Heavy | 500 |
| Steel Helm | head · Heavy | 350 |
| Warrior's Aegis | off · Heavy | 400 |

## Fort Cator — Node 5 ("Sword Town")

Lean, now that the strong flat accessories left for Ch2. All at unlock.

| Item | Slot | Stub ¢ |
|---|---|---|
| Cutlass | sword | 300 |
| Augmentor | acc | 300 |
| Purifier | acc | 280 |

---

## Uniques (found, keyed to beats)

| Unique | Beat / node | Recipient | Teaches |
|---|---|---|---|
| **Pendant of Lumara** | early Lumen beat (~Node 0–1) | Lumen | fire/Burn build, early |
| **Flametongue** | **Node 3 (Zelmonia Hills)** — mid-chapter antagonist fight | Chris | element-wheel; combos with Lumen's Burn |
| **Freelancer's Charm** | **after Node 8 (Mount Eska)** — the antagonist rematch | any | breadth-is-rewarding (pre-Magus-Crown) |

The Pendant → Flametongue arc (nodes 1→3) delivers the chapter's fire-synergy lesson (Lumen + Chris) for
free. Freelancer's Charm lands after Node 8, once classes are unlocked and breadth *means* something — and
it shares the Node 8 beat with the Arcane Robe refresh, making Mount Eska a rich "back in force" milestone.

## Moved to Chapter 2 (not Ch1)

**Gauntlet of Might · Mantle of Protection** — the strong flat accessories, held for Ch2 (per Chris). They
leave Fort Cator's Ch1 stock entirely.

---

## Availability summary (for the economy content pass)

| Trigger | Hub | Unlocks |
|---|---|---|
| Campaign start | Zarghidas | starter kit (12); + wands *granted* to mage units |
| Node 2 clear | Alvera | caster wave 1 (12) |
| Zelmonia Castle reached | Zelmonia | Heavy lane (3) |
| Node 5 clear | Fort Cator | Cutlass + 2 acc (3) |
| **Node 7 clear** | Alvera | Staff of Abundance, Tome of Power |
| **Node 8 clear** | Alvera | Arcane Robe; + Freelancer's Charm *(found)* |

**Not yet placed / deferred:** cost tuning pass (all prices above are stubs); Ch2 assignment of Gauntlet +
Mantle. **All Ch1 buyables are now accounted for.**
