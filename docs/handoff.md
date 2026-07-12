# Session Handoff

This is a transient note from one session to the next.

**Discipline:** This document is *overwritten* each session, not appended. When
starting a session, read this file and process every item — act on it, promote it
elsewhere (ADR, design-doc edit, GitHub issue), or explicitly drop it with a
reason. Items do not accumulate. If there are no notes to leave, replace the
contents with `_No handoff this session._` so the next session knows the file has
been processed.

---

## S91 — Engagement queues + per-beat edge gating SHIPPED whole (2026-07-12)

All of `taba-engagement-queues-brief.md` landed in one session (ADR-0148),
runtime AND Atlas halves — no split needed. `CampaignNode.beats` →
`engagements: Engagement[]`; `CampaignEdge.opensOnBeat?`; temporal
story-cleared; the driver walks the current engagement; Atlas authors
queues/arming/gates/placeholder-scenes, validates under gating (joint
fixpoint), and preview-walks statefully. Saves untouched (first
engagement's beat id defaults to the node id). Suite green (**2798**, was
2773), `tsc -b` clean, round-trip pin byte-identical on the regenerated
`node.ts`. Verified live: authored a Stonebridge camp (2-engagement queue,
`armsAfter: node-mountain-pass`, The-Return edge gated on the second
beat), walked the full divergence in the preview, checked the emitted
codegen text. `atlas-guide.md` updated throughout (it is the durable
reference for all of this).

### For Chris / the planner

- **Ch1 layout is unblocked**: a camp-based non-linear Chapter 1 can now
  be laid out in Atlas and walked on placeholder battles + stub scenes
  before any dialogue exists. The brief's payoff is real — I built the
  demo camp in the tool in ~a minute.
- **Brief write-back** (audit findings, recorded in ADR-0148): the brief's
  `src/campaign/validate.ts` doesn't exist (validation is
  `src/app/atlas/validate.ts`); `sequence.ts` is cursor helpers, the
  driver is `CampaignApp.tsx`; per-engagement source "none" became
  `engagements: []` at node level (a zero-beat engagement is degenerate).
- **Approved semantics** (Chris, session start): temporal story-cleared
  (camp trades between engagements); immediate default-arming chains (no
  "must leave node" rule); stateful preview; content re-keyed by beat id.

### Noticed, not acted on

- `WorldMapBeatView` never resets its internal march state — the shipped
  runner masks it by unmounting per beat, and the Atlas preview now
  remounts it per walk step (`key=` in `AtlasPreview.tsx`). If any future
  surface keeps the map mounted across advances, hoist the fix into the
  component (reset march on beat change) instead of another key.
- A TERMINAL node with a multi-engagement queue sets `won` on clearing its
  current engagement (isTerminal is edge-count-based, unchanged).
  Authorable-but-odd; a validation warning is cheap if Ch1 authoring ever
  trips on it.
- Two win-edges between the same (from, to) pair are still deduped by
  `addEdge`, so "two different beats each open the same road" is not
  authorable in-tool (it IS expressible in hand-written models). No
  current need; flag if a chapter layout wants it.
- The engagement-queue acceptance test (`engagement-queue.test.ts`) uses
  hand-built graphs with placeholder beats — if the M1 graph ever gains a
  real camp, add a shipped-content pin next to it.

### Carried from earlier (still open, low-priority — unchanged from S90)

- **Economy CONTENT pass is the next M3 beat** (real bundles, prices,
  unique placement; dials in `campaign/economy-config.ts`), then Tailored
  Outfit; M4 authoring follows (gear seam ready per ADR-0146). Chapter
  graphs can now be laid out in Atlas first — including the Ch1 camp.
- **Progressive reveal** stays a small render-layer rider (S90 assessment
  unchanged; composes with per-beat gating for free — the frontier update
  IS the reveal trigger).
- Atlas beat-editor tier before M5 authoring volume; ownership boundary
  must be redrawn per-block first (guide §6).
- `M1_NODES` / `M1_CAMPAIGN_GRAPH` names are historical; cheap cosmetic
  rename whenever convenient (change codegen + shipped file together).
- Atlas edge drawing is inspector-initiated; drag-from-rim gesture
  deferred until a real multi-chapter layout session shows friction.
- S89 playtest watch: AI gold-plating dials (`aiHints.value`,
  `DEFAULT_DEBUFF_VALUE`, gear `W_*` weights); kiting tie-break reads as
  "enemy runs away" but is intended.
- JP spillover on over-threshold spend (M2 tail); enemy progression tuning
  for Stonebridge / Marshmoor / Mountain Pass (data).
- Loadout 2nd-secondary UI (Magus Crown / Command Cap), "Level Up!" banner
  polish, rapid-dialogue-advance React setState-in-render warning.
- "99 cap" guide fiction (no code clamp) — guide-doc correction someday.
- S85/S87 playtest watch items (Epee CT-refund loops, Star Robe lifesteal,
  Expert's Tunic × Golden Hairpin, tempo-caster stack, Scouring ×
  dual-wield, Manaeater-as-default, Terra Robe maybe weak; Cremation ×
  Pendant, Shadowblade vs HP sponges, Del's Stave dump-on-buffs, Golden
  Rod clock, Volley Bow friendly fire, Excalibur above-curve by intent) —
  watch, don't pre-nerf.
- FormationDevHarness (`?formation`) still shows 2 synthetic invalid units
  (Nova, Ptolemy) as a free showcase of warning states.
- reclassUnit frees now-illegal passives but keeps now-illegal gear (D2:
  surface, don't resolve).
- Income-to-price ratio / XP rubber-band / recruitment cap / re-entry
  guard watch-fors from S88 remain live.
