## ADR-0139: M2 XP & mid-battle level-up (`system_xp_award`)

**Status:** Accepted
**Date:** 2026-07-04
**Milestone:** TABA M2 (progression) — the XP / level-up piece
**Brief:** `docs/TABADesign/m2-progression-xp-jobtree-brief.md` (Part A)
**Builds on:** ADR-0137 (stat curves), ADR-0138 (JP economy)

## Context

M2's second currency is XP → levels. The brief's Part A is settled (the FFT
loop); Part B (the job tree) is the ADR-0138 JP work. The novel piece was
**mid-battle level-up** — Chris's explicit call for the FFT feel where a unit's
stat bars jump mid-fight, not just at the battle boundary.

The load-bearing constraint (established during the assessment): `Unit.baseStats`
is *stored* opaque data, computed at setup by the **content-side** stat curve
(`buildBaseStats` / `stat-curves.ts`), which the engine never imports (rule 1).
So the engine cannot recompute a unit's stats from a new level on its own — that
is what makes mid-battle level-up a real engine piece rather than a trivial add.

## The XP mechanic (from the brief, settled)

Per connecting, effect-having action by a leveling unit: `XP = base + (target_level
− unit_level)`, floored at 1; **+10 for a KO**; `base = 10`, `per_level = 100`, XP
rolls over. Rulings implemented: self/tile/math target → delta 0 (flat base);
**one grant per action** (AoE can't multi-earn — the delta reads the primary
target); **no-effect actions award 0** (heal-on-full, re-applied buff, total miss
— the anti-grind guard). XP is actor-only (no roster spillover, unlike JP).

## Decisions

### 1. One new action type: `system_xp_award`

Wired through all five `ActionType` sites (per `conventions/action-types.md`).
It carries `{ unitId, amount }` and its outcome carries `{ xpAfter, levelsGained,
newLevel }` so the log/animator branch (silent XP gain vs. "reached Level N!").
A single action (not a separate `system_level_up`) keeps the surface minimal —
the reducer accrues XP and applies any level-ups in one pass.

### 2. Emission is a generated action from the resolver (no new hook)

`buildXpAward` runs in the `use_ability` / `use_throw_item` / `charged_action_resolve`
reducers (the same connecting-action set as JP) and appends a `system_xp_award`
to `generatedActions` — mirroring how reactions are generated. No hook added
(rule 8 untouched). The equation (base/KO) lives in engine constants
(`XP_BASE_VALUE`, `XP_KO_BONUS`, `XP_PER_LEVEL`) — settled values, a candidate to
move onto the ruleset if per-ruleset tuning is ever wanted.

The no-effect guard compares each targeted unit (and the caster) **before vs.
after** for HP / MP / status-count change. The caster's **MP** is excluded — it's
the cast *cost*, not an effect, so a Cure on a full-HP ally (spends MP, heals
nothing) correctly earns nothing.

### 3. The stat-recompute boundary fix: `statsByLevel` threaded from the fold

Because the engine can't run the curve, the campaign fold **precomputes** each
deployed unit's `BaseStats` for the next few levels via `buildBaseStats` and
threads them in as `UnitPlacement.statsByLevel` → `Unit.statsByLevel` (re-keyed
to an absolute-level `Map`). The `system_xp_award` reducer just *indexes* it on
level-up, swaps `baseStats`, and bumps current HP/MP by the effective-max delta
(`runModifyStatQuery`, so equipment/status compose). Curve logic stays
content-side.

- **`LEVELUP_PRECOMPUTE_DEPTH` (default 3) is PARAMETERIZED** (Chris) — a unit
  earns ~0–1 levels/battle, so 3 is ample; dial it up cheaply if a use appears
  (e.g. an in-battle level-manipulation effect). An exhausted table stops
  leveling and the surplus XP carries to the boundary.
- **Presence of `statsByLevel` is the opt-in.** The engine stays progression-
  ignorant: a unit with the table earns/levels, one without (Mage War / demo)
  never does. Team-agnostic — campaign **enemies** will level too once battle-
  authoring stamps their tables (their JP/unlock tracking for a future recruit-
  conversion is likewise deferred to battle authoring; the model already supports
  per-unit progression on either team).

### 4. Carry-back

`CampaignUnit` gains `xp` (the between-battle remainder; save schema **v5**).
`applyBattleResult` reads the battle unit's final `level` + `xp` home for
survived/downed units (a `lost` unit banks nothing); the heal-to-full then fills
to the new, larger effective max.

## Consequences

- **LIVE in campaign play** (unlike the ADR-0138 gating, which stays dormant):
  the fold stamps every deployed player unit, so campaign units now earn XP and
  level up mid-battle, stats growing and HP/MP jumping, with levels carrying
  between battles. Player-facing → logged in the guide changelog.
- **Animator is a no-op for now** — the level-up shows via the action log
  ("reached Level N!") and the HP/MP bar jump; a floating "Level Up!" banner is a
  future polish primitive (would need a new animator AnimKind).
- **KO detection** reads the primary hits' `hpAfter === 0`; a KO purely from
  knockback/fall generated damage isn't credited the +10 (minor; the direct-hit
  case is covered).
- **XP is engine-tracked mid-battle; JP is not** (JP is a between-battle post-hoc
  read with roster spillover). The two differ by design — JP's bench spillover
  can't be a per-battle-unit accrual.

## Files

- `src/engine/types/action.ts` — `system_xp_award` type + payload/outcome + unions.
- `src/engine/types/unit.ts` / `battle-config.ts` — `xp` + `statsByLevel`.
- `src/engine/setup/create-initial-state.ts` — thread + re-key to absolute-level Map.
- `src/engine/actions/reducers.ts` — `reduceSystemXpAward` + `buildXpAward` emission
  in the three resolver paths; `reduce.ts` / `validate.ts` / `commit.ts` dispatch;
  `ui/action-log-format.ts` + `renderer/animator.ts` (5-site wiring).
- `src/campaign/` — `CampaignUnit.xp`, serialization v5, roster, `snapshot-fold`
  (`LEVELUP_PRECOMPUTE_DEPTH` + precompute), `apply-back` (carry level/xp).
- Tests: `xp-levelup.test.ts` (reducer), `xp-emission.test.ts` (emission +
  no-effect guard), plus campaign carry/serialization.
