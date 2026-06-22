# Session Handoff

This is a transient note from one session to the next.

**Discipline:** This document is *overwritten* each session, not appended. When
starting a session, read this file and process every item — act on it, promote it
elsewhere (ADR, design-doc edit, GitHub issue), or explicitly drop it with a
reason. Items do not accumulate. If there are no notes to leave, replace the
contents with `_No handoff this session._` so the next session knows the file has
been processed.

---

## From S72 — Enchanter (13th class, Auramancy) — all 3 chunks (2026-06-22)

Shipped on main across three commits. **ADR-0120. 1992 → 2017 tests; tsc + vite
build clean.** Chunk 3 browser-verified in the Team Builder (Enchanter
selectable, portrait renders at 512×512, stat line exact, Auramancy pinned, team
validates).

- **Chunk 1 — Auramancy actives** (`75543ad`). 4 charged AoE actives: Haste /
  Protect / Shell (timed cast-buffs `quickening` / `protect_cast` / `shell_cast`,
  per_unit_ct dur 6, baseChance 95 ≈ 88% net at default Faith) + Esuna (100%
  cleanse via the new declarative `AbilityEffects.cleanse`, mirroring Remedy's
  debuff set incl. the `remedyImmune` skip). Buffs are polarity:buff +
  non-equipment ⇒ Steal-Buffs-able.
- **Chunk 2 — RSM** (`32f2990`). Resistance Save (Reaction, +10 all-elem-res per
  magical hit, uncapped STACK_ADDITIVE); Short Charge (Support, universal charged
  speed **×1.33** floored via modifyActionSpeed — multiplier chosen over flat-add
  to avoid front-loading ultimates); Float (Movement, revived hidden→available,
  1→2 SP — water-cost negation + fall-damage immunity, no elevation).
- **Chunk 3 — class wiring** (this session's 3rd commit). `enchanter` class +
  `auramancy` set; baseline stats HP103/MP40/PA3/MA10/SPD10 (Move3/Jump2,
  Eva 6/4/0); portraits (resized 1664×2556 5MB → 512×512 ~240KB,
  transparent-padded to match the convention); Team Builder tagline; added to the
  11 mage-gear `classRestrictions` files; content-id-registry + guide-changelog +
  roadmap updated. Buff→steal loop closed in tests.

### Watch-fors (S72) — for the playtest pile

- **Protect / Shell shift time-to-kill across the whole roster** — reliable AoE
  damage reduction is balance-significant; touches numbers tuned elsewhere. The
  single biggest balance item from this class.
- **Buff economy / Thief interaction** — a stolen Haste/Protect/Shell is now live;
  watch the snowball (stolen Haste → more Thief turns).
- **Low-Faith-ally penalty feel** — should read as *intended texture* (~88% on
  normal allies feels dependable; faithless allies pointedly harder), not a
  frustrating whiff. Needs a feel-check.
- **Auramancy friendly-fire** — buffs/Esuna splash onto enemies in the r1 diamond
  (Cure-style). A Protected/Hasted enemy is a real own-goal; verify it reads as a
  learnable positioning downside, not a trap.
- **AoE-buff AI behavior** — the AI casting Auramancy buffs is *untuned this
  session* (chunk-3 acceptance was the mechanic, not AI quality). Does the AI use
  the buffs well / avoid buffing enemies / value Esuna? A feel-pass item.
- **Resistance Save thematic looseness** — triggers on *magical* damage but grants
  *elemental* resistance; a pure non-elemental magical hit still arms it. Intended
  per brief D3; flag if it reads oddly. Also: uncapped — observe whether it
  reaches near-immunity in long fights (no cap by decision).
- **Short Charge ×1.33** — magnitude is a one-constant lever; bump if it reads
  mild for a support slot.
- **Esuna `remedyImmune` lever** — Esuna currently leaves stat-downs (PA/MA/Brave/
  Faith/Speed Down) alone, same as Remedy. Drop the `remedyImmune` skip in the
  dispatcher if you want Esuna to be the stronger cleanse that strips them too.

### Loose end

- `guide/art/enchantress_1.png` (5.2 MB) is an untracked **guide** asset (for the
  parallel guide-writing sessions), left unstaged — not a game asset and not part
  of the Enchanter code. The two **game** portraits under
  `src/assets/portraits/` were resized and committed.

## Still open, NOT touched (carried from S70/S71)

- **Predictive positional threat-model** — the remaining large AI gap (avoid
  reach, protect units, deploy against threats; + don't-feed-the-snowball). S70
  Mountain Pass is the natural test bed (`playtest-watch.md`).
- **S70 in-battle verification** (ambush crossfire / split-zone read) and **S69
  feel-passes** (AI charm/steal/break-charm, Math re-base, terrain-occlusion LoS +
  bounded bow arc, Vantage perched-vs-flat) — all in `playtest-watch.md`.
- **Taunt redesign** (needs Chris to pin intended effect — `taunt-audit.md`);
  **Templar / Thief** feel passes; **S68 equipment** tunables (Gauntlet +3,
  Vicious crit). All in `playtest-watch.md`.
- **Action-log redesign** (render-layer, approved, unbuilt) — `[[project_session-63-deferred-work]]`.
- `lightning-mage.ts` stale S20 header; `draft-terraformer-substrate-audit.md`
  archival — minor cleanups, still pending.
- **In-app battle auto-drive still blocked** — the setup screen's Human/AI toggle
  doesn't respond to DOM clicks (noted since S70), so both-AI battles can't be
  auto-driven in the preview. Team Builder itself drives fine (verified this
  session).
