# Session Handoff

This is a transient note from one session to the next.

**Discipline:** This document is *overwritten* each session, not appended. When
starting a session, read this file and process every item — act on it, promote it
elsewhere (ADR, design-doc edit, GitHub issue), or explicitly drop it with a
reason. Items do not accumulate. If there are no notes to leave, replace the
contents with `_No handoff this session._` so the next session knows the file has
been processed.

---

## From S76 — the Monk (2026-06-28)

Shipped the S76 brief in full: the Monk (14th class, 6th physical) + its
net-new substrate + 19 tests + basic AI awareness + the Bear's Heave two-stage
targeting UI + 512×512 portraits. `tsc -b` + `vite build` clean; suite green
(1 skipped sim). ADR-0132. Four commits on `main` (substrate+class+content; AI;
grapple-throw UI; docs).

### The ONE thing left — live-verify Bear's Heave's throw UI
- The `grapple_throw` two-stage picker IS built (turn-flow route mirroring
  tile_set/Barrier: phase 1 highlights grabbable units magenta → click to grab;
  phase 2 highlights legal landing tiles amber → click to throw; two-stage
  cancel). Helpers + FSM are unit-tested (`grapple-throw-targeting.test.ts`),
  and the app loads error-free, **but the in-battle Pixi target-select wasn't
  driven here** (not reliably automatable). **Please verify live:** add a Monk
  to a human team, reach its turn, pick Martial Arts → Bear's Heave, confirm the
  grab-highlight → place-highlight → throw lands (and a ledge throw deals fall
  damage). Easy to retint if the magenta/amber reads wrong.
- The other 4 Martial Arts abilities + the punch already play through the
  standard targeting flow (Chakra=self, Foxfire/Serpent's Coil=single_unit,
  Storm Stoop=unit_or_tile line) — verify those too while you're in there.
- The AI uses the Fists + self-heal Chakra and skips Bear's Heave (out of AI
  scope per the brief).

### Tuning flags to read via `sim:both-ai` + hand-play (all shipped at sane defaults)
- **Fist coefficients** PA×3 (Foxfire/Storm Stoop/Serpent's Coil); Bear's Heave
  0 (throw is the point).
- **Chakra** heal PA×4, MP restore PA×2, mpCost 0 (gated by the Act economy —
  spend your turn to sustain). Watch the self-sustain ceiling on a 190-HP,
  no-body, high-evasion bruiser (the brief's flagged "self-sustain" watch-for).
- **Foxfire Burn** 50% via PA+Brave (lands reliably despite MA 4; the Burn
  *tick* damage is MA-scaled → weak for the Monk, by design — chip, not the point).
- **Serpent's Coil CT refund** Speed×2 (~+20 CT at Speed 10). Watch for a
  dominant tempo loop (S76 D4).
- **Vigilance** evasion +floor(PA/2) = +4 at PA 9 → 15/12/7. Reads base PA only
  (the `modifyEvasion` hook isn't handed state, so PA buffs don't compound into
  evasion — deliberately conservative vs the brief's swingiest interaction).
  The brief frames the Monk as deliberately evasion-strong, so this can climb.
- **Counterpunch** PA×4 strike, knockback baseChance 20 × `{pa}` ≈ PA×4% at PA 9.

### Watch-fors (from the brief, for hand-play)
- The **stance system is AI-illegible** — the Monk will read weaker in
  `sim:both-ai` than in skilled hands. Don't tune the class *down* off an
  AI-vs-AI floor read.
- **Anti-physical hard-counter profile** (all-facing PA-evasion + Counterpunch +
  Chakra) concentrates counterplay onto magic. Confirm it isn't oppressive on
  magic-light maps.
- **The self-balancing must hold** — the punch-sellout's exposure (no stance, no
  body) should let magic/kiting run it down. First real balance signal.
- The Monk isn't on any default team yet — slot it into a bundled team (and run
  `sim:both-ai`) to get a floor read.

### Loose end (carried from S72, still untracked)
- `guide/art/enchantress_1.png` (5.2 MB) and now `guide/art/monk_1.png` —
  untracked **guide** assets, left unstaged for the guide-writing lineage.

## Still open from prior sessions (carried — in `playtest-watch.md`)
- **Predictive positional threat-model** (protective/anti-AoE half only) — the
  remaining large AI gap. S70 Mountain Pass is the test bed; the S75 both-AI
  seam is the verification tool.
- S72 Enchanter feel-pass pile; S70/S69 carries (Taunt redesign needs Chris to
  pin intent — `taunt-audit.md`); Templar/Thief feel passes; S68 equipment
  tunables; S74 strong-version watch-fors (Ring of Caliora, Glove of Metria).
- **Action-log redesign** (render-layer, approved, unbuilt).
