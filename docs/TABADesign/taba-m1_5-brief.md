# TABA M1.5 — Story-scenes via battle-as-beat (the loop generalization)

*The story-scene milestone (decomposition §8, follow-on to M1). Goal: let nodes carry **authored
beat-sequences** where a **battle is one beat-type among others**, so story scenes can play before a
battle, after it, between battles, or standalone with no battle at all. This is deliberately a
**loop restructure**, not a rendering feature — the interstitial runner is already a clean open set
(a story beat is a descriptor + renderer + registry entry, no runner change per the S78 handoff).
The work is collapsing today's hardcoded battle-as-spine loop into a general node-owned sequence.*

**Why pay this cost now (Chris's call, recorded):** battle-as-beat makes future progressions pure
authoring instead of loop-structure work — **consecutive battles** at one node become
`[battle, story-scene, battle]`; **choice-driven story** becomes a beat that emits a routing result.
The narrow "add two fixed slots" alternative would need a *third* structural change the next time
content wants a beat somewhere new. We generalize once, here.

## The current shape (what we're restructuring — from the S78 handoff)

- The loop is a **fixed pipeline**: formation → deployment → battle → **post-battle interstitial**.
  Beats run **only post-battle**, and they're **outcome-built** by `buildInterstitial`, not authored
  per node.
- **`requireBattle` assumes every node fights** (`CampaignApp` / `loop.ts` assert `node.battle`),
  even though `node.battle` is already *optional* in the model.
- D3's "a node can specify its beats" is **stubbed, not wired**.
- The runner dispatches by `beat.type` and never switches on it — an **open set** (this part stays).
- M1 only ever runs 1–2 beats; **no React test for the runner**; M1.5 is the first to run 3+.

## Pre-implementation plan — seam-audit FIRST, and it may change this brief

Battle-as-beat restructures how the loop treats a node, so **before building, audit how deep the
battle-as-spine assumption runs and report findings.** This audit is *allowed to overturn the plan
below* — if battle-as-beat ripples heavily into deployment/formation/persistence, we fall back to the
narrow framing (see "Fallback" at the end). Investigate:

1. **Where battle-as-spine is assumed.** Enumerate the `requireBattle` assertions and every place the
   loop/`CampaignApp` assumes "this node has exactly one battle, here." How load-bearing is the
   fixed formation → deployment → battle → interstitial pipeline?
2. **The formation/deployment coupling.** Formation + deployment currently precede *the* battle. Under
   battle-as-beat, they must precede *each battle beat*. Are they invocable per-battle-beat, or are
   they entangled with the single-battle loop assumption? **This is the likely-heaviest seam** —
   report its shape carefully.
3. **`buildInterstitial` (outcome-built → node-authored).** What does it currently construct, and what
   does shifting to node-authored beat-lists displace? Does the post-battle result-summary stay
   auto-generated (it's outcome-derived) while *story* beats become authored — i.e. a hybrid where
   some beats are authored and some are still outcome-built?
4. **Persistence.** The save carries an `awaiting_route` phase + node-id position (v2). Battle-as-beat
   needs to persist **position within a node's beat-sequence** (which beat index, and — mid-sequence —
   which battles already resolved). How far does this widen the save? (Likely v3.)
5. **The result-summary's transient BattleResult.** M1's result isn't persisted (the resume-nicety
   note). If a sequence is `[battle, story, battle]` and you save mid-sequence, the first battle's
   result may need to persist to rebuild later beats. Flag whether the sequence forces this.

**Report a findings paragraph before Chunk 1.** If seams 2 or 4 come back heavy, raise it — that's
the signal to reconsider scope with Chris, not to push through.

## Proposed design (battle-as-beat) + decision points

**The core model shift:** a node owns an **ordered `beats: Beat[]`**. Beat types (open set):
`battle`, `story-scene`, `result-summary` (and later reward/shop/etc.). The runner plays the
sequence; when it reaches a `battle` beat it launches the battle (running formation/deployment for
*that* beat), and on battle end it resumes the sequence at the next beat. A node with no `battle` beat
is a **standalone story node** — `requireBattle` is gone, replaced by "a node is a sequence; battles
are beats." The post-battle result-summary becomes a beat the *authoring* (or a helper) places after
a battle beat, rather than a hardcoded loop position.

- **D1 — Formation/deployment placement (the load-bearing call, pending the audit).** *Proposed:*
  formation + deployment run **as part of each `battle` beat** (immediately before it), so a node with
  two battle beats runs formation twice. → Confirm — or should formation be **once per node** (pick
  your K at node entry, reuse for all its battles)? *This interacts with the audit's seam 2; the audit
  may make one option clearly cheaper.* For M1.5 content (mostly single-battle nodes + standalone
  story nodes), either works; the call matters for the consecutive-battle future.
- **D2 — Authored vs outcome-built beats (the hybrid question).** *Proposed:* **story-scene beats are
  node-authored**; the **result-summary stays outcome-built** (auto-inserted after a battle beat,
  since it's derived from the just-finished battle). So a node authors its *story* beats and its
  *battle* beats; result-summaries are implicit. → Confirm the hybrid, or make result-summary
  explicitly authored too (more uniform, more boilerplate)?
- **D3 — Branch-from-beat (scope boundary).** Choice-driven routing (a story beat that offers the
  player a choice which sets the next node) is the *motivating future case*, but I'd **keep M1.5's
  routing outcome/edge-driven as today** and only ensure the beat model *could* emit a routing result
  later. → Confirm we defer authored in-scene choices to a later milestone (M1.5 proves the sequence;
  choice-routing rides the proven sequence later)?

**Content (lightweight, Claude-authored — the point is the slots):** a **boilerplate storyline**
exercising the new shape — at minimum one **pre-battle** story scene (dialogue → fight), one
**post-battle** scene, and one **standalone** story node (scene, no battle). Prose is placeholder
Ivalician-flavored filler; the goal is proving before/after/standalone all run, not the writing.

## Implementation work — chunks (audit may resequence)

### Chunk 1 — The node-sequence model + runner generalization (the core)
- Node owns `beats: Beat[]`; define the `battle` beat + fold the existing `story-scene` /
  `result-summary` into the open-set descriptor shape. Remove `requireBattle`; a node is a sequence.
- Generalize the runner to play an arbitrary sequence, launching battles at `battle` beats and
  resuming after. **This is where battle-as-spine becomes battle-as-beat.**
- *Testable:* sequence progression (incl. the first **3+ beat** and **battle-less** cases), the
  battle-beat launch/resume handoff. **Add the runner's first React/logic test** (M1 deferred it;
  3+ beats makes it worth having).

### Chunk 2 — Formation/deployment per battle-beat + persistence widening
- Wire formation/deployment to the `battle` beat per D1. Persist **beat-sequence position** (which
  beat, which battles already resolved) — likely a **v3 save**; keep the fail-loud-on-old-version
  discipline (no silent migration).
- Persist any prior-battle result a later beat needs (audit seam 5).
- *Testable:* mid-sequence save/resume (resume into the right beat, not re-fighting resolved battles).

### Chunk 3 — Story-scene beat type + the boilerplate storyline
- The `story-scene` renderer (speaker / portrait / dialogue-sequence; **no in-scene choices** per D3)
  + registry entry — no runner change (open set).
- Author the boilerplate storyline (pre-battle, post-battle, standalone) into the M1 graph.
- *Verify by hand (via the S78 debug menu):* traverse a node with `[story, battle, result]`, a
  standalone story node, and confirm mid-sequence resume.

## Acceptance criteria

- A node runs an **authored `[story-scene, battle, result-summary]`** sequence end to end; a
  **standalone story node** (no battle) runs; **`requireBattle` is gone**.
- The runner plays **3+ beats** and the **battle-less** path; the battle beat launches
  formation/deployment and resumes the sequence on battle end.
- **Mid-sequence save/resume** (v3) lands in the correct beat without re-fighting resolved battles;
  old (v2) saves fail loud.
- The **result-summary** still appears after battles (via D2's mechanism); the M1 branching/world-map
  flow is unchanged.
- Mage War unaffected; **no engine changes** expected (flag immediately if the restructure seems to
  need one — it shouldn't; this is all shell/loop).
- Suite green; `tsc -b` + `vite build` clean; ADR for battle-as-beat + the loop generalization;
  decomposition §8 marks M1.5 shipped.

## Out of scope

- **In-scene player choices / branch-from-beat** — D3 (the sequence must *allow* a future routing
  beat, but M1.5 authors none). **Progression / economy** — M2 / M3.
- **Real story writing / VO / portraits-as-art** — placeholder prose + existing portraits only.
- **Reward/shop beat types** — later; they're just new registry entries once the sequence exists.
- **Non-battle node *kinds* beyond standalone-story** (rest/town) — inert without M3 systems.

## Files (hedged — the audit confirms)

Within `src/campaign/`: the node-sequence model + runner generalization, the `battle`/`story-scene`
beat descriptors + renderer + registry, formation/deployment per-battle-beat wiring, persistence
widening (v3), the boilerplate storyline content. `requireBattle` removed. ADR. Vitest for sequence
progression + mid-sequence resume + the runner's first test. **No engine changes expected.**

## Watch-fors

- **The runner stays an open set** — dispatch by `beat.type`, never switch on it; story/battle/result
  are peers. A new beat type must never touch the runner.
- **Battle-as-beat must fully retire `requireBattle`** — a lingering "every node fights" assertion
  anywhere defeats standalone nodes; hunt them (audit seam 1).
- **Fail loud on old saves** — v2→v3 gets no silent migration (consistent with v1→v2).
- **Formation-per-battle-beat vs per-node (D1)** — whichever we pick, don't half-wire it; a node with
  two battle beats must behave coherently even if M1.5 authors none.
- **Result-summary's transient result** — if a later beat needs an earlier battle's result, persist
  it; don't let mid-sequence resume rebuild a lost summary wrong.
- **Placeholder prose stays placeholder** — don't gold-plate writing; the milestone is the slots.

## Fallback (if the audit says battle-as-beat is too heavy)

If seams 2 (formation/deployment coupling) or 4 (persistence) come back genuinely heavy, retreat to
the **narrow framing**: add a fixed **pre-battle** interstitial slot + a **standalone-node** path,
leaving the single-battle pipeline intact. It covers M1.5's content (dialogue→fight, pure-story node)
and defers battle-as-beat to when a third placement actually demands it. **Chris decides on the
retreat if the audit triggers it** — don't switch framings unilaterally.

## Estimated size

Medium-large — smaller content surface than M1, but a **loop restructure** at its core, so the risk
is in the seams, not the volume. Chunk 1 (the model/runner) is the swallow; Chunk 2 (formation-per-
beat + v3 persistence) is the likely-heaviest per the audit; Chunk 3 (renderer + boilerplate) is
light. **Audit-gated** — if it comes back clean, one session; if seams 2/4 are heavy, either a
session-plus or the narrow-framing retreat. The story *renderer* is trivial; the loop *generalization*
is the real work.
