# ADR-0148: Engagement queues + per-beat edge gating (+ placeholder scenes)

**Status:** accepted (S91)
**Context:** `docs/TABADesign/taba-engagement-queues-brief.md` (design
sources: `atlas-guide.md` A.5 half-built re-arm substrate + the S90
handoff's feature-2 scoping). Chapter 1 wants a camp/hub the player returns
to across the chapter, each return opening a different story beat and a
different path onward (the Igros-Castle shape). The save side existed
(per-beat `clearedStoryBeats`, ADR-0145); this lands the runtime/model AND
the Atlas structural-authoring in one feature, because `node.ts` is
generated — a runtime camp you can't author in the tool is a half-gap.

## What shipped

Both halves, one session. `CampaignNode.beats` → `engagements:
Engagement[]` (`{ storyBeatId?, beats, armsAfter? }`);
`CampaignEdge.opensOnBeat?`; the travel selectors and the CampaignApp
driver walk the **current** engagement; Atlas authors queues, arming,
per-beat edge gates, and placeholder scenes, validates
reachability-under-gating, and preview-walks drafts **statefully**. Saves
untouched. Suite 2798 green (was 2773); round-trip pin re-established
byte-identical on the regenerated `node.ts`; verified live (authored the
Stonebridge camp demo, walked the full A → mission → return → B → gated
path divergence in the tool).

## Decisions

### 1. The queue replaces `beats` wholesale; the first engagement's beat id defaults to the node id

`engagements: []` is the beat-less node (visit-completes, unchanged).
Migration wraps every shipped node as `[{ beats: contentBeats(id) }]` —
behavior-preserving by construction. The FIRST engagement's `storyBeatId`
defaults to the node id: that single rule is what keeps every pre-queue
save loading (they recorded node ids) with **no migration**. Later
engagements must author an explicit id — `engagementBeatId` fails loud,
Atlas validation (`engagement-id-missing`) gates it before export.

### 2. Arming: `armsAfter` names any beat id; default = previous in queue; current = earliest armed-and-uncleared

Default gives sequential same-node chains for free (clear A, re-enter,
play B — the map's self-re-entry makes this immediate, accepted by Chris);
the Igros shape authors `armsAfter` pointing at a beat **elsewhere**,
forcing the leave-and-return. No "must leave the node" rule — it would
need new save state for no design win.

### 3. "Story-cleared" is TEMPORAL: nothing armed-and-uncleared right now

A camp whose next engagement waits on a distant beat reads cleared — its
shop stock contributes (`shop.ts` unchanged), the skirmish valve can open,
it lists as a revisit — then flips back to armed when that beat clears.
Chris chose this over "cleared = whole queue done", which would have
withheld a camp's commerce for an entire chapter.

### 4. Edge opening is MONOTONIC and separate from story-cleared

`opensOnBeat` set → open when that beat is in `clearedStoryBeats`; unset →
the source's FIRST engagement's beat (or visited, for a beat-less source).
Because temporal story-cleared can *regress* (decision 3), the frontier
deliberately does not read it — an opened road never closes, consistent
with the monotonic map. The default reproduces "clearing a node opens all
its win-edges" exactly on every pre-queue edge (behavior pins + the
round-trip guard it).

### 5. `NODE_CONTENT` re-keys by effective beat id

Was node-id-keyed. Effective beat ids are validated unique across all
nodes, and existing keys ARE the default first-engagement beat ids, so the
migration is a comment change — but the ownership split now joins
per-engagement: a later content-sourced engagement keys its hand-authored
beats by its explicit `storyBeatId`. Codegen emits `contentBeats(<node
ref>)` for the defaulted first engagement and `contentBeats('<beat-id>')`
for later ones.

### 6. Placeholder scenes (WI4): classified by fixed title, not reference

`placeholderSceneBeat(marker)` emits a one-line stub scene titled
`PLACEHOLDER_SCENE_TITLE`; the Atlas importer classifies content by
reference FIRST, then placeholder-battle by registry-template shape, then
placeholder-scene by the title — so a real scene could even reuse the
words without misclassifying. With stub scenes + placeholder battles a
full Ch1 (scene → battle → return-to-camp → new scene) walks as pure
structure before any dialogue exists.

### 7. Reachability-under-gating: a joint fixpoint, not a deeper DAG walk

Beats achievable ⇄ nodes reachable via satisfiable gates, iterated to
fixpoint (`unreachable-under-gating`, `engagement-never-arms`). Arming
cycles fall out as never-achievable — no separate cycle walk. Ordering
inside a queue adds no constraint: an earlier armed-uncleared engagement
only DELAYS a later one (clearing it unblocks), so per-beat armability +
gate satisfiability is exact, tested in both false-positive and
false-negative directions. The fixpoint runs only on structurally-sound
input (no dangling refs) to keep its verdicts from stacking noise.

### 8. The Atlas preview walk is STATEFUL

The old preview synthesized "the road here is cleared" from position —
inexpressible for multi-visit shapes. Now the preview holds a real
play-through (`PreviewWalk`): each destination pick travels there and wins
whatever engagement is armed (one per entry, exactly as the driver plays
them), with a restart button. Found and fixed in passing: `WorldMapBeatView`
never resets its march state (the shipped runner unmounts it per beat), so
the preview remounts it per walk step via a `key`.

### 9. Misc

- `storyBeatIdOf(node)` → `engagementBeatId(node, index)`;
  `allNodeBeats(node)` serves the "any battle beat here" reads
  (skirmish battlefield borrowing, the vitals probe: first battle beat
  across the whole queue).
- `resolveNode` clears the current engagement's beat id (pre-clear state
  still names the engagement just played); fails loud when nothing armed.
- The driver reads the current engagement's beats at every walk site;
  trailing post-battle scenes read the PRE-resolve state's engagement so a
  queue's next engagement can't splice its scenes in.
- Atlas draft key bumped `taciturn-atlas-draft-v1` → `-v2` (model-shape
  change; old drafts are disposable scratch, per the storage module's own
  rule).
- Node-id renames in Atlas remap `armsAfter`/`opensOnBeat` references that
  ride the default first-engagement beat id (explicit ids don't move).
- A terminal node with a queue sets `won` on clearing its CURRENT
  engagement (isTerminal is unchanged, edge-count-based). Authorable but
  odd; flagged, not blocked — validation could warn later if it bites.

## Brief reconciliation (audit findings)

- `src/campaign/validate.ts` in the brief's file list doesn't exist —
  validation lives in `src/app/atlas/validate.ts`.
- `sequence.ts` is pure cursor helpers; the driver is `CampaignApp.tsx`.
- The brief's per-engagement beats-source option "none" maps to
  `engagements: []` at the node level; a zero-beat engagement inside a
  queue is degenerate and not authorable.
- Default `opensOnBeat` needed the beat-less-source refinement (visited,
  not "first engagement's beat id" — there is none).
