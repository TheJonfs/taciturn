# Session Handoff

This is a transient note from one session to the next.

**Discipline:** This document is *overwritten* each session, not appended. When starting a session, read this file and process every item — act on it, promote it elsewhere (ADR, design-doc edit, GitHub issue), or explicitly drop it with a reason. Items do not accumulate. If there are no notes to leave, replace the contents with `_No handoff this session._` so the next session knows the file has been processed.

What belongs here:

- Things noticed but not acted on.
- Implementation choices considered and rejected.
- Suggested scope or sequencing for the next session.
- Watch-for items and open questions that aren't ADR-worthy.

What does *not* belong here:

- Decisions (those are ADRs).
- What changed (that's the commit message).
- System design (that's the design docs).
- Long-running plan (that's `docs/roadmap.md`).
- Comprehensive progress / deferred-work review (`docs/progress.md` is the durable home for that — refreshed periodically, not session-by-session).

---

## From Session 40 close (2026-05-17) — knife class + dynamic variance + name-update pass

S40 shipped end-to-end in one session: knife weapon class with Speed-based dynamic variance substrate, three knives (Chef's Knife / Magebane / Sai), apply_silence_proc rider ability, AI proc-target heuristic, and a 19-string name-update pass on the four mage classes plus 15 of their abilities. **1200 tests passing across 108 files** (up from 1183 / 107; +17 net). One ADR landed: ADR-0078 (dynamic variance discriminated union).

### What shipped

**Substrate (modest extension, not a new pipeline):**

- `WeaponEquipment.physicalVariance` migrated from `{ min, max }` to a discriminated union: `{ kind: 'static', min, max } | { kind: 'attacker_speed', spread }`. Static arm preserves all existing weapons (War Axe, Bolt Hammer continue to declare `kind: 'static'` with `[0.9, 1.3]`). The `attacker_speed` arm reads attacker Speed through `runModifyStatQuery` and produces `[Speed/10 - spread, Speed/10 + spread]` at action resolution.
- `'knife'` added to `DamageTag` for weapon-class identification (knife-tagged weapons gate the dynamic variance arm by convention; future anti-knife content composes against the tag).
- No new ADR for status-via-proc (already supported per ADR-0064: Flametongue's `apply_burn_proc` is the precedent) and no new ADR for Brave-based status formula (already supported per ADR-0028: Stasis Sword is the precedent — and not needed for Magebane, see Q1 resolution below).

**Content:**

- **Chef's Knife** — WP 4, Acc 95, +1 PA, knife variance. Alchemist's natural sidearm — PA scales Potion / Phoenix Down / Ether outputs.
- **Magebane** — WP 5, Acc 95, knife variance, 50% on-hit Silence proc via the existing attackProc substrate. The procced `apply_silence_proc` ability uses `applyAlways: true` (matches the `apply_burn_proc` convention — flat weapon-side chance, no caster-stat gating). Silence duration 4 turns (matches Earth Curse / Gaian Hex's Silence).
- **Sai** — WP 4, Acc 95, +1 Speed, knife variance. The +1 Speed flows through `modifyStatQuery` into the wielder's own variance computation — a Knight (Speed 9) + Sai computes the band at Speed 10, lifting `[0.85, 0.95]` to `[0.95, 1.05]`.

**AI (D7 minimal):**

- `procTargetSynergyMultiplier` in `src/ai/basic.ts` multiplies a target's score × 1.5 when the actor wields a weapon with an attackProc that applies Silence and the target is a mage class. Generic in shape — adding e.g. Berserk-vs-low-Brave or Slow-vs-high-Speed is one entry in the predicate. Per-status-TTK projection is a future tactics pass.

**Name-update pass:** 4 class display names + 15 ability display names changed. Ids preserved per the S39 precedent — save-state compatible. Renames:
- Fire Mage → Pyromancer, Water Mage → Hydrologist, Lightning Mage → Aethurge, Earth Mage → Geosage
- Earth Strike → Rock Toss; Earth's Blessing → Life from the Loam; Earth Curse → Gaian Hex; Earth Quake → Earthquake; Earth Cataclysm → Cataclysm; Earth Resilience → Landwalker; Earth Communion → Biomastery
- Water Strike → Water Lash; Tide Surge → Rapids Rush
- Fire Strike → Scorch; Fire Embrace → Inner Warmth; Fire Storm → Fireball; Spark → Slow Burn
- Lightning Strike → Lightning Bolt; Storm Caller → Megavolt

### Plan-review resolutions (in-session)

**Q1 — Magebane formula.** Considered: Brave-based gating (per the brief's wording) vs flat-percentage (per the Flametongue / Bolt Hammer convention). Chris's call: keep convention — flat 50% trigger, `applyAlways: true` on the ability. Tunable in playtest if the rate plays as too punishing or too mild.

**Q2 — Class restrictions on knives.** The brief's D5 ("Mages not equippable") assumed weapons were already class-restricted; the audit showed no v1 weapons are. Chris's call: keep weapons class-agnostic. Soft filter is whether non-melee classes want to be attacking at all. Mage-knife builds become a real (if niche) option — watched in `playtest-watch.md`.

**Q3 — Variance band.** Small shift (Speed/10 ± 0.05) confirmed.

**Q4 — Magebane Silence duration.** 4 turns confirmed (matches Earth Curse / Gaian Hex's existing Silence duration).

**Q5 — Variance source representation.** Discriminated union with explicit `kind` arms confirmed — for future ease of adding more variance formulas.

**Q6 — Name-update pass.** Specific list provided in-session; applied via display-name swap with id preservation per the S39 precedent. See list above.

### ADRs from S40

- [ADR-0078](docs/decisions/0078-dynamic-variance-source-discriminated-union.md) — `WeaponPhysicalVariance` discriminated union with `kind: 'static' | 'attacker_speed'`.

(No ADR for status-via-proc or Brave-formula — both already shipped in prior sessions; Magebane composes with the existing substrate. No ADR for name-update pass — it's display-string content, not a design decision, and the precedent already exists from S39.)

### Browser verification

- Game loads cleanly with no console errors.
- All three knives appear in the Right Hand / Left Hand pickers for Knight, Alchemist, and the four mages (mages can equip per Q2 — universal access).
- Stat composition verified: Knight + Magebane PA 11 / SPD 9 (no statMods); Knight + Sai SPD 9 → 10; Knight + Chef's Knife PA 11 → 12; Alchemist + Chef's Knife PA 8 → 9 (Potion heal 96 → 108).
- Class display names render correctly in the team builder: Pyromancer / Hydrologist / Aethurge / Geosage / Knight / Alchemist.
- Renamed cross-class passives (Landwalker, Biomastery) render correctly in the ability picker. Active-spell renames (inside command-set submenus, only visible in-battle) are catalog reads — verified indirectly via the passing detail-text test on "Lightning Bolt".
- **Manual playtest still pending.** No live deployment-to-battle exercising the knives + Silence proc + AI Magebane preference loop in S40 — Chris's first knife playtest will surface any rendering / animation / forecast-panel gaps.

### Engine operational changes the next session should know about

- **Dynamic variance is now a thing.** `resolveVarianceBand` in `engine/damage/handlers.ts` is the single resolution site. Adding a third arm to the discriminated union (e.g. `{ kind: 'remaining_hp_fraction', ... }`) is one switch branch plus a type entry. Future variance-formula content slides in here.
- **The Speed read in dynamic variance threads through `modifyStatQuery`.** Anything that modifies Speed (Sai +1, Boots of Haste, Slow status with negative Speed, future Speed buffs) automatically affects knife variance without per-content wiring.
- **`procTargetSynergyMultiplier` is a generic shape, not Magebane-specific.** The helper inspects every attackProc on every weapon slot. Adding the next "proc-X vs target-Y" entry is extending the inner predicate `procVsTargetIsHighValue` with one branch (status-type check + target predicate). Don't fork it into a Magebane-specific path; extend the generic helper.
- **`apply_silence_proc` follows the apply_burn_proc convention exactly.** Future status-applying proc abilities should follow the same shape: `availability: 'hidden'`, `actionSpeed: 0`, `mpCost: 0`, ability tag empty (the wielder's physical hit carries 'physical' / 'weapon' / weapon-class tag; the rider runs outside the damage pipeline and only declares its own effect), `effects.statusEffects: [{ typeId, applyAlways: true, duration }]`.

### Things noticed but not acted on (next-session candidates)

- **Detail-text knife variance label** reads `Var Speed/10 ±0.05` for `attacker_speed` arms. Functional but could be more reader-friendly. A "preview the variance band for the currently-edited unit" surface (showing the actual computed `[min, max]` band given the unit's post-equipment Speed) is a UX polish item if playtest wants it.
- **Sai + Healthy Stride confusion risk.** Sai grants +1 Speed, not +1 Move. Healthy Stride scales with tiles moved (Move stat). The tooltip / detail-text could clarify "+1 Speed (CT only, not Move)" to head off the expected player question.
- **AI proc-target preference is gentle (1.5× multiplier).** First playtest will tell whether it reads as visibly smarter against mages or as indistinguishable from non-Magebane behavior. Tuning the multiplier (or layering in proc-TTK projection) is a future tactics pass if needed.
- **Command-set display names** were NOT renamed in S40 — Fire Spells / Water Spells / Lightning Spells / Earth Spells stayed. They could be renamed to align with the new class flavor (Pyromantics? Hydromancy? etc.) if Chris wants — flagged here for a future small renames pass.
- **Pre-Sai variance band character.** A Knight's natural knife variance `[0.85, 0.95]` (mean 0.9) shaves ~10% off raw damage. Whether the Sai variant's `[0.95, 1.05]` (neutral) feels meaningfully better than the bare-knife variant in play is a playtest read; if Sai feels mandatory, the bare-knife band may need a small lift.
- **Knight's first Magebane playtest probably catches something.** S39b's first playtest caught the Throw Item animator gap + the Lookout's Hood Speed register + the throw arc range bug. S40 introduces a new substrate (dynamic variance) + a new proc consumer + an AI behavior shift — there are likely two or three "didn't think of that" rough edges waiting for live exercise.

### Considered and rejected this session

- **Brave-gated Magebane formula** (per the original brief wording). Rejected by Chris in plan-review — keep the Flametongue / Bolt Hammer convention (flat weapon-side chance). Magebane composes cleanly with the existing `applyAlways: true` substrate; no new gating math needed.
- **Class-restricted knives** (Knight + Alchemist only). Rejected by Chris in plan-review — v1 weapons are class-agnostic. The brief's D5 was based on a misread of the current weapon-restriction state.
- **Schema-level dispatch on the `'knife'` tag for dynamic variance.** Considered for the variance substrate. Rejected (ADR-0078): couples taxonomy to mechanics. Future Speed-scaling weapons that aren't knife-tagged would need either tag pollution or a second dispatch path. The discriminated-union arm on `physicalVariance` is data-explicit and composes cleanly.
- **Closure-valued `physicalVariance`** (`(speed) => ({ min, max })`). Rejected — closures don't serialize, are harder to validate at catalog construction, and don't compose with ADR-replay surfaces as cleanly as a data shape.
- **Per-status-TTK projection in the AI proc-target heuristic** (ADR-0078 / D7). Considered for a more precise AI scoring shape. Deferred — v1 wants the AI to *lean* toward mage targets when wielding Magebane; a flat 1.5× multiplier achieves that without a full proc-TTK simulation. Sophisticated proc-aware tactics are a future tactics pass.

### Longer-term carry-forward (mostly unchanged)

- **TS strict-mode errors (~230) — S34 carry.** `vercel.json` works around. No change in S40 — count holds.
- **Pass-and-play toggle + dual deployment + battle-loop AI gating** — dedicated future session.
- **AI deployment logic / random-fill** — Red still uses authored placements.
- **Full battle → results → continuity-button loop manual playtest** — S34 carry; should be re-run with knives + Magebane in the mix.
- **Knight-exclusive armor access for Alchemist** (S39 D1 trajectory) — Universal-only for v1.
- **Additional consumables (Hi-Potion, Holy Water, Elixir)** — pure content adds in a future session.
- **Buff/debuff consumables** — deferred; would need an `applyStatus` field on `ConsumableEffects`.
- **Sophisticated Alchemist AI tactics** (banking, prediction, prep timing) — out of scope; v1 reactive heuristics shipped.
- **Calculator class** — future expansion; will reuse Compound submenu UX pattern.
- **Spiked Mail / Tricorn / Crusader's Helm / Light-Dark Robe playtest reads** (S37 carry) — in `docs/playtest-watch.md`.
- **Bedrock Stride / Tidewalker / Purifier / Magus Crown / Tintinibar / Sorcerer's Robe calibration** (S37 carry) — all in `docs/playtest-watch.md`.
- **Status duration rebalance signals** (S38-fixes carry) — watch how 3/4/6/10 numbers play.
- **Main Menu transition lag root cause** (S38-fixes carry) — masked by `TransitionOverlay`; not diagnosed.
- **Fire Embrace target-rejection mystery** (S38 carry) — dev-mode log will catch next occurrence. **Note:** ability is now "Inner Warmth" per S40 rename; the mystery still belongs to ability id `fire_embrace`.
- **Per-target "resolves before / after" forecast for AoE** (S38 carry).
- **Gender / zodiac field implementation** (Decision 13A) — state shape extensible; lands when needed.
- **ActionType-wiring checklist** (S39 carry — promote to a durable doc). S40 didn't add new ActionTypes (knives compose with existing physical-attack path; Magebane Silence proc rides the existing attackProc substrate; no new system_* actions). The S39 carry stands; the checklist hasn't been needed in S40 but should still be promoted before the next session that adds an ActionType.
- **Renderer-side permadeath badge** (S39 watch) — panel-only model intact in S40; revisit if playtest demands.
- **Manual deployment-to-permadeath playtest loop** (S39 carry) — should also include a knife-using Knight or Alchemist now.

---
