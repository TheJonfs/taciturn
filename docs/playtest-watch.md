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
