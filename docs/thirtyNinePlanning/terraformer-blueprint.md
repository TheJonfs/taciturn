# Terraformer Class Blueprint (Working Document)

**Status:** **BUILT (S53 substrate + S54 class). The arc is complete through class content; only AI scoring + UI polish remain (S55).** This document is now a historical design record — where it diverges from what shipped, the shipped values (below) and `docs/content-id-registry.md` are authoritative.

**Position in roster:** 10th class. First hybrid PA/MA class. First class with mutable-terrain-during-battle mechanics. First terrain-object-spawning class.

---

## S54 — what shipped (final values)

The class, Worldcraft command set, native R/S/M, barrier-damage routing, the
barrier-TTL cadence, equipment, and portrait all landed in S54 on the S53
substrate (ADR-0088). Final values, which **override the proposals below**:

- **Stats:** HP 105 / MP 35 / PA 6 / MA 8 / SPD 8 / Move 2 / Jump 2 / evades
  6/3/0, `dominantStat: 'ma'`. (PA/MA shifted from the proposed 7/7 to 6/8 per
  the S54 brief — MA-leaning hybrid; Barrier HP = 6 × 8 = 48.) Move 2 places it
  in the slow-caster tier (Calculator / Geosage / Pyromancer); see the
  playtest-watch note on the unresolved roster-wide Move-2 question.
- **Worldcraft (all instant-cast, range 4 / vertical-infinite, magic-uniform
  rangeMode `arc`):** Pillar 8 MP (+3), Pit 8 MP (-3), Hill 16 MP (3×3 kernel),
  Valley 16 MP (negated kernel), Barrier 12 MP (3-5 tile line, HP = PA × MA,
  TTL 50 turn-starts ≈ 5 rounds in a 5v5). The Hill/Valley kernel is content
  data on `effects.worldcraft`
  (`elevation`), not an AoE footprint. Barrier uses a new `tile_set` target.
- **Native R/S/M:** Damage Split (Reaction 2 SP, built S53), Ignore Height
  (Movement 3 SP, Jump → 99), Expert Former (Support 1 SP, effect cap +2).
- **Barrier damage routing:** a damaging ability on a barrier tile emits
  `system_barrier_damage` (base attacker offense, no variance/resistance);
  single-target (basic Attack) + per-tile AoE both route.
- **Barrier-TTL cadence:** ticks **globally on every `turn_start`**,
  independent of owner KO/Stop/removal (ADR-0089) — resolves OQ on the
  deferred S53 cadence. Cadence is per-turn; the `ttl` number is the tuning
  knob (playtest-watch).
- **Equipment:** mage armor + mage headgear + Books (Tome of Power, Livre of
  Urgency, Battle Dictionary) + universal items. Battle Dictionary's +1 PA
  feeds Barrier HP.
- **Open question still open:** OQ#6 (multi-Terraformer team queues), AI
  scoring (S55), Worldcraft UI polish (S55).

---

## Class identity

The Terraformer's primary contribution is the battlefield itself. Direct combat output is secondary. By manipulating elevation and constructing temporary barriers, the Terraformer reshapes engagement geometry: lifting allied archers onto perches, dropping enemies off cliffs (taking fall damage as they fall), creating impassable lines that funnel attacker movement, isolating squishy mages behind elevation gaps melee can't cross.

The hybrid PA/MA design ensures the class can't be min-maxed on one stat axis — both contribute to Barrier durability, and equipment choices have to weigh both.

**Thematic register:** "World manipulation as combat." A Geomancer would be the FFT-vocabulary version, but Geosage already holds the Earth-magic slot; Terraformer reads as distinct (and somewhat industrial-magic, which fits Gariland Academy's aesthetic). Open to other names — Tectonicist, Cartomancer, Worldshaper — but Terraformer is the working name.

---

## Stats (proposed)

Provisional, calibrated against existing classes:

| Stat | Value | Reasoning |
|------|-------|-----------|
| HP | 105 | Moderate; lower than Knight (170s) and Alchemist, higher than Pyromancer (~95). |
| MP | 35 | Sufficient for 3-4 terrain casts per battle at typical MP costs; lower than Calculator (47) because Worldcraft casts are flat-cost. |
| PA | 7 | Hybrid baseline; matters for Barrier HP scaling. |
| MA | 7 | Co-equal with PA; matters for Barrier HP scaling and possibly other parameters. |
| SPD | 7 | Slow; like Calculator. Terraformer sets up the battlefield; doesn't need to act often. |
| Move | 3 | Standard for a magical-leaning class. |
| Jump | 3 | Baseline (irrelevant if Ignore Height equipped). |
| Front evade | 6 | Standard mage profile. |
| Side evade | 3 | Standard mage profile. |
| Back evade | 0 | Standard. |
| Dominant stat | MA | Single dominant pick (Level system requires one); MA edges out PA because most Worldcraft casting feel reads as "magical." Settled if/when we add hybrid-dominant substrate; default to MA. |

**Notes:**
- PA and MA at the same value (7) signals the hybrid identity through stat profile, even though only one is technically "dominant" per S49 Level system.
- Speed 7 matches Calculator; both are "infrequent caster, big impact per cast" classes.

---

## Command set: Worldcraft

Four active abilities, all terrain manipulation. All instant-cast (no charge time). No Faith factor (these aren't status applications; they're geometric changes).

### Pillar — single-tile sharp raise

- **Target:** one tile, range TBD (recommend 4 horizontal, vertical-infinite).
- **Effect:** target tile's elevation increases by +3.
- **Active effect entry:** added to Terraformer's effect queue.
- **Tactical use:** lift an ally onto a perch; create a melee-reach gap to protect a mage; cut off a path.
- **Stacking:** two Pillars on the same tile = two queue entries, total +6 elevation. Reverting one returns to +3; reverting both returns to baseline.

### Pit — single-tile sharp lower

- **Target:** one tile, range as Pillar.
- **Effect:** target tile's elevation decreases by -3. Any unit on the tile takes fall damage equal to the elevation delta (parallel to natural fall damage).
- **Active effect entry:** added to queue.
- **Tactical use:** drop an enemy off their perch with damage; create a pit (especially in combination with another Pit or surrounded by Pillars to trap a unit if jump distance exceeded).
- **Stacking:** two Pits on the same tile = -6 elevation cumulative. Trapping geometry possible if the result exceeds adjacent units' jump stat.

### Hill — 3x3 area moderate raise

- **Target:** central tile of a 3x3 area.
- **Effect:** elevation changes per kernel:
  ```
  [1, 2, 1]
  [2, 3, 2]
  [1, 2, 1]
  ```
  Center +3, edges +2, corners +1. Produces a literal hill shape.
- **Active effect entry:** added to queue (single entry despite affecting 9 tiles).
- **Tactical use:** dramatic terrain reshape; create a multi-perch high ground; set up Hunter elevation-variance leverage across an area.
- **Stacking with Pillar:** Pillar on the center of an active Hill = +3 (Hill center) + 3 (Pillar) = +6 elevation. Two queue entries.

### Valley — 3x3 area moderate lower

- **Target:** central tile of a 3x3 area.
- **Effect:** elevation changes per negated Hill kernel:
  ```
  [-1, -2, -1]
  [-2, -3, -2]
  [-1, -2, -1]
  ```
  Center -3, edges -2, corners -1. Produces a literal valley shape.
- **Fall damage:** units on affected tiles take fall damage per-tile based on each tile's delta (center unit takes most; corner units take least).
- **Active effect entry:** added to queue (single entry, 9 tiles).
- **Tactical use:** AoE damage with positioning consequences; group an enemy cluster and drop them all; create a bowl that's hard to leave (combined with Valley's adjacent tiles being higher).

### Open targeting / cost questions

- **MP costs:** TBD. Initial proposal: Pillar 10, Pit 10, Hill 16, Valley 16. Calibration during implementation.
- **Range:** TBD. Initial proposal: 4 horizontal, vertical-infinite per S47/S49 magic substrate.
- **Self-targeting:** allowed by default (Terraformer can Pillar their own tile to perch themselves; can Pit their own tile if they want fall damage on themselves, presumably never).
- **Friendly-fire on Valley:** allowed (allies in the AoE take fall damage). AI scorer will weigh this.
- **Casting on impassable terrain:** TBD. Does Worldcraft work on rampart tiles? Bridge tiles? Likely yes — these are terrain types, all should be manipulable.
- **Water-toggle behavior:** elevation 0 = deep water, elevation 1 = shallow water (existing engine convention). Pillar on deep water (elev 0) → elev 3 (land). Valley on land (elev 4) → elev 1 (shallow water). Implicit terrain-type-from-elevation already in the engine; Worldcraft reuses cleanly.

---

## Barrier mechanic (5th ability candidate, or feature of one of the above)

Open design question: does Barrier exist as a 5th Worldcraft ability, or is it folded into one of the four (e.g., Pit creates terrain AND optionally spawns a barrier above it)? Currently leaning **5th ability** for design clarity.

### Barrier (proposed 5th Worldcraft ability)

- **Target:** a line of 3-5 currently-unoccupied tiles (player picks orientation; tiles must be contiguous).
- **Effect:** each tile gains a Barrier terrain object.
- **Barrier object properties:**
  - **HP:** PA × MA + modifier (open question — could be PA × MA, or (PA + MA)², or PA × MA × MA, etc.). Initial proposal: **PA × MA** flat. At Terraformer base stats (7×7 = 49), each barrier takes 1-2 standard attacks to break. Tunable.
  - **Lifetime:** 5 turns (timer ticks down each round). Barrier vanishes at TTL expiration regardless of Terraformer state.
  - **Targetable:** yes. Attackers can hit them with normal attacks; takes damage; HP-0 destroys.
  - **Pathing:** blocks movement (impassable). LoS-blocking TBD (probably blocks).
  - **AoE/AoE penetration:** TBD. Recommend AoE passes over (vertically-tall barriers don't block fireball arcs); ground-targeted abilities can't land on barrier tiles.
- **Active effect entry:** ONE queue entry per Barrier cast, regardless of tile count. Reverting destroys all tiles in the barrier line at once.
- **Tactical use:** chokepoint denial; mage protection (barrier line cutting off melee approach); time-buying (forces enemies to break or path around, costing turns).

### Open questions on Barrier

- HP scaling formula final.
- Whether barriers can be healed by ally abilities (recommend: no, keep simple).
- Whether they can be damaged by friendly fire (recommend: yes, weird but consistent).
- LoS blocking (probably yes).
- Whether Terraformer's death immediately destroys barriers or they persist on TTL (Chris's call: persist on TTL; barrier effects survive Terraformer KO).

---

## Effect tracking system

The effect-limit + LIFO revert mechanic is the structural backbone.

### Active effect queue

- Each Terraformer maintains their own effect queue.
- Each Worldcraft cast adds one entry: `{ability_id, tile_set, elevation_deltas, original_state, cast_turn}`.
- Queue is bounded by `max_active_effects` (see below).
- When a cast would exceed the cap, the oldest entry is **reverted** before the new entry is added.

### Revert behavior (per ability)

| Ability | Revert behavior |
|---------|-----------------|
| Pillar | Elevation returns to original. Unit on tile takes fall damage equal to the original delta (+3 → -3 fall). |
| Pit | Elevation returns to original. No damage (the pit's offense was the initial drop; restoring is gentle). |
| Hill | All 9 tiles return to original. Units on affected tiles take fall damage per-tile (parallel to Pillar). |
| Valley | All 9 tiles return to original. No damage (Valley's offense was the initial drop). |
| Barrier | Barrier tiles destroyed (objects removed). No damage. |

The asymmetry (raises punish on revert, lowers don't) creates tactical depth: a Terraformer who relies on raises to position allies has a built-in cost if they keep casting.

### Effect limits

- **Default cap:** 2 active effects.
- **With Expert Former Support equipped:** 4 active effects.
- **Cross-class secondary-Terraformer (Worldcraft as 2nd command set):** subject to same cap. Expert Former still raises cap if equipped, even by a non-Terraformer.

### KO behavior

Per Chris's call: **effects persist past Terraformer KO**. The barrier TTL timer continues ticking normally; elevation effects remain until they're reverted (which won't happen if the Terraformer is dead and can't cast more).

Tunable later in playtesting. If "permanent terrain changes after Terraformer dies" turns out to feel oppressive, alternative is "all effects revert on KO."

### Multiple Terraformers on one team

Each maintains their own queue. Effects from different Terraformers don't interact in the queue.

If team has 2 Terraformers, each has 2-4 active effects (8 total possible). Designed-but-watch territory.

---

## Native R/S/M (free abilities)

Per the Calculator pattern, Terraformer ships with class-specific R/S/M free in the slots:

### Reaction: Damage Split (2 SP equip cost)

- **Trigger:** Terraformer takes damaging attack and survives (HP > 0 after damage).
- **Trigger gate:** Brave-gated, standard reaction roll.
- **Effect:** Splits the surviving hit in two — Terraformer heals for half the damage dealt and the attacker takes the other half, **system-tagged** (bypasses defenses; doesn't trigger attacker's reactions; tagged for animation/logging). _(Amended 2026-06-12, ADR-0106: originally reflected the **full** amount; halved after playtest.)_
- **Substrate note:** "System-tagged" damage may be a new concept. Audit confirms whether existing damage types support this or substrate needs extension.
- **Borrowed from FFT** (Demi Salamander / Reraise lineage; also similar to FF games' Reflect mechanics).

### Movement: Ignore Height (3 SP equip cost)

- **Effect:** removes the Jump-stat constraint on vertical movement. Terraformer can step between any two adjacent tiles regardless of elevation delta.
- **Implementation note:** likely cleanest as "Jump = 99" override, but could be a separate flag. Audit confirms.
- **Cost rationale:** 3 SP because it's a strong mobility upgrade for any class that equips it (cross-class users get massive value).

### Support: Expert Former (1 SP equip cost)

- **Effect:** raises Worldcraft active-effect cap by +2.
- **Tag:** silently implicit — affects only Worldcraft-cast effects. If the equipping class doesn't have Worldcraft as primary or secondary command set, Expert Former does nothing.
- **Cost rationale:** 1 SP because it's useless without Worldcraft access. A cross-class user equipping Worldcraft as secondary + Expert Former gets the full 4-effect cap.

### Class free-ability set

Following Calculator pattern: `freeAbilities: [attack, damage_split, expert_former, ignore_height]`.

---

## Substrate requirements (preliminary)

> **S53 update (ADR-0088):** the substrate is **built**. The S52 audit overturned the "2-3 sessions" framing — most of the scary pieces were pre-built — and S53 landed all of it in one focused session: `system_terrain_change` (mutable terrain, structurally-shared map), the shared fall-damage helper (one `> 1` gate across knockback + terrain), the per-unit `worldcraftEffects` LIFO queue with computed `worldcraft_effect_cap` (base 2, Expert Former +2) and Barrier-TTL turn-loop decrement, Barrier objects as a `Tile.barrier?` field (impassable + LoS-blocking) with `system_barrier_change` / `system_barrier_damage` (pipeline-bypassing), the renderer instant-redraw on terrain change, and Damage Split in the catalog. Pathfinding and AoE were verified to need zero substrate. **Deferred to S54:** the live attack/AoE → barrier-damage routing (content-coupled), and the Barrier-TTL-under-KO cadence refinement. The arc now collapses to: **S53 substrate → S54 class+abilities → S55 AI+UI.**

This is the largest substrate addition since the Math Skill substrate (S49). ~~Expect 2-3 implementation sessions, possibly more.~~ **Landed in one session (S53), per the audit's revised estimate.**

### Mutable terrain state

Currently terrain is fixed at battle start. Need:
- Per-tile elevation as battle state (not just map definition).
- Tile-elevation modifications applied as "deltas" composed over base map elevation.
- Renderer support for terrain transitions (animation or instant-update).
- Per-effect tracking (the queue) per Terraformer unit.

### Pathfinding interaction

- Audit confirms whether pathfinding is cached or fresh-computed on Move action.
- If fresh-computed on Move: no substrate change needed (terrain updates are picked up automatically).
- If cached: need invalidation on terrain change.

Chris's note: likely fresh-computed at Move action; should be safe.

### Terrain object system (for Barrier)

- New "terrain object" concept (distinct from Unit).
- HP-bearing terrain objects.
- Damage pipeline routes for hitting terrain objects (a special target type alongside Unit).
- Lifetime/TTL tracking.
- Generalizable to future terrain objects beyond Barrier.

### Fall damage on revert

- Existing fall-damage formula reusable.
- Per-tile delta calculation for Hill-revert (each tile's revert applies its own per-tile fall damage if unit present).

### AI awareness

The deepest AI work in the project so far. Friendly AI Terraformer needs to evaluate:
- Where ally archers/mages are (perch / protect setups).
- Where enemy clusters are (Valley damage opportunities).
- Where chokepoints exist (Barrier denial).
- Effect-revert consequences (don't cast if revert hurts current position).

Enemy AI defending against opponent Terraformer needs:
- Cluster-avoidance heuristic (Valley defense).
- Mobility prioritization (Barrier counterplay).
- Trapped-pit risk awareness.

This is its own design effort, likely an entire session worth.

### Damage type extension

"System-tagged" damage (for Damage Split) may need substrate. Audit confirms whether existing damage type system supports a "reflect-bypass" tag.

---

## AI scoring (preliminary thoughts)

The Worldcraft scorer parallels the Math Skill scorer's structure: enumerate options, score each by net team value, pick highest above threshold.

### Per-ability scoring

- **Pillar:** score = (ally elevation gain × ally tactical leverage) + (enemy access denied × enemy disruption) - (revert risk if queue full).
- **Pit:** score = (immediate fall damage × enemy weight) + (positional disruption × enemy disruption weight).
- **Hill:** score = sum of Pillar-style scoring across 9 tiles, weighted by unit presence.
- **Valley:** score = sum of Pit-style scoring across 9 tiles + AoE fall damage.
- **Barrier:** score = (chokepoint coverage × tactical denial) + (ally protection × ally weight) - (own-team mobility cost).

Threshold and weight tuning are playtest-driven.

### AI personality variants

Possible future expansion (like Calculator's Aggressive/Conservative): "Offensive Terraformer" prioritizes Pit/Valley; "Defensive Terraformer" prioritizes Pillar/Barrier. Out of scope for v1.

---

## Equipment integration

- **Armor:** mage armor + universal (parallel to Calculator).
- **Off-hand:** Books (mage-restricted) + universal off-hand options. Books synergize with Worldcraft thematically — Battle Dictionary's +1 PA is unusually valuable here since Terraformer is the first class that meaningfully uses PA for ability scaling (Barrier HP).
- **Weapons:** likely staves/wands; Terraformer's PA contributes to Barrier HP, so wand-with-MA bonus matters less than for pure mages.
- **Accessory:** standard universal.

The Battle Dictionary plant (S51, +1 PA on a mage off-hand) becomes meaningful here — the Terraformer can equip it and benefit from BOTH stats it provides.

---

## Synergies with existing classes

| Class | Synergy |
|-------|---------|
| Hunter | Allied Terraformer creates archer perches with Pillar/Hill. Enemy Terraformer denies high ground with Pit/Valley. |
| Hydrologist | Water-toggle interactions (Pit on land → shallow water → water-tagged spell synergies). |
| Calculator | Dynamic Height parameter — Terraformer changes which units match Math Skill predicates by ±. Real interaction. |
| Aethurge | Lightning AoE range scaling with elevation; perches benefit. |
| Pyromancer | Big AoE patterns benefit from positioning manipulation. Valley clusters enemies for Fire Storm. |
| Geosage | Thematic affinity (earth/terrain magic). No specific mechanical interaction yet. |
| Knight | Ignore-Height-equipped Knight becomes mobility menace. Pillar protection works against enemy Knight. |
| Alchemist | Less direct synergy. |
| Assassin | Pillar to give ally Assassin elevation-strike setup; Pit on Assassin's escape route. |

---

## Open questions

Items still requiring settlement before implementation brief is written:

1. **MP costs** for the four Worldcraft abilities. Initial proposals listed; tune in implementation.
2. **Barrier HP formula.** Currently PA × MA. Could be (PA + MA) × constant, or include MA² for more durability, or include level scaling.
3. **Barrier as 5th ability vs. folded into another.** Currently leaning 5th.
4. **Range of Worldcraft casts.** Initial proposal 4 horizontal. Should it be 3? 5? Magic-uniform 4-tile range feels right.
5. **AoE on Valley fall damage.** Per-tile delta-based, but is there a magnitude cap? E.g., does a tile lowered by -3 plus a separately-stacked -3 = -6 elevation give -6 fall damage on the unit, or is fall damage capped at the single-cast magnitude?
6. **Multi-Terraformer team queue behavior.** Each gets their own; confirmed. Worth playtest to see if 4-Terraformer mage-war comp feels broken.
7. ~~**"System-tagged" damage substrate.** Audit confirms whether this exists or needs adding for Damage Split.~~ **CLOSED (S53, ADR-0088).** No new tag or damage-type substrate is needed. `system_damage` already bypasses the pipeline (no variance/Faith/resistance/reactions; ADR-0027); Damage Split adds one `SystemDamageSource` variant (`'reflect'`, parallel to Spiked Mail's `'revenge'`) plus a paired `system_heal` for the self-heal. Shipped standalone in the catalog this session; wired onto the Terraformer's R/S/M in S54.
8. **Naming.** Terraformer / Tectonicist / Cartomancer / Worldshaper. Terraformer is working name.
9. **Worldcraft as command set name.** Chris floated with "?"; sticking with Worldcraft as working name.
10. **Cross-class secondary Worldcraft + Expert Former interaction.** Functional but worth playtest watch — non-Terraformer with full 4-effect cap might be a build to watch.
11. **Variants in v2.** Single-tile Pillar could have +5 sharp variant (Cliff?); area Hill could have flat +1 variant (Plateau). Out of v1 scope; design space for later.

---

## Implementation phasing (preliminary)

Anticipated session sequence when we move from blueprint to engine work:

### Session A: Substrate
- Mutable terrain state.
- Terrain object system (for Barrier and future objects).
- Effect queue + revert mechanic.
- Pathfinding interaction audit and any fixes.
- Damage Split substrate (system-tagged damage if needed).

### Session B: Class + abilities
- Terraformer ClassDefinition.
- Worldcraft command set with 4-5 abilities.
- Native R/S/M (Ignore Height, Damage Split, Expert Former).
- Equipment integration.
- Tests across the kit.

### Session C: AI + UI + polish
- AI Worldcraft scoring.
- Worldcraft UI (target selection, area preview, queue display).
- Renderer for terrain transitions.
- Browser verification.

May compress to 2 sessions or expand to 4 depending on substrate audit outcomes. Comparable to Calculator's arc (Math Skill substrate + class + AI/UI was substantively one session — S49 — but it was a big one).

---

## Carries / open threads

- Decide whether Barrier is 5th Worldcraft ability or folded into existing.
- Decide whether multi-Terraformer comp needs per-team cap (probably not for v1).
- Decide AI personality variants for v2.
- Decide naming.
- Define MP costs.
- Settle Barrier HP formula.
- Address "system-tagged" damage substrate question via audit.

This document evolves as design discussion progresses. Update before each implementation session.
