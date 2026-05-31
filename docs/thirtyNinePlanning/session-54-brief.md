# Session 54 Brief: Terraformer Class + Worldcraft Abilities + Native R/S/M + Barrier Damage Routing

## Context

S53 closed with the full Terraformer substrate landing in one focused session: mutable terrain state, effect queue with bounded LIFO, fall-damage helper, Barrier objects, Damage Split Reaction (catalog-standalone), and Pieces 2/3 (pathfinding + AoE) verified-free via regression. 1510 → 1562 tests; ADR-0088 captures the decisions.

S54 is the **Terraformer class content session** — the substrate is in place, the class composes on top. Pattern parallels S49's Calculator-on-Math-Skill substrate work.

**Pieces shipping this session:**

1. **Terraformer ClassDefinition** with finalized stats.
2. **Worldcraft command set** (5 abilities — Pillar, Pit, Hill, Valley, Barrier), all instant-cast.
3. **Native R/S/M wiring**: Damage Split (built S53; wire to freeAbilities), Ignore Height (new Movement), Expert Former (new Support).
4. **Barrier damage routing** — the deferred S53 piece. `validateAction` extension for barrier targetability, basic-attack routing, AoE routing.
5. **Barrier TTL cadence change** — per Chris's call: ticks regardless of owner state (KO/Stop). S53's "ticks on owner turn_start" pattern updates.
6. **Equipment integration** — mage armor + universal armor + mage head + universal head + mage off-hand (Books) + universal off-hand + accessories.
7. **Portrait** — file awaiting crop from top + downsample to 512×512.

Scope: **Medium-Large.** Comparable to S49 in shape; substrate in place lets class content compose cleanly. Probably ~50-70 new tests.

## Inputs (read first)

In recommended order:

1. **`CLAUDE.md`** — project conventions.
2. **`docs/handoff.md`** — S53 close. Note S53's barrier-TTL implementation (ticks on owner turn_start, pauses on KO) — **S54 changes this** per Chris's call.
3. **`docs/decisions/0088-terraformer-substrate.md`** — substrate ADR. Authoritative for the engine surfaces S54 composes on.
4. **`docs/thirtyNinePlanning/terraformer-blueprint.md`** — updated post-S53 (OQ#7 closed, substrate section marked built, phasing collapsed). Stat profile updates noted below override blueprint values.
5. **`src/engine/effects/queue.ts`** — the substrate the abilities call into. `enqueueWorldcraftEffect` is the integration point.
6. **`src/content/abilities/damage-split.ts`** — Reaction from S53 to wire into freeAbilities.
7. **`src/content/classes/calculator.ts`** — closest parallel for stat profile + native R/S/M wiring pattern.
8. **`src/content/abilities/math-skill/`** — closest parallel for "command set with parameter-driven abilities + ability resolution helper."
9. **`src/content/equipment/`** — class restriction patterns (e.g., Books' `classRestrictions: [geosage, hydrologist, pyromancer, aethurge, calculator]`).
10. **`src/assets/portraits/`** — portrait pattern; uncropped Terraformer portrait file awaiting processing.

### Paths to survey before planning

Audit confirms specifics. Per audit-overturns-spec pattern (now 9 sessions running), substrate scope may be smaller than the brief assumes:

- **Move 2 baseline check.** Chris notes a prior rebaselining intended Move 2 for most classes (with Hunter, Assassin retaining higher mobility). Verify the current state — does each class declare Move 2 by default, or is there inconsistency? Calculator (Move 2) suggests the rebaseline did happen for that class; need to confirm system-wide. If inconsistency exists, surface to Chris before applying.
- **Worldcraft ability resolution shape.** Per S53 handoff: "emit `system_terrain_change` (terrain) / `system_barrier_change` (barrier spawn), then call `enqueueWorldcraftEffect(state, catalog, caster, entry)` → `withUnit(newUnit)` + append `revertActions` to generatedActions." Confirm this is the cleanest integration; audit may find a tighter shape.
- **Hill/Valley 3×3 kernel as ability data.** Per audit: kernel is class content data feeding `system_terrain_change` `tileChanges`, not an `aoeFootprint` extension. Confirm ability definition can express the per-tile elevation delta pattern.
- **Barrier line targeting.** 3-5 contiguous unoccupied tiles, player picks orientation. Confirm targeting substrate supports line-shape selection with the unoccupied-and-no-existing-barrier constraint.
- **Basic-attack barrier-damage routing.** `validateAction` extension to name barrier tiles as targets; attack execution routes through `system_barrier_damage`. Survey current attack-target resolution to identify the cleanest integration point.
- **AoE-to-barrier routing.** AoE damage that includes barrier tiles emits `system_barrier_damage` for each barrier in the AoE. Survey AoE damage application.
- **Barrier TTL ticking change.** S53's `decrementBarrierTtls` is wired into `reduceTurnStart` on the owner. New behavior: tick regardless of owner state. Audit identifies the cleanest replacement — likely a global turn-start tick or per-team-turn tick, not owner-specific.
- **Equipment expansion.** Mage-restricted items (Books, mage armor, mage head) currently list 5 classes in `classRestrictions`; add Terraformer.

## Goal

End state:

**Class:**
- Terraformer ClassDefinition registered.
- Stats: HP 105 / MP 35 / PA 6 / MA 8 / Speed 8 / Move 2 / Jump 2 / evades 6/3/0.
- `dominantStat: 'ma'` (Level system).
- `freeAbilities: [attack, damage_split, ignore_height, expert_former]`.
- Worldcraft as the class's primary command set.

**Worldcraft command set (5 abilities, all instant-cast):**
- **Pillar** — 8 MP, single-tile +3 elevation, range 4 horizontal (magic-uniform per S47/S49), vertical-infinite.
- **Pit** — 8 MP, single-tile -3 elevation, range as Pillar.
- **Hill** — 16 MP, 3×3 area raise per kernel `[1,2,1;2,3,2;1,2,1]` (center +3, edges +2, corners +1).
- **Valley** — 16 MP, 3×3 area lower per negated kernel.
- **Barrier** — 12 MP, line of 3-5 contiguous unoccupied tiles (no existing barrier on any tile). Each tile gets `{ hp: PA × MA, ttl: 5 turns, ownerId }`.

All abilities:
- Instant-cast (no charge time).
- Self-targeting allowed (Terraformer can target own tile).
- Cast emits `system_terrain_change` or `system_barrier_change` + appends `enqueueWorldcraftEffect` to generated actions.
- Queue entry tracks original elevations for revert; fall damage emerges naturally from the terrain-change reducer's drop detection.

**Native R/S/M:**
- **Damage Split** (Reaction, 2 SP) — built in S53; wire into freeAbilities.
- **Ignore Height** (Movement, 3 SP) — new; `modifyStatQuery('jump')` returns a large value (per audit: one-line implementation).
- **Expert Former** (Support, 1 SP) — new; `modifyStatQuery('worldcraft_effect_cap')` returns +2. Synthetic test pattern from S53's `queue.test.ts` is the template.

**Barrier damage routing (S53-deferred piece):**
- `validateAction` extended to name barrier tiles as damageable targets when target.kind = 'tile' and tile has a barrier.
- Basic-attack target resolution: when target tile has a barrier, emit `system_barrier_damage` (instead of resolving a unit target).
- AoE damage application: each barrier tile within an AoE takes `system_barrier_damage` independently.
- UI: when barrier present on a tile, target-select can highlight it as a damageable target (distinct visual from unit-target highlight).

**Barrier TTL cadence change:**
- TTL ticks regardless of owner state (KO, Stop, or alive). Per Chris's call: barriers exist independent of sustaining magic, but still subject to effect-cap LIFO eviction.
- Implementation: replace S53's owner-`turn_start`-gated decrement with a global turn-start decrement (or per-team turn-start; audit determines cleanest).
- S53's note "tile-side `BarrierState.ttl` is a spawn snapshot — the queue entry is authoritative for expiry" still holds.

**Equipment:**
- Terraformer added to `classRestrictions` on mage armor pieces.
- Terraformer added to `classRestrictions` on Books (Tome of Power, Livre of Urgency, Battle Dictionary).
- Terraformer added to `classRestrictions` on mage head pieces.
- Terraformer can equip all universal armor / head / off-hand / accessories.

**Portrait:**
- Source file processed: crop from top to correct aspect ratio + downsample to 512×512 RGBA PNG, per existing pattern.
- Registered in `src/assets/portraits/index.ts`.
- Displays in class picker.

**Quality:**
- Tests +50-70 (estimated).
- No new ADR anticipated; class content composes on existing ADR-0088 substrate. (ADR for Barrier-TTL change worth considering if the cadence rule is substantive; otherwise inline note + handoff.)
- Blueprint updated at session close: class section marked built, MP costs finalized, Barrier-TTL semantics noted.
- `docs/handoff.md` updated.
- `docs/content-id-registry.md` updated (Terraformer class, 5 Worldcraft abilities, 2 new R/S/M abilities — Ignore Height + Expert Former; total ability count delta).
- `docs/playtest-watch.md` updated (Worldcraft balance, Barrier HP scaling, effect-cap interaction, Barrier-TTL flavor wonkiness).
- Vercel pre-flight discipline.
- **Browser verification meaningful this session.** Terraformer in actual battle, Worldcraft abilities exercised, terrain mutation triggered, queue working, Barrier damageable.

## Pre-implementation plan

Audit-first per project conventions. **Plan-review checkpoint** confirms:

1. Move 2 baseline verification status across classes.
2. Worldcraft ability resolution shape.
3. Barrier TTL cadence implementation site.
4. Basic-attack and AoE barrier-damage routing approach.
5. Equipment `classRestrictions` update list.

### Architectural decisions

After audit (most settled by blueprint + S53 substrate):

1. **Worldcraft abilities emit substrate actions + enqueue.** Per S53 handoff: cast emits the appropriate `system_terrain_change` or `system_barrier_change`, then queues the effect via `enqueueWorldcraftEffect`. The queue helper handles cap-based eviction (with revert actions appended to generatedActions).

2. **Hill/Valley as class data, not engine extension.** Kernel `[1,2,1;2,3,2;1,2,1]` is per-tile elevation delta data within the ability definition. The ability's resolution constructs the `tileChanges` array; engine just applies them via `system_terrain_change`.

3. **Barrier line targeting via tile-set selection.** Player picks an anchor + orientation (horizontal/vertical/diagonal — TBD on supported orientations) + length (3-5 tiles). Constraint: all tiles must be unoccupied and barrier-free. If targeting substrate doesn't currently support multi-tile selection of this shape, may need a small extension.

4. **Basic-attack barrier routing at validateAction layer.** When target.kind = 'tile' and tile has a barrier, validateAction returns a barrier-target result; attack execution detects this and emits `system_barrier_damage` instead of normal unit-damage resolution.

5. **AoE barrier routing at AoE-damage application.** AoE's per-tile damage application checks each tile for barriers; if barrier present, emit `system_barrier_damage` for that tile. Unit damage on the tile still applies (a unit AND barrier on the same tile is impossible — barrier makes tile impassable — so this is "barrier tile, no unit"; the AoE damages the barrier).

6. **Barrier TTL ticks regardless of owner state.** Per Chris's call. Implementation: decrement at global turn-start (or whatever cadence audit identifies as cleanest), checking all barriers on all tiles. Not gated on owner unit existence or status.

### Decision points

(Settled in plan-review.)

**D1 — Move 2 baseline check.** Implementer surfaces current state. Three outcomes:
- All classes (except Hunter, Assassin) at Move 2 → Terraformer Move 2 fits cleanly.
- Inconsistent → surface to Chris for direction.
- Some classes higher than Move 2 unexpectedly → may indicate the rebaseline was reverted; surface to Chris.

**D2 — Barrier TTL ticking cadence.** Recommend: global turn-start decrement across all barriers (independent of owner state). Audit may identify per-team-turn-start as cleaner. Either way, ticks regardless of owner KO/Stop.

**D3 — Worldcraft ability range.** Recommend 4 horizontal (magic-uniform per S47/S49 substrate), vertical-infinite per S49 magic vertical-infinite default.

**D4 — Self-targeting.** Recommend allowed (per blueprint). Terraformer Pillar on own tile self-perches; Pit on own tile is presumably never chosen (self-fall-damage), but allowed.

**D5 — Barrier line orientations.** Recommend horizontal + vertical for v1. Diagonal omitted unless audit shows the targeting substrate supports it cheaply.

**D6 — Barrier HP formula.** Per blueprint: PA × MA. With Terraformer's PA 6 × MA 8 = 48 HP per barrier tile. Each barrier in a line has independent HP. Tunable in playtest.

**D7 — Friendly-fire on Valley.** Recommend allowed (per blueprint). AI scorer (S55) will weigh; human players make their own call.

**D8 — Worldcraft ability casting on impassable terrain.** Recommend: Pillar/Pit/Hill/Valley can target any tile (including ramparts, water, existing barriers? — surface). Barrier requires unoccupied tile (no unit, no existing barrier).

## Implementation work

### Terraformer ClassDefinition

- `src/content/classes/terraformer.ts` (new):
  - Stats: HP 105 / MP 35 / PA 6 / MA 8 / Speed 8 / Move 2 / Jump 2 / evades 6/3/0
  - `dominantStat: 'ma'`
  - `freeAbilities: [attack, damage_split, ignore_height, expert_former]`
  - First action set: Worldcraft
  - `armor`: mage + universal
- Registry in `src/content/classes/index.ts`.
- `baseline-stats.ts` declares Terraformer in `classDominantStats` parallel map (cross-validated at test time).
- Tests: class loads, stats correct, dominant stat resolves, free abilities present. ~5 tests.

### Worldcraft command set (5 abilities)

- `src/content/abilities/worldcraft/pillar.ts`
- `src/content/abilities/worldcraft/pit.ts`
- `src/content/abilities/worldcraft/hill.ts`
- `src/content/abilities/worldcraft/valley.ts`
- `src/content/abilities/worldcraft/barrier.ts`
- All instant-cast (no `chargeTime`).
- Resolution helper: `src/engine/abilities/worldcraft-resolution.ts` (new) provides shared logic for emitting `system_terrain_change` / `system_barrier_change` and calling `enqueueWorldcraftEffect`.
- Tests: each ability emits correct action + queue entry; Hill/Valley kernel applied correctly; Barrier line constraint enforced (unoccupied, contiguous, length 3-5); MP costs apply; effects integrate with queue (eviction triggers on overflow). ~20-25 tests.

### Native R/S/M (3 abilities)

- **Damage Split** — already in catalog (S53). Wire into `terraformer.freeAbilities`. No new ability definition; just registry verification. ~2 tests.
- **Ignore Height** — new ability `src/content/abilities/ignore-height.ts`. Movement R/S/M, 3 SP. Registers `modifyStatQuery('jump')` handler returning large value (99 or `Number.MAX_SAFE_INTEGER`). Tests: equipped → jump query returns large value; not equipped → normal jump returned. ~3 tests.
- **Expert Former** — new ability `src/content/abilities/expert-former.ts`. Support R/S/M, 1 SP. Registers `modifyStatQuery('worldcraft_effect_cap')` handler returning +2. Pattern parallel to Mathematician's Math Skill hooks. Tests: equipped → cap is 4 (base 2 + 2); composition verified. ~3 tests.

### Barrier damage routing (S53-deferred)

- `src/engine/abilities/validate.ts` — extend tile-target validation: tile with barrier resolves as damageable target.
- Basic-attack execution: when target tile has barrier, emit `system_barrier_damage` (action exists from S53).
- AoE damage application: each barrier tile within AoE takes `system_barrier_damage` independently.
- UI: target-select highlight distinct for barrier (visually distinguishes barrier-target from unit-target).
- Tests: basic attack on barrier tile damages barrier; barrier HP reaches 0 → barrier destroyed (S53 mechanism); AoE on multi-barrier line damages each barrier; AoE on mixed unit-and-barrier tiles damages both correctly. ~10-15 tests.

### Barrier TTL cadence change

- Replace S53's owner-`turn_start`-gated decrement with global decrement.
- Implementation site per audit (likely a turn-start hook that iterates all barriers).
- Behavior: barrier TTL decrements on each turn-start regardless of owner unit's status (alive/KO/Stop) or even existence (if Terraformer is removed from battle).
- Tests: barrier TTL decrements when owner KO'd; barrier expires correctly even when owner dead; LIFO eviction still works correctly (the queue entry's lifecycle is independent of owner's turn-start ticking). ~3-5 tests.

### Equipment integration

- Mage armor pieces: add Terraformer to `classRestrictions`.
- Books (Tome of Power, Livre of Urgency, Battle Dictionary): add Terraformer to `classRestrictions`.
- Mage head pieces: add Terraformer to `classRestrictions`.
- Universal items: no change (Terraformer can equip per existing patterns).
- Tests: Terraformer can equip mage armor and Books; mage equipment picker shows Terraformer-equippable items. ~5 tests.

### Portrait

- Source file location: implementer locates the uncropped portrait file (Chris notes it's "waiting to be cropped").
- Crop from top to correct aspect ratio (1:1).
- Downsample to 512×512 RGBA PNG following existing portrait approach.
- Register in `src/assets/portraits/index.ts`.
- Browser verification: portrait displays in class picker.

### Tests (total)

Estimated +50-70 tests across class + abilities + R/S/M + barrier routing + TTL change + equipment.

### UI surfaces

- Class picker shows Terraformer with portrait + tagline (e.g., "Battlefield-shaping geomancer").
- Worldcraft command set in Terraformer's First Action slot during battle.
- Worldcraft target-select UX — basic tile-selection for v1; richer parameter-driven UI is S55 scope.
- Barrier visualization on tiles (S53 may have basic rendering; audit confirms).
- Equipment picker shows Terraformer-allowed Books / mage armor / etc.

## Acceptance criteria

**Class:**
- Terraformer registered, picker displays correctly, stats accurate, dominant stat MA.

**Worldcraft abilities:**
- All 5 abilities cast correctly, emit appropriate substrate actions, enqueue to effect queue.
- Hill/Valley kernel applies per-tile correctly.
- Barrier line constraint enforced.
- Effect-cap eviction triggers on overflow with revert actions.
- All abilities instant-cast.

**Native R/S/M:**
- Damage Split in catalog, equipped on Terraformer, triggers correctly.
- Ignore Height applies Jump override when equipped.
- Expert Former raises Worldcraft cap to 4 when equipped.

**Barrier damage routing:**
- Basic attacks damage barriers on tile-target.
- AoE damage hits barriers in affected tiles.
- Barrier destroyed at HP-0 (S53 mechanism preserved).
- UI highlights barrier as damageable target.

**Barrier TTL cadence:**
- Barriers tick regardless of owner state (KO, Stop, removed from battle).
- LIFO eviction still works.

**Equipment:**
- Terraformer can equip mage armor + Books + mage head + universal items.
- Equipment picker correctly filters by Terraformer class restriction.

**Portrait:**
- Loads at 512×512, displays in class picker.

**Quality:**
- Tests at 1612-1632, 0 failing.
- Blueprint + docs updated.
- Vercel pre-flight clean.
- Browser verification: full battle with Terraformer equipped, Worldcraft abilities exercised, terrain mutates, barriers spawn, queue evicts correctly, fall damage applies, barriers take damage.

## Out of scope

- **AI Worldcraft scoring** — Piece 6 in audit; S55.
- **Worldcraft target-select UI polish** — basic tile-selection in v1; richer parameter UI in S55.
- **Effect queue display UI** — players see effects taking place via terrain changes; explicit queue display is S55.
- **Renderer animation polish** — terrain transitions are instant; animation as polish in S55+.
- **Default team templates updated with Terraformer** — content session for templates; not S54.
- **Terraformer team template (parallel to Calculator template, also still a carry)**.
- **Marshmoor template-compliance tests** — S52 stretch carry; still uncovered.
- **Calculator stretch abilities** (Status-debuff/Drain/Banish Math).
- **Calculator AI personality variants.**
- **All standing carries** (AI deployment role-aware sorting, Bulwark replacement, etc.).
- **`tagFilter` source inconsistency** (S51 note).
- **Damage-pipeline catalog re-lookup cleanup** (S49 engine note).

## Files likely touched

A non-exhaustive list. Audit confirms / corrects.

**Class content:**
- `src/content/classes/terraformer.ts` (new).
- `src/content/classes/index.ts` — registration.
- `src/engine/baseline-stats.ts` — Terraformer stats + dominant stat.

**Worldcraft abilities:**
- `src/content/abilities/worldcraft/pillar.ts` (new).
- `src/content/abilities/worldcraft/pit.ts` (new).
- `src/content/abilities/worldcraft/hill.ts` (new).
- `src/content/abilities/worldcraft/valley.ts` (new).
- `src/content/abilities/worldcraft/barrier.ts` (new).
- `src/content/abilities/index.ts` — registrations.
- `src/engine/abilities/worldcraft-resolution.ts` (new) — shared resolution helper.

**Native R/S/M:**
- `src/content/abilities/ignore-height.ts` (new).
- `src/content/abilities/expert-former.ts` (new).

**Equipment:**
- Mage armor / Books / mage head files — Terraformer added to `classRestrictions`.

**Barrier damage routing:**
- `src/engine/abilities/validate.ts` — tile-target extension for barriers.
- Basic-attack / AoE damage application — barrier routing.
- UI target-select — barrier highlight.

**Barrier TTL cadence:**
- `src/engine/effects/queue.ts` (or wherever S53's `decrementBarrierTtls` lives) — replace owner-gated decrement with global.

**Portrait:**
- `src/assets/portraits/terraformer.png` (new, processed from source).
- `src/assets/portraits/index.ts` — registration.

**Tests:**
- `src/test/session-54-terraformer.test.ts` (or split per area).
- Existing test fixtures updated for Terraformer class (`dominantStat: 'ma'` if any inline fixtures touch baseline stats).

**Docs:**
- `docs/thirtyNinePlanning/terraformer-blueprint.md` — class section marked built; finalized stats + MP costs.
- `docs/handoff.md` — session close.
- `docs/content-id-registry.md` — class + abilities additions.
- `docs/playtest-watch.md` — S54 watch-fors.

## Workflow notes

- **Plaintext-first review required.**
- **Audit-first with plan-review checkpoint.** Move 2 baseline status is the first surface to confirm.
- **Move 2 baseline check.** Implementer surveys current Move stats across all classes. If not all classes (excepting Hunter, Assassin) are at Move 2, surface to Chris for direction. Don't apply Move 2 to Terraformer in isolation if the rest of the roster is on Move 3.
- **Portrait file awaiting processing.** Implementer locates source file (probably in assets staging area or user-uploaded directory), crops from top to 1:1 aspect ratio, downsamples to 512×512 RGBA PNG following existing portrait pipeline. Registers in portrait index.
- **Barrier TTL cadence change.** This deviates from S53's implementation. Implementer should surface the change with the cleanest replacement (global turn-start tick recommended). The S53 ADR notes this was tunable; S54 settles the call.
- **All Worldcraft abilities are instant-cast.** No `chargeTime` declarations. Confirm via ability definition tests.
- **Vercel pre-flight discipline.** `rm node_modules/.tmp/tsconfig.app.tsbuildinfo && rm node_modules/.tmp/tsconfig.node.tsbuildinfo` before final `tsc -b`.
- **Browser verification meaningful this session.** Terraformer fights in actual battle; Worldcraft abilities exercised end-to-end; terrain mutation visible; barriers spawn and take damage; queue evicts correctly with revert (visible fall damage on raise-revert). Real-battle exercise is the smoke test substrate-only S53 couldn't do.
- **Stale `guide/` dev server still on 5173** (S52, S53 carry). Implementer should kill PID 21292 or default preview to 5174 early.
- **Mid-session design questions** route through Chris. Most likely surfaces:
  - Move baseline discrepancy if found.
  - Barrier orientations (diagonal Y/N).
  - Barrier HP feel (PA × MA = 48 baseline; tunable).
  - Worldcraft MP cost feel after first playtest.

## Watch-fors

**Addressed this session:**
- Terraformer ClassDefinition.
- 5 Worldcraft abilities (Pillar/Pit/Hill/Valley/Barrier).
- 3 R/S/M wired (Damage Split, Ignore Height, Expert Former).
- Barrier damage routing (S53-deferred).
- Barrier TTL cadence change (S53-deferred decision).
- Equipment expansion (Terraformer added to mage-restricted items).
- Portrait.

**Not addressed this session, longer-term carry-forward:**
- All standing carries.
- **AI Worldcraft scoring (S55)** — Piece 6 in audit.
- **Worldcraft UI polish (S55)** — target-select richer interactions, queue display.
- **Renderer animation polish** — instant terrain redraw only.
- **Default team templates with Terraformer** — content session.
- **Calculator team template revision** (still S49/S50/S51/S52/S53 carry).
- **Marshmoor template-compliance tests** (still S52 carry).

**Watch-fors specific to this session:**

- **Worldcraft balance in actual play.** First time terrain mutation lands in real battles. Watch whether Pillar/Pit feel powerful at 8 MP (4-5 casts per battle), whether Hill/Valley 16 MP feels appropriately costly, whether Barrier 12 MP × 5 tiles is balanced.
- **Barrier HP scaling (PA × MA = 48).** First class to use PA productively. Watch whether 48 HP feels right per barrier — too durable (battles stall around them) or too fragile (single attack breaks them, denial mechanic feels weak).
- **Effect-cap interaction.** Naked Terraformer at cap 2; with Expert Former at cap 4. Watch whether 2 is too restrictive (Terraformer feels weak without Support) or 4 is too permissive (oppressive battlefield control).
- **Barrier TTL flavor wonkiness.** Chris noted the "Barrier continues even when Terraformer KO'd, but still gets evicted by cap LIFO" semantics are flavorfully odd. Watch playtest for whether this feels weird in play — if so, alternative rules to consider.
- **Hill/Valley friendly fire.** Allies in Valley AoE take fall damage. Watch whether AI players (in S55) handle this correctly, and whether human Terraformer users find it tactically interesting or accidentally punishing.
- **Move 2 consistency check.** If audit finds inconsistency, surface for resolution. Terraformer at Move 2 should match the rest of the non-mobility classes.
- **Battle Dictionary finally pays off.** First class to use the +1 PA productively (Barrier HP scaling). Watch whether Terraformer + Battle Dictionary becomes a default build, and whether the design intent (hybrid PA/MA value) holds up.
- **Cross-class secondary Worldcraft (with or without Expert Former).** Other classes equipping Worldcraft as secondary command set — watch whether this becomes a problematic build. Calculator + Worldcraft for terrain-aware Math Skill? Knight + Worldcraft for self-Pillar perching? Build space expands significantly.

## Estimated size

**Medium-Large.** Comparable to S49 Calculator session in shape. Substantial content addition with substrate already in place.

**No split contingency anticipated.** If budget tightens:
- Worldcraft abilities (5) can split into core (Pillar, Pit, Hill, Valley) and Barrier as separate commit.
- Barrier damage routing can split from initial Barrier-spawn work if needed.
- Native R/S/M (3) is small and ships together.
- Equipment integration is small.

**Stretch indicators** (opportunistic):
- Default team templates updated with Terraformer (one of three templates revised to feature Terraformer).
- Marshmoor template-compliance tests (S52 stretch carry).
- Tidewalker AI weighting on water-heavy maps (S52 stretch carry).
- Calculator + Worldcraft cross-class combination playtest.
- Killing the stale `guide/` dev server / fixing the launch.json port.

These are pure housekeeping; not core scope.
