# Session Handoff

This is a transient note from one session to the next.

**Discipline:** This document is *overwritten* each session, not appended. When
starting a session, read this file and process every item — act on it, promote it
elsewhere (ADR, design-doc edit, GitHub issue), or explicitly drop it with a
reason. Items do not accumulate. If there are no notes to leave, replace the
contents with `_No handoff this session._` so the next session knows the file has
been processed.

---

## From S72 — Enchanter class + a Protect/Shell rework + Aura Mastery (2026-06-22)

Six commits on main. **ADRs 0120 (Enchanter), 0121 (Protect/Shell rework), 0122
(Aura Mastery). 1992 → 2021 tests; tsc + vite build clean.** Chunk-3 class wiring
browser-verified in the Team Builder (Enchanter selectable, 512×512 portrait,
stat line exact, Auramancy pinned, team validates).

### The Enchanter (13th class) — `75543ad` (chunk 1), `32f2990` (chunk 2), `4c84126` (chunk 3)
- **Auramancy** (First Action): Haste / Protect / Shell (timed cast-buffs
  `quickening` / `protect_cast` / `shell_cast`, per_unit_ct dur 6, baseChance 95
  ≈ 88% net) + Esuna (100% AoE cleanse via the new declarative
  `AbilityEffects.cleanse`, Remedy's set incl. the `remedyImmune` skip). Buffs are
  polarity:buff + non-equipment ⇒ Steal-Buffs-able (loop verified).
- **RSM:** Resistance Save (+10 all-elem-res / magical hit, uncapped); Short Charge
  (universal charged speed ×1.33 via modifyActionSpeed); Float (revived
  hidden→available, 1→2 SP — water-cost negation + fall-immunity, no elevation).
- Stat line HP103/MP40/PA3/MA10/SPD10; mage-gear tier (11 item files); portraits
  resized 5 MB → 512×512.

### Protect/Shell reworked to one-directional damage multipliers — `4456778` (shared-hook refactor), `d06ff4e` (rework)
- Per the S72 design discussion: Protect/Shell are now **×0.5 damage multipliers**
  (via `onDamageReceived`), not additive `modifyResistance`. They halve physical /
  magical damage **after** resistance, and **never reduce absorption** (resistance
  > 100 still heals in full). Magnitude reinterpreted as **% reduction** (50 ⇒
  ×0.5) so it stays amplifier-scalable.
- The shared-hook refactor (`4456778`) extracted Haste/Protect/Shell behavior into
  the base file, imported by the cast sibling (the regen/regen_auto pattern) — so
  a buff behaves identically regardless of source.
- **Confirmed live:** absorption (resistance > 100 → heal) has been implemented
  since S27/ADR-0057 and is tested (lightning 150 → 50% absorb). Chris had
  wondered if it was ever built — it is.

### Aura Mastery — Enchanter's 2nd Support, the buff-amplifier — `f4b08a3`
- New caster-side hook `modifyOutgoingStatusMagnitude` (fired at apply time, gated
  to volitional non-equipment casts) scales the magnitude of `amplifiable` buffs
  by **K = 1.33**. Two new `StatusEffectType` fields: `amplifiable` +
  `magnitudeKind` ('additive' | 'multiplier').
- **Flagged:** quickening (multiplier), protect_cast, shell_cast, regen,
  engineered_defenses, crit_modifier. **Unflagged:** equipment grants + flat
  stat-point / reaction self-buffs.
- Regen refactored to magnitude-drive its coefficient (default 1 = identical).
- Free for the Enchanter; with Support capacity 3 it pairs with Short Charge.

### Watch-fors (S72) — for the playtest pile
- **Protect/Shell now COMPOUND with native resistance** (multiplicative), where
  before signed-max let them only *compete* (a built-in stacking brake). Genuine
  power increase for resistance-stacked units. (ADR-0121.)
- **Aura Mastery K = 1.33 potency.** Protect/Shell at ~⅔ reduction, Haste ~×1.67,
  on an Enchanter who can run Short Charge *and* Aura Mastery. K is a single
  constant. (ADR-0122.)
- **The cast-buff balance items from chunk 1 still stand:** reliable AoE
  Protect/Shell shifting time-to-kill; the buff→steal interaction; the
  low-Faith-ally penalty feel; Auramancy friendly-fire splashing onto enemies.
- **AoE-buff AI is untuned** — the AI casting Auramancy buffs / valuing Esuna was
  out of scope this session. Feel-pass item.
- **Esuna `remedyImmune` lever** and **Resistance Save's magical-trigger/
  elemental-grant looseness** — both intended, both one-line levers if playtest
  disagrees.
- **Protect changed symmetrically with Shell** (ADR-0121) though Chris only
  described the magical case — easily reverted if Protect-as-multiplier is
  unwanted.

### New convention worth knowing
- **Amplifiable buffs** are now a documented authoring surface:
  `docs/design/status-effects.md` → "Amplifiable buffs", plus the
  `StatusEffectType.amplifiable` / `magnitudeKind` field comments. When authoring a
  new magnitude-bearing buff, decide whether it's `amplifiable` (so Aura-style
  supports keep working without re-touching the support).

### Loose end
- `guide/art/enchantress_1.png` (5.2 MB) is an untracked **guide** asset (for the
  parallel guide-writing sessions), left unstaged — not a game asset. The two
  **game** portraits under `src/assets/portraits/` were resized and committed.

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
- **Action-log redesign** (render-layer, approved, unbuilt).
- `lightning-mage.ts` stale S20 header; `draft-terraformer-substrate-audit.md`
  archival — minor cleanups, still pending.
- **In-app battle auto-drive still blocked** — the setup screen's Human/AI toggle
  doesn't respond to DOM clicks (since S70), so both-AI battles can't be
  auto-driven in the preview. Team Builder itself drives fine.
