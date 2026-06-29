# TABA M0 — Findings: the unit-model boundary

**Type:** Discovery / read-only audit (answers `taba-m0-unit-boundary-audit.md`). No code
written, no refactor. Read the model, mapped it, categorized it, recommendation in §E.

**Scope note (per Chris, for the planner downstream):** this audit is unit-model-centric.
The **S70 registry/combiner seam** is mapped *lightly* (it's entry-boundary-adjacent — see §B);
the **Mage War shell's setup path specifically** (the §2 "product-agnostic core" boundary-drawing
job) is **deliberately out of scope here** and is flagged for the planner as separate downstream
work. Good news from the audit: that seam is *already* product-agnostic by construction (see §E,
last paragraph) — MW and the campaign both go through the same `BattleConfig` → `createInitialState`
funnel, so the divergence is purely "what each shell sets / reads," not engine surgery.

---

## TL;DR (the headline)

The assumption in the brief — *"there may or may not already be a durable-template vs
battle-instance split"* — resolves cleanly:

- **In running *state*, there is no split**: one `Unit` type ([unit.ts](../../src/engine/types/unit.ts)),
  partly `readonly` identity/loadout, partly mutable vitals/ct/position/statuses, held in
  `GameState.units` and threaded through the reducer.
- **But in the *config* pipeline, the split already effectively exists** as a three-stage chain:
  **`BuiltUnit` → `UnitPlacement` → `Unit`**. The first stage (`BuiltUnit`) is *already* a
  position-less, battle-agnostic "roster unit," and there are **two pure fold functions** that
  already do exactly the "fold a durable team into a battle-config template" move the campaign
  needs. The snapshot-in boundary is clean and pure.
- **The thin spot is the exit**: the battle emits only `{winner, conditionIndex, description}`.
  No per-unit delta object. *However* — every per-unit fact M0 needs (survival, final HP/wounds)
  is already sitting in the final `GameState.units` map; it just isn't *assembled* into a result.
- **The real snags are two, both small and known**: (1) durable **identity** — `BuiltUnit` has no
  id; ids are assigned *positionally from template slots* at config-build time, so identity is
  battle-local today; (2) **serialization** — `Map`s in `GameState`/`Unit` don't survive a naive
  JSON round-trip (matters only if M0 wants *mid-battle* save; between-battle save dodges it).

**Bottom line: the codebase is already ~80% of the way to "durable config → battle snapshot →
deltas out."** M0 is mostly *adding* a durable container + a result-summarizer at an existing seam,
not splitting a mutated god-object.

---

## The pipeline (the spine, as it exists today)

```
BuiltTeam (BuiltUnit[])          ← team-builder output / authored templates; NO position, NO id
  │  buildTeamBattleConfig(template, builtTeam, team)      [content/teams/build-team-battle-config.ts] — PURE fold
  ▼
BattleConfig (UnitPlacement[])   ← ids + placeholder positions injected from template slots
  │  buildDeployedBattleConfig(template, deploymentResult) [app/deployment-config.ts] — PURE fold (positions/facing)
  ▼
BattleConfig (deployed)
  │  createInitialState(config, catalog)                   [engine/setup/create-initial-state.ts] — PURE snapshot-in
  ▼
GameState { units: Map<UnitId, Unit>, ... }
  │  orchestrator: runPreBattlePhase → turn loop via commitAction
  ▼
GameState.outcome = { winner, conditionIndex, description }   ← terminal `battle_end` action; engine stops here
```

Everything left of `createInitialState` is **shell code producing plain config**; the engine only
ever sees a finished `BattleConfig`. That is the campaign's friend.

---

## A. The unit model itself

**Types & locations:**
- `Unit` — [src/engine/types/unit.ts](../../src/engine/types/unit.ts). The live battle entity.
- `UnitPlacement` — [src/engine/types/battle-config.ts](../../src/engine/types/battle-config.ts).
  "What a single unit looks like as it walks onto the battlefield." The config representation.
- `BuiltUnit` / `BuiltTeam` — [src/content/teams/built-team.ts](../../src/content/teams/built-team.ts).
  The team-builder's output; the closest thing to a durable roster unit that exists.

Notably, `UnitPlacement`'s own doc-comment already anticipates the campaign:
> *"Anything that might vary per battle goes here; persistent identity (class progression, items
> learned) lives off-battle and is folded in by the caller when constructing the placement."*

**Field categorization of `Unit`:**

| Field | Category | Notes |
|---|---|---|
| `id` | (1) durable identity* | *but currently minted positionally from template slots — see §D |
| `team` | battle-only | team assignment is per-battle (a roster unit isn't "Blue" forever) |
| `name` | (1) durable identity | |
| `classState.currentClass` | (1) durable identity | `classProgress` is **commented-out / not yet present** |
| `gender` | (1) durable identity | cosmetic (portrait variant) |
| `level` | (1) durable identity | M0 carries it but doesn't change it (no leveling) |
| `baseStats` | (4) **mixed** | class-layer (pa/ma/spd/maxHpBase/maxMpBase) **derived** from (class, level) via `buildBaseStats`; character-layer (brave/faith) durable; crit defaults uniform. **Today stored pre-computed on the placement.** See §E muddy-part. |
| `loadout` | (2) durable loadout | command sets + passive abilities per bucket |
| `equipment` | (2) durable loadout | 5-slot map; immutable mid-battle in v1 |
| `resistances` | (2) durable loadout (derived) | composed at setup from class baseline + placement overrides |
| `vitals` (hp/mp) | (3/4) **ephemeral, but persist-capable** | **see the wounds finding below** |
| `position`, `facing` | (3) battle-only | set by deployment |
| `ct` | (3) battle-only | seeded at battle start |
| `statuses` | (3) battle-only | reset each battle |
| `worldcraftEffects` | (3) battle-only | always starts empty |
| `stockpile` | (3) battle-only | rebuilt each battle from Field Kit passive grants |
| `turnsKOd`, `removed`, `airborne` | (3) battle-only | permadeath / transient flags |

**The wounds question (called out specifically in the brief):** current HP/MP **is** modeled
distinctly from max (`vitals` stored; `maxHp`/`maxMp` computed via `modifyStatQuery`). And
critically — **`UnitPlacement.vitals` is optional**: when an author supplies it, it persists into
the battle unmodified (`createInitialState` only auto-fills from computed maxes when vitals are
*omitted*; see `fillVitalsFromComputedMaxes`). The doc-comment literally says *"Authors who want a
unit to start damaged still pass `vitals` explicitly."*

➡ **"Wounds persist A→B" is already expressible in the current model** — a campaign carrying a
wounded unit into node B just sets `placement.vitals` to the carried-over value. No new field, no
engine change. (One caveat in §E.)

**No progression state exists yet.** `classProgress` and per-command-set `learning` appear only in
the design doc / commented stubs — not in the live `Unit`. Correct for M0 (progression is OUT).

## B. The entry boundary (team-builder / deployment → battle)

- **What crosses:** a plain-data `BattleConfig` (whose `units` are `UnitPlacement[]`). Fully
  declarative; no behavior, no closures, no class instances. `createInitialState(config, catalog)`
  is the single instantiation point.
- **Snapshot-in, not mutate-in-place:** `createInitialState` builds a *fresh* `Map<UnitId, Unit>`
  via `placementToUnit(...)`; it never writes back to the config. The config objects are inert
  inputs. ✔ This is exactly the "instantiate battle-state from config" the brief hoped for.
- **Two pure folds already exist** and are the precedent the campaign should reuse:
  - `buildTeamBattleConfig(template, builtTeam, team)` — folds a durable team into a config
    template, assigning each built unit the template slot's `id` + placeholder position.
  - `buildDeployedBattleConfig(template, deploymentResult)` — overwrites positions/facing from the
    deployment phase. Returns a new `BattleConfig`; "the engine never learns a deployment happened."
- **S70 registry/combiner seam (light touch):** the decomposition doc credits S70 with defining a
  battle node as *map + deployment zones + teams*. In code, deployment zones are a first-class
  config concept (`DeploymentZoneConfig`, ADR-0118) and `computeAiDeploymentResult` already spins up
  a throwaway `createInitialState` purely to read computed maxHP for deployment sorting. The
  campaign's "battle node" can be modeled as *(BattleConfig template minus the player team) + zones*,
  with the roster-fold supplying the player team — i.e., the combiner seam **is** `buildTeamBattleConfig`
  generalized. (Flagged for the planner; not chased further here.)

## C. The exit boundary (battle → result)

- **What the battle emits:** only `GameState.outcome: BattleOutcome` =
  `{ winner: TeamId, conditionIndex, description }` ([battle-outcome.ts](../../src/engine/types/battle-outcome.ts)),
  set by the terminal `battle_end` action ([action.ts](../../src/engine/types/action.ts) `BattleEndPayload`).
  That's the *entire* structured result. No surviving-unit list, no final-HP summary, no deltas.
- **But the data is all there:** the final `GameState.units` map holds every unit's terminal
  `vitals`, `statuses`, `removed`, `turnsKOd`. Survival = `hp > 0 && !removed`; wounds = final
  `vitals`. So the M0-relevant per-unit facts are **recoverable from final state** — they're just
  not *assembled*. (`BattleView` already reads `latestState.units` directly for its detail panel.)
- **Already decoupled from any consumer:** the engine sets `outcome` and then simply *refuses
  further commits* — it does not act on the result. The UI reads it. So the "battle reports a result
  it doesn't itself act on" property the brief wants is **already true**.
- **Enriching to a delta superset is easy and engine-safe:** the natural home is a **new pure
  function at the shell/seam** — `summarizeBattleResult(finalState[, initialRoster]) → BattleResult`
  — that walks `finalState.units` and emits the per-unit superset (survival, final vitals/wounds,
  and later XP/JP once progression tracks them). The engine needn't know the campaign exists; this
  reads public final state. For **M0 specifically**, the consumed subset (win/loss + survival, both
  pure-derivable today) requires **zero engine change**. XP/JP would need the battle to *track*
  deltas it doesn't today — but that's M2, explicitly OUT of M0.

## D. Serialization + identity

**Serialization:**
- Blockers to a naive `JSON.stringify` round-trip:
  - `GameState.units` is a `Map`; `Unit.resistances` and `Unit.stockpile` are `Map`s.
  - `StatusInstance.customState: Readonly<Record<string, unknown>>` — opaque escape-hatch payload
    (e.g. Charging carries a `ChargedActionId`); serializable in practice but untyped.
  - `WorldcraftEffectEntry` carries arrays of tile-change records — plain data, fine.
- Branded IDs (`UnitId`, etc.) are **runtime strings** — serialize and round-trip cleanly.
- **No existing serialization layer** anywhere (`serialize`/`toJSON`/`saveGame` grep is empty — all
  hits are comments). Save/load is genuinely greenfield.
- **Key scoping point for the planner:** the decomposition doc §3 frames save/load as *"serialize
  the campaign state,"* i.e. the **durable roster container**, not mid-battle `GameState`. If M0's
  "save/resume" means **between-battle** save (resume at the node graph, not mid-fight), the `Map`
  problem **never arises** — the durable container can be designed plain-serializable from line one
  (it'd be `BuiltUnit`-like data + ids + carried vitals). The `Map` round-trip problem only bites if
  M0 wants **mid-battle** save/resume. **Recommend the planner pin this** — it materially changes
  scope. (Default reading of the M0 brief: between-battle resume, so the `Map`s are a non-issue for M0.)

**Identity:**
- `UnitId` is a durable string *type*, but **today it's minted positionally**: `BuiltUnit` has **no
  id**; `buildTeamBattleConfig` assigns each built unit the *template slot's* id (`slot.id`). So a
  unit's identity is currently "its slot in this battle's template," i.e. **battle-local**, not a
  durable per-unit key.
- ➡ For the campaign, **the durable unit must own a stable id minted once (at recruitment) and
  carried into each battle's `UnitPlacement.id`.** Small but central change — it's the difference
  between "unit 3 in this battle" and "Ramza, across the campaign." This is the single most
  load-bearing identity change M0 introduces.

## E. Synthesis — where the seam wants to be (the recommendation)

**How close is it?** Very. The shape the campaign needs — *durable config → battle snapshot →
deltas out* — is already the de-facto architecture minus two pieces: a **durable container with
stable identity** on the front, and a **result-summarizer** on the back. The middle (snapshot-in via
`createInitialState`, the pure folds, the decoupled outcome) is built and clean.

**Proposed split (prose sketch — types are the M0 brief's job):**

1. **`CampaignUnit` (durable, lives in campaign state).** Essentially `BuiltUnit` **+ a stable
   minted `id`** **+ carry-state** (current vitals / wounds; later XP/JP/learned per ADR). Crucial
   design call, consistent with CLAUDE.md ground rule 5 (*computed vs stored*): **store the
   *inputs* — `(classId, level, brave, faith, loadout, equipment, gender)` — and the carry-state
   (vitals), NOT the derived `baseStats`.** Recompute `baseStats` via `buildBaseStats(class, brave,
   faith, level)` at fold time. This keeps the muddy mixed `baseStats` field (see §A) out of the
   durable model and makes the durable unit trivially serializable.

2. **Snapshot (campaign → battle).** A campaign-side fold — the generalization of
   `buildTeamBattleConfig` — turns the deployed roster (K-of-N) into `UnitPlacement[]`, injecting:
   the **stable id** (no longer positional), the recomputed `baseStats`, and the **carried
   `vitals`** (explicitly, so wounds persist — the one mechanism already supported). Then
   `createInitialState` runs **unchanged**.

3. **Deltas out (battle → campaign).** A new pure `summarizeBattleResult(finalState) → BattleResult`
   at the shell/seam (§C). It emits the **superset**; M0 **consumes the subset** (outcome +
   per-unit survival, optionally carried wounds). The campaign then **applies** the result back to
   the `CampaignUnit`s (mark dead/removed, write back vitals).

**The muddiest part (the single thing hardest to cleanly separate):** it's a **two-way tie**, both
already named above —
- **(a) Identity.** `BuiltUnit` carries no id and ids are positional/template-derived (§D). Until a
  durable id is minted upstream and threaded through the fold, "the same unit across battles" isn't
  expressible. This is *the* spine change.
- **(b) `baseStats` is a mixed, pre-computed field** (class-layer derived + character-layer durable,
  frozen onto the placement). It's the one field that violates store-inputs-not-derived if copied
  verbatim into the durable model. The fix (store inputs, recompute at fold) is clean and cheap, but
  it's the place where "what persists vs what's recomputed" is muddiest and must be decided
  deliberately — especially because **M2 progression will mutate exactly these inputs** (level, and
  eventually learned abilities), so getting the durable shape right *now* pays off then.

  *Minor caveat on the wounds path:* carried `vitals.hp` must be clamped against the **recomputed**
  max at fold time (equipment/level could differ between nodes). Trivial, but the brief should name it.

**Existing precedents to compose on (don't invent):**
- The **two pure folds** (`buildTeamBattleConfig`, `buildDeployedBattleConfig`) — the campaign's
  snapshot step is a third sibling in the same family.
- **`createInitialState`** — the pure, mutation-free "config → initial state" step; lean on it
  as-is.
- The **immutable-state + action-log + decoupled-`outcome`** architecture — gives a clean "result
  the battle doesn't act on" for free, which is precisely the "emit superset, consume subset" seam.

**Why this stays product-agnostic (the §2 invariant, confirmed from the audit):** because MW and
the campaign both funnel through `BattleConfig → createInitialState`, and the result is already a
public, un-acted-on `outcome` + final-units map, the two shells diverge **only** in (a) who builds
the `BattleConfig` (a one-shot setup vs a roster fold) and (b) who reads the result (MW reads
win/loss; the campaign also reads the per-unit superset). MW keeps working by simply **not setting**
carried vitals / progression and **not reading** the delta summary. No engine-side branching, no
shell-specific logic in the core. ✔ The product-agnostic seam the decomposition doc §2 demands is
**naturally where the code already cuts** — which is the strongest signal that M0 is shell-addition,
not engine surgery.
