# TABA M0 — The Spine Slice (campaign de-risker)

*The first TABA milestone (see `campaign-decomposition.md` §8). Goal: prove the campaign spine
end-to-end with the thinnest genuine two-battle campaign — author a roster, deploy K-of-N at node A,
fight, carry the **same persistent units** to node B, fight, win/lose, with **between-battle
save/resume**. Progression, economy, story, and branching are all OUT. This milestone de-risks the
expensive-to-rework foundation (persistent identity + battle-as-pure-transition) before any feature
layer stands on it.*

**This brief is unusually settled** because the pre-design audit (`taba-m0-findings`, read it first)
already did the discovery. The headline finding: **the codebase is ~80% of the way there.** The
config pipeline already carries the durable-vs-battle split (`BuiltUnit → UnitPlacement → Unit`) via
**pure folds**, `createInitialState` is already a pure snapshot-in, the engine already emits a
result it doesn't act on, and **carried vitals already pass through unmodified**. M0 is *shell
addition at existing pure seams* — **no engine surgery**.

## Context — the spine, as it already exists

```
CampaignUnit[]  (durable roster — NEW)
  │  snapshot-fold (NEW; sibling of buildTeamBattleConfig)   ← inject stable id, recomputed baseStats, carried vitals
  ▼
BattleConfig (UnitPlacement[])  →  buildDeployedBattleConfig (EXISTS)  →  createInitialState (EXISTS, UNCHANGED)
  ▼
GameState  →  orchestrator turn loop  →  GameState.outcome + final units map
  │  summarizeBattleResult (NEW; pure shell fn reads public final state)
  ▼
BattleResult  →  apply-back (NEW; fate classification → write durable roster)  →  CampaignUnit[]
```

Everything the engine sees is a finished `BattleConfig`; everything it emits is a public
un-acted-on `outcome` + final-units map. The two new pure functions (fold in, summarize out) bracket
the existing engine without touching it. **Mage War keeps working by simply not setting carried
vitals and not reading the result summary** — confirmed product-agnostic by the audit (§E).

## Inputs

- **`taba-m0-findings`** (the audit) — the authoritative map of the current model. Key references:
  `Unit` (`src/engine/types/unit.ts`), `UnitPlacement` (`src/engine/types/battle-config.ts`),
  `BuiltUnit`/`BuiltTeam` (`src/content/teams/built-team.ts`), the two folds
  (`buildTeamBattleConfig`, `buildDeployedBattleConfig`), `createInitialState`, `BattleOutcome`.
- `campaign-decomposition.md` — vision + roadmap (§3 spine, §8 M0 scope).
- The repo (engine ADRs, `CLAUDE.md` — note ground rule 5: store inputs, not derived state).

## Goal

A runnable two-node campaign: author a fixed roster of `CampaignUnit`s → deploy K-of-N at node A →
fight (existing battle) → summarize result → apply back to the roster (heal survivors/downed, mark
lost) → advance to node B → deploy → fight → win/lose → campaign end. Save between battles and
resume. Persistent unit identity across both battles. Mage War unaffected.

## Settled design decisions (resolved by the audit + Chris — recorded, not open)

- **D-A — Store inputs, not derived state.** `CampaignUnit` holds the *inputs*
  `(classId, level, brave, faith, loadout, equipment, gender)` + carried vitals + stable id + name +
  a terminal-fate marker. **`baseStats` is recomputed at fold time** via `buildBaseStats(...)`, never
  persisted. (CLAUDE.md rule 5; forward-compatible with M2, which mutates exactly these inputs.)
- **D-B — Stable minted identity.** A unit's `id` is minted **once at roster authoring** and carried
  into each battle's `UnitPlacement.id`. This replaces today's *positional* id assignment (where
  `buildTeamBattleConfig` hands each unit the template slot's id). **The single most load-bearing
  change in M0** — it's what makes "the same unit across battles" expressible.
- **D-C — Between-battle save only.** Serialize the **durable campaign container** (roster + graph
  position), never mid-battle `GameState`. The container is designed **plain-serializable from line
  one** — so the `Map`/opaque-payload round-trip problems in `GameState` never arise. Mid-battle save
  is explicitly way-down-the-road.
- **D-D — Three terminal fates, two durable outcomes.** Classify each unit from final state:
  **survived** (`hp > 0`), **downed** (`hp === 0 && !removed`), **lost** (`removed === true`).
  M0 handling: **survived + downed stay on the roster and are healed to full** at the between-battle
  boundary; **lost is flagged** (`fate: 'lost'`) on the durable unit — **not hard-deleted** — and
  dropped from the next deploy roster. The durable record persists, so future "effortful restoration"
  or true permadelete is a *rules change reading the marker*, not a rearchitecture.
- **D-E — Heal-to-full is a rule, not missing plumbing.** M0 heals everyone to full between battles
  (FFT-style), so wounds don't actually carry yet. **But the snapshot-fold must still supply
  `vitals` explicitly** (carrying the durable unit's stored vitals, which happen to be full),
  **exercising the persist-vitals path** — NOT omit vitals and rely on `createInitialState`'s
  auto-fill, which would *skip* the carry plumbing. When attrition-style wounds-carry lands later,
  it's a one-line change in apply-back (write final vitals instead of full); the plumbing is already
  proven. **State this so the implementer doesn't optimize the vitals fold away as "unused."**

## Roster authoring, the level model, and the node / enemy / map mechanism (M0 specifics)

These resolve "how is the campaign roster authored" and "where do maps + enemies come from" — both
of which diverge from Mage War's team-builder flow.

**Roster authoring & level (bypasses MW's per-slot-level flow entirely):**
- Level is a **durable per-unit stored input** on `CampaignUnit` (per D-A), *not* a per-slot
  authoring knob. MW's "map a level to each of the five slots" is not used.
- The M0 roster is authored as **data** (a file of `CampaignUnit` literals) — **no authoring UI in
  M0**. The only campaign UI M0 builds is the deploy selection (Formation).
- Each unit carries its own `level`; M0 authors a **uniform baseline** (≈25, a tuning value —
  pick it so the reused enemies below are *winnable*). Nothing structural forces uniformity (mixed
  levels are expressible; M0 just authors flat).
- *(Far-future, not M0: the team-builder could be adapted into a roster-authoring UI with durable-
  level semantics. Do not scope it here.)*

**N and K are parameters, not the hardcoded 5:**
- **N** = roster size (a campaign-roster property). **K** = deploy cap (a **per-node** property —
  "deploy up to K here"). The Formation screen selects up to K of the N `active` units; deployment
  positions them. M0 authors e.g. N≈8, K≈5 (illustrative).
- Build the K/N parameters **generally** (so MW *could* adopt deploy-K-of-N later) but **only wire
  the campaign side** — **retrofitting MW's deploy model is explicitly OUT of M0** (don't let this
  become a deploy refactor).
- **Pre-impl confirm (the deployment question the unit audit didn't probe):** does the deployment
  phase already support deploying **K-of-N with K < team size**, or does MW deploy its whole authored
  team? If selection exists, Formation just drives it; if not, Formation is where the K-of-N
  subset-selection gets built. Either way it's in scope — this just determines Chunk 3's weight.

**The node / enemy / map mechanism (a node is a partial BattleConfig):**
- A battle node is authored as **map + enemy team + player deploy zones + K** (+ optional win/loss
  conditions). The snapshot-fold drops the player roster into the empty player slots — i.e. the node
  is "(BattleConfig − player team)," exactly as the audit found.
- **The durable-roster machinery is player-side ONLY.** Enemies are ordinary **battle-local
  `UnitPlacement`s** — no `CampaignUnit`, no stable id, no carry-state (they don't persist across the
  campaign). Consequently the **apply-back writes back only player-roster units (matched by stable
  id)** and ignores enemy units in final state.
- **M0 populates enemies the lazy way: reference existing default teams + existing maps** for the two
  nodes (near-zero authoring; the spine doesn't care about encounter quality, only that two battles
  resolve to win/loss). Caveat: align the player baseline level with the reused enemies so fights are
  **winnable** — the loop test needs to reach **both** outcomes (advance-on-win, end-on-loss). If the
  defaults won't line up to something playable, **fall back to hand-authoring two small enemy teams as
  data** for level control. The node format supports either a team-reference or inline placements.
- Win/loss conditions **default to standard rout** (defeat all enemies / player wiped); the node may
  carry custom conditions but M0 authors none. Authored-and-balanced (and generated) encounters are
  M4.

## Pre-implementation plan (light — the heavy audit is done)

Confirm only the few things the unit-model audit didn't cover:
1. **Formation/deploy reuse** — how the existing deployment phase consumes a team selection, so the
   minimal Formation screen feeds it rather than reinventing it (`DeploymentZoneConfig`,
   `computeAiDeploymentResult`, the deployment-phase entry). *Audit-unconfirmed; this is the one piece
   designed from reasoning — expect it thin, but verify.*
2. **`buildBaseStats` signature** — exact inputs for the fold-time recompute.
3. **Campaign code-region placement** — where the new shell lives (a `src/campaign/` region for
   container/fold/summarizer/apply-back/graph/loop; Formation UI in the UI layer), consistent with the
   existing layer structure.

## Implementation work — three chunks

### Chunk 1 — The durable container + stable identity (the spine)
- **`CampaignUnit`** (the stored-inputs shape per D-A) + **stable id minting** (D-B), plus the name
  and the `fate` marker (`'active' | 'lost'`, default `'active'`).
- **The campaign-state container**: the roster (`CampaignUnit[]`), the node-graph position, and
  whatever the save slot needs. **Plain-serializable** — no `Map`s, class instances, or closures.
- **Author the M0 roster** as `CampaignUnit`s (a fixed handful — enough to deploy K-of-N twice).
- *Independently testable:* type round-trips, id stability, serialize→deserialize of the container.

### Chunk 2 — Snapshot-fold + result-summarizer + apply-back (the loop's pure core)
- **Snapshot-fold** (the third sibling to `buildTeamBattleConfig`): deployed roster selection
  (K-of-N) → `UnitPlacement[]`, injecting the **stable id** (not positional), the **recomputed
  baseStats**, and the **carried vitals supplied explicitly** (D-E), **clamped to the recomputed max**
  (equipment/level may differ between nodes). Then hand off to the existing
  `buildDeployedBattleConfig` → `createInitialState` (unchanged).
- **`summarizeBattleResult(finalState) → BattleResult`**: a **pure shell function** walking
  `finalState.units`, emitting the per-unit superset it can derive — survival, final vitals, and the
  terminal fate. (M0 emits what it can derive; M2 extends this with XP/JP once the battle tracks
  them. Don't pre-build empty M2 fields.)
- **Apply-back**: classify each unit (D-D), then write the durable roster — survived/downed → heal to
  full + keep; lost → set `fate: 'lost'`. Returns the updated `CampaignUnit[]`.
- *Independently testable:* the fold against `createInitialState`; the summarizer on a constructed
  final state; the apply-back's fate classification + heal/mark behavior. These are pure — test hard.

### Chunk 3 — Node-graph + minimal Formation + save + loop (the slice)
- **Data-driven 2-node graph** (linear A→B; authored). Each node = a `BattleConfig` template *minus
  the player team* + zones; the snapshot-fold supplies the player team. (Linear only — branching is
  M1.)
- **Minimal Formation screen**: select K-of-N from the roster (`active` units only) → feed the
  existing deployment phase. Thin selection UI over `CampaignUnit[]`; lean on deployment machinery.
- **Between-battle save/resume**: serialize the container after each apply-back; resume → continue at
  the next node with the post-battle roster. Round-trips cleanly (D-C).
- **Loop orchestration**: deploy → fight → summarize → apply-back → heal → advance → (repeat) →
  win/lose end.
- *Verify by hand:* the end-to-end two-battle run + save/resume (integration + UI, less unit-testable).

## Acceptance criteria

- A two-node campaign runs end-to-end: author roster → deploy node A → fight → carry the **same
  units (stable id)** to node B → deploy → fight → win/lose → end.
- **Persistent identity**: each deployed unit is the same durable entity across both battles (id
  minted once, threaded — not regenerated per battle).
- **Fate classification (D-D)**: survived/downed stay (healed to full); lost is marked + dropped from
  node B's deploy roster, durable record retained.
- **Save/resume (D-C)**: serialize after node A's apply-back; resume → node B with the post-node-A
  roster; clean round-trip.
- **Vitals carry path exercised (D-E)**: the fold supplies vitals explicitly (full in M0); clamped to
  recomputed max; baseStats recomputed (not persisted).
- **Mage War unchanged**: still runs; no engine branching; MW sets no carried vitals and reads no
  result summary.
- `createInitialState` is untouched; the result-summarizer reads only public final state.
- Suite green; `tsc -b` + `vite build` clean; ADR for the campaign spine.

## Out of scope

- **Mid-battle save** (D-C — way-down-the-road).
- **Progression** (XP/JP/level/unlock) — M2. No `classProgress`/`learning` work.
- **Economy / gear-acquisition** — M3.
- **Generated encounters** — M4 (M0 is authored).
- **Branching graph** — M1 (M0 is linear A→B).
- **Story** — M5.
- **True permadelete + effortful restoration** — M0 marks `lost` + drops from roster; the long-term
  death rules read the marker later.
- **Wounds actually carrying** — M0 heals to full; plumbing built + exercised, the rule is later.
- **The §2 Mage-War-shell-setup boundary refactor** — the audit confirmed the seam is *already*
  product-agnostic, so M0 needs no MW refactor. (Flagged by the audit as separate downstream planner
  work, not M0.)

## Files (hedged — confirm placement in pre-impl)

New campaign shell region (likely `src/campaign/`): `CampaignUnit` + container types, id minting,
roster authoring, the snapshot-fold, `summarizeBattleResult`, apply-back, the node-graph, the loop
orchestration, save/load. Formation UI in the UI layer. ADR for the spine. Vitest for the pure
core (fold, summarizer, apply-back, container round-trip) + an end-to-end loop test. **No engine
changes expected** — flag immediately if the work seems to require one (it shouldn't).

## Watch-fors

- **Don't hardcode the deploy count to 5** — K is a per-node parameter, N is the roster size; build
  them general but wire only the campaign side (no MW deploy retrofit in M0).
- **Durable machinery is player-side only** — enemies are battle-local placements; the apply-back
  matches and writes back **only** player-roster units by stable id, ignoring enemy final state.
- **Don't omit vitals in the fold** — supply them explicitly (D-E), or the carry path is skipped via
  auto-fill and the plumbing isn't actually proven.
- **Clamp carried vitals to the recomputed max** at fold time (equipment/level differences between
  nodes).
- **Keep the durable container plain-serializable** — it's the save target; no `Map`s/instances/
  closures leaking in.
- **Don't persist derived `baseStats`** — store inputs, recompute at fold (the muddiest field per the
  audit; M2 will mutate these inputs, so the shape must be right now).
- **Mint the stable id once** (authoring), thread it — never regenerate per battle.
- **Verify MW still runs** — it shouldn't break (it doesn't touch the new paths), but confirm.

## Estimated size

Large — the first campaign milestone: a new shell region + the spine + the pure loop core + save/load
+ a minimal Formation, across three chunks; likely a session-plus. **But heavily de-risked** by the
audit: no engine surgery, the snapshot-in + decoupled-outcome + vitals-carry all exist, and the two
new seam functions compose on proven pure folds. Chunks 1–2 are pure-function-heavy (test hard);
chunk 3 is integration/UI (hand-verify). The audit turned this from "split a mutated god-object"
into "add a durable front and a summarizer back at seams that already cut the right way."
