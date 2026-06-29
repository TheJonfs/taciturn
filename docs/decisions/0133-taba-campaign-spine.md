## ADR-0133: The TABA campaign spine — durable unit identity + the snapshot/apply boundary (M0)

**Status:** Accepted
**Date:** 2026-06-29

## Context

TABA ("There and Back Again") is the campaign expansion: units persisting across
an authored sequence of battles, with progression and team economy between them
(`docs/TABADesign/campaign-decomposition.md`). M0 — the **spine slice** — de-risks
the expensive-to-rework foundation before any feature layer stands on it: a
two-node campaign where the *same persistent units* fight node A, carry their
state to node B, with between-battle save/resume and win/loss. Progression,
economy, branching, and story are all later milestones.

A read-only pre-design audit (`taba-m0-unit-boundary-findings.md`) established
the key fact: **the codebase is ~80% of the way there.** The config pipeline
already carries a durable-vs-battle split via two pure folds
(`buildTeamBattleConfig` → `buildDeployedBattleConfig` → `createInitialState`),
`createInitialState` is already a pure snapshot-in, the engine already emits a
result it doesn't act on (`GameState.outcome` + final-units map), and carried
vitals already pass through unmodified (`UnitPlacement.vitals` is optional and
persists when supplied). M0 is **shell addition at existing pure seams — no
engine surgery.**

This ADR records the spine's load-bearing decisions. Chunk 1 (this commit) ships
the durable container + identity + authored roster + serialization; Chunks 2–3
(the snapshot-fold / summarizer / apply-back, then the node graph + loop +
Formation) build on it.

## Decisions

### 1. A new `src/campaign/` shell region; the core stays product-agnostic

The campaign is a **shell** that consumes the shared core (engine + content) and
is consumed by the app. Nothing in the core imports from `src/campaign/`. This is
the §2 "three parts, one engine" invariant: Mage War and the campaign both funnel
through `BattleConfig → createInitialState` and both read the same public,
un-acted-on `outcome` + final-units map. They diverge *only* in who builds the
config (a one-shot setup vs a roster fold) and who reads the result (MW reads
win/loss; the campaign also reads the per-unit superset). **No engine-side
branching, no shell-specific logic in the core** — confirmed by the audit, not
just asserted.

### 2. `CampaignUnit` stores INPUTS, never derived state (D-A)

The durable unit holds `(classId, level, brave, faith, loadout, equipment,
gender)` + carried `vitals` + a stable `id`, name, and `fate` marker. It
deliberately does **not** store `baseStats` — those are recomputed at fold time
via `buildBaseStats(classId, brave, faith, level)`. This honors CLAUDE.md ground
rule 5 (store inputs, not derived) and keeps the muddiest field in the live model
(the mixed class-derived/character-durable `baseStats`) out of the durable shape.

It is also **forward-compatible with M2**, which mutates exactly these inputs
(level now, learned abilities later). Getting the durable shape right here is what
makes M2 a data change rather than a re-architecture.

### 3. Stable minted identity, threaded — not positional (D-B)

A unit's `id` is minted **once at roster authoring** and carried into every
battle's `UnitPlacement.id`. This replaces the engine's current *positional* id
assignment (`buildTeamBattleConfig` hands each unit the template slot's id). It is
**the single most load-bearing change in M0**: the difference between "unit 3 in
this battle" and "the same unit across the campaign." The campaign's snapshot-fold
(Chunk 2) will inject the durable id instead of the slot id — Mage War's positional
assignment is untouched (its units are ephemeral, so slot-local identity is fine).

### 4. Between-battle save only; the container is plain-serializable by line one (D-C)

The save target is the durable `CampaignState` container (roster + node-graph
*position* + phase), **never mid-battle `GameState`**. Because the container is
plain data by construction — no `Map`/`Set`, class instances, or closures — save
is a thin `JSON.stringify` and load is `JSON.parse` + a **loud structural
validation** (CLAUDE.md: fail loud, no silent coercion). The `Map`-round-trip and
opaque-`customState` problems that live in `GameState` never arise. The
node-*graph definition* (maps, enemy teams, zones) is static authored content
referenced by `nodeIndex`, not serialized (CLAUDE.md rule 4, identity by ID).
Mid-battle save is explicitly way-down-the-road.

### 5. Three terminal fates, two durable outcomes; `lost` is marked, not deleted (D-D)

Each unit is classified from final battle state: **survived** (`hp > 0`),
**downed** (`hp === 0 && !removed`), **lost** (`removed === true` — the S39a
permadeath flag, which *is* reachable in a real battle when a KO'd unit's
`turnsKOd` crosses the ruleset threshold). M0 handling (Chunk 2 apply-back):
survived + downed stay on the roster, healed to full; **lost is flagged
(`fate: 'lost'`) on the durable record — not hard-deleted — and dropped from the
next deploy roster.** Keeping the record means future "effortful restoration" or
true permadelete is a *rules change reading the marker*, not a rearchitecture.

### 6. Heal-to-full is a rule; the carry-vitals path is still exercised (D-E)

M0 heals everyone to full between battles (FFT-style), so wounds don't actually
carry yet. But `vitals` is a stored field on `CampaignUnit` and the snapshot-fold
(Chunk 2) will supply it **explicitly** (clamped to the recomputed effective max),
exercising the persist-vitals path rather than relying on `createInitialState`'s
auto-fill. When attrition-style wounds-carry lands later, it's a one-line change
in apply-back (write final vitals instead of full) — the plumbing is already
proven. (Chunk 1 authors *provisional* full vitals from the base maxes; the
true effective-full normalization, which needs the catalog to read
equipment-adjusted maxes, lands with the fold in Chunk 2.)

### 7. The campaign drives the *interactive* battle via an additive `BattleView` callback

The battle is "pure transition" for the engine but an interactive React/Pixi
session for the shell. The campaign loop (Chunk 3) reuses `DeploymentScreen` and
`BattleView` unchanged except for **one additive optional prop** —
`onBattleEnd(finalState)` — slotted into the spot where `BattleView` already
detects `step.done` / reads `outcome` and already fires `onExitTo*` callbacks. MW
passes no `onBattleEnd` and behaves identically; the campaign passes one and owns
its post-battle continuation (in place of MW's `ResultsScreen` "New Battle / Main
Menu"). This is "emit superset, consume subset" at the component boundary. **MW's
team builder, slot-derived levels, setup picker, pass-and-play, and results UI are
all untouched** — the campaign reaches the shared battle runtime through a
parallel entrance, bypassing MW's setup chain rather than refactoring it. (The §2
Mage-War-shell-setup boundary refactor is confirmed unnecessary for M0 and
deferred as separate downstream work.)

## Consequences

- A `@campaign` path alias is added (tsconfig + vite), siblings to the existing
  region aliases.
- The durable model is greenfield and serializable; no engine changes were
  required for Chunk 1 (and none are expected for M0 — flag immediately if the
  work seems to need one).
- N (roster size) and K (per-node deploy cap) are parameters, not the hardcoded
  team-of-5; M0 wires only the campaign side (no MW deploy retrofit).
- The durable-roster machinery is **player-side only** — enemies are ordinary
  battle-local `UnitPlacement`s; apply-back writes back only player-roster units
  matched by stable id.

## Alternatives considered

- **Store `baseStats` on the durable unit** (copy the placement verbatim).
  Rejected — it's derived state (rule 5) and the one field that mixes
  class-derived and character-durable layers; recomputing at fold is clean and
  cheap, and M2 mutates the inputs anyway.
- **A parallel `CampaignApp` that re-mounts the battle components independently**
  (instead of the additive `onBattleEnd` prop on the shared `BattleView`).
  Rejected — duplicates the orchestrator wiring and risks drift; the additive
  callback keeps one battle runtime.
- **Serialize mid-battle `GameState` for save/resume.** Rejected for M0 — it drags
  in the `Map`/opaque-payload round-trip problem for no M0 benefit; between-battle
  resume is the design intent.
