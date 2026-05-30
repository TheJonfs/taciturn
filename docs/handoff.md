# Session Handoff

This is a transient note from one session to the next.

**Discipline:** This document is *overwritten* each session, not appended. When starting a session, read this file and process every item — act on it, promote it elsewhere (ADR, design-doc edit, GitHub issue), or explicitly drop it with a reason. Items do not accumulate. If there are no notes to leave, replace the contents with `_No handoff this session._` so the next session knows the file has been processed.

---

## From Session 53 close (2026-05-30) — Terraformer substrate (mutable terrain + fall-damage helper + effect queue + Barrier objects + Damage Split)

The full Terraformer substrate landed in one focused session, per the S52 audit's revised estimate. **1510 → 1562 tests** (+52), `tsc -b` clean, `vite build` clean (Vercel pre-flight green, tsbuildinfo cleared first). Captured in **ADR-0088**. Not yet committed — Chris hadn't asked at the time of writing; everything is working-tree and ready for a commit when he says go.

### What landed (all 8 substrate pieces; 2 & 3 verified-free)

- **Piece 8 — Damage Split (catalog-standalone).** New `reflect_damage` reaction-effect kind in the data-driven compiler; new `SystemDamageSource` `'reflect'` + `SystemHealSource` `'reaction'` variants. Reflects full damage to attacker (pipeline-bypass, no cascade — Spiked Mail `'revenge'` precedent) + heals reactor half. Survival gate (`hp > 0` post-hit) runs before the runner's Brave roll. `system_heal` already existed. `damage_split` in `src/content/abilities/damage-split.ts`, registered, 2 SP reaction. **Not equipped on any class yet — S54.**
- **Piece 1 — Mutable terrain.** `system_terrain_change` action (per-cast `tileChanges` with original+new elevation/terrain), reducer produces structurally-shared `map.tiles`. **Fall damage lives in this reducer:** an occupied tile that *drops* emits `'falling'` `system_damage` via the shared helper; a *rising* tile emits nothing → the blueprint's raise/revert asymmetry for free.
- **Piece 4 — Fall-damage helper.** `src/engine/map/fall-damage.ts` (`fallDamageAction`, `FALLING_DAMAGE_PER_LEVEL`), extracted from `knockback.ts` (no-op refactor). Single `> 1` gate shared by knockback + terrain. **Settled at session start: Worldcraft reuses the natural gate**, so Hill/Valley corner tiles (±1) deal 0 fall damage.
- **Pieces 2 & 3 — Pathfinding + AoE (zero substrate).** Regression tests mutate terrain through the reducer and confirm `getLegalMoves` / `aoeFootprint` recompute. No engine change.
- **Piece 7 — Renderer redraw.** `battle-renderer.playActions` calls `redrawStaticLayers()` on any committed `system_terrain_change` (also barrier actions). Instant; no animation. Animator returns null for the three new no-tween actions.
- **Piece 9 — Effect queue.** `Unit.worldcraftEffects` (union of `terrain`/`barrier` entries; `src/engine/effects/queue.ts`). `enqueueWorldcraftEffect` reads cap via `runModifyStatQuery('worldcraft_effect_cap')` (base 2; synthetic Expert Former test proves +2 composes), serial-LIFO-evicts with revert actions. `decrementBarrierTtls` wired into `reduceTurnStart` (no-op for non-Terraformers — returns the same unit ref).
- **Piece 5 — Barrier objects.** `Tile.barrier?: { hp, ttl, ownerId }`. Impassable (`canStep`/`canLeapTo`) and **LoS-blocking** (Chris's call; inclusive lower bound so a wall between same-elevation units blocks the eye-level ray). `system_barrier_change` (spawn/clear) + `system_barrier_damage` (HP, destroy-at-0, pipeline-bypass).

### Two deviations / decisions worth Chris's eyes at review

1. **Barrier damage uses a parallel `system_barrier_damage`, not literally `system_damage`.** The brief said "via `system_damage`," but that action is `targetId: UnitId`; a barrier is tile-addressed. Overloading it to a unit|tile union would ripple through every bypass consumer. The parallel action keeps the *exact* bypass property (no variance/Faith/resistance/reactions) without the ripple. Documented in ADR-0088 §4. **If you'd rather overload `system_damage`, it's a contained change — flag it.**
2. **Live attack/AoE → barrier-damage routing is deferred to S54.** The *mechanism* (`system_barrier_damage` + destruction + multi-tile independence) is built and tested. The wiring where a basic attack / AoE landing on a barrier tile emits barrier damage — and `validateAction` naming a barrier as a target — is content-coupled (needs the Barrier ability + barrier-aware attacks to be meaningful/testable). No S53 content creates or targets a barrier, so there was nothing to route. ADR-0088 "Deferred."

### Deferred / settle-in-S54

- **Barrier-TTL cadence under KO/Stop.** S53 ticks TTL on the owner's `turn_start`; a KO'd owner pauses its barriers' countdown. Blueprint wants "keeps ticking past KO." Tunable; settle in S54 with playtest. The tile-side `BarrierState.ttl` is a spawn snapshot — the queue entry is authoritative for expiry. (Also in playtest-watch S53.)
- **Renderer terrain-transition animation** — instant redraw only.

### S54 starting points (class + abilities)

- Terraformer ClassDefinition + Worldcraft command set (Pillar/Pit/Hill/Valley + Barrier). The Hill/Valley 3×3 kernels are *class content data* feeding `system_terrain_change` tileChanges — not an `aoeFootprint` change (audit confirmed).
- Worldcraft ability resolution: emit `system_terrain_change` (terrain) / `system_barrier_change` (barrier spawn), then call `enqueueWorldcraftEffect(state, catalog, caster, entry)` → `withUnit(newUnit)` + append `revertActions` to generatedActions.
- Wire native R/S/M onto the Terraformer free slots: `damage_split` (built), **Ignore Height** (`modifyStatQuery('jump')` → large value — one-liner per audit), **Expert Former** (`modifyStatQuery('worldcraft_effect_cap')` → +2 — the synthetic test in `queue.test.ts` is the template).
- Build the live attack/AoE → barrier-damage routing (the deferred piece) + `validateAction` barrier targetability.
- Equipment integration (mage armor + universal; Books synergy — Battle Dictionary's +1 PA matters for Barrier HP).

### Browser-verification note (environment carry-forward)

Stale `guide/` dev server still holds **5173**, so the game's `npm run dev` starts on **5174** and the preview tooling defaults to 5173. S53 substrate has no player-facing surface to exercise (no Worldcraft abilities yet); the bar was "app loads, no console errors," smoke-tested. If you bring up the preview, point it at `http://localhost:5174/`.

### Engine-side notes worth carrying forward

- **Three new system action types** (`system_terrain_change`, `system_barrier_change`, `system_barrier_damage`). All exhaustive switches updated (reduce dispatch, validate pass-through, commit envelope, animator no-tween, action-log formatter `[terrain]`/`[barrier]` rows). The `never`-guarded switches will fail the build if S54 adds a kind without a case.
- **`Unit.worldcraftEffects` is required** (empty default). Two construction sites carry it (`create-initial-state.ts`, ct test fixture). New Unit-builders must set it.
- **`map/test-fixtures.ts` `TileSpec` now carries optional `barrier`** (so `mapWith` can seed barriers).
- **LoS barrier semantics:** barriers block on an inclusive lower bound; `blocks_los` terrain keeps the strict `>` graze-pass. If S54 wants a "shoot over a low barrier from high ground" interaction, that asymmetry is the knob.

### Carry-forward (longer-term) — none addressed this session

Standing carries unchanged from S52: AI deployment role-aware sorting (Marshmoor sharpens the Tidewalker symptom), Skullclamp tax balance, Parrying Sword + Shimmer Cloak evasion stack, Absolom default-Brave WP, level-cap retune signal, Speed factor /40 ceiling, Combat Focus stacking lifecycle, Bulwark replacement, Pyromancer R/S/M consolidation, Speed Save / Updraft / Cornered Focus per-swing cap codification, renderer multi-swing polish, hill-height adjustment on Stonebridge, asymmetric siege scenario, terrain-bar mid-battle vanishing repro, larger teams beyond 5v5, team import, Calculator team-template revision, Calculator stretch abilities / AI personalities, damage-pipeline catalog re-lookup cleanup, `tagFilter` source inconsistency. **Marshmoor template-compliance tests** (S52 stretch) still not added.

**Terraformer arc:** substrate done (S53) → **class+abilities (S54)** → AI+UI (S55). Blueprint at `docs/thirtyNinePlanning/terraformer-blueprint.md` (updated: OQ#7 closed, substrate section marked built, phasing collapsed to 3). Audit at `docs/decisions/draft-terraformer-substrate-audit.md` (still a draft; ADR-0088 supersedes its decisions — archive or leave as the survey record).
