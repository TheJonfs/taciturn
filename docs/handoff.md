# Session Handoff

This is a transient note from one session to the next.

**Discipline:** This document is *overwritten* each session, not appended. When
starting a session, read this file and process every item — act on it, promote it
elsewhere (ADR, design-doc edit, GitHub issue), or explicitly drop it with a
reason. Items do not accumulate. If there are no notes to leave, replace the
contents with `_No handoff this session._` so the next session knows the file has
been processed.

---

## From S68 (continued) — weapon trade study → fix + tuning (2026-06-17)

A deep balance exploration of the physical-attack space (Knight / Hunter /
Assassin × axes / swords / knives / bows × Eagle Eye / Martial Expertise /
Two Weapons) surfaced one real bug and motivated a tuning pass. **1904 →
1909 tests; tsc -b + vite build clean.** ADR-0114 (the fix).

### Shipped this session

1. **Per-swing weapon consistency fix (ADR-0114).** Dual-wield accuracy
   (`evasionCheck`) and variance (`resolvePhysicalVarianceBand`) read the
   *dominant* (right-hand) weapon for every swing, while WP read the
   swinging slot (S42). Mixed pairs could launder the off-hand weapon's WP
   through the right-hand weapon's accuracy + variance — worst case an
   Assassin with right-hand Sai (95% acc, ~2.1× Haste-Speed variance) +
   left-hand War Axe (WP 12) → a 12-WP axe swing at knife accuracy/variance,
   ~2× the next-best build. Fix: a shared `getSwingWeapon(slot)` resolver;
   all three per-swing reads route through it. Matched pairs unchanged;
   single-swing + forecast/AI bit-identical (pass no slot).
   - **Note for Chris:** you wanted to take the exploit "for a spin" in a
     playtest before pushing — the fix is already committed to main. To watch
     it live, you'd need to temporarily revert the two `getSwingWeapon` calls
     (or check out the parent commit). Flag if you want me to stash a quick
     toggle instead.
2. **Knight base Speed 9 → 8** (rationale: equipment breadth counterweight +
   bruiser identity; *not* a DPS nerf — the Knight was never the throughput
   leader).
3. **Hunter PA 6→7, Speed 9→10, MA 3→5** (PA/Speed middle ground between
   Knight and Assassin; MA is a deliberate plant for a future magic-leaning
   secondary command set — Hunter > Knight as the magic-dip candidate).

### Still OPEN — the Hunter two-hander/bow Support (brainstorm, not decided)

The proposed new Hunter Support (reward for two-handed + empty off-hand) is
**still being kicked around — do not implement yet.** Key findings from the
analysis:
- A *generic* two-hander damage bonus disproportionately buffs the **Knight
  with a Knight Sword** (Absolom WP 13, unrestricted; high-Brave Knight gets
  ~172 throughput, the new top single-swing build) over the bow Hunter — the
  opposite of the intent.
- Chris's hesitation about bow-gating: bows already self-buff via elevation
  (`height_delta`) variance. Open ideas on the table: (a) amplify the
  elevation-driven variance; (b) a PA bonus when wielding a bow; (c) bow-gate
  a flat damage/WP bonus; (d) something only bows exploit (range/height).
- Constraints to honor: keep it cross-class-takeable (flexibility); make it a
  *damage* lever not accuracy (Eagle Eye already owns accuracy; the bow's 33
  base accuracy is the Hunter's real ceiling and should stay a tension);
  the "empty off-hand" clause is the anti-Monkeygrip guard (big-single-hit
  XOR Monkeygrip dual-wield) — keep that.
- Next step: settle the ability's gating + shape + magnitude with Chris, then
  implement (likely a 2nd free Hunter Support + cost-2 cross-class, paralleling
  Two Weapons as "the two-hander Support").

### Watch / follow-ups surfaced

- **Forecast/AI model only the dominant swing for dual-wield** (pre-existing,
  untouched by ADR-0114). The off-hand swing's accuracy/variance isn't
  represented in the UI damage range or AI projection. Minor today (matched
  pairs dominate); worth closing if mixed dual-wield becomes common.
- **Knight Speed 8 + Hunter Speed 10 interaction:** the buffed Hunter can now
  slightly out-*throughput* a nerfed Knight even in melee (Knight keeps
  per-hit + durability edges). Watch in playtest that melee still reads as the
  Knight's domain; if not, the Hunter Speed or the Knight nerf is the dial.
- **Uncapped Speed** stays uncapped (Chris's call: Speed Save snowball is
  survival-gated, and that's the brake). Coherent *now that the per-swing bug
  is fixed* — the knife's low WP is the counterweight again.

## Still open, NOT touched (carried from earlier)

- **Hunter magic secondary command set** — the MA-5 plant anticipates this; no
  content exists yet.
- **Taunt redesign** — deferred; needs an attacker-side hit-chance hook + AI
  taunt-awareness; Chris must pin intended effect
  (`docs/thirtyNinePlanning/taunt-audit.md`).
- **Templar (S62) balance/feel**; **Thief feel pass** (Momentum / Steal MP /
  charm) — all in `playtest-watch.md`.
- **S68 equipment feel-pass** — Gauntlet of Might +3 (vs +2 fallback), Vicious
  Dagger crit-stacking (`playtest-watch.md`).
- **S61 standing AI carries**; **MP-penalty scope (S66, ADR-0109)**;
  **deployment taxonomy (S66)**; default team templates with the newer classes
  + S68 gear; `lightning-mage.ts` stale S20 header;
  `draft-terraformer-substrate-audit.md` archival.
