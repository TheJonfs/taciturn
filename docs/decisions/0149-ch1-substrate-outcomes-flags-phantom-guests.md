# ADR-0149: Ch1 substrate — outcome conditions, campaign flags, phantom edge, guest allies

**Status:** Accepted (2026-07-12, Session 92)

**Context:** The Chapter 1 arc (linear spine 0→10) needs four capabilities that
did not exist: special battle-end logic at nodes 3/8/9/10 (a cutscene-immortal
recurring antagonist; two subdue-without-killing fights with good/standard
outcomes), a persistent store those outcomes write to and later content reads
from, a visible-but-unreachable map destination (Old Ordal → Viura), and
player-side AI-driven guest units (Oskun node 1, Sera at Ordal Canyon node 6).
Per `docs/TABADesign/taba-ch1-substrate-brief.md`, this substrate precedes the
Ch1 Atlas layout. All four shipped in one session.

## WI1 — Victory-condition grammar, death protection, death tracking

**Decision: extend the closed `VictoryCondition` union with a `predicate`
variant carrying a composable predicate + explicit winner + optional outcome
tag.** The evaluator (`engine/turn/evaluate-battle-outcome.ts`) was built for
this: exhaustive switch, first-satisfied-wins ordering, re-checked after every
committed action (ADR-0074) — so an early-termination subdue win fires at the
exact action that satisfies it (D-sub-2, confirmed by Chris: the subdue
predicate ENDS the battle as a win). The evaluator gained a `catalog` param
(`unit_below_hp` reads effective max HP through `runModifyStatQuery` — rule 5,
computed never stored).

Grammar (`VictoryPredicate`): `all_defeated(side)` · `no_deaths(side)` ·
`unit_below_hp(unit|side, fraction)` · `all_of([...])` (shallow AND). No OR
variant — OR is two conditions in the ordered list. Semantics pinned by tests:

- **Strict `<`** for below-threshold (an enemy at exactly 25% is not subdued).
- **`hasDied` is forever** — a new battle-scoped `Unit.hasDied` flag set on the
  hp>0→0 transition and never reset; a revived enemy still counts as having
  died (the brief's watch-for).
- **Not-standing counts as below any threshold** — a boss lethal-hit through
  protection satisfies `unit_below_hp` (beaten past the line is past the line).

**Death protection** is a `UnitPlacement.deathProtected` flag (authored;
placement→Unit passthrough). All three HP-lowering writers (ability pipeline,
`system_damage`, cover redirect) settle through one shared helper
(`settleHpLoss` in reducers.ts): lethal on a protected unit floors HP at 0 and
sets a new `Unit.retreated` flag instead of `hasDied`, and the site emits a
`system_unit_removed` with a new optional `reason: 'retreated'` payload field —
reusing permadeath's removal flip and filtering (targeting/occupancy/AoE) plus
the action-log line ("has retreated!"). KO sweeps and charged-action cleanup run
as on a death; retreat ≠ death for `no_deaths`. `summarizeBattleResult`
classifies retreated units `survived` (checked before `removed`, which alone
would read `lost` — a retreated player unit must never permadeath).

**D-sub-1 (Chris):** the threshold-retreating boss presents post-battle only —
victory fires, the scene explains the escape; no mid-battle scripted dialogue
(that stays a deferred feature). The boss threshold condition carries **no
outcome tag** (nothing branches — he always escapes).

Known edge, accepted: the battle_end decision is taken at the checkpoint that
satisfies it; a same-boundary generated action (e.g. a poison tick that kills
an enemy after the good-outcome battle_end enqueued) does not retro-change the
recorded outcome. The fight was decided when the condition held.

## WI2 — Persistent campaign-flag store + outcome-branched scenes

`CampaignState.flags: Readonly<Record<string, boolean | number | string>>` —
typed wider than Ch1's boolean-only authoring from day one (a Ch2 counter/enum
is an authoring change, not a substrate change). APIs: `setFlag` / `getFlag`
(`campaign/flags.ts`). Save-compat is the lenient-absent convention (`gil`
precedent): absent → `{}` on load, **no schema bump**; non-scalar values are
rejected loudly at deserialize.

Recording + branching are authored on `NodeBattle`:
- `recordOutcomeAs?: string` — the driver writes `flags[key] = firedOutcomeTag`
  after a win (tag flows `DecidedOutcome.outcome` → `summarizeBattleResult`).
- `onOutcome?: Record<string, StoryScene>` — the outcome-branched follow-up
  scene, played after the result summary and **before** the shared positional
  trailing scenes (which stay outcome-independent). Scenes are inline (the
  brief said "sceneRef"; this codebase authors scenes inline — same model).
  Pure pick helper `outcomeFollowUpScene` (sequence.ts); the driver wiring in
  `CampaignApp.handleBattleEnd` is three lines.

Cross-chapter reads (Ch2 dialogue on a Ch1 flag) use the same `getFlag` — the
store persists; that content is a later authoring concern.

## WI3 — Phantom node/edge

`CampaignNode.phantom?` + `CampaignEdge.phantom?` composing on the existing
model. Runtime: `isEdgeOpen` is always false for a phantom edge (frontier);
`nextNodes` filters phantom edges, so `winChoices` / `isWinChoice` /
`isTerminal` all ignore them (a node whose only out-edge is phantom IS
terminal). A phantom node is never visited, so the revisit pass never lists it.

Validation (`atlas/validate.ts`): `winAdjacency` excludes phantom edges (they
contribute nothing to reachability, can't mask a real unreachable node, can't
form runtime cycles); the `unreachable` / `unreachable-under-gating` reports
exempt phantom **nodes** per-flag — a real unreachable node next to a phantom
one still fires (the brief's watch-for; pinned by test). Chapter-regression
skips phantom edges (decoration, not progression). Two new phantom-coherence
rules: `phantom-target-real-edge` (error — a real edge into a phantom node
would make it enterable) and `phantom-with-engagements` (warning — dead
content).

Atlas: node checkbox + per-edge checkbox (`setEdgePhantom` clears by DELETING
the field, matching emit-only-when-true codegen); dashed+faded render on both
canvases (WorldMapBeatView already dashes non-frontier edges — a phantom edge
simply never lights); codegen/import round-trip the two optional fields
byte-identically (shipped graph unchanged — Viura itself is authored in the
Ch1 layout session, not here).

## WI4 — Guest ally

**Audit write-back: guests are NOT Steal-Heart-minus-timer — they are its
inverse, and the inverse is simpler.** Steal Heart is a control-only override
(team unchanged, ADR-0111); a guest is genuinely ON the player's team (friend/
foe, heals, targeting colors, win/loss all correct for free) with only CONTROL
routed to the AI. The AI computes friend/foe from the actor's own team
(basic.ts), which is *wrong* for charm puppets (known asymmetry) but exactly
*right* for guests — same scorer, right side, no AI change needed.

Mechanism: `UnitPlacement.guest?: true` → `Unit.guest?: true` (engine carries
but never reads it — app-layer control data, like `Team.control`). Consumers:
- `DemoOrchestrator.pickController`: a guest's turn routes to the first
  AI-controlled team's controller (checked before the charm override).
- `use-turn-flow.isOurTurn`: guests are never "ours" — the action menu stays
  closed in lockstep.
- Fold: guest placements are fixed authored units, NOT deploy slots —
  `playerSlots` excludes them, `foldCampaignRoster` preserves them, they don't
  count against `deployCap`, the Deployment screen neither offers nor requires
  placing them (they render like opponents, fixed), and
  `buildDeployedBattleConfig` keeps their authored tile.
- `NodeBattle.guests?: CampaignUnit[]` re-skins the template's guest slots via
  `foldGuestTeam` (the guest sibling of `foldEnemyTeam`) — Sera as a guest is
  Sera the plot unit, curve stats and gated kit included.
- `buildSkirmishBattle` strips guest placements from the borrowed template
  (skirmishes never inherit story guests — the brief's watch-for).
- Apply-back/rewards ignore guests for free (roster-keyed).

**Guest ≠ join.** The brief assumed a plot-unit-join mechanism existed ("same
as Clio/Thessaly") — audit write-back: it didn't; plot units are seeded into
the INITIAL roster. New `joinPlotUnit` (`campaign/join.ts`, approved by Chris):
appends a durable unit mid-campaign at effective-full vitals, grandfathers its
gear into the inventory (`bootstrapInventory`, whose comment anticipated this
caller), throws on duplicate. No gil, no starter-gear purchase. The driver
calls it at the authored beat; the guest system doesn't know about it.

## Consequences

- Nodes 3/8/9/10's battle logic and the 1/6 guest fights are now authorable in
  `node-content.ts`; the Ch1 Atlas layout session is unblocked.
- Test count 2798 → 2848; suite green, `tsc -b` clean, saves back-compatible
  (flags lenient-absent), Atlas round-trip pin byte-identical.
- New engine surface: `VictoryPredicate`, `DecidedOutcome.outcome`,
  `Unit.{hasDied, retreated, deathProtected?, guest?}`,
  `SystemUnitRemovedPayload.reason?`. `evaluateBattleOutcome` now takes the
  catalog.
