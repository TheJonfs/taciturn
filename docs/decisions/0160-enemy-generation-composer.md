# ADR-0160: Enemy party generation — the unified composer (loadouts, gear, archetypes)

**Status:** accepted (S99, 2026-07-22)

## Context

Generated enemies were barebones (M4 brief): the S94 enemy-kit framework
bought a JP-budgeted prefix of the class's *active* curriculum, but nothing
was ever **equipped** past First Action + innates — no secondary command
set, empty R/S/M buckets (silently: unequipped passives just never register
hooks) — and gear was a lone Dagger. The S89 gear-valuation module
(`rankItemsForUnit`) was built for exactly this consumer and sat unconsumed
(D-ai-3's ordering). Calibration (offset curve, `ENEMY_JP_PER_LEVEL`) was
blocked: numbers measured against barebones enemies are invalidated the
moment enemies fight for real.

## Decision

**One composer, three consumers.** `composeEnemyBuild` in
`src/campaign/enemy-generation.ts` produces a complete enemy build —
learned kit, populated loadout, gear — from `(classId, level, seed)` plus
optional authored overrides. All three generation consumers resolve through
it: skirmish parties (`generateSkirmishParty`), Cartographer auto/budget
kits, and story-lineup slots without an authored loadout
(`composeLineupEnemyDraft` routes every slot through the composer;
overridden halves replace their generated defaults wholesale). A generated
enemy is identical whichever door it comes through (test-pinned).

**Buy toward the loadout (WI2).**

- The JP budget buys the primary class's active curriculum first
  (authoring order, prefix discipline — S94 unchanged).
- Leftover budget diversifies into a seeded **pair class**, rolled
  uniformly from the canonical `CLASS_TIER_MAP` classes **at or below the
  primary's tier** (never above — no Tier-3 secondaries on a Ch1 grunt;
  the tier cap is this ADR's addition to Chris's "roll from the fourteen").
  One pair active bought ⇒ the pair's command set is wielded as the Second
  Action. White Magic and other non-canonical legacy sets are excluded by
  construction (the roll only sees the tier map).
- **Native-class R/S/M passives are free to equip in-class** — that is the
  existing player rule (`canEquipPassive`: the ComponentMeta cost is an
  *export tax*, free in the native class), so enemy R/S/M fill is parity,
  not budget spend: fill to capacity from the native curriculum in
  authoring order, then leftover budget pays export taxes on pair-class
  passives **only if they actually fit** (never convert budget into
  unequippable learning).
- Consequence worth naming: even an L1 enemy fields its class's native
  passives — the same power a player unit has from creation. The JP budget
  remains the legible dial for *actives* and cross-class reach.

**Same legality as the player.** Composition runs on the shared draft
resolver (`draftBucketCapacity`/`draftAbilityCost`/`validateDraftUnit`) —
no enemy-specific legality path. Gear is assigned *before* passive fill
because capacity is equipment-adjusted (Spiked Maul's −3 reaction just
leaves less to fill). Every fully-generated build must pass
`validateDraftUnit` (sweep-pinned).

**Gear: level-keyed, UNCLAMPED, via the S89 floor (WI3).**
`assignEnemyGear` (`src/campaign/enemy-gear.ts`) ranks pool candidates per
slot with `rankItemsForUnit` (profile: curve pa/ma + kit-derived usesMp).
The pool policy:

- `ENEMY_GEAR_BANDS` (economy-config, placeholder): L1–12 → Ch1, L13–24 →
  Ch2, L25+ → Ch3, **no story-chapter cap** — high-level enemies carry gear
  the player can't buy yet.
- In-band per-slot ramp (`ENEMY_GEAR_RAMP_START = 0.1`, `RAMP_LEVELS =
  12`): band entry ≈ one new-tier piece in ten slots, full pool by band
  end — no cliff at L12→13.
- **No uniques, ever** (`acquisition: 'unique'`) — the load-bearing filter
  under unclamped tiering; pinned by a class×level×seed sweep test.
- **No exotics**: a new campaign-side `exotic` flag on `TabaGearEntry`
  (equipment-pool.ts) marks items whose identity the S89 valuation floor
  deliberately doesn't score. Campaign-side, not an engine `ItemDefinition`
  field — the engine stays product-agnostic (equipment-pool's own charter).
  S99 flag set (Chris review pending): Prism Wand, Scouring Wand, Healer's
  Staff, Epee, Palliative Pike, Moon Robe, Terra Robe. Deliberately NOT
  flagged (floor-valued common patterns): Gaia's Axe, Star/Void Robe,
  variance-shape weapons, cast-speed items.
- Off-hand discipline: no second weapon without a dual-wield grant; no
  off-hand next to a two-handed grip (the UI-tier rules, same as Team
  Builder).

**Archetypes scope the cast (WI4).** `src/campaign/archetypes.ts`: an
archetype = weighted class pool + optional composition minimums (fail-soft
on starvation) + flavor label/name-prefix. A hand-authored node→archetypes
registry (Ch1 draft: Ordallian Patrol / Bandits / Hedge-Mages / Poachers)
plus a chapter-agnostic default for unmapped nodes. A skirmish rolls the
archetype, then the classes; unit names read "Bandit Monk". Ch1 pools
top out at Tier 2 — no Assassin/Calculator at any level (test-pinned,
class AND command sets). Atlas/Cartographer authoring for archetypes is
deferred until it chafes. Ch2/Ch3 registries are authored with those
chapters.

**Skirmish variance without reroll-scumming.** The skirmish seed is
`hash(nodeId, skirmish wins at that node)` — a new campaign-flag counter
(`skirmish_wins:<nodeId>`, bumped on skirmish wins in the battle-end
flow). Repeat farming meets a new party each win; save-reload never
rerolls (losses don't save), so the reload-risk governor and replay
determinism hold. Story-lineup slots use a *fixed* seed
(`lineupSlotSeed(key, index)`) — authored battles never shift under the
author; the placeholder story lineups seed off their node id and pull the
node's archetype.

## Addendum (S99 cont., same day): the gil purse

Chris's playtest check: full wardrobes on L1–2 enemies outpace the player's
own early-gil reality (and sharpen the Oskun +1-offset sting). Fix at the
gear layer, not the offsets (those wait for the calibration pass): the JP
dial's gil sibling. `ENEMY_GEAR_GIL_PER_LEVEL` (economy-config, placeholder
80) gives a level-L enemy `L × dial` gil for its armor slots at the same
`itemPrice` the player pays; the **weapon is free** (a class that can't
hold one — Monk — simply doesn't). Paid slots fill in priority order
(armor → headgear → off-hand → accessory) with the best AFFORDABLE piece
per slot, so a low-level enemy fields a weapon and a piece or two.
Test-pinned as a mechanism (paid spend ≤ purse; weapon free at L1; sparse
low / full high), not as exact counts — prices are D-econ-6 placeholders.

## Consequences

- **Global difficulty increase** — every generated enemy fights with a
  populated loadout and real gear. Zelmonia Hills and earlier nodes get
  harder. Per the brief: measure in the calibration pass, do NOT pre-tune
  offsets.
- The Cartographer's auto/budget kit display now comes from the composed
  draft (pair spillover included); `EnemyEditor` takes the lineup key to
  derive the fold's exact per-slot seed.
- `generatedEnemyUnit` moved from enemy-kit.ts to enemy-generation.ts
  (cycle avoidance); enemy-kit keeps the budget/prefix/Brave-Faith/basic-
  gear primitives.
- Steal/drops (gear as income), exotic AI valuation (the S89 ceiling), and
  archetype authoring UI stay out of scope (brief).
