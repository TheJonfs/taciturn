# Session Handoff

This is a transient note from one session to the next.

**Discipline:** This document is *overwritten* each session, not appended. When
starting a session, read this file and process every item — act on it, promote it
elsewhere (ADR, design-doc edit, GitHub issue), or explicitly drop it with a
reason. Items do not accumulate. If there are no notes to leave, replace the
contents with `_No handoff this session._` so the next session knows the file has
been processed.

---

## From the Thief session (2026-06-14 → 06-15) — the 12th class, all three chunks

Shipped the **full Thief class** to main across three commits. **1853 → 1880
tests; tsc -b + vite build clean.** ADR-0110 (chunk 1) + ADR-0111 (chunk 2).

- `e3c6f16` — **chunk 1**: class skeleton, Steal HP / MP / Buffs, Slip Free /
  Momentum / Move +2. New substrate: `lifesteal` + `mpDrain` + `stealBuffs`
  effect specs, `system_mp_drain.restoreFraction`, the additive
  target-Brave-as-resistance contest chance (`computeThiefContestChance`), and
  a **new closed-surface hook** `modifyIncomingStatusDuration` (Slip Free's
  Brave-gated apply-time shave). `computeOutgoingHitChance` generalized for
  hitRoll-without-damage (Steal MP evasion).
- `0644165` — **chunk 3 (side pieces)**: Thief portraits → 512² + pngquant,
  wired into the portrait index (default gender **female**). Thief feel-pass
  watch block added to `playtest-watch.md`.
- `79ce77d` — **chunk 2**: Steal Heart (24-MP charm capstone) + the
  control-override substrate (`effectiveController`, computed; orchestrator
  routes through it). `enthralled` + `heartwarded` statuses; `controlOverride`
  / `controlOverrideImmune` flags. Three design calls settled with Chris:
  **control-only charm**, **last-enemy charm doesn't win**, **gender-absent
  target invalid**.

### Needs Chris's in-battle feel pass (harness can't drive PixiJS)

All validation is unit-test-only. `docs/playtest-watch.md` carries the watch
blocks — the named risks:
- **Momentum tempo** — fires every non-magical action (incl. basic Attack),
  more often than the Flow State it matches at +10; watch for runaway turn
  economy.
- **Steal MP mage-counter** — PA×3 ≈ 30 MP at max PA; watch whether it erases
  caster turns (PA×2 is the release valve).
- **Steal Heart / charm** — land-rate at base 10%; charm fragility (50% break
  on attack damage, **not** DoT); and the **control-only scope quirk** (a
  charmed enemy's old allies won't attack it; it's only useful via friendly
  fire). Promote to a full friend/foe flip if it reads toothless.
- **Steal Buffs log attribution** — chunk-1 logging is summary-level; watch
  that the strip-from-target/apply-to-Thief reads right (else itemize it).

### Decisions / scope notes for Chris when convenient

- **Charm scope** — shipped control-only (ADR-0111). Full friend/foe flip
  (puppet hostile to its old team for AI/targeting/AoE) is the deferred bigger
  option.
- **Tunables I picked** (all flagged in code/ADR): Steal Heart range 3
  straight_line; Steal Buffs range 4; portrait default gender female; Momentum
  refund 10; immunity duration 5 (charm 3 + 2 buffer).
- **AI debt (the real follow-up):** content-ahead-of-AI as planned — the AI
  under-plays the self-state kit (buff-gain-on-self, valuing a charm swing,
  playing around being charmed). This is the **self-state AI dimension** beat
  the concept-notes/blueprint flag for promotion. The Thief adds weight to it.
- **Thief not in default team templates / playtest battles** yet (a small
  follow-up).

### Housekeeping

- **Roadmap unchanged** — the Thief is content-expansion-pass work tracked via
  ADR-0110/0111, not a numbered mechanism-track item (same rationale as
  S62/S65/S66).
- `content-id-registry.md` re-baselined (it had lapsed at S54 — was missing
  S62 Templar; the Δ column now resets to live totals).
- **Action-log redesign (S63) verification — CLOSED** this session (Chris
  confirmed it reads correctly in-battle); recorded resolved in
  `playtest-watch.md`. Dropped from the carry-list below.

### Still open, NOT touched this session (carried from S65/S61)

- **Taunt redesign** — deferred; needs an attacker-side hit-chance hook + AI
  taunt-awareness; Chris must pin intended effect. Audit in
  `docs/thirtyNinePlanning/taunt-audit.md`.
- **Templar (S62) balance/feel** — compounded by Battlemage's Chain feeding the
  tanky self-sustainer (watch entry exists).
- **Team-builder follow-ups (S64):** parchment reskin; single-source flavor
  pass; placeholder icons.
- **S61 standing AI carries:** Layer-2 positional prediction; Worldcraft
  move-then-cast; killValue-weighted Math re-base; Perch move-onto-created-perch;
  default team templates with Terraformer (and now the Thief); roster-wide
  Move-tier discussion; Calculator team-template revision + AI personality
  variants; Marshmoor template-compliance tests; `lightning-mage.ts` stale S20
  header; `draft-terraformer-substrate-audit.md` archival; terrain-transition
  animation; Math Skill SP scaling review.
- **MP-penalty scope (S66)** — extend the AI MP-spend penalty to
  heal/Math/Worldcraft, or keep offence+buff-only? (ADR-0109.)
- **Deployment taxonomy (S66)** — coarse melee/ranged shipped; richer
  tank/skirmisher/artillery/support split is the deferred next step.
