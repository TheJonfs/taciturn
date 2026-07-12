# Session Handoff

This is a transient note from one session to the next.

**Discipline:** This document is *overwritten* each session, not appended. When
starting a session, read this file and process every item — act on it, promote it
elsewhere (ADR, design-doc edit, GitHub issue), or explicitly drop it with a
reason. Items do not accumulate. If there are no notes to leave, replace the
contents with `_No handoff this session._` so the next session knows the file has
been processed.

---

## S89 — Pre-M4 AI competency refresh SHIPPED whole (2026-07-11)

All seven items of `taba-ai-refresh-brief.md` landed (ADR-0146): the audit
(now durable as `docs/design/ai-substrate.md` — **the authoritative AI
reference; update it when scorer branches change**), grapple-throw, the
`aiHints.value` debuff floor, Raise, Esuna, the Jump pin, reflect-awareness,
and the `scoreItemForUnit` gear-valuation module. Suite green (**2733**),
`tsc -b` clean. Per-class matrix: no broken entries remain
(`taba-ai-refresh-findings.md` has the audit + outcome).

### For Chris / the planner

- **M4 is unblocked on the AI side (D-ai-3 resolved).** The generator's
  gear-assignment upgrade consumes `rankItemsForUnit(catalog, pool, profile)`
  from `src/ai/gear-valuation.ts` (`GearScoreProfile` = classId/pa/ma/usesMp —
  deliberately not a battle Unit). The `generateSkirmishParty` seam is
  unchanged.
- **Playtest is the remaining judge** (acceptance criterion). Watch
  specifically for gold-plating: skirmishes should stay beatable-not-
  exhausting. If enemies feel oppressive, the dials to lower are the NEW
  floors — per-status `aiHints.value` (content), `DEFAULT_DEBUFF_VALUE`,
  and the gear-valuation `W_*` weights — not the node offsets.
- **AI behavior newly visible in play:** Monks heave units off ledges
  (enemies only); Assassins open with Shadow Stitch and stop re-stitching;
  Templars cast Raise and answer perch-campers with Jump; Enchanters Esuna
  debuffed clusters; everyone avoids feeding Spiked Mail/Mirror Shield
  unless the hit kills.

### Noticed, not acted on

- `countDebuffStatuses` (the Remedy-*throw* valuation) doesn't skip
  `remedyImmune` statuses, so a throw is slightly over-valued on a
  stat-downed ally; the engine's actual Remedy cleanse and the new Esuna
  scorer both skip them (`countCleansableDebuffs`). One-line alignment if it
  ever matters; left alone to avoid disturbing the throw path's tuning.
- The AI kites: the joint planner's S59 danger tie-break makes ranged
  debuffers step back to max range before casting (seen in the S89 tests —
  `driveToAbility` in the test files applies committed Move legs). Good
  behavior, but playtest may read it as "enemy runs away"; it's the
  tie-break, not a bug.
- Deferred-without-loss kit gaps (recorded in ai-substrate.md deferrals):
  Tide Surge ally-tempo, Steal MP, Scramble, ally-rescue throws, stance
  strategy, charge-delay discounts on Raise/Esuna.

### Carried from earlier (still open, low-priority — unchanged from S88)

- **Economy CONTENT pass is the next M3 beat** (real bundles, prices, unique
  placement; all dials in `campaign/economy-config.ts`), then Tailored
  Outfit; node/map authoring utility is session-sized and sequenced before or
  alongside M4 (`taba-node-authoring-substrate-notes.md`).
- JP spillover on over-threshold spend (M2 tail).
- Enemy progression tuning for Stonebridge / Marshmoor / Mountain Pass (data).
- Loadout 2nd-secondary UI (Magus Crown / Command Cap), "Level Up!" banner
  polish, rapid-dialogue-advance React setState-in-render warning.
- "99 cap" guide fiction (no code clamp) — guide-doc correction someday.
- S85/S87 playtest watch items (Epee CT-refund loops, Star Robe lifesteal,
  Expert's Tunic × Golden Hairpin, tempo-caster stack, Scouring × dual-wield,
  Manaeater-as-default, Terra Robe maybe weak; Cremation × Pendant,
  Shadowblade vs HP sponges, Del's Stave dump-on-buffs, Golden Rod clock,
  Volley Bow friendly fire, Excalibur above-curve by intent) — watch, don't
  pre-nerf.
- FormationDevHarness (`?formation`) still shows 2 synthetic invalid units
  (Nova, Ptolemy) as a free showcase of warning states.
- reclassUnit frees now-illegal passives but keeps now-illegal gear (D2:
  surface, don't resolve).
- Income-to-price ratio / XP rubber-band / recruitment cap / re-entry guard
  watch-fors from S88 remain live.
