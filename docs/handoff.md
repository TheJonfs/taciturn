# Session Handoff

This is a transient note from one session to the next.

**Discipline:** This document is *overwritten* each session, not appended. When
starting a session, read this file and process every item — act on it, promote it
elsewhere (ADR, design-doc edit, GitHub issue), or explicitly drop it with a
reason. Items do not accumulate. If there are no notes to leave, replace the
contents with `_No handoff this session._` so the next session knows the file has
been processed.

---

## S86 — TABA M3 gear UI + inventory SHIPPED (2026-07-10)

The whole `formation-gear-ui-brief.md` core shipped (ADR-0143): the shared
draft-legality resolver (D3), the party inventory (Stage 0), the merged
two-column Loadout view (Stage 1), and surface-and-block (Stage 2). Suite
green (**2581**), `tsc -b` clean. **5 commits:** `ce02d04` (D3 resolver) ·
`9d5f286` (inventory) · `3f94ad6` (dev seed) · `3eeb908` (merged view) ·
`3779318` (surface-and-block). Plus this docs commit.

S85's structural warning is CLOSED: equipment-adjusted capacity is enforced
end-to-end; a Spiked Maul over-fill is held, surfaced with its cause, and
deploy-blocked. UI legality and engine legality are one code path — see the
drift alarms in `src/engine/items/draft-legality.test.ts` (sweeps every
catalog item/ability pinning draft === hook-based `getCapacity`/`getCost`)
and `src/campaign/node.test.ts` (`CAMPAIGN_RULESET_ID` pin).

### Stage 3 — LANDED same session after Chris's playtest reports (`681871f`)

The trailing piece got pulled forward: `probeUnitStats` (snapshot-fold) probes
one unit through the real `campaignPlacement` fold; the dossier header now
shows equipment/passive-composed stats (+ Move/Jump chips, '—' when invalid),
and the Loadout tab gains `LoadoutInspector` (the Mage War inspector,
celestial): hover gear/passives/secondary → mechanical detail + PROJECTED ±
stat chips (re-probe with the pick applied; swap math accounts for the
displaced item). Also from the same reports: `formatItemDetail` gained arms
for the 15 S85 rider fields that had none (Epee CT refund, Choir Staff
duration, lifesteal, spell procs, equipLegality, …) + the Trident
commandSetFilter scope — shared via `ui/index` with the Team Builder and the
in-battle panel; and `isPlotUnique` now keys on `PLOT_UNIT_IDS` (Lumen + Clio
were crestless — only override-carriers badged before).

### Late-session addition (Chris's request)

**Pre-battle roster management** (`6984343`): the deploy-selection screen now
carries a Manage Roster button; the manage screen tracks its origin
(`ManageOrigin` in CampaignApp) and returns to deploy selection ("← Back to
Deploy") or the world map accordingly. Loadout/gear testing is possible from
the very first River Ridge battle. Also noted from Chris: the five named
plot-unique roster characters are **Lumen, Chris, Clio, Thessaly, Sera**.

### Watch-fors / notes for next session

- **The FormationDevHarness (`?formation`) shows 2 synthetic invalid units**
  (Nova, Ptolemy) — they spread `m1Roster[0]`'s assassin equipment/loadout
  under a different class, so the new detector correctly flags stranded gear
  + blown budgets ("A Monk can't use the right hand slot", etc.). Left as-is:
  free showcase of the warning states. If it bothers visual review, give
  their seeds class-legal gear.
- **`reclassUnit` frees now-illegal passives but keeps now-illegal GEAR** —
  deliberate (D2: surface, don't resolve; the warning banner names the
  stranded piece). If playtest says auto-unequip feels better, that's a
  one-line change in `reclassUnit` + a ruling.
- **Alchemists (and everyone) can hold swords** — weapon defs mostly carry no
  `classRestrictions`; the pickers therefore offer broad pools. Content-side
  tightening (if wanted) is authoring, not UI.
- **Dossier equip has no undo/confirm** — every pick persists immediately via
  the existing onChange→save path (same as reclass/JP-spend). Fine so far;
  note for playtest.
- **Manual playtest still owed** (carried from S84/S85): plot-unit signatures
  + the M3 gear feel — now actually possible via the manage screen + DEV seed
  chip ("🎒 Seed gear").
- Tooling: `vite.config.ts` now honors `PORT` and `.claude/launch.json` has
  `autoPort: true` so a second Claude session's preview can run beside a
  primary dev server. No product impact. **One-time side effect (diagnosed,
  no action):** the config change restarted Chris's running dev server and
  re-optimized vite's dep cache; his open tab straddled two Pixi module
  instances and threw `TexturePool.returnTexture: Cannot read properties of
  undefined (reading 'push')` on a Text destroy (texture acquired from the
  old chunk's pool singleton, returned to the new one). Not reproducible on
  a clean load — deployment-canvas mount/unmount/remount verified clean. If
  this error EVER shows on a cold page load, that's a different bug — then
  investigate for real.

### Next M3 beats (unchanged order)

1. **Economy pass** — story-gated shop stock per location, costs, currency;
   unique acquisition flows; enriches `equipment-pool.ts` in place. The DEV
   seed chip is the stand-in until then. Receipt stays the uniqueness gate
   (`grantItems` is the one door into the inventory).
2. **Stage-3 inspector polish** (above) — can ride along with the economy
   pass or precede it.
3. Ch3 findable-uniques + Tailored Outfit + post-game gear (design/authoring).

### Carried from earlier (still open, low-priority)

- JP spillover on over-threshold spend (M2 tail).
- Enemy progression tuning for Stonebridge / Marshmoor / Mountain Pass (data).
- Loadout 2nd-secondary UI (Magus Crown / Command Cap), "Level Up!" banner
  polish, rapid-dialogue-advance React setState-in-render warning.
- "99 cap" guide fiction (no code clamp) — guide-doc correction someday.
- AI doesn't understand exotic gear — keep effect weapons off authored ENEMY
  loadouts until an AI-valuation beat (fits the AI capability-expansion arc).
- S85 open-register playtest items (Epee CT-refund loops, Star Robe lifesteal,
  Expert's Tunic × Golden Hairpin, tempo-caster stack, Scouring × dual-wield,
  Manaeater-as-default, Terra Robe maybe weak) — watch, don't pre-nerf.
