# Session Handoff

This is a transient note from one session to the next.

**Discipline:** This document is *overwritten* each session, not appended. When
starting a session, read this file and process every item — act on it, promote it
elsewhere (ADR, design-doc edit, GitHub issue), or explicitly drop it with a
reason. Items do not accumulate. If there are no notes to leave, replace the
contents with `_No handoff this session._` so the next session knows the file has
been processed.

---

## S84 — TABA chapter-1 plot-unit SEAMS shipped; unit instantiation is next (2026-07-05)

**Shipped** all three engine seams from `chapter1-plot-units-brief.md`
(ADR-0141), each tested in isolation, across **3 commits**: `1df3efd` (Seam 1),
`3eede12` (Seam 2), `c2201b3` (Seam 3). Suite green (**2441**), `tsc -b` clean.
Also confirmed `classAccessOverride` survives the `reclassUnit` round-trip
(reclass.test.ts). The brief's "load-bearing part, built once" is done; what
remains is **instantiating the five units on the seams** ("mostly data once the
seams exist").

### The three seams and exactly how to consume them

**Seam 1 — chapter context (`GameState.scenarioTier`, default 1).**
- Set at fold time: the campaign→battle fold must pass
  `BattleConfig.scenarioTier = <node's chapter>`. Fake playtest battles should
  **declare a placeholder chapter per battle** (brief: let each battle be its
  own chapter to exercise the range). Find where `NodeBattle` builds its
  `BattleConfig` (snapshot-fold / campaignPlacement path) and thread it.
- **Lumen** (fire ×): a free innate passive with an `onDamageDealt` hook that
  multiplies fire-tagged damage by `1 + 0.1 × ctx.scenarioTier` (caps ×1.3).
  Read `ctx.scenarioTier` off the DamageContext. Model on an existing
  `onDamageDealt` multiplier (grep the Pyromancer/Conductor kit).
- **Clio** (team CT): a free innate passive with an `onTurnStart` hook (now
  widened + fires on her non-skipped turns). Return `{ emittedActions: [...] }`
  of one `system_ct_push` per living ally, `delta = 3or4 × scenarioTier`.
  `passiveHook('onTurnStart', (args) => ...)` gives `args.state` (roster +
  scalar). NOTE: `system_ct_push`'s `SystemCtPushSource` union has no
  "team-conduct" variant — either reuse `{kind:'support', abilityId, unitId}`
  or add a variant (small action.ts edit). WATCH the tempo-loop (brief;
  playtest, tunable, don't pre-nerf).

**Seam 2 — cover (`coverParams` on PassiveAbilityDefinition).**
- **Chris**: a free innate Knight-themed passive whose def carries
  `coverParams: { redirectPerTier: 0.1, range: 1, verticalTolerance: 3 }`. The
  `cover_redirect` handler + `runMitigationOnlyPipeline` + `reduceCoverRedirect`
  already do all the work generically — Chris's passive just needs the params
  (no hooks required; the handler scans for it). Mitigation-only soak (his
  Protect/resist/armor reduce it; reactions deferred — see ADR-0141 follow-up).

**Seam 3 — unit-restricted components (`restrictedToUnit` on ComponentMeta).**
- **Thessaly**: two restricted Math components — `XP` (Parameter) + `Square`
  (Value: 1,4,9,16,25…) — added to `COMPONENT_ENTRIES` with
  `restrictedToUnit: <thessaly stable id>`, curve-priced ABOVE a base Math
  component (each opens a new row/column of triples). **Engine work:** the
  MathSkillParameter/MathSkillValue literals are a closed set — adding `xp` /
  `square` needs the engine's Math Skill types + combinator extended, and the
  Calculator picker must read the unit's unlocked components (the
  `usableMathParameters`/`usableMathValues` allowlists already exist on
  UnitPlacement; the fold stamps them). This is the heaviest remaining piece.
- **Sera**: `Hamstring` — a NEW Assassin active (Sera-restricted, buyable
  ~200 JP). MP 8, same range/LoS as her line abilities, instant. Applies
  **Move −1 and Jump −1**, **stacking + permanent**, **floors both at 0**, proc
  on the **same Speed formula as Shadow Stitch / Blowdart**. Needs a new
  stacking-debuff status (Move/Jump −1 per stack, floored) + the active.
  Restricted catalog entry keyed to Sera's stable id.

### The units (new first-class module — do NOT keep deriving from Gravity Well)

Author the five as their own campaign plot-unit definitions with **durable
stable ids** (e.g. `plot-lumen`, `plot-chris`, `plot-clio`, `plot-thessaly`,
`plot-sera`) — decoupled from the `taba-m1-NN-slug` positional scheme (Seam 3
and M5 story links key on these). Export the ids as constants so
`component-catalog-data.ts` can reference them for the restricted entries.
Gravity Well stays an **untouched standalone Mage War team**; the campaign gets
its own plot-unit roster (`m1Roster` swaps its first five for these).

| Unit | Class | classAccessOverride | Signature |
|---|---|---|---|
| Lumen (protagonist ♀) | Pyromancer (T1) | none | fire × (Seam 1) |
| Chris (deuteragonist ♂) | Knight (T2) | [Knight, Alchemist] | cover (Seam 2) |
| Clio (♀) | Hydrologist (T1) | none | team CT (Seam 1) |
| Thessaly (♀) | Calculator (T3) | [Calculator, Geosage] | 2 Math components (Seam 3) |
| Sera (♀) | Assassin (T3) | [Assassin, Monk] | Hamstring (Seam 3) |

- **classAccessOverride correct at JOIN level even though L25 won't stress it**
  (the brief's load-bearing scoping note — the T3-only fallback is the
  anti-dead-end). Author it right now.
- Lumen/Chris/Clio signatures are **free innate always-equipped** passives:
  author each as a content ability, pre-equipped in the unit's passive bucket +
  in `unlocks`, OUTSIDE the component-cost catalog (reclass/gating already treat
  non-catalog passives as "keep, don't price").
- **Pre-seed the buyable signatures** (Hamstring, Thessaly's XP/Square) as
  unlocked in the L25 fixtures so the test lineup actually exercises them.

### Portrait seam (ADR-0136 completion item 1 — first live consumer)

Wire the durable override now: add `CampaignUnit.portrait?: PortraitRef`, thread
fold → `UnitPlacement.portrait?` → engine `Unit.portrait?` → renderer (the
`gender` cosmetic precedent — engine carries, renderer interprets), and migrate
the ~7 `portraitUrlFor` sites to `resolvePortraitUrl(unit.portrait ?? {kind:
'class', ...})`. `FIXED_PORTRAITS` stays empty; keys light up as Chris's art
lands incrementally (placeholder-tolerant — don't block unit authoring on art).

### Suggested order (brief's + mine)

1. Portrait durable field + threading (unblocks unit portraits).
2. The three innate signatures (Lumen/Chris/Clio) — quick, pure content on the seams.
3. Sera's Hamstring (new status + active) + costing.
4. Thessaly's Math components (heaviest: engine Math-Skill type extension + combinator).
5. The plot-unit module + stable ids + swap into m1Roster + pre-seed signatures.
6. ADR update (extend 0141 or a new instantiation ADR), changelog (player-facing THIS time), roadmap.

### Watch-fors (carried, unchanged)
- Cover reactions/evasion — mitigation-only v1; wiring the bearer's reactions
  onto the redirect is a clean additive follow-up (ADR-0141).
- Clio tempo loop (playtest, tunable).
- Thessaly's components must be ABSENT from every non-Thessaly Calculator
  catalog (Seam 3 handles it — just don't forget the `restrictedToUnit`).

### Untouched carry-from-earlier (still open, low-priority)
- JP spillover on over-threshold spend (M2 tail).
- Enemy progression tuning for Stonebridge/Marshmoor/Mountain Pass (pure data).
- Loadout 2nd-secondary (Magus Crown), "Level Up!" banner polish, the
  rapid-dialogue-advance React setState-in-render warning.
- "99 cap" is a guide fiction (no code clamp) — a guide-doc correction someday.
