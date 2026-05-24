# Playtest Watch

The durable home for systemic playtest observations — things to keep an
eye on during real engagements that aren't ADR-worthy on their own but
shouldn't drift out of memory between sessions.

## Discipline

- **Sessions can add.** When something surfaces during a session that
  needs human playtest signal before it can be acted on, append it here.
- **Cross off when observed.** When a playtest gives the entry the
  signal it needs (good or bad), the item is closed — promoted to an
  ADR (if it produces a durable design decision), folded into a content
  rebalance (if a tuning shift), or simply struck through with a short
  resolution note.
- **Lighter than ADRs, more durable than handoffs.** Handoffs overwrite
  each session; ADRs codify decisions; this doc accumulates *pending
  observations* — items that need real human-driven engagements to
  resolve.
- **Each entry uses the same shape:**
  - **What to watch** — the specific behavior, value, or interaction.
  - **Why it matters** — the design question or risk the observation
    speaks to.
  - **What signal would indicate adjustment** — what should be observed
    that would push toward changing the underlying content / mechanic.

## Active entries

### S49 — Calculator + Math Skill + Level system

- **Math Skill targeting UX clarity.** The Calculator's parameter ×
  value pick is complex (4 × 4 = 16 combinations per ability). The
  preview UI is responsible for making the matched-set obvious at a
  glance. Watch first-pass feedback: can players read who they'd hit
  before committing? If not, UI iteration (16-grid layout, color
  contrast, hit counter prominence) needed.

- **Self-damage from Math.** A Calculator at L25 (slot 0) whose own
  CT / HP match the predicate eats their own Math cast. Watch first-
  cast surprise vs. the design intent (the trade-off is a feature, not
  a bug). The Calculator-at-slot-3 (L26) convention sidesteps Level-
  parameter self-hits; CT / HP / Height self-matches are situational.

- **Friendly fire on Math (Sculpted / Engineered buffing enemies).**
  Math Skill's friendly fire applies in both directions — a status
  buff lands on matching enemies too. Watch whether the "I buffed my
  opponent" moments read as interesting trade-offs or frustrating
  whiffs.

- **Exact Rhythm snowball.** Multi-target CT push every Calculator
  turn could lock out enemies. Brief flagged this; Chris will
  stress-test. Lever: SP reduction or per-cast cooldown if it runs
  away.

- **Sculpted Enhancement stack-up.** PA Up / MA Up are STACK_ADDITIVE.
  Multiple casts compound the party's offensive stats — across 5+
  casts, decisive or just "Calculator earned a slow setup"?

- **Engineered Defenses runaway.** Same concern at 80% base rate,
  multiplicatively stronger per cast (+10 to *each* elemental
  resistance + 5% per facing). Watch whether multiple stacks make
  units near-invulnerable; lever is non-stackable rule if so.

- **Level-system retroactive template rebalance.** S49 applied
  slot-based levels to all 8 pre-S49 templates (Mage War's Geosage
  at slot 1 → L24 → -10% HP/MP; the Aethurge at slot 3 → L23 → -1
  MA + -20% HP/MP). Watch whether these tunings hold or want
  rebalancing — the templates were calibrated at uniform L25.

- **Calculator at L26 (slot 3) default placement.** Naturally optimal
  for Level math (immune to Level-parameter self-hits). Watch whether
  every Calculator team defaults to this — predictable + meta-locked
  — or whether other slot placements stay viable for CT / HP
  parameter strategies.

- **AI Math Skill quality.** v1 max-EV scoring may pick options that
  look weird to a human (a Calculator hitting many allies for a
  slight enemy hit; Targeted Treatment on enemies). Watch AI play
  for "intelligent" vs "arbitrary" reads. Aggressive / Conservative
  variants deferred to a future session if needed.

- **Magus Crown + Math Skill interactions.** A Calculator + Magus
  Crown gets Math + two secondaries at MA 5 (down from 8). A Mage +
  Magus + Math secondary gets native spells + Math + a third
  secondary at MA 8–9. Watch whether these are interesting build
  options or auto-picks.

- **Mathematician's anti-parasitism lever holds?** Mage + Math
  secondary + Mathematician costs the Mage's Support slot
  (Conductor). Watch whether the trade is real — does the Math
  output justify giving up MA × 1.25 — or whether cross-class Math
  becomes the default for Mages.

### River Ridge balance post-S37 loadout changes

- **What to watch.** River Ridge engagements after the S36 loadout
  shift (Pointy Hat / Wizard's Robe diversity) and the S37 equipment
  pool expansion (Travel Garb, Lookout's Hood, Light / Dark Robe,
  Crusader's Helm, Tricorn, Spiked Mail). Watch unit survivability,
  damage trades, time-to-KO across the four mage elements + Knight.
- **Why it matters.** S36 swapped Pointy Hat for Magus Crown / Guard
  Cap / Focus Band across the river-ridge roster; S37 expands the
  equipment surface mid-content. The relative power of teams might
  drift.
- **Signal for adjustment.** Lopsided engagements (one team wins ≥ 80%
  of the time without changing tactics); a unit reads as never useful
  in its new loadout; a build becomes mandatory because it
  dominates.

### Battle Gear HP swing on Fire Mage

- **What to watch.** A Fire Mage in Battle Gear shows ~227 HP in the
  team builder vs ~97 baseline — a +130 swing from the catalog's
  statMods. (S36 observation, S37 carry.)
- **Why it matters.** Authored value, faithfully composed. Whether it
  reads as "good fat" or "outsized" wants a playtest signal.
- **Signal for adjustment.** Battle Gear Fire Mages dominating
  engagements; Battle Gear becoming the default mage body slot when
  the elemental matchup doesn't matter.

### Burn × Purifier readability

- **What to watch.** The Red Lightning Mage carries Purifier (which
  doubles per-tick stack consumption on negative-tagged statuses).
  When Burn is applied to a Purifier wearer, the burn ticks faster.
- **Why it matters.** The interaction is mechanically correct but
  readability is uncertain — does a player watching the action log
  understand why Burn is decaying twice as fast on Purifier wearers?
- **Signal for adjustment.** Purifier wearers feel "lucky" instead of
  "rewarded for the gear choice"; the action log entries don't make
  the Purifier-Burn interaction legible.

### Bedrock Stride real-knockback playtest

- **What to watch.** Bedrock Stride's elevation-driven knockback. The
  collision policy + falling-damage substrate was integration-tested
  in S33, but real human-driven engagements on River Ridge haven't
  exercised the cliff-edge geometry yet.
- **Why it matters.** Bedrock Stride is the Earth Mage's signature
  mobility tool; if it feels janky or unpredictable on the
  river-ridge map's cliff lines, it'll surface as a tactics-layer
  problem.
- **Signal for adjustment.** Players visibly hesitating to use
  Bedrock Stride near elevation changes; outcomes feeling random
  rather than spatial-tactical.

### Tidewalker tempo signature on River Ridge

- **What to watch.** Tidewalker (Water Mage's water-traverse passive)
  on River Ridge's shallow-water tiles — does the Water Mage's
  tempo feel different from the others on this map, and is the
  difference legible?
- **Why it matters.** River Ridge has water terrain by design;
  Tidewalker is meant to matter here. If it doesn't change
  positioning behavior on this map, the passive is undercosted (free
  flexibility) or the map isn't shaped to reward it.
- **Signal for adjustment.** Water Mages standing on the same tiles
  as non-Water Mages 90% of the time; Tidewalker's terrain access
  never being the decisive factor in a positioning choice.

### Procced spell uses caster's MA

- **What to watch.** When a procced ability fires (Bolt Hammer →
  Lightning Strike, Flametongue → apply_burn), the spell's MA scaler
  uses the *wielder's* MA, not the proc's "natural" caster's. So a
  high-MA Mage wielding Bolt Hammer fires bigger Lightning Strikes
  than a Knight would.
- **Why it matters.** Composable identity — the weapon is the spell's
  source; the wielder is the caster. Whether this lands as
  build-enabling or surprise-confusing wants signal.
- **Signal for adjustment.** Players surprised that the proc's damage
  scales with their unit's MA; balance reads where a high-MA
  proc-wielder becomes dominant.

### Magus Crown calibration

- **What to watch.** Magus Crown's +1 secondary-command-sets capacity
  on Mages, especially when the Mage runs both elemental command
  sets via the crown.
- **Why it matters.** Two command sets on one Mage is a powerful
  flexibility — does the head-slot opportunity cost (no Pointy Hat,
  Focus Band, etc.) read as a real tradeoff?
- **Signal for adjustment.** Magus Crown becoming the default Mage
  head when running mixed builds; opportunity cost feeling
  insufficient.

### Tintinibar Regen calibration

- **What to watch.** Tintinibar's Regen status on the wearer.
  Calibration of the per-tick heal vs. the accessory's other costs.
- **Why it matters.** Regen is a slow-sustain mechanic; if it's too
  weak it's invisible, if too strong it neutralizes attrition
  pressure entirely.
- **Signal for adjustment.** Tintinibar wearers shrugging off
  damage they shouldn't; or Tintinibar feeling like a "dead" slot
  that never matters.

### Sorcerer's Robe Move +1

- **What to watch.** The Move +1 added to Sorcerer's Robe — does
  the extra step land as "harder to pin down" (per the equipment
  doc) or does it shift Mage positioning behavior subtly enough
  that nothing's different?
- **Why it matters.** Move ranges have integer-step behavior in a
  grid game; a +1 either changes a positioning choice or doesn't.
- **Signal for adjustment.** Sorcerer's Robe Mages reaching their
  cast positions when other Mages can't; opponents adjusting their
  approach because Mages aren't where they expected.

### Pacing constants (260 / 480 / 1100 / 360 ms)

- **What to watch.** The S33.5 turn-pacing values: between-event
  delay, charged-action settle, results-screen reveal, etc.
- **Why it matters.** Initial read was "good" (Chris's S33.5 note);
  ongoing watch is whether longer engagements develop pacing fatigue
  or feel rushed.
- **Signal for adjustment.** Players visibly waiting for animations
  to finish; or rapid-clicking through events they should be reading.

### Cliff-edge thickness (2 / 3 / 5px)

- **What to watch.** River Ridge's elevation-edge rendering — the
  visual thickness of cliff edges by elevation differential.
- **Why it matters.** Cliffs convey tactical information (drop
  hazards, line-of-sight, Bedrock Stride targets). Initial read
  was good; ongoing watch is whether the thickness reads at all
  viewport sizes.
- **Signal for adjustment.** Players missing cliff edges and
  walking off / falling unexpectedly; or asking "is that a cliff
  or a tile boundary?"

### Spiked Mail reflect feel (new S37)

- **What to watch.** A Knight in Spiked Mail taking physical hits —
  does the 20% return damage to the attacker feel like a meaningful
  defensive tool, like punitive overhead, or like noise?
- **Why it matters.** First reflect-style equipment effect in the
  catalog; the 20% number was a first-pass pick. The reflect is
  deterministic (no Brave gate) and reads `[revenge]` in the action
  log.
- **Signal for adjustment.** Attackers steering around Spiked Mail
  wearers ("don't punch the spiky one" emerges as visible tactic);
  or attackers ignoring it entirely because 20% isn't enough to
  change targeting decisions.

### Crusader's Helm Faith bump on Knight (new S37)

- **What to watch.** A Knight in Crusader's Helm vs. Steel Helm /
  Tactical Mask — does the +10 Faith pay off in current Knight
  content, or is it a head-slot piece without a use case?
- **Why it matters.** Knights don't natively cast Faith-scaling
  abilities in the current ability set; the helm is positioned for
  hybrid-caster Knights running mage command sets. If the Knight
  command-set repertoire doesn't reward Faith, Crusader's Helm is
  inert.
- **Signal for adjustment.** Crusader's Helm never picked in
  Knight loadouts; or only picked when running a mage secondary
  command set.

### Tricorn Brave bump on Mage (new S37)

- **What to watch.** A Mage in Tricorn vs. Pointy Hat / Magus
  Crown — does the +10 Brave actually push reaction firing
  probabilities high enough to matter (Discharge, Earth
  Resilience)? Does it pair with weapon-proc weapons (Bolt
  Hammer's Lightning Strike rider via attackProc) in a way that
  shifts build patterns?
- **Why it matters.** Mages typically don't carry physical
  reaction patterns; Tricorn opens a hybrid-physical / reactive
  Mage build path.
- **Signal for adjustment.** Tricorn never picked; or only
  picked when running a specific reactive ability set.

### Light/Dark Robe choice salience (new S37)

- **What to watch.** Does the choice between Sorcerer's Robe
  (all-element balanced), Light Robe (Fire/Lightning specialist),
  and Dark Robe (Water/Earth specialist) actually emerge as a
  real decision when assembling a Mage team?
- **Why it matters.** The three-way split was designed to make
  opponent-element matchup a real loadout-time decision rather than
  a default. If players don't know their opponent (deployment-phase
  blind, no reconnaissance), the choice may collapse to "always
  Sorcerer's."
- **Signal for adjustment.** Players defaulting to Sorcerer's Robe
  regardless of opponent; or Light/Dark Robe over-performing because
  opponent rosters are too predictable.

### Post-S38 duration rebalance (per_unit_ct statuses)

- **What to watch.** The 2026-05-15 in-between-sessions pass cut
  `per_unit_ct` status durations to FFT-shaped values: Don't Act / Don't
  Move 24→3 (Earth Cataclysm), Blind / Silence 24→4 (Earth Curse),
  movement debuff 24/36→4 (Earth Quake / Earth Strike), Stop 12→3
  (Bolt / Stasis Sword), Taunted 12→4, regen 36→10 (Earth Blessing),
  movement self-buff 24→6 (Earth Resilience). These reset the
  "duration N = N of the **holder's** turn cycles" expectation; the
  prior 24 meant ~24 wasted Knight-turns and felt like an eternity.
- **Why it matters.** First-pass FFT-shaped numbers, picked to match
  hard-disables ≈ 3 turns, soft-disables ≈ 4 turns, buffs 6–10. Play
  feel could shift in any direction: hard-disables might now feel
  too short to matter, or soft-disables might land in the "annoying
  but not decisive" sweet spot, or the math could expose secondary
  effects (e.g. with shorter Stop, Stasis Sword stops feeling like a
  Knight-build payoff).
- **Signal for adjustment.** Hard-disables (DA / DM / Stop) feeling
  inconsequential — the target shakes them in one or two turns and
  the spell read as wasted MP. Conversely, AoE hard-disables (Earth
  Cataclysm) still feeling overpowered because the cluster targeting
  amplifies the 3-turn impact. Regen at 10 healing for full
  engagements vs. running out before the Earth Mage's next cast.

### Magebane Silence base rate (S40)

- **What to watch.** Magebane's weapon-side proc rate is a flat 50% on
  every connecting physical hit (matches the apply_burn_proc convention
  per ADR-0064 — decoupled from wielder casting stats). Apply_silence_
  proc then short-circuits the BMG formula via `applyAlways: true`, so
  the only modifiers between the 50% gate and Silence landing are the
  target-side `modifyIncomingStatusApplicationChance` chain (Pointy Hat
  × 0.5, Focus Band × 0.75). Effective rate against a Pointy-Hat mage
  is 25%; against a bare mage, 50%.
- **Why it matters.** 50% is higher than FFT-canon weapon procs
  (typically 19–25%). The brief flagged this as tunable in playtest.
  Mages make up 4/5 of the v1 class roster — Magebane on a Knight or
  cross-class Alchemist is a real anti-mage pressure tool, especially
  paired with Remedy.
- **Signal for adjustment.** Mages feel forced to wear Pointy Hat
  defensively, distorting the equipment economy. Conversely, mages
  shrug off the Silence (because Remedy clears it fast enough that
  the proc never feels decisive). Anti-mage teams dominate mage-heavy
  compositions in head-to-head engagements.

### Knife dynamic variance — Speed-class spread

- **What to watch.** Knives use `attacker_speed` variance: the band is
  `[Speed/10 - 0.05, Speed/10 + 0.05]`. A Knight (Speed 9) at `[0.85,
  0.95]` shaves ~10% off the raw PA × WP; an Aethurge (Speed 11) at
  `[1.05, 1.15]` adds ~10%; Sai-equipped wielders read at `[0.95,
  1.05]` (neutral). Magebane's WP 5 + Knight PA 12 + variance 0.9
  yields ~54 base; with Sai instead, WP 4 + Speed-10 variance 1.0
  yields ~48. The damage spread between class wielders is real but
  not enormous.
- **Why it matters.** First content using a dynamic variance source.
  The spread (±0.05) is intentionally tight per Chris's design call —
  preserves "every weapon has *some* variance" without breaking the
  Speed-deterministic character. If the spread feels flat in play
  (no swingy moments on a knife hit) we can widen; if it feels noisy
  we narrow.
- **Signal for adjustment.** Damage on knife hits feels uniformly
  predictable / boring to land (too tight). Conversely, knife hits
  feel inconsistent enough that players avoid them in tight spots
  (too wide). Mage-class knife wielders (the 1.05–1.15 band) feeling
  exploitable — a Mage wielding a Magebane / Chef's Knife is an
  off-character tactical option, watch whether it lands as
  intentional flavor or as "this should be class-restricted."

### Chef's Knife + Alchemist healing scaling

- **What to watch.** Chef's Knife adds +1 PA to the wielder. On the
  Alchemist, PA scales every consumable's heal: Potion (PA × 12 → +12
  HP per throw), Phoenix Down (PA × 4 → +4 HP), Ether (PA × 4 → +4
  MP). Verified at the team builder: Alchemist PA 8 → 9 with the
  knife equipped; Potion heal reads 108 HP instead of 96.
- **Why it matters.** The Alchemist's healing role gets a small
  reliable amplifier through equipment. The brief expected this as
  "meaningful but not transformative." Whether it actually reads that
  way in play — does the Alchemist suddenly feel like a strict-better
  healer in Chef's Knife, or does the small headline scaling still
  read as marginal?
- **Signal for adjustment.** Every Alchemist build defaults to Chef's
  Knife because the PA scaling dominates the tactical decision —
  suggests the +1 PA is too valuable on this class specifically.
  Conversely, Alchemist players reach for Magebane or Sai because
  the Chef's Knife buff feels too small to matter.

### Sai + Healthy Stride interaction (no amplification)

- **What to watch.** Sai grants +1 Speed, NOT +1 Move. Healthy Stride
  scales with tiles moved (Move stat). Sai therefore does NOT amplify
  Healthy Stride's heal — only Move-boosting gear (Boots of Haste,
  Sorcerer's Robe) does.
- **Why it matters.** Player expectation: "this knife makes me faster,
  maybe my movement heal scales too." It doesn't. The +1 Speed
  contributes to (a) the knife's own variance band lifting a slow
  class toward neutrality, (b) CT accumulation toward the next turn.
  Both are intentional but neither feeds Healthy Stride.
- **Signal for adjustment.** Players consistently ask "why doesn't Sai
  buff my Healthy Stride?" — suggests tooltip / detail-text should
  surface the distinction more explicitly. Alternatively, the
  Alchemist build economy stays clear enough that the question
  doesn't surface and no change is needed.

### Universal-access knives — soft filter only

- **What to watch.** Knives ship with no `classRestrictions`. All
  classes (Knight, Alchemist, four mages) can equip them. The brief's
  D5 originally recommended Knight + Alchemist only; Chris's response
  in plan-review aligned the implementation to keep weapons
  class-agnostic, with "other factors (e.g. Mages usually don't want
  to be attacking) as the soft filter."
- **Why it matters.** Mage knife builds become a real (if niche)
  option. A Pyromancer or Geosage on a defensive footing could wield
  a Magebane and use physical hits as a Silence-application vector
  instead of casting their own debuffs. Whether this plays as a
  flavor option or as a meta-distorting strategy is the watch item.
- **Signal for adjustment.** Mage-knife builds dominate competitive
  loadouts (suggests the soft filter is too soft). Conversely, mage
  knife wielders never read as worth the action-economy tradeoff (the
  expected outcome — confirms the soft filter holds).

### AI weapon-proc target preference (minimal v1)

- **What to watch.** Per D7 / ADR-0078, the AI's scoring multiplies
  target appeal × 1.5 when (a) the actor wields a weapon with an
  attackProc, (b) the procced ability applies Silence, (c) the
  target is a mage class. v1 only models Silence-vs-mage; the helper
  shape is generic so future combinations extend cleanly.
- **Why it matters.** Magebane-equipped enemies should preferentially
  target the player's mage line. The bonus is a soft preference
  (1.5×) rather than a forcing function — kill value still
  dominates when a non-mage is much closer to death. Whether this
  reads in playtest as "the AI feels smarter against my mages"
  or as "the AI is doing nothing different" is the open question.
- **Signal for adjustment.** Magebane AI feels indistinguishable from
  Long Sword AI (suggests the 1.5× is too gentle); conversely, AI
  obviously favors the mage so consistently that other targets are
  ignored when they should be picked (suggests too strong).

---

## Session 42 — Assassin + Two Weapons + Lightning Stab

### Knight + Bravestrider + Lightning Stab apply rate

- **What to watch.** Lightning Stab's Silence rider uses `{ brave: true, ma: true }` at baseChance 50 (held at Stasis Sword's prior calibration per D3). Bravestrider's +10 Brave (Knight 70 → 80) lifts the rate above the old Stasis-Sword baseline.
- **Why it matters.** A Bravestrider Knight Silencing a caster ~52% per hit may read as too sticky — Silence is a hard caster-disable.
- **Signal for adjustment.** If Silence lands so reliably it neuters enemy mages from turn one, shave Lightning Stab's baseChance (50 → 40) or revisit Bravestrider's Brave magnitude.

### Speed Save accumulator snowball

- **What to watch.** The Assassin gains +1 Speed per enemy hit (permanent, accumulating, persists through KO). Early hits → faster Assassin → harder to catch.
- **Why it matters.** Snowball potential, likely checked by HP 96 + 0 back-evade making early hits often lethal — but watch.
- **Note (D5 nuance / known limitation).** The flat `perUnitPerTurnReactions: 1` cap throttles Speed Save to **once per enemy turn**, even when a Two-Weapons enemy lands both swings (D5 wanted up to 2 procs). Honoring per-swing would need a per-ability reaction-cap override — deferred. Watch whether once-per-turn feels too slow to ramp.

### Multi-swing × Counter / Power Attack

- **What to watch.** A Two-Weapons attacker triggers the target's Counter per swing (capped at 1/turn), and Knight + Two Weapons + Power Attack + Battle Gear is a burst spike.
- **Why it matters.** Whether multi-weapon use feels discouraged against Counter targets (good) or Counter feels oppressive (bad); and whether dual-wield Power Attack overshadows other builds.
- **Signal for adjustment.** Earlier math: Knight + Two Weapons + dual axes ≈ 1634 dmg / 9 turns vs Martial Expertise single-weapon ≈ 1404. Watch whether the shield-loss trade keeps Martial Expertise a real choice.

### Permadebuff stickiness (Undermine / Sow Doubt)

- **What to watch.** Brave Down / Faith Down now persist all battle (permanent, through KO, Remedy-immune per ADR-0081). Existing PA/MA/Speed Down also became Remedy-immune this session — a balance change to Fire/Earth Strike / Brine / Earth Quake.
- **Why it matters.** Early debuff applications are "locked in." Strong identity; watch for whether it reads as decisive or as feel-bad / un-counterable.
- **Signal for adjustment.** If un-cleanseable stat debuffs feel oppressive, reconsider a cleanse path or per-status `remedyImmune` scoping. Undermine's self-cancellation tension (lower Brave → lower Brave-and-Speed re-apply chance) and Sow Doubt's double-edged Faith (also softens your own mages vs that target) are designed textures — confirm they read as interesting, not frustrating.

### Assassin AI

- **What to watch.** No Assassin-specific AI heuristics were added; the Command Set works through the existing data-driven "non-buff status applier = offensive" classification.
- **Signal for adjustment.** If the Assassin idles, spams one ability, or applies debuffs to poor targets, add Assassin-aware scoring (priority-target weighting for Shadow Stitch / Undermine; sustained-pressure value for Blowdart).

### The Offering — four-swing burst ceiling

- **What to watch.** The Offering (accessory) doubles basic-Attack swings per weapon; with Two Weapons that's **four swings** in one Attack, each rolling its own damage/variance/weapon-procs and each able to trigger the target's Counter / Speed Save. Balancing is a flat −2 PA + the accessory slot.
- **Why it matters.** Four-swing basic attacks are a large raw-output lever. On Knight + dual axes + Battle Gear especially, watch whether it overshadows other builds. Deliberately gated to the *basic Attack* (not Power Attack / Lightning Stab / Counter), which caps the ceiling.
- **Signal for adjustment.** If four-swing Attack output dominates, increase the −2 PA tax, make `attackSwingMultiplier` not multiply with dual-wield (cap total swings at 2), or raise the accessory's opportunity cost. Conversely, if −2 PA makes it never worth equipping, soften the tax.

### S43 — AI vs. AI balance & loop conditions

- **What to watch.** AI-vs-AI (both teams `control: 'ai'`) is a new mode that puts the AI in charge of both sides. It exercises edge cases human-vs-AI never reaches.
- **Why it matters.** Watch for: AI loop/stall conditions, both-sides-questionable decisions, battles running excessively long (no decisive play), or the existing offensive-classification AI mirror-matching into stalemate.
- **Signal for adjustment.** If AI-vs-AI battles routinely fail to terminate or visibly thrash, add tie-break / aggression heuristics to the basic AI. (A step bound already guards the AI-vs-AI integration test.)

### S43 — AI deployment heuristic positioning quality

- **What to watch.** AI teams auto-deploy via `planAiDeployment`: high-`maxHP` units forward (nearest the front center), low-HP back, all facing the opposing centroid. It is deterministic but not role-aware.
- **Why it matters.** maxHP is a rough proxy for "should be in front." A high-HP support (e.g. a tanky Hydrologist) lands forward; a squishy-but-frontline class lands back. Real play will reveal where "HP forward" reads wrong.
- **Signal for adjustment.** If placements feel consistently off, move to role-aware sorting (tank > damage > support) or an AI scoring-based placement pass. The geometry (front-center assignment, facing) is sound; the *sort key* is the lever.

### S43 — Pass-and-play handoff ergonomics & active-team signaling

- **What to watch.** First two-human playtest. Does the `HandoffScreen` beat between turns feel smooth or naggy? Is it clear whose turn it is in active play? All three signals ship on by default — (a) banner, (b) menu glow, (c) fading alert — each toggleable in pause → Settings.
- **Why it matters.** No information-hiding is needed (everything is visible); the only risk is forgetting whose turn it is. The open question is which *combination* of the three signals is sufficient vs. redundant.
- **Signal for adjustment.** After playtest, turn off whichever signals feel redundant (Chris's stated plan). If the mid-battle handoff prompt feels like too much friction on every human→human turn, consider gating it (e.g. only on team change after N turns, or a "skip handoffs" setting).

### S43 — KO'd-unit traversal secondary interactions

- **What to watch.** Movement now lets a unit path *through* a KO'd unit's tile (any team) but not stop on it (`removed`/permadead units are fully free). Watch for unexpected interactions with charged-spell line-of-sight, AoE targeting, or other tile-occupancy-sensitive subsystems now that downed bodies are pathable.
- **Why it matters.** The fix is scoped to pathfinding traversal only, but tile-occupancy is consulted in several places; a downed unit being "passable for movement but still an occupant for settling/targeting" is a subtle split.
- **Signal for adjustment.** If a downed unit blocks/allows something inconsistently (e.g. an AoE that should hit the tile misses, or LoS behaves oddly across a body), reconcile that subsystem's occupancy predicate with `isKO`.

### S43 — Pre-existing border/borderColor style warnings (minor)

- **What to watch.** Two React dev warnings ("Removing a style property during rerender (borderColor) when a conflicting property is set (border)") fire during battle. Confirmed *not* introduced by S43 (the new signaling components use only separate `borderWidth/Style/Color`); a battle component mixes the `border` shorthand with a dynamic `borderColor`.
- **Why it matters.** Cosmetic dev-console noise only; no functional impact. Worth tracking down so it doesn't mask a real warning.
- **Signal for adjustment.** Trivial fix when located — replace the offending `border: '…'` shorthand with separate border properties. Fold into any future UI-polish pass.

### S45 — Bow accuracy calibration (Eagle Eye on 33% base)

- **What to watch.** Bare bows hit at 33% accuracy; Eagle Eye (native Hunter Support) doubles it to ~66% net. Whether a Hunter without Eagle Eye feels uselessly unreliable, and whether one *with* it dominates.
- **Why it matters.** 66% is the design center for a high-WP ranged attacker. Real play may show it's too low (Hunter whiffs too much to matter) or too high (free ranged pressure outclasses melee).
- **Signal for adjustment.** Levers, in order of bluntness: bow base accuracy (33), the Eagle Eye multiplier (×2), or both. The Longbow's WP 7 assumes ~66% effective; re-tune WP if accuracy moves.

### S45 — Longbow elevation safe zones (the 5-cap)

- **What to watch.** Height-delta variance clamps to 0 when the target sits ≥5 tiles above the shooter — a target on a tall cliff is bow-immune from below. Conversely, shooting *down* multiplies damage (×2.0 at 5 below). River Ridge's west high ground likely creates such zones.
- **Why it matters.** This is intended positional texture (high ground matters), but on a map with a dominant cliff it could create one-sided archer duels or unkillable perches.
- **Signal for adjustment.** If a map produces a degenerate safe perch, the lever is `falloffPerHeight` (currently 0.2 → 5-tile cap) or map elevation design, not the mechanism.

### S45 — Pin Down EV in real play

- **What to watch.** Pin Down lands Slow at ~33% net (base 50% × Brave 0.49 × Speed-factor 1.35 at the reference 70-Brave / Speed-9 matchup). Whether that feels worth an action against the value of a 4-turn Slow.
- **Why it matters.** Below break-even and nobody uses it; too reliable and Slow-locking trivializes fights. It's calibrated to sit alongside Shadow Stitch / Magebane Silence as an action-cost-only applier.
- **Signal for adjustment.** Levers: base rate (50), duration (4 turns), or the Slow magnitude (×0.5 Speed).

### S45 — Riptide Bow CT-push tuning

- **What to watch.** 30% on-hit proc pushes the target's CT back ~18 (PA-scaled, factor −3 × Hunter PA 6 ≈ 2 ticks). Whether it's a noticeable tempo tool or negligible/oppressive.
- **Why it matters.** The Riptide trades WP (5 vs Longbow 7) for tempo control; if the push is too small the trade is dead, too big and it chains targets into permanent CT-lock.
- **Signal for adjustment.** Levers: proc chance (0.30), `undertow`'s factor (−3), or the WP gap vs the Longbow.

### S45 — Charged Attack Action Speed (escape window)

- **What to watch.** Charged Attack charges at `actionSpeed 25` (Brine/Earth-Quake tier, ~1 enemy turn for a Speed-9 Hunter). Whether slow targets can't escape the pinned tile but fast targets can — the intended "aim" dynamic.
- **Why it matters.** Too fast and it's a no-downside nuke; too slow and the target always walks off the tile (wasted action).
- **Signal for adjustment.** The `actionSpeed` value is the single lever; calibrate against the Speed band of common targets (9–14).

### S45 — Scramble use frequency

- **What to watch.** Whether Hunter players ever use Scramble (the 1-tile, jump-5 reposition) or always just Move before firing. Constant panic-leaping out of melee would suggest the bow's 2-tile min-range is too punishing; never using it suggests a dead slot.
- **Why it matters.** Scramble exists to answer the bow's min-range dead zone and to reach high ground; if it's redundant with normal Move, the Marksmanship slot is wasted.
- **Signal for adjustment.** Tune the bow min-range (2) and/or Hunter Move (4) / base Jump (3); or reconsider Scramble's reach/leap.

### S45 — The Offering + bow, and Knight + bow + Lightning Stab

- **What to watch.** Two cross-build interactions the substrate enables: The Offering on a bow (two ~66% shots/turn at range with elevation bonuses) and a Knight wielding a bow with Lightning Stab (a ranged status applier). Both are intended-but-untested power combos.
- **Why it matters.** The Offering's −2 PA tax + accessory cost should balance the double shot; Lightning Stab inheriting bow range is a deliberate design choice. Either could over/under-perform.
- **Signal for adjustment.** If The Offering + bow dominates, revisit the swings-per-weapon gate or the PA tax. If Knight + bow + Lightning Stab is oppressive, the lever is Lightning Stab's rider rate or whether weapon-tagged Battle Skills inherit weapon range.

### S45 — AI Hunter deployment placement

- **What to watch.** The HP-only AI deployment heuristic (S43) places the Hunter (HP 116) mid-pack. A bow archer wants high ground or the back line, not the middle.
- **Why it matters.** Same root as the S43 role-aware-sorting watch: maxHP is a poor proxy for a ranged class's ideal position.
- **Signal for adjustment.** Reinforces the case for role-aware deployment sorting (tank > damage > ranged/support).

---

## Session 46 — Playtest tuning / bug fixes (Hunter, UI, Stop)

### Move/map size tuning observation (deferred — second-map design)

- **What to watch.** Units routinely have 5-7 Move on the 14×14 River Ridge — first turn often resolves into combat without much positional setup. This is structural, not a class-balance read.
- **Why it matters.** A "turn 1 = engage" tempo skips the deliberate positioning phase the map's elevation/terrain is designed to reward. Two tuning levers: (a) reduce baseline Move by 1 across all classes, (b) make future maps larger (16×16 or 18×18).
- **Signal for adjustment.** Decision lands in the next map-design session (S47+) — pick (a), (b), or both based on how the second map's footprint and elevation rhythm shape up. Don't act on River Ridge alone.

### Bow damage forecast format after Item-1 fix

- **What to watch.** Bow forecasts now show raw damage range (variance only) with hit chance in a separate row. Watch for edge cases: range "0-0" when shooting ≥5 tiles uphill (height_delta clamps to 0), big swings on cliff-edge shots, and whether the hit-chance row is visible enough next to the damage row in actual play.
- **Why it matters.** The S46 fix removes the hit-chance multiplier from the damage range and resolves height_delta on the midpoint. UI semantics changed: "damage" now means "if it hits" rather than "EV including miss." A player might initially miscalibrate against the prior display.
- **Signal for adjustment.** Players asked "why does the forecast show 84 but I expected 55?" — readability issue, lever is panel layout (combine damage × hit_chance into a third "expected" row, or label the existing row more clearly). Not a calculation bug.

### Charging-target hit guarantee — interaction surfaces

- **What to watch.** Per S46 Item 2: physical attacks on charging targets auto-hit. Watch the interaction with: (a) The Offering's four-swing burst on a charging target (each swing guaranteed?), (b) Counter reactions firing on the auto-hit, (c) AI scoring — does the AI now sharply prefer attacking visibly-charging enemies?
- **Why it matters.** The guarantee is new content (not just an audit-cleanup), so its second-order effects haven't been observed yet. A charging Aethurge becomes a high-value target for ANY physical attacker — possibly a Knight cleaning house mid-cast.
- **Signal for adjustment.** If charging Mages feel un-defendable (every physical hit lands), tune the actionSpeed of the charged spells or the timing windows. If the AI ignores charging targets, expand the role-aware scoring.

### Stop tick + CT drain after Item 3 fix

- **What to watch.** Per S46 Item 3: Stopped units' fake turns drain CT to 0 AND decrement Stop's duration. Watch for: (a) Shadow Stitch / Stasis Sword Stops feeling meaningful (3 fake turns of actual immobility), (b) whether Stopped + Slowed compounds into very-long disable windows, (c) the action log's readability — three "status_tick" rows + a "Stop expired" row across the Stop's lifetime.
- **Why it matters.** Pre-S46 Stop felt sticky-then-weak (duration never counted down, but CT also kept high so the unit came back fast). Post-fix it's FFT-canonical (CT drains, duration ticks). The "right" feel needs human playtest signal — too short and Stop becomes filler; too long and locked-out units feel un-fun.
- **Signal for adjustment.** Levers: Stop's duration on each applier (Shadow Stitch 3t, Stasis Sword 3t), the Brave×MA application chance, or revisit the "Stop drains CT entirely" rule if it makes the recovery cycle feel too punishing for fast classes.

### Permadeath visual now full sprite removal

- **What to watch.** Per S46 Item 5: removed (permadead) units are hidden from the field entirely. KO'd-but-not-removed units retain their sprite at reduced alpha. Watch for: (a) does the disappearance read as decisive (FFT-style) or jarring (sprite pops out instantly)?, (b) does the action log readout suffice to explain the missing body?, (c) any odd interactions during the moment a unit transitions from KO'd to removed.
- **Why it matters.** The S41 permadeath badge is now redundant (the sprite is just gone). Visual ambiguity between KO and permadeath was the bug — confirmed fixed structurally; the "feel" is the next question.
- **Signal for adjustment.** If the instant-pop feels too abrupt, add a 200-400ms fade-out transition before removal. If players miss the moment of removal, lean into the action-log line and / or a brief flash on the tile.

### Zoom max bumped to 4.0 (from 3.0)

- **What to watch.** Per S46 Item 6: maximum zoom raised from 3× to 4×. Watch: (a) art quality at max zoom (tile textures, unit sprites, status badges), (b) whether the higher cap shifts how players use the camera in actual play (more close-up tactical view, less mini-map-style overview), (c) any UI overlap at extreme zoom (status chips, action log).
- **Why it matters.** The prior 3× cap was conservative. Verified visually at 4×: tiles still crisp, no pixelation. But playtest may surface issues the visual spot-check missed.
- **Signal for adjustment.** Levers: lower back to 3.5× if pixelation visible; raise to 4.5× if 4× still feels distant. The pan / camera-bounds math is zoom-independent so further tuning is single-knob.

### Terrain bar mid-battle vanishing — deferred root-cause investigation

- **What to watch.** The S46 audit fixed the padding (bar at top:12 instead of top:0) but couldn't reproduce the mid-battle vanishing in the dev-server pass — the bar is rendered unconditionally per the code path. Cursor-tile useState persistence between battles is the leading hypothesis but doesn't explain mid-battle disappearance well.
- **Why it matters.** A vanishing top bar mid-battle hides the X/Y/Elev/Terrain readout the player relies on for elevation-aware positioning (bows, knockback, Bedrock Stride). If it's genuinely intermittent, more playtest data is needed.
- **Signal for adjustment.** Next playtest pass: try to repro and capture (a) when in the turn cycle, (b) what action / settings change preceded it, (c) whether the bar's DOM is still present (use the inspect tool). Common candidates to consider: a turn-transition alert, a pause-resume cycle, a settings toggle.

### Stonebridge — race-to-seize dynamics (S47)

- **What to watch.** Stonebridge's symmetric deployment + south-team-closer-to-the-keep layout. Watch (a) whether Red consistently reaches the keep by turn 2-3, (b) whether magic vertical (Blue can engage rampart from afar) balances this or whether the building falls to whoever spawns nearest, (c) whether the central bridge (peak elev 6) sees actual fighting or whether teams just pass each other and converge on the keep.
- **Why it matters.** S47 ships Stonebridge with explicit awareness that deployment is symmetric but the building is *not* symmetric in reach — Red is closer. The race may produce one-sided matches.
- **Signal for adjustment.** If Red wins ≥70% with the same team comps and Blue plays optimally, tighten Red's deployment (move to rows 13-14 instead of 14-15) or restructure the keep (widen the gate, add a postern). If Blue can keep up via magic vertical, leave as-is.

### Stonebridge — two-Hunter-rampart stress test (S47)

- **What to watch.** Two Hunters deployed by Red onto the rampart (elev 8) shooting bow attacks down at attackers. Magic vertical (ADR-0085) is intended as the equalizer. Watch (a) whether magic from flat ground feels like adequate counterplay, (b) whether the Hunters' elevation-damage-reward (per ADR-0083 height_delta variance) makes them too dominant before magic can land, (c) whether the keep + bow combination feels like a fortress or a fair perch.
- **Why it matters.** Hunters on perch is the canonical defensive composition; if magic vertical is the answer per the brief's framing, this is the proof.
- **Signal for adjustment.** If two-Hunter-rampart wins consistently, levers: (a) drop rampart elev 8 → 7 (reducing Hunter bow damage bonus), (b) tighten the AoE vertical tolerance further (default 3 might still be too generous), (c) widen the gate so attackers can collapse the choke without exposing themselves to two shots before reaching melee range.

### Stonebridge — defender bottle-up at the gate (S47)

- **What to watch.** The keep's single-tile gate at (10, 14). Watch matches where attackers can't dislodge defenders even with magic + Assassin tools — bodies pile up at the gate, the rampart picks them off, and attackers run out of MP before breaking in.
- **Why it matters.** A choke point is healthy tension; a *deadly* choke point makes the map unwinnable for attackers. The single-tile gate may be either.
- **Signal for adjustment.** Levers: (a) widen the gate to 2 tiles (turn (10, 14) and (11, 14) both into the opening), (b) add a postern via a future map revision (one extra ground tile in the south or east wall as a secondary entry), (c) restructure the rampart's line-of-sight to add a blind spot near the gate.

### Stonebridge — AI deployment on the new map (S47)

- **What to watch.** The AI deployment heuristic places HP-descending into front-center. Watch how it lays out a Red team for Stonebridge: does it place tanks toward the bridge, support classes inside the keep, or does it bunch everyone in the center of the south zone? Does it deploy a Hunter onto the rampart sensibly?
- **Why it matters.** The AI's deployment heuristic was tuned for River Ridge; Stonebridge's keep wants different positional preferences (Hunters on rampart, tanks at gate, Mages behind walls). If the AI plays the map naively, the human-vs-AI experience degrades.
- **Signal for adjustment.** If the AI consistently bunches or fails to use the keep, role-aware deployment scoring (S44 carry — Hunter sharpens the case) becomes a higher-priority feature for a future session.

### Stonebridge — hill heights at the corners (S47 / D9)

- **What to watch.** Corner hills at (0, 0) and (0, 15) at elev 8 — same height as the rampart. Watch whether the NW corner hill becomes an auto-take perch for Blue early-game (a Hunter parks there, dominates the north half) and whether the SW corner does the same for Red. If both, the map becomes two parallel race-to-seize-the-perch lanes rather than the intended "race for the bridge + race for the keep" double-pivot.
- **Why it matters.** Hills were deliberately set at elev 8 (same as rampart) to test whether secondary high-ground positions are needed. If they're too tall, the answer is they crowd out other strategic considerations.
- **Signal for adjustment.** Drop corner hill elevations to 6 (still high but no longer "automatically taken first turn") in a future tuning round if playtest reveals corner-perch dominance.

### Stonebridge — AoE vertical tolerance default 3 (S47 / ADR-0085)

- **What to watch.** The S47 default tolerance bump from 1 → 3 affects 6 magical AoE spells (Earth Quake, Earth Cataclysm, Fire Storm, Maelstrom, Chain Lightning, Tidal Wave). On flat terrain (River Ridge or anywhere away from the rampart), behavior should feel identical. On Stonebridge's keep, AoE on rampart now splashes to ±3 elevation. Watch (a) whether existing River Ridge engagements feel different (regression-feel), (b) whether the rampart-AoE coverage feels right or too generous, (c) any AoE spell that feels wrong with the new default.
- **Why it matters.** The default change touches every default-tolerance AoE in the game. A per-spell override is the lever, but identifying which spells warrant ≠ default needs playtest.
- **Signal for adjustment.** Specific spells reading wrong → author per-spell `verticalTolerance` overrides. Aether Bloom's +1 might compound feel-issues; revisit if multiple players note the wider splash.

### Stonebridge — magic vertical change affecting existing battles (S47 / ADR-0085)

- **What to watch.** Pre-S47 most magic capped at `vertical: 2`; post-S47 it's uniform `vertical: 99`. River Ridge battles will see different magic behavior anywhere there was a cap interaction — most likely spells targeting cliff-top Hunters or Mages on the elev-9 east perch.
- **Why it matters.** A regression in feel where a former "you have to climb to magic them" becomes "magic anyone anywhere" is the intended consequence — but watch for cases where the change makes a previous tactical position pointless.
- **Signal for adjustment.** If a former perch (River Ridge elev-9 cliff) becomes worthless because magic now nullifies the elevation, revisit per-element vertical caps (a future tuning pass declaring `vertical: 5` on selected spells).

### 5v5 battle pacing (S48)

- **What to watch.** S48 unlocked 1–5 unit team sizes; River Ridge and Stonebridge templates now field 5v5 by default. Watch turn count, action density per side per turn, and average battle duration vs. the pre-S48 4v4 baseline. Especially: does the 5th unit per side land in roles that meaningfully extend tactical options, or does it just lengthen the same engagement?
- **Why it matters.** Adding a 5th unit on a map sized for 4v4 (14×14 / 16×16) compresses positioning and may produce bunching at the central engagement zone. The AI deployment heuristic places HP-descending — five units in that order may stack squishies behind a single front line.
- **Signal for adjustment.** Battles consistently lasting 1.5–2× longer with the same decisive moments — consider adjusting per-team default size in scenarios. Map feels cramped — consider larger maps for future content. AI deployment looks awkward — sharpens the role-aware-sort carry case (a recurring item since S43).

### AI deployment with 5 units (S48)

- **What to watch.** Both River Ridge and Stonebridge bumped to 5-slot per-team templates. The AI's HP-descending placement now spreads five units across the deployment zone (River Ridge: 12 tiles per team, Stonebridge: 8). Watch (a) whether Red ends up with sensible front-line / back-line shape, (b) whether the 5th unit lands awkwardly (a Mage in the front-center, a Knight on the flank), (c) whether the rampart sees a Hunter on Stonebridge.
- **Why it matters.** The deployment heuristic was tuned for 4-unit Red teams. 5 units stress its single-axis sort. Role-aware sort (S44 carry) is sharpened further; this may be the playtest evidence to commit to.
- **Signal for adjustment.** AI 5-unit placements consistently look "wrong" (Mage in melee, Knight at far flank) → role-aware deployment is a future-session priority.

### New default-template balance — Gravity Well / High Ground / Mage War (S48)

- **What to watch.** The three new Chris-authored default templates landed this session: Gravity Well (4 units; Knight dual-wield + Burn-pressure Pyromancer), High Ground (5 units; Hunter / Alchemist cross-bow + Aethurge + Geosage dual-secondary + Knight shield), Mage War (5 units; one of every class). Watch matchup parity — does any template consistently dominate the others when played against the stock Red AI template, and how do head-to-head matchups feel?
- **Why it matters.** New content encodes Chris's current best-thinking about team comp. Playtest reveals balance and surfaces which interactions read well vs. don't.
- **Signal for adjustment.** Lopsided matchups (Gravity Well's Knight + The Offering one-shotting every Red Mage every game) → tune the offending interaction, not the team. Specific spells / passives consistently feel skippable in these comps → revisit content individually.

### Command Set tooltip information density (S48)

- **What to watch.** The S48 team-builder ability picker now wraps every Command Set option in a hover tooltip that lists its 5 member abilities with a compact one-liner per ability (MP / Charge / damage formula / AoE / status effects). On Earth Spells / Water Spells / Fire Spells / Lightning Spells, that's 5–6 lines of inline detail. Watch (a) whether the tooltip is enough to decide between secondary command sets, (b) whether the one-liner format is dense-but-scannable or unreadable, (c) whether players want a follow-on "full ability detail" surface on click vs. hover.
- **Why it matters.** Command Set abilities are richer than R/S/M passives (cost, range, accuracy, status effects, AoE shape). A condensed view trades depth for scannability; the right balance is a tooltip-readability question.
- **Signal for adjustment.** Players hover repeatedly trying to extract info that isn't there → enrich the one-liner or add a click-to-expand affordance. Players don't hover the tooltip at all → reduce the surface to titles only.

### Charged Attack power_coefficient bump to 2.0 + 6 MP (S48)

- **What to watch.** Pre-S48 Charged Attack and Power Attack both landed at 1.5× — same damage, different cost vector. S48 lifted Charged Attack to 2.0× / 6 MP so the player pays both the delay and the MP. Watch (a) whether the Hunter's Marksmanship reads as the higher-ceiling First Action option vs. the Knight's Battle Skill, (b) whether 6 MP is gating enough that Hunter's MP-pool design (probably 30–40) feels constrained, (c) whether the 2.0× + bow's height-delta variance starts producing one-shot kills on Mages.
- **Why it matters.** Two abilities trading the same axis (delay vs. MP) collapsed the choice; the new shape makes them genuinely different role picks. If 2.0× is too much, single-shot kills break the engagement tempo.
- **Signal for adjustment.** Hunter consistently one-shots Mages on the first elevation-delta cast → consider 1.75×, or limit the height-delta-variance ceiling. Hunter never uses Charged Attack (MP cost too steep) → lower to 4 MP or 5 MP.

### Landwalker scope shift — Move-only (S48)

- **What to watch.** Earth Resilience's stacking buff now applies +1 Move only (was +1 Move / +1 Jump pre-S48). Watch whether the Geosage's mobility identity feels diminished — the Jump component was a small but real perk in elevated terrain (river-crossing on River Ridge, rampart-stepping on Stonebridge).
- **Why it matters.** The change brings the stacking-mobility reaction family — Landwalker / Updraft / Speed Save — into symmetric one-axis-each shape. If the Jump-on-hit was actually doing important work on the Geosage's identity, removing it may surface as a feel regression.
- **Signal for adjustment.** Geosage players note Landwalker "doesn't do much" on elevated maps → consider adding a paired but cheaper status (Jump-only reaction passive) for the Earth school. Geosage feels fine → the symmetry was the right call.

### Float suppression — content gap watch (S48)

- **What to watch.** Float (terrain-cost leveling on every tile) is suppressed from the picker (`'hidden'`) for S48. No class is currently shipped with Float in `freeAbilities`. Watch whether the missing-from-picker cross-class universal-mobility option is felt — does anyone hit a moment in playtest where "I wish I could just walk over the water tile" without Tidewalker?
- **Why it matters.** Float was a cross-class baseline; pulling it removes a player option even though no team was using it. If the suppression silently degrades any specific playstyle, that's signal a class needs to adopt it.
- **Signal for adjustment.** Repeated playtest comments about water-tile movement friction → restore Float (`availability: 'available'`) or attach to a new class (Hydrologist-adjacent — Tidewalker is the current water-friendly Movement, Float would extend to *every* terrain).

### Bulwark Stance suppression — Knight Movement content gap (S48)

- **What to watch.** Bulwark Stance was removed in S48 Commit 2 (Knight-flavored Movement passive without a class home). Knight's Movement bucket now offers Move +1 / Bravestrider (free) / Field Recovery / Fleet of Foot / Tidewalker / Hotfoot / Quickstep / Bedrock Stride. Watch whether Knight Movement still feels sufficient or whether a deliberate "Knight tank" Movement passive (the role Bulwark Stance was filling) wants to be re-designed.
- **Why it matters.** Knight is the v1 tank archetype; Bulwark Stance's "trade Move for MaxHP / Evade" identity was the only Knight-flavored Movement option. Suppressed; the tank fantasy is now equipment-only (War Plate + Steel Helm + Tintinibar).
- **Signal for adjustment.** Knight players consistently equip the same Movement (Bravestrider + filler) without any of the new options reading as defensive → a future content pass authors a Knight-flavored defensive Movement passive (potentially adopting the suppressed Bulwark Stance with refreshed numbers).
