# Brief — Enemy party generation: loadouts, gear, and archetypes

*Status: plaintext review by Chris before it ships to CC. This is **the M4 generator upgrade** queued since
S88 ("replace `generateSkirmishParty(level, count, catalog)`; nothing else moves") and the consumption of
the S89 gear-valuation module built for exactly this (D-ai-3: AI values gear first, generator consumes it
— that ordering now cashes in). Audit-first; file paths are inferences to correct.*

---

## Context

Generated enemies are currently **barebones**: locked to a minimal equipment configuration, and their JP
spend likely never reaches a **loadout**. That last point is the sharp one — per `ability-slots.md`,
*learning* an ability (JP) and *equipping* it (buckets) are architecturally separate. A unit with learned
abilities but an empty loadout still acts (First Action is class-determined, learned actions available) but
has **no secondary command set and no passives at all** — up to 9 points of Reaction/Support/Movement
capacity sitting empty. And it fails **silently**: unequipped passives simply never register hooks, so
nothing errors; the enemy is just quietly missing most of the competence the S89 AI work assumed.

Three things follow: enemies need loadouts, enemies need gear, and skirmish parties need composition.

**Why now:** calibration is blocked on it. Offset-curve and `ENEMY_JP_PER_LEVEL` numbers measured against
barebones enemies are invalidated the moment enemies carry gear and deploy abilities — so this lands
*before* the Zelmonia Hills / Oskun / Alvera calibration pass.

## Settled design decisions

- **One composer, three consumers.** Skirmish generation, Cartographer auto/budget mode, and story-battle
  lineups that don't specify a loadout must all resolve through the *same* composer. (Partial convergence
  exists: `generatedEnemyUnit` was extracted from the skirmish stub for Cartographer Tier 2, and
  `composeLineupEnemyDraft` is the shared fold/editor/validation composer — the audit establishes whether
  these are one path or two, and unifies.)
- **Loadout: learned = equipped wherever it fits.** No deliberate under-equipping.
- **Budget is the difficulty dial.** `ENEMY_JP_PER_LEVEL` (the JP budget) is *the* knob; a smaller budget
  means visibly fewer abilities in play, which is **legible**. Secret under-equipping would weaken enemies
  for reasons the player can't perceive — rejected.
- **Gear: level-keyed, UNCLAMPED** (FFT-style). Enemy gear tier derives from enemy level with no
  story-chapter cap, so high-level enemies can carry gear the player can't yet buy — the peek-at-the-future
  thrill. Accepted rationale: a party grinded to Ch3 levels in Ch1 has already opted out of the difficulty
  curve; the *level* gap is the imbalance, not the gear.
- **Two hard gear exclusions** (both load-bearing under unclamped):
  - **No uniques, ever.** Single-instance, receipt/`grantItems`-gated; generation minting one would corrupt
    the uniqueness invariant outright. Unclamped level-keying makes the Ch3 tier reachable, so this filter
    is now *required*, not tidy.
  - **No exotic/marquee effect items.** S89's gear valuation shipped as a **floor** (stat gear + common
    effect patterns), explicitly not exotic optimization — so Del's Stave, Golden Rod, Volley Bow, Prism
    Wand, Scouring Wand and friends stay off generated enemies. An enemy misusing an exotic is a *worse*
    encounter, not a harder one. (This brief thereby **partially lifts** the standing "keep effect weapons
    off enemy loadouts" deferral: common effects in, exotics still out.)
- **Archetypes scope the class pool by location.** Archetype supplies the *cast* (flavor/location); level
  supplies the *power*. Ch1 locations draw a tight pool (e.g. Archers, Monks, Hunters, occasional Knight/
  Thief — **never an Assassin**); Ch2+ pools open up as the player's own class access broadens, so the
  gating mostly does its work early and relaxes naturally.
- **Determinism preserved.** Generation stays seeded — same (seed, inputs) → same party, so replays hold.

## Goal

Generated enemies that fight like real units: a coherent party of level-appropriate, location-appropriate
classes, each with abilities bought *and equipped*, carrying gear the AI can actually use — through one
composer shared by skirmishes, Cartographer, and story-battle defaults.

---

## WI1 — Unify the composer (audit + converge)

Establish whether skirmish generation and the Cartographer auto/budget path are one code path or two;
converge on a single composer taking roughly `(classId, level, seed, gearPool, context)` and returning a
complete enemy unit (stats, learned abilities, **loadout**, gear). All three consumers call it. Report what
already existed.

## WI2 — Loadout deployment (the silent gap)

After the JP budget buys abilities, **equip them**: fill the Second Action bucket with the best available
command set and the Reaction/Support/Movement buckets to capacity, using the real `getCapacity`/`getCost`/
`validate` surface — the same resolver the player's loadouts use (three-resolver discipline: no
enemy-specific legality path).

**Buy toward the loadout.** The current `enemy-kit.ts` curriculum prefix buys in authoring order, which
predates equipping — so it can spend budget on abilities that can't be deployed (e.g. more Support passives
than the bucket's capacity 3 can hold). The buy policy should prefer abilities the unit can actually equip,
so budget converts to fielded capability rather than dead learning. Audit how far the current prefix policy
is from that; refine if cheap, flag if not.

## WI3 — Gear assignment (consume the S89 module)

Assign equipment via `rankItemsForUnit(catalog, pool, profile)` from `src/ai/gear-valuation.ts`
(`GearScoreProfile` = classId/pa/ma/usesMp), built for this and not yet consumed. The **pool** passed in is
where the policy lives:

- Pool = catalog items whose **tier is at or below the enemy's level band** (level-keyed, **no chapter
  cap**).
- **Minus uniques** (pool `unique`).
- **Minus the exotic/marquee effect items** (the S89 floor boundary — the audit should determine the cleanest
  discriminator: an explicit exclusion list, or a flag/tag on the items themselves. A tag is more durable —
  new exotics then exclude themselves.)
- Fill the slots the class can legally use (Monk's two-slot case, 2H rules, class restrictions) — via the
  shared draft-legality resolver, not a parallel check.

## WI4 — Archetypes + location scoping (skirmishes)

**Archetype** = a named, authorable record: a **weighted class pool** + optional **composition minimums**
(e.g. "≥1 frontline") + a flavor label. A skirmish first rolls an archetype for the location, then rolls
its units from that archetype's pool at the resolved enemy level.

- **Locations reference archetypes** (a node/region → eligible archetypes mapping). Lean: a hand-authored
  registry keyed by node/region for v1; Atlas/Cartographer authoring support **deferred until it chafes**
  (same discipline as the deferred beat-editor tier).
- Ch1 archetypes are tight and thematic ("Ordallian patrol", "bandits", "hedge-mages"); later chapters use
  broader pools.
- **Story battles are unaffected by archetypes** — their classes are authored (Cartographer Tier 2/3).
  What story battles *do* consume from this brief is the **loadout/gear default** (WI2/WI3) when a lineup
  specifies class+level without an explicit loadout.

---

## Acceptance criteria

- One composer serves all three consumers; a generated enemy is identical whether produced by a skirmish,
  Cartographer's auto mode, or a story lineup without an authored loadout.
- Generated enemies have a **populated loadout**: a Second Action command set and R/S/M passives filled to
  capacity from what the budget bought, passing the shared loadout validation.
- Generated enemies carry level-appropriate gear via `rankItemsForUnit`; **no unique ever appears** on a
  generated enemy (pin this with a test — it's an invariant, not a preference); no exotic/marquee effect
  items appear.
- A skirmish at a Ch1 location rolls only that location's archetype classes (test: no Assassin/Calculator in
  a Ch1 skirmish at any level); composition minimums hold.
- **Determinism pinned:** same seed + inputs → byte-identical party (replay safety).
- Suite green, `tsc -b` clean.

## Out of scope

- **Steal-equipment / enemy loot drops** — the acquisition half of the level-scaled-gear mechanic doesn't
  exist yet (no persistent-inventory-era steal was built). Noted as a future design (drops-from-loadout in
  particular would become a gear *income* stream and would want an economy-framework look).
- **Exotic-item AI valuation** (the ceiling S89 deferred) — until that lands, exotics stay off enemies.
- **Atlas/Cartographer authoring UI for archetypes** (registry-authored for v1).
- **Re-tuning the offset curve / `ENEMY_JP_PER_LEVEL`** — that's the calibration pass *after* this lands.

## Files (audit to confirm — inferences)

- `src/campaign/skirmish.ts` — `generateSkirmishParty` (the M4 seam being replaced) + `generatedEnemyUnit`.
- `src/content/enemy-kit.ts` (or wherever `enemyKitForLevel` lives) — JP budget + curriculum prefix policy.
- `composeLineupEnemyDraft` / `enemiesFromLineup` — the Cartographer/story-lineup composer + consumer.
- `src/ai/gear-valuation.ts` — `rankItemsForUnit` (consume; likely unchanged).
- Loadout validation surface (`getCapacity`/`getCost`/`validate`/`equip`) — shared, not duplicated.
- `equipment-pool.ts` — tier/unique/exotic discriminators for the pool filter.
- New: archetype registry + location→archetype mapping.
- `campaign/economy-config.ts` — `ENEMY_JP_PER_LEVEL` and any new generation dials, marked placeholder.

## Workflow notes

- **Audit-first**, specifically: (1) are skirmish gen and Cartographer-auto one path or two; (2) do generated
  enemies equip loadout buckets *at all* today; (3) how far is the curriculum-prefix buy policy from
  buy-toward-loadout; (4) what's the cleanest exotic discriminator (list vs tag).
- Ship order: WI1 (unify) → WI2 (loadouts) → WI3 (gear) → WI4 (archetypes). WI2 and WI3 are each a
  standalone difficulty increase and each independently playtestable.
- Mid-session design questions route through Chris to the planner.

## Watch-fors

- **This is a global difficulty increase** — every enemy in the game gets stronger (loadouts especially).
  Expect Zelmonia Hills and the earlier nodes to get harder; **do not pre-tune offsets to compensate** —
  measure after, per the calibration plan.
- **Unique leakage** is the invariant to guard hardest under unclamped tiering; a test pin, not a code
  comment.
- **Determinism** — any unseeded randomness in composition/gear/loadout breaks replay.
- **Archetype pool starvation** — a tight Ch1 pool plus composition minimums could make some rolls
  unsatisfiable; fail soft (relax the minimum) rather than throw.
- **Budget waste** — if the buy policy stays authoring-order, watch for budget spent on abilities the unit
  can't equip; that silently converts difficulty budget into nothing.

## Estimated size

Full session. WI2 and WI3 are the substance (loadout deployment against the real capacity surface; the gear
pool policy + filters); WI1 is convergence work the audit sizes; WI4 is a registry plus a roll. The audit may
find WI1 largely done, in which case this fits comfortably; if all four are green-field, WI4 is the natural
fast-follow.
