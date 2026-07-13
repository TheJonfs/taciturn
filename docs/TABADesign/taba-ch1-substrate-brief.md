# Brief — Chapter 1 substrate: outcome conditions · campaign flags · phantom edge · guest allies

*Status: plaintext review by Chris before it ships to CC. This installs the four new substrate pieces the
Ch1 outline needs *before* the chapter can be stubbed. Over-specifies; **audit-first, and treat the file
paths in §Files as inferences to correct — my path guesses have been wrong before, which is why they're
marked audit-to-confirm.** Two design points (D-sub-1/2) for the review to settle.*

---

## Context

The Ch1 arc (linear spine, 0→10, border out-and-back) needs four capabilities that don't exist yet. Three
are engine + hand-authored-content; one (phantom edge) touches Atlas. None is huge alone; together they're
the gate that must clear before the story battles at nodes 3/8/9/10 and the guest fights at 1/6 can be
authored — so **this substrate precedes the Ch1 Atlas layout**, not the reverse.

The four, and where each lives:

| # | Piece | Layer | Used by |
|---|---|---|---|
| 1 | Battle **outcome-condition** system | engine + content | Nodes 3, 8, 9, 10 |
| 2 | Persistent **campaign-flag** store | save + engine + content | 9, 10 (write); future chapters (read) |
| 3 | **Phantom edge/node** | graph + validation + render + **Atlas** | Old Ordal → Viura |
| 4 | **Guest ally** unit | engine (team + AI) + content | Oskun (1), Ordal Canyon (6) |

---

## WI1 — Battle outcome-condition system (the meaty one)

Unify all four nodes' special battle logic into **three composable primitives** on a battle:

**(a) Victory-condition list.** A battle carries an ordered list of `{ predicate, outcome }`. The battle
ends when the highest-priority satisfied predicate fires; its `outcome` tag is recorded (→ WI2). The
implicit default remains `all-enemies-defeated → "standard"`. Predicates compose from:
- `unitBelowHp(selector, fraction)` — a named unit or a team, at/under an HP fraction.
- `noDeaths(team)` — no unit on `team` has died this battle (a battle-scoped death counter — see (c)).
- `allDefeated(team)` — the existing default.

**(b) Death-protection (unit flag).** A flagged unit can't be KO'd; a would-be-lethal hit instead removes
it as **retreated** (not dead). Retreat is *not* a death for `noDeaths`. (Nodes 3/8's antagonist —
cutscene-immortal by design; he survives whether he's threshold-retreated or lethally-hit.)

**(c) Battle-scoped death tracking** — a per-team counter feeding `noDeaths`.

How the four nodes map (this is the acceptance surface):

- **Nodes 3 & 8** (recurring antagonist): boss carries death-protection (b). Victory = `unitBelowHp(boss,
  ~0.15) OR allDefeated(enemies)` — either ends the fight, boss survives either way. **No outcome flag**
  (he always escapes; nothing to branch). The other enemies rout when the boss condition fires.
- **Node 9** (subdue-all): two victory conditions — *good:* `noDeaths(enemies) AND unitBelowHp(all-enemies,
  0.25)` → `"ester-good"`; *standard:* `allDefeated(enemies)` → `"ester-standard"`. Once any enemy dies,
  `good` is permanently unsatisfiable, so the fight falls through to standard. Getting everyone under 25%
  with zero kills **ends the battle** as the good outcome.
- **Node 10** (subdue-leader): *good:* `noDeaths(enemies) AND unitBelowHp(leader, 0.25)` → `"ruk-good"`;
  *standard:* `allDefeated(enemies)` → `"ruk-standard"`. Only the *leader* need be subdued; other rebels
  just have to survive.

Authoring lives in `node-content.ts` (battle content, hand-authored — same half as enemies). No Atlas.

**D-sub-1 (settle in review): how does a threshold-retreating boss present?** Lean: he's simply removed
(retreated) and the post-battle scene explains it — *not* mid-battle scripted dialogue (that's a bigger
scene-scripting feature, deferrable). Confirm you don't want a mid-battle beat here.

**D-sub-2 (confirm — load-bearing): the subdue predicate ENDS the battle as a win.** Nodes 9/10's "good"
condition is an early-termination victory (all/leader under 25% + no deaths → battle ends, good outcome),
not merely a post-battle check — otherwise the only way to end the fight would be killing, which breaks the
no-kill constraint. I'm confident this is the intent; confirming because everything in WI1 keys on it.

## WI2 — Persistent campaign-flag store (WI1's write-target; future chapters' read-source)

A keyed store on the campaign save, **typed `boolean | number | string` from day one** (the store shape
costs nothing; Ch1 authoring stays boolean-only, but Ch2 can set a counter/enum without a substrate
change). Two APIs: **set** (WI1's outcome recording calls it) and **get** (content branches on it).

**Ch1 read surface — the immediate payoff:** after a battle with outcome conditions, the driver
(`CampaignApp` per the S91 write-back) plays an **outcome-branched follow-up scene** — Node 9/10's "good"
outcome shows a different post-battle scene than "standard." So a battle beat can carry an `onOutcome`
map (`{ good: sceneRef, standard: sceneRef }`) authored in `node-content.ts`; the driver picks by the
recorded outcome. Cross-chapter reads (Ch2 dialogue reading a Ch1 flag) use the same **get** API and are a
later authoring concern — not built here, but the store persists for them.

Save-compat: additive (a new store, absent = empty); existing saves load unchanged.

## WI3 — Phantom edge/node (Old Ordal → Viura)

A destination shown on the map but never traversable. Two flags composing on the existing model:
- `CampaignNode.phantom?` — Viura: appears (labeled) but is **exempt from the `unreachable` validation
  error** and never enters travel/frontier.
- `CampaignEdge.phantom?` (Old Ordal → Viura) — rendered dashed, **excluded from the frontier selector**
  so clearing Old Ordal never lights it.

**Atlas authoring:** mark a node phantom, draw a phantom edge to it; validation exempts phantom nodes from
`unreachable` and phantom edges from reachability contribution; render dashed in both Atlas and the real
`WorldMapBeatView`. Round-trip stays byte-identical with the new optional fields.

## WI4 — Guest ally unit

A third team-membership state: **player-side, AI-driven, uncontrolled, non-recruitable, battle-long.** The
scorer runs on it exactly as on any unit (it's just a friendly the player can't command). Composes on the
**Steal Heart** precedent (temporary enemy→player flip) — the audit's question is whether it's Steal
Heart's mechanism *minus the timer and originating as ally* (likely) or genuinely new.

- Acts on its own CT turn like everyone else, AI-chosen; the player issues it no commands and can't deploy
  or bench it.
- **Authored into a battle:** `NodeBattle` gains an `allies?` (or `guests?`) alongside `enemies?` —
  hand-authored in `node-content.ts`. Oskun (1) has a guest to ease the fight; Ordal Canyon (6) has Sera
  as a guest.
- **Guest ≠ join.** Sera fights as a guest at Node 6, then the standard plot-unit-join adds her to the
  roster in the post-battle scene (same mechanism as Clio/Thessaly joining). The guest system doesn't know
  about joining; keep them separate.

Difficulty note (context, not a task): the guest is the *friendly* mirror of the enemy-AI work — tuned to
*lower* difficulty. It borrows the same scorer, so the "legible, not gold-plated" discipline applies in
reverse: a competent-but-not-savant ally.

---

## Acceptance criteria

- **WI1:** each of nodes 3/8/9/10's battle logic expressible and correct — boss retreats (threshold or
  lethal-hit) and survives; 9/10's good-outcome fires only on subdue+zero-deaths and ends the battle;
  a single kill drops 9/10 to standard; the default all-defeated win still works everywhere.
- **WI2:** outcome tags persist to the save; a post-battle scene branches on outcome (good vs standard);
  `get` returns a set flag across a save/reload; store typed for non-boolean values though Ch1 uses bools.
- **WI3:** Viura shows on the map, dashed edge, never reachable/frontier, no `unreachable` error; Atlas
  authors it and the round-trip stays byte-identical.
- **WI4:** an authored guest fights on the player's side under AI control, uncommandable, not in the
  roster; Sera transitions guest→roster-join cleanly at Node 6.
- Suite green, `tsc -b` clean, Atlas DEV-gated, saves back-compatible.

## Out of scope

- **Mid-battle scripted dialogue** (D-sub-1 lean is post-battle scenes; defer in-battle scripting).
- **Cross-chapter flag *reads*** (Ch2+ authoring; the store + get API exist, the content that reads them is later).
- **Atlas authoring of outcome conditions / guest allies** — these are battle content (hand-authored in
  `node-content.ts`), which the deferred beat-editor tier will eventually own; not this brief.
- Engagement queues / camps (Ch1 is linear — already shipped, unused here).

## Files (audit to confirm — inferences, correct them)

- Engine battle/victory resolution — the victory-condition evaluator, death-protection, death counter
  (path unknown; audit locates — likely near the win/loss check the driver consumes).
- Unit/team model — death-protection flag; the third team-membership state for guests.
- Steal Heart's implementation — the composition source for WI4 (audit: minus-timer or new?).
- Campaign save/state — the flag store; `CampaignApp.tsx` (the real driver, per S91) for outcome branching.
- `node-content.ts` — authoring outcome conditions, `onOutcome` scene branches, `allies?` guests.
- `src/campaign/graph.ts` — `phantom?` on node + edge; `src/app/atlas/validate.ts` (per S91 write-back)
  for the exemptions; `WorldMapBeatView.tsx` + Atlas canvas for dashed render.
- `src/app/atlas/codegen.test.ts` — round-trip pin for the new optional fields.

## Workflow notes

- **Audit-first**, especially: whether guest allies are Steal-Heart-minus-timer (WI4), and where the
  victory-resolution actually lives (WI1). Report what already exists.
- WI1 and WI2 are **coupled** (WI1 writes outcomes, WI2 stores + branches on them) — sequence WI1→WI2, or
  build together.
- WI3 is independent and small; WI4 is independent and composes on Steal Heart. Either can go first to
  unblock front-of-chapter authoring (Oskun's guest is Node 1).
- Mid-session design questions route through Chris to the planner.

## Watch-fors

- **`noDeaths` vs retreat** — a death-protected boss retreating must NOT trip `noDeaths` (retreat ≠ death);
  the only place this could matter is if a future node combines a protected unit with a zero-kill
  condition, but get the rule right now.
- **Subdue-win edge cases** — an enemy at exactly 25%, an enemy revived after "death," an enemy that flees:
  pin what counts as "below threshold" and "died" precisely (lean: `< 0.25` strict; revive after death
  still counts as having-died for the battle).
- **Phantom reachability** — the validator must exempt phantom nodes from `unreachable` without
  accidentally exempting *real* unreachable nodes (a real authoring bug should still fire).
- **Guest in skirmishes** — guests are story-battle authored; confirm the skirmish/generator path doesn't
  accidentally inherit or require them.

## Estimated size

One session per Chris's read — four pieces, but only WI1 is meaty (the victory grammar + death-protection),
WI2 composes on it, WI3 is small, WI4 composes on Steal Heart. If the audit says the victory-resolution
refactor is deeper than it looks, WI1+WI2 could stand alone with WI3+WI4 as a fast-follow — flag if so.
