# Session Handoff

This is a transient note from one session to the next.

**Discipline:** This document is *overwritten* each session, not appended. When
starting a session, read this file and process every item — act on it, promote it
elsewhere (ADR, design-doc edit, GitHub issue), or explicitly drop it with a
reason. Items do not accumulate. If there are no notes to leave, replace the
contents with `_No handoff this session._` so the next session knows the file has
been processed.

---

## S95/S96 — Earning-coverage audit + Ch1 shop/map polish + playtest batch (2026-07-18)

All four work items of the S95 brief shipped (ADR-0153), plus the same-day
S96 playtest batch (ADR-0154): **weapon-delivered ⇒ weapon-ranged always**
(the Dagger-Hunter 5-tile Charged Attack — melee fallback lands in
`computeAbilityRange`, one seam for validation/AI/UI; tooltips read
"weapon range") and **out-of-battle max changes re-normalize vitals**
(equip/unequip/reclass now refill to effective full — the Padded Jacket
6-MP repro, browser-verified through the Manage Roster flow both
directions). Suite **2929**, `tsc -b` clean, Atlas round-trip intact.

**WI1 (the centerpiece):** the executable audit
(`src/engine/actions/earning-coverage.test.ts`, real content catalog) found
**six silent zero-earns** (Worldcraft, barrier attacks, the real Bear's
Heave path, Steal MP, Chakra ally-refuel, charged Tide Surge) and **one
systemic over-earn** (EVERY charged resolve earned since M2 — the inline
Charging-status removal read as an effect; whiffed nukes now earn 0). All
fixed + pinned. Chris's rulings, now canon: earning = "changed something
other than the caster's own bookkeeping; world changes count"; **JP follows
XP** — `computeEarnedJp` keys off `system_xp_award` log entries, the
hit-based predicate is deleted. The **merged coverage table** (AI × earning
× display) lives in `docs/design/ai-substrate.md` — the checklist for any
new effect shape. Display ride-along fixed lance `pierces` + Prism Wand
`sourceAbilityTagAny`; every item field now has a detail arm.

**WI2:** stock-refresh notification — `CampaignState.shopStockSeen`
(optional field, lenient load; stamped in `routeToNode` + `resolveNode`),
`nodesWithUnseenStock` → gold "new stock!" badge on the Road Ahead until the
hub is visited; aftermath scene lines at Old Ordal + Mount Eska.
Browser-verified end-to-end (badge → march back → buy Staff of Abundance →
badge gone). **WI3:** Road Ahead now min(1080px, 94vw) — footprint confirmed
decoupled from the battle map; reveal/no-frame-jump intact. **WI4:** guest
placard ("Ally's turn — Sera", pinned by component test) + per-hub shop
subtitle.

### S96 continued — the first campaign-authored maps

**Oskun Fields + Alvera Village shipped** from Chris's elevation grids
(commit e05cc08; specs in docs/maps/). Ch1 nodes 1-2 now fight on their
own battlefields. Alvera introduces ARCHITECTURE: elev-8 walls, elev-3
interiors, four door gaps — the substrate for Chris's announced
special-features pass. **Deployment layouts are PROPOSALS** (Oskun:
west-bank vs eastern-knolls across the stream; Alvera: road-defense vs
NW-fields ford assault) — re-placing a zone is one registry edit.
Browser-verified through a fresh campaign into the Oskun battle. Suite
**2951**, tsc clean.

### For Chris / the planner

- **Session intent was to stay open for Ch1 playtest/debug** — the audit +
  UI items are done and committed; the next feedback batch can land on a
  clean tree.
- **Design footnote (low stakes):** a solo Chakra that refuels only the
  caster's own MP earns nothing (self-bookkeeping rule). Pinned as
  deliberate; flag if you want self-refuel to earn.
- **Known limitation (accepted, in ADR + table):** lethal displacement
  (heave/knockback off a ledge) never pays the +KO bonus — the KO arrives
  via the generated fall-damage action. Revisit only if kill-credit starts
  mattering (e.g. kill-count achievements).
- **XP economy note:** the charged over-earn fix is a mild global XP *nerf*
  (whiffed/no-op charged casts paid since M2); the six zero-earn fixes are
  buffs to those kits (Terraformer especially). Watch the offset-curve
  playtest series with that in mind.

### Noticed, not acted on

- The world-map SVG nodes aren't in the browser accessibility tree as
  clickable buttons for coordinate-clicks in the preview pane (worked via
  DOM dispatch; real mouse use is fine). Purely a tooling nit, but if a11y
  becomes a goal, `<g role="button">` without tabindex/keyboard handling is
  the gap.
- Pre-S95 saves have no `shopStockSeen` → every stocked hub badges once,
  then self-heals on visit (documented in serialization.ts; dev-only saves,
  accepted).
- `docs/TABADesign/taba-economy-framework.md` §5/§9 (the planner's per-hub
  revision) committed alongside this session's docs.

### Carried from earlier (still open, low-priority — pruned)

- **Economy content remaining:** cost TUNING pass (D-econ-6) + Tailored
  Outfit; then M4 authoring proper (real maps, lineups via the
  `generateSkirmishParty` seam, dialogue — M4/M5).
- Enemy-kit dial (ENEMY_JP_PER_LEVEL = 100, buy-order prefix) — measure in
  playtest alongside the offset curve; party-avg-per-node is the series.
- Theo kit tuning placeholder (L4 pin_down only; L10 full Marksmanship +
  Eagle Eye); exact JP/kit later per Chris.
- Latent (ADR-0152): the joint planner still fail-hard-nulls if its best
  plan fails validation for reasons other than locks — unreachable now.
- `WorldMapBeatView` march-state reset rider; win-edge dedupe in `addEdge`;
  engagement-queue shipped-content pin when a camp lands (Ch2); Atlas
  beat-editor tier before M5 volume.
- Kit-seeding tier-threshold watch; S89 AI gold-plating dials; JP spillover
  seam; "Level Up!" banner polish; rapid-dialogue setState warning; "99
  cap" guide fiction.
- S85/S87 gear watch list (Epee loops, Star Robe lifesteal, Expert's Tunic
  × Golden Hairpin, tempo-caster stack, Scouring × dual-wield, Manaeater
  default, Terra Robe, Cremation × Pendant, Shadowblade vs sponges, Del's
  Stave, Golden Rod clock, Volley Bow friendly fire, Excalibur by intent).
- FormationDevHarness synthetic invalid units intended; reclassUnit keeps
  now-illegal gear (D2: surface, don't resolve); retreated units carry hp 0
  in apply-back (unreachable in Ch1); AI charm asymmetry unreached.
- Preview pane is a HIDDEN tab — battles stall on rAF throttling;
  `window.__taciturnDebug.pump(n)` drives them.
