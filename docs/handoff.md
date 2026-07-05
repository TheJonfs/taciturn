# Session Handoff

This is a transient note from one session to the next.

**Discipline:** This document is *overwritten* each session, not appended. When
starting a session, read this file and process every item — act on it, promote it
elsewhere (ADR, design-doc edit, GitHub issue), or explicitly drop it with a
reason. Items do not accumulate. If there are no notes to leave, replace the
contents with `_No handoff this session._` so the next session knows the file has
been processed.

---

## S84 — TABA chapter-1 plot-unique units COMPLETE (2026-07-05)

The whole `chapter1-plot-units-brief.md` shipped this session (ADR-0141): the
three engine seams **and** the five unit instantiations. Suite green (**2467**),
`tsc -b` clean. **7 commits:** `1df3efd` (Seam 1) · `3eede12` (Seam 2) ·
`c2201b3` (Seam 3) · `a8fa759` (portrait threading) · `9ed6e5b` (3 innate
signatures) · `7fa6788` (Hamstring) · `602f396` (Thessaly's Math components + the
five plot units). Plus a docs commit.

Every brief acceptance criterion is met and tested: seams work in isolation;
each of the five units instantiates; signatures fire (fire ×, cover, team CT,
Hamstring stack/floor/proc, XP+Square buyable only for Thessaly, Hamstring only
for Sera); `classAccessOverride` survives `reclassUnit`; portrait seam wired.

### Portrait art — DONE

The five portraits are processed (512×512, top-anchored crop; Lumen re-cropped
tighter to bust framing), named `plot-<id>.png`, and registered in
`FIXED_PORTRAITS`. Dialogue speakers switched to their `fixed` keys. Verified in
the running app: dialogue faces (Chris's Knight, Sera's assassin) + the in-battle
deployment panel (all five bespoke faces) + Chris confirmed as a Knight. The
Formation roster is celestial (no photo faces) by design.

### Repo hygiene — raw art blobs in unpushed history (your call)

An errant `git add -A` swept the raw ~3–4 MB source PNGs (`Chris_1.png` etc.)
into commit `a8fa759`; they're deleted again in `6289754`, so the WORKING TREE is
clean (only the 512² `plot-*.png` are tracked). But ~18 MB of raw blobs linger in
history. All 10 commits are **unpushed**, so it's safely strippable via a history
rewrite (`git filter-repo --path src/assets/portraits/<Name>_1.png --invert-paths`
for each) if you want the history clean before the first push — otherwise it's a
one-time 18 MB and harmless. (I'll use explicit `git add <paths>` going forward.)

### Watch-fors / playtest (not blockers)

- **Manual in-battle playtest is needed** to *see* the signatures fire — the
  campaign→battle Pixi deployment can't be driven by the preview tools (synthetic
  pointer events; noted since S83). The mechanics are covered by deterministic
  integration tests, but the feel (esp. tuning knobs below) wants a real play.
- **Clio's tempo loop** — Tidal Cadence is `3 × chapter` per ally (started at 3,
  brief allows 3–4). Watch for the compounding loop with her Hydrologist CT tools;
  the multiplier is the tuning knob (`TIDAL_CADENCE_CT_PER_TIER`). Don't pre-nerf.
- **Hamstring baseChance 75** — between Blowdart (80) and Shadow Stitch (60); tune
  from playtest if the grind feels wrong.
- **Cover is mitigation-only in v1** — the soak runs Chris's defenses but does NOT
  trigger his reactions and isn't evadable (S84 ruling). Wiring reactions/evasion
  onto the redirect is a clean additive follow-up (ADR-0141).
- **Buying the buyable signatures needs earned JP** — by design (paced). At L25
  fixtures, `seedStartingKit` sets available JP to 0, so Hamstring / XP / Square
  aren't immediately buyable in a fresh playtest until the unit earns Assassin /
  Calculator JP in battles. If a playtest wants them sooner, grant JP in the
  `?formation` dev harness (don't change the seed model).

### Carried from earlier (still open, low-priority)

- JP spillover on over-threshold spend (M2 tail).
- Enemy progression tuning for Stonebridge / Marshmoor / Mountain Pass (data).
- Loadout 2nd-secondary (Magus Crown), "Level Up!" banner polish, the
  rapid-dialogue-advance React setState-in-render warning.
- "99 cap" is a guide fiction (no code clamp) — a guide-doc correction someday.
