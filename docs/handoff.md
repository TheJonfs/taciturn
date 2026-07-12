# Session Handoff

This is a transient note from one session to the next.

**Discipline:** This document is *overwritten* each session, not appended. When
starting a session, read this file and process every item — act on it, promote it
elsewhere (ADR, design-doc edit, GitHub issue), or explicitly drop it with a
reason. Items do not accumulate. If there are no notes to leave, replace the
contents with `_No handoff this session._` so the next session knows the file has
been processed.

---

## S90 — Atlas node-authoring tool, structural tier SHIPPED whole (2026-07-11)

All of `taba-node-authoring-structural-tier-brief.md` landed (ADR-0147):
`chapter` on `CampaignNode` (all M1 nodes ch1), the WI5 content split
(`node-content.ts` hand-authored / `node.ts` generated-shaped), the
`BATTLE_TEMPLATE_REGISTRY` + `placeholderBattleBeat` (River Ridge default —
Chris's call over training-field, which has no zones), the Atlas editor
(`?atlas`, DEV-gated, lazy chunk), validation (incl. chapter-monotonicity
and forward-DAG acyclicity), live preview through the real
`WorldMapBeatView` (now takes optional graph/layout props; viewBox is
bounds-derived with the 640×350 floor), and the byte-identical M1
round-trip pin (`codegen.test.ts`). Suite green (**2773**), `tsc -b`
clean. Verified live in the browser: import → edit → validate-gate →
preview march → export.

### For Chris / the planner

- **The economy CONTENT pass is unblocked on layout:** chapter graphs can
  now be laid out in Atlas first, then bundles keyed to nodes. Atlas does
  NOT author `firstAvailableAt` (economy tier, deferred per brief).
- **New durable reference: `docs/atlas-guide.md`** (also added to the
  CLAUDE.md context table) — the Atlas user guide + the plain-language
  node/beat model appendix + validation-rule table + glossary. Update it
  whenever an Atlas tier ships or the node/beat model changes.

### Post-session design discussion (Chris, S90 wrap) — three future features, with recommended sequencing

Chris raised two campaign-structure wants; a third (the Atlas beat-editor
tier) was already on the deferral list. Assessments + my sequencing
recommendation (route through the planner for real briefs):

1. **Progressive reveal** (FFT-style: nodes appear as milestones clear) —
   SMALL, sequence first or ride along any session. Visibility is
   DERIVABLE from existing save data (rule 5): visible = visited ∪ current
   travel choices. Clear a node → its win-edge targets pop onto the map.
   Render-layer filter in `WorldMapBeatView` (hide nodes + edges touching
   them); march unaffected (only visible places are ever endpoints). No
   save change. Optional later: authored `revealedBy: beatId` on the node
   for dramatic distant reveals (still derived at render). Monotonic-map
   decision means revealed-never-hidden — consistent.
2. **Engagement queues + per-beat edge gating** (return to a camp node for
   a NEW story/battle that opens a DIFFERENT path) — session-sized runtime
   feature; sequence when story authoring needs it (M5-ish, or before
   laying out real chapter graphs that lean on a recurring camp). The save
   side is ALREADY BUILT (per-beat `clearedStoryBeats` + `storyBeatId`,
   ADR-0145 — no migration needed). Missing, all runtime/model: (a) the
   engagement QUEUE on the node (today `beats` = one current engagement),
   (b) arming triggers ("arms after beat Y clears"), (c) **per-beat edge
   gating** — the subtle one: today clearing a node opens ALL its
   win-edges; the camp pattern needs edges keyed to the beat that opens
   them (e.g. optional `opensOnBeat` on `CampaignEdge`, default = the
   node's first engagement). `travel.ts` selectors were written expecting
   the queue to change them, not their callers. Composes with hub-ness
   (commerce persists while story re-arms) and with reveal (1) — new
   locations appearing after the camp's second story falls out free.
3. **Atlas beat-editor tier** (scenes/battle-beats/enemy grids in the
   tool) — sequence before M5 scene authoring at scale; NOT needed for the
   economy content pass. **Prerequisite decision recorded in the guide
   §6:** this tier writes into today's hand-authored half, so the
   node-content ownership boundary must be redrawn deliberately
   (per-block, not per-file) or the round-trip losslessness argument
   dissolves. That's the audit question for its brief. Chris is also open
   to a second support tool where that fits better (battle-TEMPLATE
   authoring should stay a separate tool regardless).

Recommended order relative to the standing plan: economy CONTENT pass
first (unchanged), reveal (1) as a small rider or immediately after,
queues (2) when the real chapter graphs / story structure demand a
recurring-camp shape, beat-editor (3) before M5 authoring volume.
- **Workflow change:** story scenes / battle beats / enemy derivation are
  hand-edited in `src/campaign/node-content.ts` now; `node.ts` is
  overwritten wholesale by Atlas export. The round-trip test fails loudly
  if the two drift from the canonical shape.
- **Editing discipline the tool enforces:** renaming a node id in Atlas
  orphans its `node-content` entry — validation reports `content-missing`
  before export, and `contentBeats` throws at module init if a stale
  export lands anyway.

### Noticed, not acted on

- `M1_NODES` / `M1_CAMPAIGN_GRAPH` names are historical now that the graph
  spans the campaign; kept to avoid churning ~16 importers. Cheap cosmetic
  rename whenever convenient (codegen emits the same names — change both
  together; the round-trip pin will catch a half-rename).
- The brief's WI3 validation list said "start node has a battle beat", but
  S88 lifted that invariant (probe fallback); implemented as a WARNING.
  Recorded in ADR-0147 — flagging so the planner can update the brief's
  checklist if it becomes a template for later tiers.
- Atlas edge drawing is inspector-initiated ("Draw edge from here…" →
  click target). A drag-from-node-rim gesture would be faster at scale;
  deferred as polish until the real multi-chapter layout session shows
  the friction.
- `validate.ts` checks `deployCap ≤ player slots` but the structural tier
  can't author a violating cap (placeholders are fixed at 5 ≤ every
  registered template's slots); the rule is live for content beats and
  future per-node caps.

### Carried from earlier (still open, low-priority — unchanged from S89)

- **Economy CONTENT pass is the next M3 beat** (real bundles, prices,
  unique placement; dials in `campaign/economy-config.ts`), then Tailored
  Outfit; M4 authoring follows (gear seam ready per ADR-0146).
- S89 playtest watch: AI gold-plating dials (`aiHints.value`,
  `DEFAULT_DEBUFF_VALUE`, gear `W_*` weights); the kiting tie-break reads
  as "enemy runs away" but is intended; `countDebuffStatuses` vs
  `remedyImmune` one-liner.
- JP spillover on over-threshold spend (M2 tail).
- Enemy progression tuning for Stonebridge / Marshmoor / Mountain Pass (data).
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
