# Playtest Scenarios

Deliberate edge-case test plans for the Phase E close playtest. Each
entry describes a *configuration to construct* and a *behavior to look
for* — the goal is to surface design questions that organic play might
not hit on its own.

## Discipline

- **Sessions can add.** When a content / mechanic surface lands without
  a clear answer to "is this calibrated right?", append a scenario here
  that would surface the answer.
- **Cross off when run.** When a playtest exercises a scenario and
  produces signal — good or bad — strike the entry through with a
  short resolution note (or promote it to an ADR / `playtest-watch.md`
  entry / content rebalance).
- **Each entry uses the same shape:**
  - **Setup** — team composition + relevant equipment + any ability
    loadout overrides; specific enough that two playtests of the same
    scenario produce comparable observations.
  - **Test** — what to do in-battle. Specific moves / engagements /
    targets, not just "play the team."
  - **Signal for adjustment** — what observation would push toward
    changing the underlying content / mechanic. Distinct from
    "play it; see how it feels."

## Relationship to `playtest-watch.md`

`playtest-scenarios.md` is *what to deliberately try*: pre-planned
configurations designed to stress a specific design question.
`playtest-watch.md` is *what to keep eyes on during organic play*:
ongoing observations that surface during normal engagement, not from a
deliberate setup. Scenarios run on demand; watches accumulate
passively.

---

## Damage extremes

### Lightning Mage one-shot threshold

- **Setup.** Player team: Lightning Mage with Magus Crown + Wizard's
  Robe + Capacitor Ring + Staff of Power, Brave 70 / Faith 90.
  Opponent: any Mage in a non-Light-Robe body (target the Fire Mage in
  Wizard's Robe).
- **Test.** First Lightning Strike or Bolt at full charge into the
  exposed Mage.
- **Signal for adjustment.** A clean ≥80% HP chunk reads as decisive;
  a 100% one-shot is a calibration question. If players consistently
  open with this combo and it ends engagements before the opponent
  acts, the Lightning Mage's burst ceiling needs a tap-down.

### Sustained physical pressure (Knight Spiked Mail vs Knight tank)

- **Setup.** Player team: Knight in Spiked Mail + War Axe + Strength-
  free build (Diamond Bracelet for hybrid). Opponent: Knight in War
  Plate + Warrior's Aegis + Tintinibar.
- **Test.** Direct attack trades — both Knights swinging until one
  drops. Note Spiked Mail revenge ticks vs War Plate's elemental
  defenses.
- **Signal for adjustment.** Trades that conclude in <3 turns indicate
  Knight-on-Knight tempo is too high; trades that drag past 8 turns
  indicate Knight burst is too low. Watch whether Spiked Mail revenge
  is decisive or noise relative to incoming damage.

### Bolt Hammer Lightning Strike proc decisiveness

- **Setup.** Player team: any Mage carrying Bolt Hammer (Fire / Earth
  / Water Mage — anyone with a high MA who isn't a Lightning Mage). At
  least one Mage with Tricorn (Brave +10) to push the proc rate.
- **Test.** Use Attack repeatedly into a low-Lightning-resist target.
  Track how often the Lightning Strike rider fires and how much it
  contributes to total damage.
- **Signal for adjustment.** Proc rate <20% of swings reads as
  invisible; proc damage <20% of total weapon contribution reads as
  flavorful but inert. Either suggests the rider's chance / scale
  needs a bump.

---

## Defense extremes

### Max-tank Knight solo into 2 attackers

- **Setup.** Player Knight: Spiked Mail + War Plate + Crusader's Helm
  (yes, max-stacking three Knight-only pieces) + Tintinibar (Regen
  status grant) + Warrior's Aegis. Brave 70 / Faith 90. Opponent:
  Aggro Knight + a high-MA Mage.
- **Test.** Solo the Knight into the front; let both opponents attack
  the Knight for 5+ rounds without retreating. Note time-to-KO
  (or whether the Knight survives a sustained 2v1).
- **Signal for adjustment.** Knight shrugs off >50% of incoming for
  an extended fight ⇒ the defensive ceiling is too high; Spiked Mail
  + War Plate becomes the must-pick. Knight drops in 2 rounds despite
  max gear ⇒ defensive ceiling is too low to matter against Mage burst.

### Light Robe specialist vs all-Fire team

- **Setup.** Player team: 4 Mages, all in Light Robe (Fire / Lightning
  resist +75 each). Opponent: any team that leans Fire (≥2 Fire Mages
  + 1 Lightning Mage). Use the Aggro Knight Squad as the opponent
  template.
- **Test.** Engage the Fire-heavy team head-on; let opposing burst
  spells land on Light-Robe Mages. Compare to the same engagement
  with Sorcerer's Robe instead.
- **Signal for adjustment.** Light Robe wearers shrug Fire/Lightning
  damage so hard that the matchup becomes one-sided ⇒ specialist
  resist values are too high. Light Robe wearers take materially the
  same damage as Sorcerer's Robe wearers ⇒ specialist resist values
  are too low (no payoff for the matchup pick).

### Sorcerer's Robe Auto-Shell vs Mage burst

- **Setup.** Player Mage: Sorcerer's Robe (Auto-Shell statusGrant) on
  any Mage class. Opponent: high-MA Lightning or Fire Mage with
  Magus Crown + Wizard's Robe.
- **Test.** Take a fully-charged burst spell from the opposing Mage.
  Compare HP loss vs the same Mage in a non-Sorcerer's-Robe body.
- **Signal for adjustment.** Auto-Shell turns "this kills you" into
  "this hurts" ⇒ Auto-Shell is the right ballpark. Auto-Shell turns
  it into "this barely registers" ⇒ Auto-Shell is too generous.

---

## Tempo extremes

### All-Speed loadouts (CT race)

- **Setup.** Player team: every unit in Lookout's Hood (Speed +1) +
  Boots of Haste + Lightfoot. Opponent: any non-Speed-stacked team
  (use Defensive Front for the contrast).
- **Test.** Track the first 20 turn-grants; count how many go to
  player units vs opponent units. Note whether the speed advantage
  results in lopsided outcomes or just faster engagements.
- **Signal for adjustment.** Player gets ≥70% of early turns and
  wins decisively before opponent acts ⇒ Speed-stacking is
  dominant. Player gets ≥70% of turns but the engagement still
  feels balanced ⇒ Speed isn't the lever its costs suggest.

### Battle Gear (HP) vs Lookout's Hood (Speed) on the same Mage

- **Setup.** Two identical Fire Mages, one in Battle Gear + Pointy
  Hat, the other in Wizard's Robe + Lookout's Hood. Both with the
  same accessory + secondary loadout.
- **Test.** Run each through the same engagement (vs the same
  opponent template); compare survival turns + damage dealt.
- **Signal for adjustment.** One build dominates the other
  consistently across 5 engagements ⇒ the HP-vs-Speed tradeoff is
  miscalibrated. Both builds win and lose in roughly equal numbers
  ⇒ the tradeoff is real; pick by matchup.

---

## Status chains

### Burn × Purifier readability

- **Setup.** Opponent Lightning Mage carries Purifier (per the
  River Ridge roster). Player Fire Mage applies Burn via Smolder /
  Flametongue rider.
- **Test.** Apply Burn to the Purifier-wearing target; watch the
  action log over 3-4 ticks.
- **Signal for adjustment.** The faster Burn decay reads as
  Purifier paying off ⇒ working as designed. The faster decay reads
  as random / inconsistent ⇒ action log needs an explicit
  "Purifier doubled" attribution.

### Regen vs Burn race (Earth's Blessing on Burned target)

- **Setup.** Player Earth Mage casts Earth's Blessing on a Burned
  ally. Track tick-by-tick HP movement.
- **Test.** Compare Regen tick (heal) vs Burn tick (damage) over
  the duration overlap.
- **Signal for adjustment.** Regen completely neutralizes Burn ⇒
  Regen is too strong (Burn becomes purely psychological pressure).
  Burn out-paces Regen consistently ⇒ Earth's Blessing isn't worth
  the action cost relative to disengaging.

---

## Element specialization vs generalization

### Light vs Sorcerer's Robe pick (known vs blind opponent)

- **Setup.** Player Lightning Mage. **Scenario A:** the player can
  see the opponent's class composition before choosing armor (a
  hypothetical reconnaissance state). **Scenario B:** blind
  loadout (the deployment-phase default — no opponent info before
  commit).
- **Test.** Pick Sorcerer's Robe in scenario A; pick Light Robe in
  scenario A. Pick whichever feels right in scenario B.
- **Signal for adjustment.** In scenario B, players default to
  Sorcerer's Robe ⇒ Light Robe's specialist payoff isn't worth the
  matchup gamble. Light Robe wins the matchup so hard in scenario A
  that it becomes the only correct call ⇒ specialist resists too
  high.

### Wand of Deepwood (water-shift proc) on a fire-heavy opponent

- **Setup.** Player Earth Mage with Wand of Deepwood. Opponent
  team: 2+ Fire Mages.
- **Test.** Use Attack repeatedly against the Fire Mages; note when
  the water apply-shift proc fires and whether re-tagging future
  hits as water (instead of physical) changes the damage profile.
- **Signal for adjustment.** Proc never affects Fire Mage's
  effective HP loss ⇒ the apply-shift mechanic doesn't pay off in
  the matchup it should. Proc reliably doubles the Earth Mage's
  effective DPS into Fire Mages ⇒ working as designed.

---

## Equipment interaction stacking

### Spiked Mail + AOE attacker (Tidal Wave)

- **Setup.** Player Water Mage casts Tidal Wave centered on (or
  hitting) a Spiked Mail Knight on the opponent team.
- **Test.** Fire Tidal Wave; note how the Spiked Mail revenge
  reflects — once for the AOE hit, or per-tile-overlap, or not at
  all.
- **Signal for adjustment.** Reflect fires once per damage instance
  and feels punitive ⇒ working as designed (Tidal Wave caster pays
  a premium for the AOE engagement). Reflect doesn't fire because
  of an interaction quirk ⇒ Spiked Mail's `onFinalDamageReceived`
  trigger needs an audit.

### Crusader's Helm + Earth Spells secondary (Knight Earth's Blessing)

- **Setup.** The Defensive Front Knight: Crusader's Helm (Faith
  +10) + Earth Spells secondary command set. Brave 70 / Faith 80.
- **Test.** Cast Earth's Blessing on a Brave/Faith 70 ally
  repeatedly across 5 attempts. Track Regen application rate (how
  many of the 5 land).
- **Signal for adjustment.** All 5 land ⇒ Crusader's Helm Faith
  bump pays off; Defensive Front archetype is viable. <3 land ⇒
  the Knight casting via Faith is too unreliable; the archetype
  needs the higher-Faith Mage as the Earth's Blessing source
  instead.

### Tricorn Brave bump + reaction firing rate

- **Setup.** Player Mage with Tricorn (Brave +10) and a reaction
  ability (Smolder, Discharge, Earth Resilience). Brave 80 baseline
  → 90 effective.
- **Test.** Take 10 attacks; count reaction firings. Compare to
  the same Mage without Tricorn (Brave 70 effective).
- **Signal for adjustment.** Reaction fires noticeably more often
  with Tricorn ⇒ Brave bump pays off; Tricorn opens reactive
  Mage builds. Firing rate barely changes ⇒ +10 Brave isn't
  enough to clear the threshold; Tricorn becomes a niche pick.

---

## AI behavior under extreme builds

### AI focus targeting (Crusader's Helm Knight + glass-cannon Mage mixed front)

- **Setup.** Player team: Defensive Front (Knight tank in front,
  glass-cannon Lightning Mage behind). Opponent: any AI team.
- **Test.** Watch AI target selection for the first 3 turns. Does
  it correctly identify the glass cannon as the high-priority
  target, or does it pile on the visible-front Knight?
- **Signal for adjustment.** AI wastes attacks on the Knight while
  the Lightning Mage farms uninterrupted ⇒ AI threat-assessment
  needs an audit (likely a known carry — see `playtest-watch.md`).
  AI correctly bypasses the Knight to engage the Mage ⇒ working as
  designed.

### AI reflect awareness (Spiked Mail deterrent)

- **Setup.** Player Aggro Knight Squad. Opponent: AI team with
  physical attackers. Note AI behavior toward the Spiked Mail
  Knight.
- **Test.** Track whether the AI deprioritizes the Spiked Mail
  Knight as a target relative to non-reflecting players.
- **Signal for adjustment.** AI ignores the reflect and trades
  attacks anyway ⇒ AI threat model lacks reflect awareness; the
  Spiked Mail wearer feels rewarded by enemy mistakes, not by
  enemy adaptation. (Likely a Phase F AI improvement; flag here
  rather than acting on it now.)
