# Session Handoff

This is a transient note from one session to the next.

**Discipline:** This document is *overwritten* each session, not appended. When
starting a session, read this file and process every item — act on it, promote it
elsewhere (ADR, design-doc edit, GitHub issue), or explicitly drop it with a
reason. Items do not accumulate. If there are no notes to leave, replace the
contents with `_No handoff this session._` so the next session knows the file has
been processed.

---

## From S74 — AI position/CT increments + caster-accessory batch (2026-06-26)

All six brief items shipped in six commits on main. Suite 2050 → 2075; `tsc -b`
+ `vite build` clean. Five new ADRs (0125–0129). The brief estimated ~1.5
sessions; it fit in one. Sequencing followed the audit's regrouping (A + B →
Ring + Greaves → Glove + Pendant), not the brief's original carve.

### What landed
- **AI A — coverage-weighted AoE-buff targeting** (`873ec5d`). `scoreAoeBuff` +
  shared `buffPotency`; `bestActFromSource` routes AoE buffs through it.
- **AI B — charged-attack CT-race devaluation** (`32cf17f`).
  `chargedTilePinValueFactor` via `estimateChargedTiming`; ×0.35 when the target
  acts before the charge resolves.
- **Greaves of Seraphis** (`9ac8a49`, ADR-0125) — Speed +2 + `battleStartCt`
  data field on `EquipmentBase` (pre-battle `system_set_ct`, equipment > explicit
  > formula; clamps to 99).
- **Ring of Caliora** (`126f72d`, ADR-0126) — MA +2 + `damageCtDrainPercent` on
  `onFinalDamage` → negative `system_ct_push`. **Uncapped** (0-floor only).
- **Glove of Metria** (`352c014`, ADR-0127) — MA +1 + `SpellPowerModifier.perExtraTarget`;
  `targetCount` threaded into `modifySpellPower`. **Applies to Math Skill.**
- **Pendant of Lumara** (`981e065`, ADR-0128) — MA +2 + generalized
  `modifyOutgoingStatusMagnitude` to cover Burn (Burn's `composeApplyState` now
  routes per-stack through the caster-side hook; `ComposeApplyStateArgs` gained
  `target` + `statusType`); `outgoingStatusMagnitudeMods` equipment field.

### Deliberate scoping / watch-fors (all in `playtest-watch.md`)
- **Chris chose the STRONG versions of Ring (no per-hit cap) and Glove (applies
  to Math Skill)** to playtest the field-wide-Calculator interactions rather than
  pre-capping. The Calculator is the epicenter — Ring (team-wide CT drain) and
  Glove (per-target SP) both compound on Precision Fire. The cheapest guardrails
  if oppressive: Ring per-hit cap / CT floor in `finalDamageCtDrainContributor`;
  Glove exclude `math_skill` or drop the per-target delta. Both localized.
- **AI A/B feel is UNVERIFIED** — both-AI battles still can't be auto-driven in
  the preview (the S70 setup-screen Human/AI toggle DOM-click blocker persists).
  Validation is unit-test-only again. The S70 in-app auto-drive block is the
  single biggest testing gap for AI work — worth a dedicated look.
- **Equipment is in the catalog but not equipped on any demo/default team.** The
  four accessories ship available but untuned in live builds; Chris may want to
  slot them into a default team (e.g. Ring/Glove on the Calculator in "Claude's
  Answers") to actually exercise the field-wide case.

## Still open, NOT touched (carried — in `playtest-watch.md`)
- **Predictive positional threat-model** — the remaining large AI gap. Only the
  protective/anti-AoE half is wanted (camping/high-ground half is unwanted per
  S73). AI A's over-cluster risk + AI B's deferred *dodge-incoming* half both
  want it. S70 Mountain Pass is the test bed.
- **S72 Enchanter feel-pass pile** (AoE Protect/Shell TTK, Aura Mastery K, buff→
  Steal-Buffs loop, low-Faith penalty, Auramancy friendly-fire splash, etc.).
- **S70/S69 carries:** S70 in-battle verification (ambush/split-zone); S69
  feel-passes (charm/steal, Math re-base, terrain-occlusion LoS + bounded arc,
  Vantage). **Taunt redesign** (needs Chris to pin intent — `taunt-audit.md`).
  **Templar/Thief** feel passes; **S68 equipment** tunables.
- **Action-log redesign** (render-layer, approved, unbuilt).
- Minor: `lightning-mage.ts` stale S20 header; `draft-terraformer-substrate-audit.md`
  archival.

## Loose end (carried from S72, still untracked)
- `guide/art/enchantress_1.png` (5.2 MB) — untracked **guide** asset, left
  unstaged. Leave it for the guide-writing lineage.
