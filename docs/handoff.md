# Session Handoff

This is a transient note from one session to the next.

**Discipline:** This document is *overwritten* each session, not appended. When
starting a session, read this file and process every item — act on it, promote it
elsewhere (ADR, design-doc edit, GitHub issue), or explicitly drop it with a
reason. Items do not accumulate. If there are no notes to leave, replace the
contents with `_No handoff this session._` so the next session knows the file has
been processed.

---

## S85 — TABA M3 equipment expansion COMPLETE (2026-07-09)

The whole `taba-equipment-expansion-brief.md` shipped this session (ADR-0142):
Stage 0 isolation substrate, Stages 2a/2b/2c flat batches, all Stage 3 engine
prerequisites, all Stage 4 confirms + effect items, AND the deferred Ch1
breadth-enabler (named **Freelancer's Charm** + the equip-legality seam).
**51 new items** (catalog 82 → 133), 2 statuses, 4 hidden rider abilities,
1 new hook (`modifyOutgoingStatusDuration`, Chris-approved), ~14 sanctioned
rider fields/contributor arms. Suite green (**2536**), `tsc -b` clean.
**8 commits:** `1e00ae7` (Stage 0) · `b12c815` (2a) · `7ffabc4` (engine seams)
· `815c397` (2b) · `5cf4f51` (2c) · `9d962b9` (Stage 3) · `7d7e8ad` (Stage 4)
· `f848b8d` (Freelancer's Charm). Plus this docs commit.

Mage War regression: the frozen 75-item pool is PINNED
(`src/ui/mage-war-frozen-equipment.test.ts`) — do not update that pin without
an explicit Mage-War-change decision.

### THE structural warning for the M3 gear-UI session (promoted to ADR-0142 too)

**Spiked Maul breaks the M2 Formation UI's capacity assumption.** The UI
assumed "equipment can only LIFT capacity above baseline" — the maul's
reaction-bucket −3 (capacity → 0) falsifies it, and `createInitialState`
THROWS on over-capacity loadouts. The gear UI must enforce
equipment-adjusted capacity (block or unequip-excess on equip).
Good news (verified + test-pinned end of session): the capacity budget is
COST-weighted and class-innate reactions cost 0, so capacity 0 keeps the
wielder's innate reaction and blocks only imports — exactly Chris's intent;
maul + Steel Helm nets 1 (innate + one cost-1 import). Chris: try as-is,
rebalance later.

### Watch-fors / playtest (not blockers)

- **AI doesn't understand the exotic gear** — it would bonk enemies with a
  Healer's Staff (healing them) and mis-value the effect weapons. Keep the
  exotic pieces off authored ENEMY loadouts until an AI-valuation beat covers
  them (fits the AI capability-expansion arc).
- **Open-register playtest items** (all shipped per ruling, watch don't
  pre-nerf): Epee CT-refund loops (× Haste/Clio), Star Robe field-wide
  lifesteal (Calculator extreme; per-cast cap is fix-if-needed), Expert's
  Tunic × Golden Hairpin (MP ×0.375 for two slots), tempo-caster triple stack
  (Livre + Choir + Meditant's = +15 magical cast speed), Scouring + dual-wield
  stack rate, Manaeater as default non-caster sword, Terra Robe possibly
  UNDER-powered.
- **Authored magnitude judgment calls** (flag-level, not rulings): Meditant's
  Cowl "charge-time reduction" authored at Livre-parity +5 magical; Estoc
  vertical reach authored 3 (melee parity); Palliative Pike kept the lance
  family's pierce (two pulses on a pierced pair).
- **Manual playtest still owed** from S84 (plot-unit signatures) — now plus
  the M3 gear feel. TABA items are equip-able only by authoring today (no
  gear UI), so a real gear playtest waits for the UI beat.

### Deliberate Mage War delta (the one exception to the freeze)

The action-speed rider tag-gate union fix (Livre of Urgency now speeds buff
casts, matching its own doc comment). Chris chose bug-fix over absolute
freeze. Lineup/pool unchanged; the pin is untouched.

### Next M3 beats (the brief's own deferrals)

1. **Formation gear UI** (equip/unequip between battles; respect
   equipment-adjusted capacity + `equipLegality`; surface the TABA pool by
   chapter via `tabaShopPool`).
2. **Economy pass** — story-gated shop stock per location, costs, currency;
   unique acquisition flows (Freelancer's Charm / Pendant / Flametongue
   pickups); enriches `equipment-pool.ts` entries in place.
3. **Ch3 findable-uniques + Tailored Outfit (Ch2 depth-enabler, design
   settled in the lineup doc) + post-game gear** — separate design/authoring
   passes.

### Carried from earlier (still open, low-priority)

- JP spillover on over-threshold spend (M2 tail).
- Enemy progression tuning for Stonebridge / Marshmoor / Mountain Pass (data).
- Loadout 2nd-secondary UI (Magus Crown — now ALSO Command Cap), "Level Up!"
  banner polish, rapid-dialogue-advance React setState-in-render warning.
- "99 cap" guide fiction (no code clamp) — guide-doc correction someday.
- Raw portrait blobs (~18 MB) in unpushed history — Chris accepted the cost
  (S85 ruling); drop this item.
