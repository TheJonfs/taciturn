# Brief — Engagement queues + per-beat edge gating (+ placeholder-scene rider)

*Status: plaintext review by Chris before it ships to CC. Design sources: `atlas-guide.md` (node/beat
model, appendix A.5 on the half-built re-arm substrate) + the S90 handoff's feature-2 scoping. This lands
the "return to a location for a NEW story beat that opens a DIFFERENT path" pattern (Igros-style) — needed
for Chapter 1's non-linear pathing. Over-specifies; **audit-first, prune against the real `travel.ts`/
`sequence.ts`.**~*

---

## Context

Ch1 wants a camp/hub you return to across the chapter, each return opening a different story beat and a
different path onward (the Igros-Castle shape — not beat-for-beat, but that structure). The save side is
already built: the cleared guard is **per-beat** (`clearedStoryBeats` keyed by `storyBeatId`, ADR-0145), so
a location re-arming with a new engagement under a new beat id needs **no save migration** (guide A.5).
What's missing is runtime/model + the Atlas authoring to express it.

Because `node.ts` is Atlas-generated, this needs **both halves in one feature**: the runtime/model (so the
game plays camps) *and* the Atlas structural-authoring (so you can lay camps out — you can't hand-add them
to a generated file). Queues are topology/structure, so the Atlas work is a **structural-tier extension**,
not the deferred beat-editor tier.

## Settled shape (from planning)

- Queues are Ch1-necessary → this is the next session (ahead of the Ch1 layout that leans on a camp).
- Both halves (runtime + Atlas authoring) briefed as one session; **audit may split** runtime-first /
  Atlas fast-follow if too large — but the target is "lay out and walk a camp-based Ch1 in the tool."
- Placeholder-scene rider folded in (it's the same per-engagement beats-source machinery).
- Progressive reveal is **not** here (later player-experience rider; it composes for free once per-beat
  gating updates the frontier).

## Goal

A location can host an **ordered queue of engagements**; each clears independently under its own beat id,
each can gate **different outgoing edges**, and later engagements **arm** on a trigger. Atlas authors all
of it (multiple engagements per node, per-beat edge gating, arming, placeholder support), round-trip stays
byte-identical, and a camp-based Ch1 is walkable on placeholders.

---

## The model (proposed — audit to reconcile with the real code)

**Engagement queue on the node.** Today `CampaignNode.beats: NodeBeat[]` is one implicit engagement.
Generalize to an ordered list:

```ts
interface Engagement {
  storyBeatId: string;       // the per-beat cleared-guard key (guide A.5)
  beats: NodeBeat[];         // this engagement's scene/battle sequence
  armsAfter?: string;        // beat id whose clearing arms this engagement;
                             // default = the previous engagement in the queue;
                             // first engagement is armed at node availability
}
// CampaignNode.engagements: Engagement[]   (migration: today's node → [one engagement])
```

The **current** engagement on entry = the earliest engagement that is *armed* (its `armsAfter` beat is
cleared, or it's first) and *not yet cleared*. When all clear, the node is story-complete and just offers
hub/skirmish (composes with A.6 travel semantics). `armsAfter` defaulting to "previous" gives sequential
camp visits for free; allowing it to reference **any** beat supports "camp re-arms after you clear a
mission elsewhere" (the Igros shape — return after doing something else).

**Per-beat edge gating** (the subtle piece CC flagged). Today clearing a node opens **all** its win-edges.
Add:

```ts
interface CampaignEdge { /* from, to, on */ opensOnBeat?: string; }
// default = the node's FIRST engagement's storyBeatId (preserves today's behavior exactly)
```

An edge enters the frontier when its `opensOnBeat` engagement clears — so Igros engagement A opens the
path to mission X, engagement B opens the path to mission Y. `travel.ts` selectors change internally (the
S90 note: they were written expecting the queue to change *them*, not their callers).

**Save shape: unchanged.** Everything keys on `storyBeatId` in `clearedStoryBeats`, which already exists.

## Composition wins (call out, don't rebuild)

- **Hub-ness persists across re-arms** — a camp stays a shop/recruit hub while its story queue advances
  (isHub is visit-gated, not story-gated; guide A.3).
- **Reveal falls out free later** — new locations appearing after the camp's second story is just the
  frontier updating under per-beat gating; nothing special to build when reveal lands.
- **Placeholder-scene rider is the same machinery** — see below.

---

## Work items

### WI1 — Runtime/model: engagement queue

`beats` → `engagements` (migrate today's single engagement to `[one]`). Driver (`sequence.ts`) walks the
**current** engagement; `travel.ts` "story-cleared" and "returnable" selectors read the queue (a node is
story-complete when all armed engagements are cleared; re-entry plays the current armed-uncleared one).
Arming resolution per `armsAfter`. Codegen shape changes → update the round-trip pin; **saves untouched**.

### WI2 — Runtime/model: per-beat edge gating

`opensOnBeat?` on `CampaignEdge` (default = first engagement's beat). Frontier selector opens an edge when
its `opensOnBeat` engagement clears, not when the node clears. Default preserves current behavior
byte-for-byte on every existing edge.

### WI3 — Atlas structural-authoring for both

The inspector gains an **engagement-queue editor** per node: add/remove/reorder engagements; each carries
a `storyBeatId`, a beats source (content / placeholder-battle / **placeholder-scene** / none), and an
`armsAfter` picker (default previous). The **edge editor** gains an `opensOnBeat` picker (default first
engagement). Codegen emits the queue + gated edges; round-trip stays byte-identical.

**Validation extensions** (appendix B additions): engagement `storyBeatId`s unique across all nodes
(extends `story-beat-id-collision`); `armsAfter` resolves to a real beat; `opensOnBeat` resolves;
**reachability/acyclicity must account for per-beat gating** — a node is reachable only if the engagement
whose edge reaches it is itself armable-and-reachable. This is the trickiest validator change; the audit
determines how deep (at minimum: no edge gated on an unreachable/never-arming beat).

### WI4 — Placeholder-scene rider

A **placeholder-scene** beats source parallel to placeholder-battle: Atlas generates a stub `story-scene`
beat with a single author-typed marker line ("Scene between Lumen and Chris here"), emitted into the
generated `node.ts` like the battle placeholder, swapped for real content later (flip source to *content*).
Composes directly on WI3's per-engagement beats-source selector. **Payoff:** with stub scenes + placeholder
battles, a full Ch1 — scene → battle → scene → return-to-camp → new scene — is **walkable as pure structure
before any real dialogue is written.**

---

## Acceptance criteria

- A node with a 2-engagement queue: engagement A plays on first visit, clears, opens only its
  `opensOnBeat=A` edge(s); engagement B arms per `armsAfter`, plays on a later visit, opens its edge(s);
  the node stays a hub throughout (if `isHub`).
- Existing single-engagement content plays **identically** (default `opensOnBeat` = first beat; migration
  is behavior-preserving) — the M1 round-trip stays byte-identical after the shape migration.
- Atlas authors a camp node + gated edges + a placeholder-scene engagement; validation gates the new rules;
  **preview-walks** the camp (multiple visits, path divergence) through the real `WorldMapBeatView`.
- Saves from before this change still load (no migration — verify the beat-id guard is untouched).
- Suite green, `tsc -b` clean, Atlas DEV-gated.

## Out of scope

- **Progressive reveal** (later render-only rider; composes free).
- **Atlas beat-editor tier** (scene/enemy content editing — still deferred; this authors engagement
  *structure* + placeholders, not real scene/enemy content).
- **Multi-battle-per-engagement** authoring beyond what already exists (model-supported, not
  driver/save-exercised; don't build ahead of runtime).
- Economy bundle assignment, battle-TEMPLATE authoring (separate).

## Files (audit to confirm; over-specified)

- `src/campaign/graph.ts` — `Engagement`, `CampaignNode.engagements`, `CampaignEdge.opensOnBeat`;
  `storyBeatIdOf` generalization.
- `src/campaign/sequence.ts` — driver walks the current engagement.
- `src/campaign/travel.ts` — story-cleared / frontier / returnable selectors read the queue + gating
  (the selectors CC noted were written expecting this).
- `src/campaign/node.ts` (generated) + `node-content.ts` (hand) — migration to engagements; preserve the
  ownership split.
- Atlas editor components — engagement-queue editor, `opensOnBeat` edge picker, placeholder-scene source.
- `src/campaign/validate.ts` — the WI3 rule additions.
- `src/app/atlas/codegen.test.ts` — round-trip pin updated for the new shape.
- `src/campaign/{graph,node,sequence,travel,loop}.test.ts` — behavior-preservation pins.

## Workflow notes

- **Audit-first, especially on reachability-under-gating** — resolve how deep the validator goes against
  the real selector code; report the split-vs-inline choice.
- **Migration is behavior-preserving by construction** — the round-trip must stay byte-identical after
  wrapping today's nodes as single engagements with default gating. That pin is the safety net.
- If the audit says one session can't hold both halves, **ship runtime-first (WI1/WI2), Atlas fast-follow
  (WI3/WI4)** and write back — but flag it, since a runtime camp you can't author in Atlas is a half-gap.
- Mid-session design questions route through Chris to the planner.

## Watch-fors

- **Behavior drift on existing content** — the default `opensOnBeat`/single-engagement migration must not
  change how any shipped node plays; the round-trip + behavior pins guard it.
- **Reachability false-negatives/positives under gating** — the validator getting this wrong either blocks
  valid camps or passes unreachable ones; test both directions.
- **Arming loops** — `armsAfter` referencing a beat that itself arms-after this one; the acyclicity check
  should extend to arming, not just win-edges.

## Estimated size

Full session, front-loaded by WI1/WI2 (the model change + the `travel.ts` selector rework are the real
work; per-beat gating is the subtle part). WI3 composes on the existing Atlas inspector/codegen; WI4 is a
small rider on WI3's per-engagement source selector. Audit may split runtime/Atlas across the session
boundary — acceptable, with the fast-follow flagged.
