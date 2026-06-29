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

### S71 — Math Skill status application bases (25/25/40 after the Faith sweep)

- **What to watch.** S71 (#15, ADR-0119 update) made the three Math Skill status
  applications Faith-independent (MA-only factor) and retuned their base chances
  to roughly preserve the prior effective rates: **Precision Fire → Burn 50→25**,
  **Sculpted Enhancement → PA/MA Up 50→25**, **Engineered Defenses 40 (was 80)**.
  At the Calculator's base MA 9 these land ~45% / ~45% / ~72% per matching target;
  they rise with MA (Conductor, Cornered Focus, level) since the MA factor (≥1.8)
  now does all the scaling.
- **Why it matters.** The bases were originally tuned *with* the Faith multiplier
  (×0.49 at default Faith) holding them down. The retune is a best-effort match to
  the old feel, not a playtested value — and because the MA factor only amplifies
  (never gates below 1.0), a high-MA Calculator pushes all three toward 100%.
- **What signal would indicate adjustment.** Burn-spread / party-buff coverage
  feels *too reliable* on a buffed-MA Calculator (statuses effectively always land)
  → lower the bases further, or reconsider whether MA should scale status chance at
  all (the Option C "flat base" path). Coverage feels *too thin* at base MA → raise
  the bases back toward the old effective numbers. Dials: the `baseChance` on
  `precision-fire.ts` / `sculpted-enhancement.ts` / `engineered-defenses.ts`.

- ~~**Action-log redesign visual (S63, `b3bd121`).** Whether the redesigned
  action log reads correctly in real battles.~~ **Resolved (Thief session,
  Chris):** confirmed reading correctly in-battle. Closed; dropped from the
  handoff carry-list.

### S70 — Mountain Pass ambush: does the victim AI play the terrain?

The brief's free intelligence probe (ADR-0118; observation, not acceptance).

- **What to watch.** On Mountain Pass with the *ambusher* (the SE-heights split
  zone) AI-controlled and the *victim* (NW valley) also AI, or victim AI vs human
  ambusher: does the victim AI advance straight up the pass into the SE crossfire,
  or does it use the central spine / valley cover and refuse the bad ground?
- **Why it matters.** The in-battle AI has no predictive positional threat-model
  (the large deferred AI gap) — it doesn't reason about avoiding enemy reach or
  walking into a kill-zone. The ambush map is the cleanest natural test of how
  badly that absence reads.
- **What signal would indicate adjustment.** If the victim reliably marches into
  the crossfire and gets folded, that's concrete motivation (and a test bed) for
  the predictive threat-model beat. If it incidentally plays fine (terrain costs
  steer it well enough), the threat-model stays low-priority.

### S70 — split-zone AI deployment coherence

- **What to watch.** When the ambusher is AI, does the 3-SW-massif / 2-NE-edge
  split *read* as a coherent ambush (tank fronting the dominant wing, casters
  perched), or does the round-robin distribution put units in odd spots?
- **Why it matters.** The split-zone heuristic fills wings sensibly by
  construction (unit-tested) but has had no in-battle feel pass.
- **What signal would indicate adjustment.** If the AI's wing composition looks
  obviously wrong (e.g. the lone melee stranded on the weak NE flank, casters
  exposed at the front), revisit the distribution order.

### S68 equipment — feel-pass tunables

Four new pieces shipped at settled numbers; two carry a latent tuning the brief
flagged for the feel pass.

- **Gauntlet of Might — PA +3.**
  - **What to watch.** +3 PA is potent across every PA-scaled effect (basic
    attacks, the Thief's PA-gated charm / Steal MP contest, status PA_factor).
    Does it read as too dominant on a single unit despite the one-per-team gate?
  - **Why it matters.** Shipped at +3 per the brief; +2 is the flagged fallback.
  - **Signal for adjustment.** If a Gauntlet build warps deployment around the
    one wearer, drop to +2.

- **Vicious Dagger — crit stacking.**
  - **What to watch.** Base 5 + Vicious 25 (+ Arcane Lens 10 + a Crit Modifier)
    can push a dedicated build past ~40% crit; at ×1.5 that's ~+20% average
    damage. Does the crit archetype feel strong-but-fair, or swingy?
  - **Why it matters.** The dagger *seeds* the crit archetype; further support
    pieces are a future pass. It's strong but bounded by design.
  - **Signal for adjustment.** If crit-stacking reads as oppressive, the future
    crit pieces should be tuned down (or the dagger's +25 trimmed) rather than
    expanding the archetype.

### S68 Vantage — X = 2 magnitude (ADR-0115)

Shipped at +2 elevation as the deliberately-spicy first cut.

- **What to watch.** A Vantage bow on level ground already reads as +2 downhill
  → always-on ~+40% on the Longbow's height-variance (linear curve), before any
  real terrain. Plus +5% accuracy more often, +1 reach-from-height at level, and
  shoot-over-cover. Does the bow Hunter (with the S68 PA7/Spd10 buffs) over-
  perform on damage-over-time vs the Knight/Assassin trade study?
- **Why it matters.** One constant (`VANTAGE_ELEVATION_BONUS`) controls all of
  it; +1 halves the always-on damage floor (~+20%).
- **Signal for adjustment.** If the Hunter's tempo-normalized output overtakes
  its intended middle-ground slot, drop to +1. Also watch the cross-class
  caster splash (Aethurge / any straight-line mage taking Vantage for shoot-
  over-cover) — intended vs Barriers, but flag if it trivializes cover broadly.
- **S68 update — bow buff shipped (Longbow WP 9/acc 40, Riptide WP 7/acc 40).**
  The DoT re-analysis confirmed X=2 wasn't overpowering (the bow Hunter was the
  lowest-output build); the fix was buffing the bows, not nerfing Vantage. By
  design now: a **flat-ground** Hunter stays well below the front line, but a
  **perched** Hunter (earned high ground + Vantage) *out-damages the Knight*.
  **Watch:** confirm this perched-vs-flat split reads as an *earned* payoff for
  taking the high ground, not as oppressive — on elevation-rich maps especially.

### Thief — Steal Heart / charm feel (ADR-0111)

The charm capstone shipped (control-only scope). Unit-tested; the *feel* and the
scope quirks need human engagements.

- **Control-only scope quirk.**
  - **What to watch.** A charmed enemy keeps its team, so its former allies'
    AI won't proactively attack it, and it's only useful to you offensively
    (via friendly fire — you direct it to hit its own side). Does the puppet
    feel impactful, or toothless because it's "protected" by its old team and
    can't be leveraged defensively?
  - **Why it matters.** v1 is deliberately control-only (ADR-0111); the full
    friend/foe flip (puppet hostile to its old team for AI/targeting) was the
    bigger, deferred option.
  - **Signal for adjustment.** If the charm reads as underwhelming, promote to
    the full friend/foe flip.

- **Land-rate & setup loop.**
  - **What to watch.** Base 10% contest (~31% naked, ~48% equipped, ~58% after
    an Undermine), capped 95, at 24 MP. Does the set-up-or-don't-bother loop
    feel rewarding, or just unreliable/expensive given the MP bank tension?
  - **Signal for adjustment.** If it never lands meaningfully, lift the base or
    the α/β tuning (concept-notes); if it lands too freely with setup, the cap
    is the backstop.

- **Charm fragility (break-on-damage).**
  - **What to watch.** 50% break on any *attack* damage — but NOT on DoT ticks
    (Poison/Burn bypass the pipeline), so the charm is a touch less fragile
    than the concept's "any damage." Does the puppet last long enough to matter
    before a stray AoE / friendly-fire hit snaps it?
  - **Signal for adjustment.** If it breaks too readily, restrict the trigger
    to original-team damage or drop below 50%; if it never breaks, fold DoT in.

### Thief — chunk 1 kit feel (ADR-0110)

The Thief (12th class) shipped its three Thief Arts actives and three RSM. All
unit-tested; the *feel* needs human engagements (the harness can't drive
PixiJS). The AI under-plays the kit (content-ahead-of-AI) — these are
human-driver observations, not AI ones.

- **Momentum tempo (the named risk).**
  - **What to watch.** Momentum refunds +10 CT after every non-magical action,
    the basic Attack included — and it fires far more often than the Flow State
    it's modeled on (which only refunds magical casts). Does a Thief spamming
    Attack / Steal MP pull ahead of the turn queue oppressively?
  - **Why it matters.** The basic-Attack refund is the deliberate bit (banking
    turns stay productive); 10 is the spec's "match Flow State" start, but the
    higher fire rate could compound tempo.
  - **Signal for adjustment.** Thief noticeably out-acting the field on tempo
    alone → drop the refund (8 / 6) or exclude the basic Attack.

- **Steal MP as a mage-counter.**
  - **What to watch.** PA×3 drain is up to ~30 MP at max PA — roughly half a
    48-MP mage on one hit, a lockout on two. Does a built Thief feel like a
    fair disruptor or a hard mage-counter that erases caster turns?
  - **Why it matters.** The drain scales on the Thief's everything-stat; the
    refuel (50% of removed) funds the rest of the kit.
  - **Signal for adjustment.** Casters reliably neutralized by a single Thief →
    drop the coefficient to PA×2 (the concept-notes' release valve).

- **Steal Buffs action-log attribution.**
  - **What to watch.** On a successful steal, the stolen buffs are recorded as
    applications in the action's per-target result. Does the log read clearly
    that the buffs left the *target* and landed on the *Thief*, or does it look
    like the Thief buffed the enemy?
  - **Why it matters.** Chunk-1 logging is summary-level (ADR-0110); the
    strip-from-target half isn't itemized.
  - **Signal for adjustment.** If the log misreads, itemize the strip (a
    dedicated "stole Haste from X" line) — folds into the action-log work.

- **Slip Free feel.**
  - **What to watch.** A high-Brave Thief shrugs a tick off most incoming
    timed debuffs and negates 1-tick ones. Does control-resistance feel
    appropriately slippery, or does it trivialize others' disable kits against
    the Thief?
  - **Why it matters.** It's the skirmisher's defining defensive trait, gated
    on the same Brave that fuels its steals.
  - **Signal for adjustment.** If disables feel pointless vs the Thief, gate
    Slip Free to a subset of debuffs or lower its effective rate.

### S65 — control sub-game, MP economy, Bull Rush (ADR-0108)

The Knight gained Bull Rush (weapon attack + Brave×PA knockback), the Assassin
darts now require LoS, three equipment pieces shipped, and the caster MP bases
dropped. All unit-tested; the *feel* needs human engagements.

- **MP rebaseline × Circlet sustain (test together).**
  - **What to watch.** The four elemental mages now field 48 MP (was 60),
    Calculator 37 (was 47). Does a mage run dry mid-fight at a sensible
    cadence, and does the Circlet's MA/2-per-turn regen (≈+6 for a 12-MA mage)
    earn its head slot against Pointy Hat / Magus Crown / Golden Hairpin?
  - **Why it matters.** The regen only justifies its slot *because* MP is now
    scarce; the two were tuned as a pair. Too-tight MP makes casters feel
    starved; too-loose makes the Circlet inert.
  - **Signal for adjustment.** Mages reliably out of MP by mid-fight with no
    sustain → loosen the rebaseline or raise the regen; mages never constrained
    even at 48 → the cut was too shallow.

- **AI MP economy (headline risk).**
  - **What to watch.** The scorer doesn't pace MP or value sustain. With MP now
    scarce, AI mages may run dry and stall (idle/auto-pass) harder than human
    players, widening the gap.
  - **Why it matters.** Not built this session; the rebaseline could expose it.
  - **Signal for adjustment.** AI mages repeatedly stranded with no MP and no
    plan → an AI MP-pacing / sustain-valuation pass (future).

- **Calculator net power (the "slightly strong" flag).**
  - **What to watch.** −10 MP composes with the recent faith buff (harder per
    cast, fewer casts). Watch whether this quietly resolves the flag rather than
    needing a separate nerf.
  - **Signal for adjustment.** Calculator still over-performs → a targeted nerf;
    now under-performs → the −10 was too much, partially restore.

- **The control sub-game (Bull Rush / Shadow Stitch / Barbut).**
  - **What to watch.** Disables only matter if they bite: does the Barbut
    (Stop / Don't Move / Don't Act × 0.5) earn its slot in practice, and does
    Bull Rush's shove (off ledges, into Pit/Valley) read as a real tactic? Does
    the AI value the knockback (it rides the existing Worldcraft fall scoring)?
  - **Why it matters.** The whole sub-game (offense = darts + Bull Rush;
    defense = Barbut) is only interesting if the statuses/displacement land
    meaningfully and the AI engages with them.
  - **Signal for adjustment.** Barbut never picked / disables shrugged off →
    raise disable rates or the resist value; Bull Rush never used for position
    → tune chance/distance or AI knockback valuation.

- **Dart LoS feel.**
  - **What to watch.** Blowdart / Shadow Stitch / Undermine / Sow Doubt now
    blocked by cover (terrain, units, Barrier). Does the new positional
    constraint read as fair counterplay or as the Assassin feeling neutered?
  - **Signal for adjustment.** Assassin ranged pressure feels dead behind any
    cover → reconsider (revert a subset, or shorten the change to Blow Dart
    only); cover-dodging never comes up → the change is invisible (fine).

- **Battlemage's Chain on the tanky-self-sustainer Templar.**
  - **What to watch.** +80 HP / +10 MP / +1 MA Heavy body (Knight/Templar)
    stacked on the Templar (still on the S62 balance watch). Does it tip the
    Templar into an un-killable sustainer?
  - **Signal for adjustment.** Templar + Chain dominating attrition → revisit
    Templar sustain or the Chain's HP.

- **Barbut / Focus Band are both head slot — they don't co-stack.** The engine
  composes the resists multiplicatively (×0.5 × ×0.75) but a unit has one head
  slot, so the two never co-occur. They're alternatives (Barbut for the
  disable-heavy matchup, Focus Band for broad negative-status resistance). Noted
  so a future "stacking feels off" report isn't chased — it can't happen here.

### S59 — Tier C revert-traps (ADR-0096)

The AI now springs Worldcraft revert-traps: at cap, it casts a harmless raise
to evict an older Pillar/Hill that an enemy is riding, dropping it. Never
drops an ally (hard veto). Unit-tested; needs a human Terraformer playthrough.

- **Revert-trap opportunism / frequency.**
  - **What to watch.** Does the AI spring traps at sensible moments — an enemy
    has wandered onto a raised tile the Terraformer built earlier, and it's at
    cap? Or does it rarely trigger (the precondition — at cap + enemy on an old
    raise *now* — is narrow), or trigger awkwardly (casting a stray raise just
    to evict)?
  - **Why it matters.** v1 is opportunistic-only (no speculative laying, no
    prediction); the precondition may make it a rare flourish rather than a
    real tactic.
  - **Signal for adjustment.** If revert-traps essentially never fire in real
    play, the lever is speculative laying / movement prediction (deferred
    Layer 2) — a deliberate scope expansion, not a tuning tweak.

- **Never-drop-ally veto holds.**
  - **What to watch.** The hard veto must never let the AI drop its own unit —
    including a Hill 3×3 footprint catching a mixed friend/enemy cluster.
  - **Why it matters.** A revert that drops an ally is a serious own-goal; the
    veto is a hard gate, but real boards are messier than tests.
  - **Signal for adjustment.** Any observed self-drop → bug, not tuning.

### S59 — defensive above-melee-reach term (ADR-0095)

The AI now reads a per-turn threat coverage map (ADR-0094) and prefers safe
attacking tiles. Unit-tested + integration-clean, but the *feel* needs a
human Terraformer/mixed-roster playthrough.

- **Safety as a tie-break vs. tempo.**
  - **What to watch.** The defensive term is a **tie-break** (offence decides
    whether/what to attack; residual danger only chooses between equal-offence
    tiles). Does the AI take safe high ground / kite out of melee to cast at
    sensible moments — or does it look like it's ignoring obvious danger
    because the tie-break is too weak to bite?
  - **Why it matters.** A score-reducing form caused the AI to stop engaging
    (symmetric stalemates), so v1 deliberately ships the conservative
    tie-break. The risk now is the opposite — safety being effectively
    invisible because exact-offence ties are rare.
  - **Signal for adjustment.** AI mages repeatedly eating avoidable melee when
    an equally-good safe cast tile existed → promote the term from a tie-break
    to a weighted score reduction (the deferred dial in ADR-0095). Conversely,
    any sign of dithering/kiting-without-progress → keep it a tie-break / add
    inertia.

- **Neutralised-threat discount scope.**
  - **What to watch.** A plan's danger excludes only a *single unit-targeted*
    enemy it would KO. An AoE that wipes a cluster, or a hard-disable (Stop)
    that neutralises a threat, still counts that threat's danger — so the AI
    might over-avoid a tile that an AoE would actually make safe.
  - **Why it matters.** v1 scoped the discount narrowly; AoE/disable
    neutralisation is deferred.
  - **Signal for adjustment.** AI declining a good AoE position for "safety"
    from enemies the AoE would kill → extend the discount to AoE footprints /
    disables.

- **Coverage-map turn latency (perf — headline risk).**
  - **What to watch.** The map is built per AI decision (bounded to reachable
    tiles; each enemy attack projected once). Watch AI think-time on a full
    6-unit battle, especially stacked with Worldcraft enumeration.
  - **Why it matters.** Projection is the costly stage; the integration test
    already brushed vitest's 5 s timeout before the once-per-attack precompute.
  - **Signal for adjustment.** Noticeable AI think-time. Levers: memoise the
    map across the Move→Act re-call (WeakMap by state), or prune enemies/tiles
    further before projecting.

### S57 — unified AI scoring currency (ADR-0092)

The AI's pre-empt cascade (Alchemist / Math / heal phases firing before the
offensive scorer) was replaced by one commensurable candidate pool. The
fix is unit-tested, but the *value-mapping dials* and the *frequency* of
each action class in real play need human signal.

- **Heal / revive / cleanse / item value dials.**
  - **What to watch.** `HEAL_WEIGHT = 0.7`, `REVIVE_WEIGHT = 1.5` (revive ≈
    ally maxHpBase × 1.5), `CLEANSE_VALUE_PER_DEBUFF = 15`,
    `ETHER_VALUE_FACTOR = 0.1` (`src/ai/basic.ts`). Whether the AI heals a
    wounded ally, revives a KO'd one, Remedies a debuff, or attacks at
    sensible moments — or over-/under-values any of these vs a kill.
  - **Why it matters.** First time these compete on one scale; the constants
    are first-pass. Revive in particular is tuned to "strong attack tier"
    (beats routine attacks, loses to a clean finish) — that balance is a
    judgment call.
  - **Signal for adjustment.** AI ignoring a dying ally to chip a healthy
    enemy (raise HEAL_WEIGHT); reviving when it should finish a kill (lower
    REVIVE_WEIGHT), or vice-versa; never throwing Remedy/Ether (raise their
    factors).

- **Compound under-crafting (Compound demoted to last resort).**
  - **What to watch.** Compound now fires only when no scored action is
    positive *and* the actor can't advance. A support Alchemist may bank
    fewer Potions/Phoenix Downs than before.
  - **Why it matters.** The fix deliberately killed over-eager banking (the
    Knight-finishes-without-attacking bug); the opposite failure — a healer
    that never stocks up — is the risk to watch.
  - **Signal for adjustment.** Alchemists arriving at fights with empty
    stockpiles, or never crafting across a whole battle. Lever: a "craft
    when idle and safe" heuristic, or a small positive Compound score when
    the actor is out of combat range.

- **Math Skill raw (un-killValue-weighted) scoring.**
  - **What to watch.** Math options inject raw net-team-value into the pool
    (no killValue weighting yet; `MATH_SCORE_SCALE = 1.0`). A Calculator
    should still cast Math when it's the best play, but lose to a lethal
    attack.
  - **Why it matters.** "Normalize & compete" was the chosen scope; the full
    killValue-weighted re-base is deferred. Math may slightly under-compete
    vs attacks on wounded clusters.
  - **Signal for adjustment.** Calculator casting Math when a clearly better
    attack exists, or never casting Math because it always loses. Lever: the
    deferred killValue-weighted Math re-base, or tune `MATH_SCORE_SCALE`.

### S57 — Worldcraft AI scoring, Tier A + B perch (ADR-0093)

The AI now casts Pit/Valley (fall damage) and Pillar/Hill (lift-in-place
perch). Unit-tested, but **browser verification is human-only** (the harness
can't drive AI battles) — these need a real Terraformer playthrough.

- **Pit/Valley target selection feel.**
  - **What to watch.** Does the AI drop genuinely worthwhile clusters /
    high-ground enemies and decline pointless flat-ground casts? Does it
    avoid Valleys that catch its own line (friendly-fire penalty)?
  - **Why it matters.** First time the AI uses the destructive works; the
    scoring mirrors the engine's fall rule exactly, but *target choice* in
    real fights is the open question.
  - **Signal for adjustment.** AI casting Pit/Valley for trivial damage when
    an attack was better (it should lose in the unified pool — flag as a
    commensurability issue, not Worldcraft-specific), or dropping its own
    units. Lever: `FRIENDLY_FIRE_PENALTY_FACTOR`, or the fall scorer.

- **Perch (PERCH_DAMP) tempo.**
  - **What to watch.** `PERCH_DAMP = 0.5` (`src/ai/basic.ts`). Does the AI
    raise an archer's tile at sensible moments, or over-build perches
    (passivity / tempo bleed) — or never build them?
  - **Why it matters.** A perch is a spent Terraformer turn for a future ally
    shot; the dial guards over-eagerness, same failure mode as over-climbing.
  - **Signal for adjustment.** Terraformer perching when attacking/Pitting was
    better (raise PERCH_DAMP), or never perching for a well-placed archer
    (lower it).
  - **v1 scope note:** perch is **lift-in-place only** (raise the tile the
    archer already stands on). "Archer moves onto a created perch" is deferred
    to S59 — watch whether the lift-in-place case alone reads as too narrow.

- **Worldcraft enumeration cost.**
  - **What to watch.** Tile-targeted enumeration (every in-range tile × works
    × footprint occupancy) on top of the existing per-destination projection.
    Cast from current position only (no move-then-cast) to bound it.
  - **Why it matters.** The brief flagged evaluation time as the headline
    risk. Watch AI turn latency on a Terraformer in a full battle.
  - **Signal for adjustment.** Noticeable AI think-time. Lever: prune
    low-elevation tiles / tiles with no nearby units before scoring.

- **Barrier denial — DEFERRED to S59.** Barrier scoring needs the threat
  model (which enemies can reach/hit a tile); folded into S59 rather than
  shipping a throwaway heuristic. No Barrier behavior to watch yet.

### S53 — Terraformer substrate (no direct signal yet; watch-fors for S54+)

The substrate ships no player-facing content (no ability creates terrain or
barriers yet), so it produces no playtest signal this session. These are
seeded for when the Worldcraft abilities land (S54).

- **Worldcraft corner-tile fall damage feels like nothing.**
  - **What to watch.** Hill/Valley corner tiles move by ±1, and Worldcraft
    reuses the natural fall gate (`dropDistance > 1`), so a unit on a Valley
    corner — or a reverted Hill corner — takes **zero** fall damage (edges
    20, center 30). Watch whether "the corner did nothing" reads as intended
    falloff or as a bug/dead zone once players cast these.
  - **Why it matters.** Settled at S53 start (reuse the natural gate). If
    corners feeling inert hurts the ability's read, the lever is a Worldcraft-
    specific gate (10/level from delta ≥ 1).
  - **Signal for adjustment.** Players consistently surprised that corner
    occupants take no damage, or corner placement never mattering.

- **Effect-queue eviction surprise (the LIFO revert tax).**
  - **What to watch.** A Terraformer at cap (2, or 4 with Expert Former) who
    casts again silently reverts its oldest effect — which can *drop* an ally
    off a Pillar/Hill (fall damage) or collapse a wall. Watch whether the
    revert-on-overflow is legible to the player or feels like a random
    self-inflicted hit.
  - **Why it matters.** The cap+revert is the class's structural backbone;
    if the consequence is invisible until it hurts, it reads as a bug. UI
    surfacing of the queue (S55) is the intended mitigation.
  - **Signal for adjustment.** Players repeatedly evicting effects they
    didn't mean to. Levers: clearer queue UI, a cast-time warning, or a
    confirm prompt when a cast would evict.

- ~~**Barrier-TTL-under-KO cadence (deferred decision, ADR-0088).**~~
  **RESOLVED (S54, ADR-0089):** the TTL now ticks **globally on every
  `turn_start`**, independent of owner state — a KO'd / Stopped / removed
  owner's barriers count down normally. The open *rate* question moves to the
  S54 entry below.

- **Damage Split reflect economy.**
  - **What to watch.** Once equipped (S54), Damage Split reflects the full
    hit back (pipeline-bypassing — ignores the attacker's defenses) and heals
    the Terraformer half. Watch whether a Brave-high Terraformer becomes a
    punishing tank that melee simply can't profitably hit.
  - **Why it matters.** Full-damage bypass reflect + half self-heal is a
    strong defensive package; the blueprint priced it at 2 SP.
  - **Signal for adjustment.** Melee refusing to engage the Terraformer, or
    reflect swinging fights on its own. Levers: reflect a fraction rather
    than full, drop the self-heal, or raise the SP cost.

### S54 — Terraformer class + Worldcraft (first real play signal)

The class ships; these need real engagements to settle.

- **Worldcraft MP economy / cast frequency.**
  - **What to watch.** Pillar/Pit 8 MP, Hill/Valley 16 MP, Barrier 12 MP, off
    MP 35. Whether a Terraformer can shape the field 3-4 times a battle as
    intended, or runs dry too fast (or never, trivializing positioning).
  - **Why it matters.** First terrain-mutation class in real play; the costs
    are first-pass.
  - **Signal for adjustment.** Terraformer either out of MP by mid-fight or
    never constrained. Levers: per-ability MP, off MP 35.

- **Barrier HP scaling (PA × MA = 48 at baseline).**
  - **What to watch.** First class to use PA productively. Whether 48 HP feels
    right per barrier tile — too durable (battles stall around walls) or too
    fragile (one hit breaks the denial).
  - **Why it matters.** The hybrid PA/MA identity and Battle Dictionary's +1 PA
    both hinge on this formula feeling meaningful.
  - **Signal for adjustment.** Barriers ignored (too weak) or oppressive (too
    strong). Levers: the PA × MA formula, or a flat add.

- **Effect-cap restrictiveness (2 naked / 4 with Expert Former).**
  - **What to watch.** Whether cap 2 makes a Support-less Terraformer feel
    starved, or cap 4 (Expert Former) enables oppressive battlefield lockdown.
  - **Signal for adjustment.** Expert Former feeling mandatory, or cap-4 builds
    dominating. Lever: the base cap or Expert Former's +2.

- **Barrier TTL *rate* (global per-turn-start tick — ADR-0089).**
  - **What to watch.** TTL decrements on *every* `turn_start`. Barrier ships at
    `ttl: 50` ≈ 5 full rounds in a 5v5 (~10 turn-starts/round) — the blueprint's
    intended lifetime (Chris's call S54). Watch whether 5-ish rounds feels right
    for chokepoint denial / time-buying.
  - **Why it matters.** The owner-independence is correct (ADR-0089); the
    *number* (50) is the untested knob, and the per-turn cadence makes lifetime
    scale **inversely with party size** (~5 rounds in a 5v5, ~6 in a 4v4, ~4 in
    a 6v6).
  - **Signal for adjustment.** Barriers feeling too durable or too brief — tune
    `ttl`. If the party-size spread itself proves problematic, the lever is a
    per-round cadence (needs a round-boundary event the engine lacks today).

- **Worldcraft as a cross-class secondary command set.**
  - **What to watch.** Other classes equipping Worldcraft (+ optionally Expert
    Former for the full cap). Knight self-Pillar perching, Calculator + terrain-
    aware Math Skill, etc. Whether this opens a problematic build.
  - **Signal for adjustment.** A cross-class Worldcraft build dominating. Lever:
    secondary-command-set cost or Expert Former cross-class cost.

- **Move-2 roster rebaseline question (carried from S54 audit).**
  - **What to watch.** The "Move 2 for most classes" rebaseline Chris recalled
    never landed: only Calculator / Geosage / Pyromancer / (now) Terraformer
    are Move 2; Knight, both other mages, Alchemist, Assassin, Hunter are
    Move 3. Terraformer was placed at Move 2 to match its slow-caster tier, not
    to pre-empt a roster pass. Decide whether a deliberate roster-wide Move
    rebaseline is wanted, or the current two-tier split (slow casters 2,
    everyone else 3) is the intended shape.
  - **Why it matters.** Avoids piecemeal Move drift; the brief flagged it for a
    dedicated decision.
  - **Signal for adjustment.** Chris's call on whether the split is intentional.

### S52 — Marshmoor + bow range-from-height

- **Marshmoor setup-phase length feel.**
  - **What to watch.** Marshmoor's two deployment corners are 26 Manhattan
    tiles apart — the longest pre-engagement window of any v1 map. Watch
    the first 4-6 turns: does the maneuvering window feel like meaningful
    setup time (buffing, positioning, peak-racing) or like a drag before
    anything happens?
  - **Why it matters.** The long gap is intentional (room for setup and the
    eventual Terraformer's terrain shaping), but a battlefield that's "boring
    for six turns" is a pacing failure.
  - **Signal for adjustment.** Players skipping/auto-passing the opening
    turns, or engagements that never actually reach the central flats. Lever:
    tighten zone spacing or add mid-field incentives in a future map rev.

- **Marshmoor water-mobility burden on melee.**
  - **What to watch.** A Knight (Move 3, Jump 2) crossing the marsh without
    Tidewalker spends much of its move budget wading (water_deep 3 MP,
    water_shallow 2 MP). Watch whether Marshmoor genuinely shifts class
    viability — Tidewalker/Hydrologist demand spiking, heavy melee feeling
    stuck.
  - **Why it matters.** Intended texture (terrain-as-obstacle), but if melee
    is simply non-functional here the map is a mage-only stage, not a
    tactical choice.
  - **Signal for adjustment.** Melee units consistently arriving 2+ turns
    after the mages and contributing nothing. Lever: add more land bridges,
    or accept Marshmoor as a deliberately mage/mobility-favoring map.

- **Bow range-from-height tactical shift.**
  - **What to watch.** A Hunter on Marshmoor's SE peak (elev 6) shooting an
    elev-0/1 target gains +3 horizontal range (base 5 → 8) *and* ~×2 downhill
    damage (the stacked height-delta variance). Watch how much this empowers
    archer-led comps — does claiming a peak win the game outright?
  - **Why it matters.** "Bow to the high ground is a real menace" is the
    explicit design intent, but two stacked height rewards on the same shot
    could be oppressive on elevation-rich maps.
  - **Signal for adjustment.** Archer-on-peak comps winning ≥ ~70% on
    Marshmoor / Stonebridge, or peaks being the only thing that matters.
    Levers: cap the range bonus (`deltaHorizontal` ceiling), lower the SE
    peak from 6, or decouple the range and damage rewards.

- **Corner-peak claim races.**
  - **What to watch.** Each deployment corner has a "home" peak up its own
    edge spine (SW→NW elev 5; NE→SE elev 6), but the peaks sit *opposite* the
    central flats. Watch whether opening play races for peaks or contests the
    center — and whether the off-axis placement actually costs enough tempo to
    balance the bow power above.
  - **Why it matters.** The off-axis peak design is the counterweight to the
    stacked bow reward; if peaks are both dominant *and* cheap to reach, the
    counterweight failed.
  - **Signal for adjustment.** Both teams beelining the same peak every game.
    Lever: lengthen the spines (more water between zone and peak).

- **Tidewalker valuation in AI deployment.**
  - **What to watch.** AI role-aware deployment sorting is a standing carry;
    Marshmoor makes it sharper because Tidewalker is materially more valuable
    here. Watch whether AI teams under-value water mobility on this map.
  - **Why it matters.** A symptom of the broader deployment-sort carry, but
    Marshmoor surfaces it acutely.
  - **Signal for adjustment.** AI Hydrologists/Tidewalker-equipped units
    deploying as if water cost didn't exist. (Tracked carry; not fixed S52.)

- **Bow genericization gaps for future ranged weapons.**
  - **What to watch.** `rangeFromHeightBonus` is designed for genericity
    (`perDeltaVertical` / `deltaHorizontal`). Watch whether any future ranged
    weapon's needs reveal a field-design gap.
  - **Why it matters.** Cheap to extend now, costly after more weapons depend
    on the shape.
  - **Signal for adjustment.** A new ranged weapon wanting a max-bonus cap, an
    elevation-direction toggle, or distance-falloff the current two-field shape
    can't express.

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

---

## Session 50 — Calculator playtest fixes + universal equipment + Knight Sword class + tuning retunes

### Skullclamp HP/MP tax balance (S50)

- **What to watch.** Skullclamp is the first equipment to ship negative `statMods` on HP/MP: −20 HP / −10 MP in exchange for +1 PA / +1 MA. Universal head, no class restrictions. Watch (a) whether the tax feels punishing or fair on fragile classes (Calculator HP 101 → 81 base; Aethurge MP 24 → 14 base before equipment additions), (b) whether the +1 PA / +1 MA dual-axis bump justifies the cost for hybrid attackers (Knight + magic secondary, Alchemist with magic-tagged consumables), (c) whether the team-builder stat preview displays the negative numbers cleanly.
- **Why it matters.** First negative-HP equipment is a new texture in the universal pool. If the tax reads as a strict downside (no class wants to lose HP / MP for a small stat bump), Skullclamp will sit unequipped; if too cheap, it becomes a default hybrid head over Pointy Hat (Mage-only) / Tactical Mask (Knight-only).
- **Signal for adjustment.** Skullclamp never picked → tax too steep; lower to −10 HP / −5 MP. Skullclamp always picked by hybrid builds → tax too cheap; raise the HP cost (−30) or drop one of the +1 stats. Display bug → fix in team-builder stat panel.

### Parrying Sword + Shimmer Cloak evasion stack (S50)

- **What to watch.** Parrying Sword adds +10 Front / +5 Side evade; Shimmer Cloak adds +10 to all three facings. Combined: a wearer carries **+20 Front / +15 Side / +10 Back** above their class baseline before considering any other evasion source (Mantle of Protection accessory adds another +25 to all facings). Watch whether the build feels "uncatchable" against physical attackers, or whether Magebane / bow-class accuracy floors (33 base) tame it.
- **Why it matters.** First defensive sword (Parrying Sword) and first universal evasion-bias body (Shimmer Cloak) both landed in S50 — neither alone is dominant, but the additive stack across two slots is the new design space. The [0.05, 1.0] hit-chance clamp floors out the worst case (95% miss with maximum evade), so the question is whether the player-set ceiling pushes consistently into uncomfortable territory.
- **Signal for adjustment.** Players actively avoid Parrying-Sword + Shimmer-Cloak wearers in melee, or accept the miss tax and shift to magic → confirms the build's defensive ceiling. The build dominates head-to-head matchups against physical-heavy enemy comps → tune Parrying Sword (drop Front to +5) or Shimmer Cloak (drop all three to +5) before touching the universal evasion mechanic.

### Absolom default-Brave WP question (S50)

- **What to watch.** Absolom is WP 13 with `attacker_brave` variance band `[Brave/100 − 0.05, Brave/100 + 0.05]`. At default Brave 70 the midpoint is 0.70 → effective WP `13 × 0.70 = 9.1`, **already greater than Long Sword's flat 8**. With the +1 Reaction-bucket capacity rider on top, Absolom is strictly better than Long Sword at default Brave for a single-handed-slot trade — the only tax is the two-handed lock-out (no shield, no dual-wield). Watch whether the lock-out is enough of a real cost at default Brave, or whether Absolom emerges as the default Knight/hybrid weapon pick.
- **Why it matters.** The design intent was "high-Brave wielders push effective WP toward 13 and beyond, default-Brave wielders trade the two-handed slot for a small loss." The math doesn't realize that — the slot loss is the only downside until Brave 73 or so, and even then the variance band's upper bound (0.75 × 13 = 9.75) exceeds Long Sword + offers the Reaction rider. Tuning lever: drop WP 13 → 11 puts midpoint at Brave 70 to 7.7 (parity ~Brave 73, real upside above), or keep WP 13 and drop the +1 Reaction rider.
- **Signal for adjustment.** Every Knight / hybrid-attacker default-Brave team builds switch to Absolom → WP is too high for the slot trade. Default-Brave Absolom wielders feel underwhelmed and respec back to Long Sword + shield → WP is in the right band; the rider was the tipping point and may need to drop. High-Brave (Soul Vest / Tricorn / Bravestrider stack) Absolom feels appropriately scary → the curve is working.

### Level cap retune — slot ±2 wings (S50)

- **What to watch.** S50 capped the level HP/MP shift at ±10% regardless of slot distance (pre-S50 was linear). Slot 3 (L23) and slot 4 (L27) now share HP/MP with slot 1 (L24) and slot 2 (L26) respectively — they only differ on the dominant-stat axis (PA/MA/Speed ±1). Watch whether the slot 3 vs slot 1 distinction still reads as a meaningful weakness (lower-leveled / weaker dominant stat), or whether it feels collapsed.
- **Why it matters.** The level system is *the* slot-distance signal in v1; if the cap retune flattens the distinction too far, slot 3 / slot 4 placement becomes purely cosmetic (no team-comp incentive to put your tank vs your glass cannon in any specific slot). The pre-S50 ±20% was too steep per Chris's intent; the new ±10% might be too gentle.
- **Signal for adjustment.** Wing slots (slot 3 / slot 4) feel identical to inner slots (slot 1 / slot 2) in team-builder previews → either bump the dominant stat shift to ±2 at ±2 levels (currently ±1) or restore ±15% on HP/MP at slot ±2 specifically. Wing slots still read as distinctly weaker / specialized → cap landed correctly.

### Speed factor /40 — high-Speed Assassin ceiling (S50)

- **What to watch.** Speed factor formula `0.9 + spd/X` had two retunes this session: /20 → /30 → /40. Sped-up Assassin at Speed 20 (Speed Save +3 stacks on Speed 17 baseline) now lands at factor 1.40 (was 1.90 pre-S50, 1.57 mid-retune). Pin Down's net Slow application rate dropped from ~33% to ~28%. Watch (a) whether sped-up Assassin debuff builds still earn their tempo investment, (b) whether the Slow / Stop / Don't Move applier suite still feels like a real threat or has been tuned into noise, (c) whether Pin Down specifically reads as "the slow option that sometimes works" vs. "the slow option."
- **Why it matters.** Pre-S50 sped-up Assassin debuffs were oppressive — Stop / Slow landed too reliably for a target's status defenses to feel meaningful. The two-pass retune (20 → 30 → 40) chose a gentle slope to keep the high-Speed wing playable without nullifying defenses. Whether that's the right band is the open call.
- **Signal for adjustment.** Sped-up Assassin debuffs feel unreliable / not worth the investment → divisor too high; revert to /30 or even /25. Sped-up Assassin debuffs still land too reliably against full-defense targets (Focus Band + high Brave) → divisor still too low; push to /50. Speed factor at default Speed 9 (Hunter / Pin Down reference) feels right but Speed 14+ feels flat → consider a non-linear formula (e.g., diminishing returns above Speed 15) rather than a flatter linear slope.

### Combat Focus stacking lifecycle change (S50)

- **What to watch.** Combat Focus (Alchemist Reaction) migrated from `turn_based`/3-turn + REFRESH to `permanent` + STACK_ADDITIVE. Each enemy hit now adds +1 PA permanently to a single accumulating instance (parallel to Speed Save / Updraft / Cornered Focus); pre-S50 it refreshed a fixed +1 PA / 3-turn timer. Watch (a) whether the Alchemist's PA ramp reads as distinct from Knight's Bravestrider-via-stats and Soul-Vest passive stacking, (b) whether the permanent stacking feels appropriately rewarding for a class that wants to stay in the fight, (c) whether the lifecycle change collapses Combat Focus into "just another stacking buff" without its own identity.
- **Why it matters.** The lifecycle parity with Speed Save / Updraft / Cornered Focus is intentional — four classes each get a "+1 stat per hit" Reaction along the axis their identity rewards (Assassin Speed, Hunter Jump, Calculator MA, Alchemist PA). The risk is uniformity: if all four feel the same in play, the parallel design becomes a wash.
- **Signal for adjustment.** Combat Focus feels under-impactful vs. Speed Save / Updraft / Cornered Focus → the PA-axis ramp doesn't pay off the same way (Assassin already has high Speed; Hunter already wants high Jump; Calculator wants MA for its dominant stat; Alchemist's PA buffs healing and Compound throws but isn't as decisive). May want a richer effect (e.g., +1 PA AND +5 max HP per stack). Combat Focus dominates Alchemist builds and crowds out the other Reaction options → tax the magnitude (back to +0 PA stack, just refresh) or revert to turn-based.

## Session 51 — Universal off-hand expansion + Calculator MA bump + Wand of Depths refit

### Off-hand build variety with the new pieces (S51)

- **What to watch.** S51 opened the off-hand slot for every class via three universal pieces (Buckler / Talisman of Warding / Talisman of Conviction) plus three mage-restricted Books (Tome of Power / Livre of Urgency / Battle Dictionary). Six new build dimensions. Watch which off-hand combinations players gravitate toward across each class and across the four template Mages. Particularly: (a) does any single off-hand consistently dominate (auto-pick) within a class, (b) does any consistently sit unequipped (always-skipped), (c) do non-Knight physical classes (Alchemist / Hunter / Assassin without Two Weapons) actually use the new off-hand options or stay with a free off-hand for tempo / posture reasons?
- **Why it matters.** Pre-S51 the off-hand was Knight territory (shields) or dual-wield territory (Two Weapons). Opening it universally is the largest build-space expansion since equipment integration (S17c). The trade-off it introduces — "do I want a real off-hand piece or do I want my hands free for something else?" — only becomes interesting if players actually feel the choice; if everyone universally equips Talisman of Warding (the cheapest "I have to put something there" option), the universalization doesn't deliver.
- **Signal for adjustment.** Buckler / Talismans always equipped on classes that previously left the slot empty → universalization successful; consider further off-hand pieces (utility, mobility) to extend the build space. Buckler always-skipped vs. the Talismans → Buckler stat profile too weak; raise resistance to +20 or add a small statMod. Talisman of Warding crowds out Mantle of Protection → bump Mantle (the design intent was Mantle remains top-tier); or accept the off-hand-vs-accessory equivalence as intentional flexibility.

### Mage Book preferences (S51)

- **What to watch.** Mages now choose between three Books: Tome of Power (+1 MA, +10 MP), Livre of Urgency (+1 Speed, +5 charged action speed on magical), Battle Dictionary (+1 PA, +1 horizontal range, +1 AoE vertical tolerance on magical). Watch which mage class gravitates toward which Book and why. Particular interactions: Hydrologist + Livre (already-fast caster gets faster), Pyromancer + Battle Dictionary (range + AoE vertical tolerance on top of Aether Bloom's existing AoE enlargement is the stretch interaction), Calculator + Tome (cleanest +MA scaling for Math Skill; the other two Books have limited Math interaction).
- **Why it matters.** Three Books per mage class = 12 combinations of (class, Book). If one Book auto-picks for everyone (likely Tome of Power for raw scaling), the other two reveal as filler; if class-specific preferences emerge (Pyromancer Battle Dictionary, Hydrologist Livre, Aethurge Tome), the design space is healthy.
- **Signal for adjustment.** Tome of Power on every mage build → +1 MA outweighs the other two leverages; either nerf Tome's +1 MA or raise the other Books' impact (Livre's +5 charged speed to +8; Battle Dictionary's +1 horizontal to +2). Battle Dictionary unpicked by mages → +1 PA + range/AoE bumps don't land; needs a small MA component to be competitive. Pyromancer + Battle Dictionary + Aether Bloom stacks into oppressive AoE → tune AoE-elevation contribution (drop Battle Dictionary's +1 vertical) before touching Aether Bloom.

### Calculator MA 9 calibration (S51)

- **What to watch.** S51 bumped Calculator base MA 8 → 9 (+12.5%). Math Skill damage / heal / CT scale linearly on MA, so every Math cast outputs roughly 12.5% more. Status applications (Sculpted, Engineered) gain MA-factor contribution proportionally. Watch whether the bump (a) makes Math Skill feel appropriately impactful per cast (the pre-S51 cast often read as "I gave up a Calculator turn for ~12 damage on 4 targets — was that worth it?"), (b) over-corrects into "Calculator Math casts dominate the action economy," or (c) shifts which Math abilities feel best (Targeted Treatment's healing benefits per-cast; Exact Rhythm's CT push compounds faster).
- **Why it matters.** Calculator was the new class in S49 and the playtest signal from the brief was "per-cast payoff felt undersized." A 12.5% bump is conservative — large enough to bite but small enough that an over-correction is recoverable in a follow-up (back to 8, or up to 10). The dominant-stat MA also still bumps ±1 at slot wings, so a slot-3 Calculator reads at MA 8 / slot-4 at MA 10 — the S51 bump shifts the whole curve up by one.
- **Signal for adjustment.** Math Skill casts now feel "worth a turn" without dominating → the bump landed. Calculator becomes the auto-pick power class → over-correction; either revert to MA 8 or counter-balance by raising Math SP costs / per-target MP. Exact Rhythm specifically becomes the runaway snowball → adjust SP (the Exact Rhythm-specific lever called out in S49 brief) rather than the MA.

### Wand of the Depths AoE vertical tolerance refit (S51)

- **What to watch.** Pre-S51 Wand of the Depths declared `abilityRangeModifiers: [{ deltaHorizontal: 1, deltaVertical: 1, tagFilter: ['water'] }]`. Every v1 spell already targets at vertical 99 (effectively infinite), so the `deltaVertical: 1` was unobservable. S51 reinvested the +1 elevation budget onto a new `aoeVerticalToleranceModifiers: [{ delta: 1, tagFilter: ['water'] }]` field — water AoE casts now cover an additional elevation step beyond the ruleset default. Watch whether Hydrologist players actually feel the AoE elevation widening on real terrain (Stonebridge ramparts, River Ridge perches), and whether the refit changes water AoE casting patterns.
- **Why it matters.** The refit is a quiet correction — the wand's spec said "+1 vertical" but the engine had nowhere to put it that mattered. Now it does. Risk: the +1 AoE elevation might be hard to see in real engagements (most enemies aren't ±2 elevation away from the anchor), and the refit reads as "didn't change anything I can feel."
- **Signal for adjustment.** Hydrologist players notice "more enemies caught by Tidal Wave / Maelstrom on Stonebridge ramparts than before" → refit landed visibly. No observable difference → the +1 elevation budget is too small at v1's terrain heights (Stonebridge tops at elevation 8); consider bumping to +2, or moving the bonus to something else entirely (e.g., +1 AoE radius). Players read the wand as "stronger" without identifying the elevation contribution → ambient positive signal; leave alone.

### Aether Bloom queue-tower AoE preview restoration (S51)

- **What to watch.** Pre-S51 the queue-tower's charged-action inspector (clicking an in-flight charged spell to see its AoE) painted the **base** shape, not the modified shape — Aether Bloom's enlargement showed only at initial targeting time, not when reviewing queued casts. Live resolution still applied the modifier (so the cast hit the larger AoE; only the inspector preview lied). Watch whether Pyromancer players (or anyone using charged casts with `modifyAoeShape` riders) now plan around the correct previewed footprint when reviewing the queue — and whether the corrected preview reveals tactical patterns the pre-S51 misleading preview obscured.
- **Why it matters.** The bug was visual-only — resolution was always correct. But planning around an incorrect preview created a tactical-information asymmetry where players who knew about the bug planned correctly and players who trusted the UI underestimated their own Aether Bloom area coverage. Now corrected: queue inspector matches resolution.
- **Signal for adjustment.** Players notice the inspector "matches what actually happens now" → fix landed correctly. Any remaining preview vs. resolution mismatches surface → audit the modifier pipeline for other UI consumers (initial targeting preview already correct per S38 fix; resolution path correct; queue inspector now correct — there may be others like the AI projection preview that need parallel fixes).

### Universal off-hand opening — Two Weapons interaction (S51)

- **What to watch.** Two Weapons (Assassin's dual-wield Support) lets a wielder swing both hands' weapons as a single Attack action. With the off-hand slot now universal, an Assassin with Two Weapons could in principle equip a Buckler / Talisman / Book in the off-hand — but the slot would hold a non-weapon, breaking the dual-wield. Currently the engine permits the equipment (validateSlotItem accepts shield kind in `leftHand`), but the dual-wield logic only fires when both hands hold weapons. Watch whether players hit the expectation gap — "I have Two Weapons equipped and a Buckler in my off-hand; why am I not getting the second swing?" — and whether the team-builder communicates this clearly (the picker doesn't warn).
- **Why it matters.** The off-hand universalization deliberately doesn't touch Two Weapons; the design intent is "Two Weapons users choose between second weapon OR universal off-hand piece, can't have both." But the UI doesn't communicate the trade-off at equip time. A player equipping a Buckler on their Assassin loses their second swing silently.
- **Signal for adjustment.** Players consistently mis-equip Two Weapons + Buckler and lose their second swing → add a team-builder warning ("This off-hand piece replaces your dual-wield second weapon"), or restrict universal off-hand items from Two-Weapons-equipped units. No confusion → the trade-off is understood as part of build choice; leave alone.

## Session 55 — Terraformer playtest fixes + UI polish + tuning

### Pillar/Pit magnitude 4 — easy-prison geometries (S55)

- **What to watch.** Pillar/Pit now move a tile ±4 (was ±3). A unit on a tile with an adjacent elevation delta greater than its Jump is trapped. At Pit-4 with adjacent elev 0, a unit at the bottom (elev −4) faces a vertical change of 4 to neighbors — Jump-3 classes (Knight, Hunter, Hydrologist, Aethurge, Alchemist, Assassin) and Jump-2 classes (Calculator, Geosage, Pyromancer, Terraformer) are all stuck; only Ignore-Height-equipped units escape. Pit-4 on an occupant also now deals **40** fall damage (drop 4 × 10/level), up from 30.
- **Why it matters.** Chris explicitly wanted to test the +4 magnitude in real geometry. The question is whether it reads as tactically interesting (positional vulnerability earned through smart play) or unfair (a one-shot prison via geometry).
- **Signal for adjustment.** Units routinely trapped with no counterplay, or Pit-4 functioning as a reliable removal → consider Pillar/Pit back to 3, a Worldcraft-specific escape affordance, or rescue mechanics. Feels like a real positional threat with counterplay (reposition, Ignore Height, ally assist) → keep at 4.

### Staff of Power × 1.5 MP — Pyromancer economy (S55)

- **What to watch.** Staff of Power's MP-cost multiplier rose 1.2 → 1.5. Pyromancer is already MP-constrained (28 base); with × 1.5, a 20-MP Fire Storm becomes 30 — a single cast drains most of the pool. Watch whether Staff of Power becomes a niche "nuke-once" pick or whether the +4 MA still justifies the economy hit across a battle.
- **Why it matters.** A major MP-economy shift on a shared mage weapon. It could quietly reshape every Staff-of-Power build, not just the Terraformer's.
- **Signal for adjustment.** Staff of Power never picked over cheaper-MP options, or Pyromancer feels gated out of its identity → walk the factor back toward 1.3–1.4. Feels like a deliberate damage-vs-casts trade → keep at 1.5.

### Hill/Valley AoE preview clarity (S55)

- **What to watch.** The new hover preview tints each kernel tile by delta magnitude (raise → green, lower → red, stronger alpha = bigger |delta|) with a +N / −N label. Watch whether the 3×3 reads clearly at a glance or feels cluttered/noisy, and whether the green/red + alpha convention communicates raise-vs-lower and falloff without explanation.
- **Why it matters.** Per-tile delta visualization is novel territory; first content to use it.
- **Signal for adjustment.** Players misread the shape or the numbers crowd the tiles → drop the numeric labels (tint only) or coarsen the alpha steps. Reads cleanly → keep.

### Barrier targeting feel — click-far-end UX (S55)

- **What to watch.** Barrier uses a two-stage picker: click an anchor tile (valid starts highlighted), then click the far end of a straight 3–5 line (valid far-ends highlighted, the candidate line previewed on hover). Cancel backs out one stage (extent → re-pick anchor; anchor → leave). Watch whether click-far-end feels intuitive or whether players expect orientation-then-length, and whether the two-stage cancel surprises.
- **Why it matters.** First multi-step tile_set targeting in the game; sets the pattern for any future line/area placement abilities.
- **Signal for adjustment.** Players repeatedly mis-aim or can't find the far-end set → reconsider orientation-then-length, or add a clearer extent prompt. Feels direct → keep.

### Worldcraft tooltip density (S55)

- **What to watch.** Each Worldcraft tooltip now leads with an authored effect description plus the effect-queue note ("Counts as 1 active Worldcraft effect"), ahead of the auto cost/target lines. Watch whether the combined block reads cleanly or feels overloaded (Worldcraft carries more to say than a standard ability).
- **Why it matters.** Tooltip information density is a recurring concern (cf. S48 command-set density).
- **Signal for adjustment.** Tooltips feel wall-of-text → trim the descriptions or move the queue note to a secondary line. Reads well → keep.

### Empty-cast rejection feel (S55)

- **What to watch.** A net-lowering Worldcraft cast (Valley/Pit) whose whole footprint is already on the water floor now fails validation ("Target area would not be affected") instead of silently spending MP. Watch whether players understand *why* a watery-target cast is blocked, or whether it reads as the ability being mysteriously unavailable there.
- **Why it matters.** Fixes the silent no-op, but trades it for a rejection the player must interpret.
- **Signal for adjustment.** Players confused why they can't Valley a lake → surface the reason more prominently, or grey-out water-floor targets during targeting. Understood as "nothing to lower there" → keep.

### Offensive AoEs now catch the caster (S55, ADR-0090)

- **What to watch.** Offensive AoEs (Cataclysm, Earth Quake, Fire Storm, Tidal Wave, Chain Lightning) no longer exclude the caster — a mage caught in their own blast (point-blank cast, or a charged cast whose target moves adjacent mid-charge) now takes the damage/status. Cone/line (Maelstrom, Flame Lance) are unaffected (footprint starts one tile ahead). Watch whether self-hits feel like fair positional consequence or an accidental-suicide trap, especially with the charged-cast case where the target controls the geometry.
- **Why it matters.** Reverses a long-standing "caster immune to own AoE" default across the mage roster; charged AoE + a mobile target is a new self-damage vector.
- **Signal for adjustment.** Players repeatedly nuke themselves by surprise on charged casts → consider a confirm/warning when the projected footprint covers the caster, or revisit per-ability. Reads as smart positional play → keep.

### Rapids Rush speed (S55)

- **What to watch.** Rapids Rush actionSpeed 25 → 35 (resolves faster). Watch whether the quicker CT-bump buff overshadows other Water Mage options or feels appropriately snappy.

## Session 56 — AI approach-path high-ground awareness

### AI approach-path high-ground climbing (S56, ADR-0091)

- **What to watch.** A bow user that can't shoot anything this turn now advances toward an elevated perch (height-sensitive future-shot value via the projection resolver) instead of pure distance-closing. Two failure modes to watch in real battles: (a) **over-climbing / tempo loss** — the unit detours uphill or sideways to a perch instead of pressing the attack, arriving late or never engaging; (b) **passivity** — a bow unit that has a strong shot *now* climbs first instead of taking it. (b) is guarded by the joint planner + the dominant `bestOffensiveScore` tier and should not occur; (a) is the live risk.
- **Why it matters.** The positional term is first-class (it can pull a unit off the straight line of advance) and `positionalValue` is range-relaxed (it values a perch's shot *potential* regardless of whether the unit advances). The conservative `APPROACH_DISTANCE_FRACTION = 0.25` is meant to keep this in check, but only real engagements show whether the blend feels right.
- **Signal for adjustment.** Bow units visibly dawdling toward hills instead of fighting → **raise** `APPROACH_DISTANCE_FRACTION` (favour tempo). Bow units ignoring obviously good nearby high ground on the approach → **lower** it. The conditional/gating is correct (tests cover it); the *coefficient* is the dial to turn.

### AI Hunter on Stonebridge — the motivating bug (S56)

- **What to watch.** Does a Hunter (or any bow user) on a map with real high ground (e.g. Stonebridge) take an advantageous perch in actual play — both the move-and-shoot case (already worked pre-S56, now pinned by tests) and the multi-turn approach case (the S56 term)? And does it *decline* a perch that pays nothing?
- **Why it matters.** The unit tests assert the scoring math; only a real battle confirms the AI *feels* right. This is the acceptance criterion the brief flagged as browser-critical and that the automated harness can't drive (PixiJS federated events don't accept synthetic pointer events — see S55 handoff; deployment + turn + cast can't be canvas-driven through the preview).
- **Signal for adjustment.** Hunter still hugs low ground on approach → revisit `APPROACH_DISTANCE_FRACTION`, or confirm the perch is actually reachable within its move budget. Hunter climbs sensibly and shoots downhill, and ignores pointless peaks → close this item.

## Session 60 — arc→straight_line cut + offence-side LoS (ADR-0097)

### Ranged combat under cover — the meta change (S60, ADR-0097)

- **What to watch.** Seven single-target/AoE-anchor spells (Lightning Bolt, Scorch, Water Lash, Megavolt, Chain Lightning, Fireball, Flame Lance) now require **line-of-sight** — terrain, units, and barriers can break the shot. Bows and the area detonators (Earthquake, Cataclysm, Tidal Wave, Maelstrom, Rock Toss, Discharge Strike) still lob over (`arc`). Watch the *feel*: does cover read as meaningful counterplay, or does it just make mages feel unreliable/fiddly? Does the split (these gate, those lob) make intuitive sense at the table, or do players expect e.g. Fireball to arc?
- **Why it matters.** First time LoS matters to ranged damage in v1 — a roster-wide change to how mage positioning plays. It's the substrate the S61 Barrier-denial AI builds on, so its feel gates that work too.
- **Signal for adjustment.** Cover feels punishing/finicky → narrow the cut (pull an AoE member back to `arc`) or revisit. Reads as smart positional play → keep, and widen later if wanted.

### AoE-anchor LoS — burst still spreads through cover (S60)

- **What to watch.** For Chain Lightning / Fireball / Flame Lance, LoS gates only **reaching the anchor**; the burst then spreads from the anchor unobstructed. Watch whether "I can't lob it over the wall, but if I can see the anchor tile it still bursts behind cover" reads as consistent or surprising.
- **Signal for adjustment.** Players confused that the AoE ignores cover once anchored → consider per-tile LoS for AoE spread (a larger change), or pull these back to `arc`. Reads fine → keep.

### AI respects cover on offence (S60, B2 fix)

- **What to watch.** The AI no longer values a `straight_line` shot through a wall, and — the regression that prompted the fix — no longer **collapses its whole offence plan** when its top-scored target is blocked: it now fires at the best *reachable* target or repositions to open a lane. Watch in real battles: does a mage behind/around cover pick sensible targets and firing tiles, or does it dither/waste turns near barriers? Per-turn AI think-time should be unchanged (the LoS gate is cheap; no new projection).
- **Why it matters.** Unit-tested (`session-60-offence-los.test.ts`), but the harness can't drive AI battles (PixiJS) — only a human playthrough confirms the AI *feels* right under cover.
- **Signal for adjustment.** AI fires into walls (shouldn't — gate is in place) or freezes near barriers → investigate. Picks reachable targets and kites for lanes sensibly → close.

## Session 61 — Barrier denial (ADR-0098)

### AI Terraformer walls to protect a threatened ally (S61, ADR-0098)

- **What to watch.** A Terraformer now casts Barrier to screen its most-threatened ally when the net protection is positive — scored as the reduction in incoming damage to the ally *minus* the barrier's cost to the AI team's own offense (a wall blocks both teams). Watch in real battles: does it wall sensibly (a wall that actually shields a squishy from a `straight_line` mage / an approaching melee), and does it *avoid self-walling* — never trapping its own units or blocking its own kill shots? Does it correctly *not* wall against bow/arc attackers (which lob over)?
- **Why it matters.** First reactive use of Barrier by the AI, and the fourth/last coverage-map consumer. The net-benefit scoring (vs. ally-protection-only) is the guard against the AI fortifying itself into uselessness — only a real battle confirms the balance of gain vs. self-obstruction feels right.
- **Signal for adjustment.** AI walls itself in / blocks its own offense → the cost term is under-weighted (revisit the net formula or killValue weighting). AI never walls even when an ally is plainly exposed → the gain is under-valued, or the cardinal-screen enumeration is missing the right wall (consider offset-2 / diagonal screens). Walls sensibly and declines bad walls → close.

### Barrier denial — candidate bounding & think-time (S61, perf)

- **What to watch.** Barrier denial is bounded (protect top-1 ally; ≤12 cardinal-screen candidates; lazy gain-then-cost on the top-3). Measured ~2 ms/decide on a 4v4 in tests — but the per-candidate `threatsToTile` recomputes are the cost centre, and a *full Terraformer battle map* (larger, more units) is the real test. Watch per-turn AI think-time when a Terraformer with Barrier MP is acting.
- **Why it matters.** Perf was the headline risk for this consumer; the bound holds in tests but the harness can't drive a real battle.
- **Signal for adjustment.** Noticeable think-time spike on a Terraformer's turn → add the team-keyed Dijkstra cache (the known redundancy: the cost loop rebuilds the AI-team Dijkstra per enemy for a fixed hypothetical), or tighten the shortlist/candidate count. Snappy → keep.

## Session 66 — AI capability expansion (ADR-0109)

All three S66 chunks are unit-test-validated only; the PixiJS harness can't drive
AI battles, so every item below needs Chris's in-battle feel pass.

### AI values knock-into-hazard knockback (S66 chunk 1)

- **What to watch.** The AI now folds the expected fall consequence of a knockback
  rider into an action's score — a Knight should pick **Bull Rush** over a plain
  Attack when the shove drops an enemy into a Pit/Valley or off a ledge, and pick
  the plain Attack when there's no hazard in the shove direction. AoE knockbacks
  (Tidal Wave / Maelstrom) likewise gain value for shoving enemies into hazards,
  and should *avoid* knocking an **ally** into one.
- **Why it matters.** First time displacement consequences influence AI target/
  ability choice. Consequence-only by design (D1) — it values the *fall*, never a
  pointless shove.
- **Signal for adjustment.** AI shoves enemies to safety / wastes Bull Rush with
  no payoff (shouldn't — flat-ground fall value is 0) → investigate. AI knocks an
  ally off a ledge → the ally-cost sign is wrong. Lands hazard shoves and declines
  empty ones → close.

### AI conserves MP when low — the cower watch (S66 chunk 2)

- **What to watch.** The MP-spend penalty is the named risk: it must stay
  **subordinate**. Watch that a low-MP mage still **casts** when a cast is clearly
  worth it (lethal, big AoE) and only declines genuinely *marginal* casts in favor
  of a free attack. The failure mode is the resource cower: a mage that hoards MP
  and stops casting / ends turns doing nothing. Also watch that normal play (mid-
  to-high MP) is **undistorted** — the penalty should be near-zero there.
- **Why it matters.** The MP rebaseline (S65) made AI mages run dry; this is the
  fix, but a too-strong penalty recreates the cower problem in resource form.
- **Dials** (`src/ai/basic.ts`): `MP_SPEND_PENALTY_WEIGHT` (1.5), the convex
  scarcity curve, `MP_RESTORE_SCARCITY_BONUS` (1.0, Ether).
- **Signal for adjustment.** Mage hoards MP / freezes at low MP → lower the weight
  (or soften the curve). Mage still burns its last MP on junk casts → raise it, or
  reconsider the deferred hard floor (D2). Conserves on marginal casts but commits
  on real ones → close.
- **Scoping to revisit.** The penalty currently covers offence + ally-buff only
  (not heal / Math / Worldcraft) — deliberate, to avoid a support-cower and to
  leave the Worldcraft/Math dials untouched. If Terraformer/Calculator/healer MP
  pacing looks off in play, extending the penalty to those scorers is the lever.

### AI role-aware deployment (S66 chunk 3)

- **What to watch.** At battle start, an AI team should form a sensible shape:
  melee/front-line units on the forward tiles (tanks at the tip), archers and
  casters on the protected tiles behind. Watch whether the formation reads as
  coherent on the real River Ridge mount (and any future maps) — not casters
  stranded too far back to act turn 1, nor melee leaving gaps.
- **Why it matters.** First consumer of `weaponType` (ADR-0105) and the first
  role-aware placement. Coarse melee/ranged split only (D3).
- **Signal for adjustment.** Casters deploy uselessly far back / formation looks
  scattered → revisit the forwardness assignment (e.g. cap ranged setback, or
  cluster around the spear tip rather than pure distance rank). A richer taxonomy
  (tank/skirmisher/artillery/support) is the deferred next step if the coarse
  split feels too blunt. Reads as a sensible battle line → close.

### AI values gaining a good state — Steal Heart / Steal Buffs (S69 chunk 1)

- **What to watch.** The Thief's two previously-AI-invisible actives now score as
  subordinate candidates. Watch that an AI Thief **casts Steal Heart on a real
  threat** when the swing wins (a high-output enemy, no better play) but **never
  passes up a lethal/decisive attack** to charm — the named cower-adjacent risk.
  Likewise Steal Buffs should **peel a buffed backliner** and **ignore a bare
  one** (scores 0 with no stealable buffs). Both must stay below a genuine attack.
- **Why it matters.** First self-state valuation (the brief's chunk 1). The
  contest land-gate (~31% naked Steal Heart, ~48% Steal Buffs) keeps each EV
  honest; over-valuation would make the AI charm-spam instead of pressing damage.
- **Dials** (`src/ai/basic.ts`): `CHARM_SWING_DAMPING_FACTOR` (0.5) — charm value =
  target damage-output × charm duration × contest chance × this; `STEAL_BUFF_VALUE_PER_BUFF`
  (18, damage-equivalent per stolen buff).
- **Threat-value basis.** Charm uses the *damage-output proxy* (Chris's call): the
  target's strongest projected attack, so a hard hitter is the charm target, not
  a tank. Current-position only — no move-to-charm (the utility-candidate
  boundary, cf. Worldcraft).
- **Signal for adjustment.** Thief charms over a kill / charm-spams → lower the
  damping (or check the contest gate). Thief never charms even a fat threat with
  no other play → raise it. Steals bare targets → the buff-count guard regressed.
  Charms real threats and presses damage when that's better → close.

### AI frees a charmed ally — break-a-charm (S69 chunk 2)

- **What to watch.** When an own unit is `enthralled` (an enemy Thief's Steal
  Heart), the AI may attack it to snap the charm (50% per landed hit). Watch that
  it (a) **attacks the charmed unit to free it** when the freed unit's value
  justifies the chip damage, (b) **never KOs its own unit** to do so, and — the
  hard guard — (c) **never attacks a non-charmed ally**. The break competes in the
  pool, so a better attack on a real enemy still wins.
- **Why it matters.** The session's higher-value self-state half (break-a-charm
  over the deferred don't-feed-snowball). It's the only path that offensively
  targets a same-team unit; the guard (`isControlOverridden` only) must hold.
- **Dials** (`src/ai/basic.ts`): `CHARM_BREAK_CHANCE` (0.5, matches enthralled),
  `BREAK_CHARM_VALUE_FACTOR` (1.0). Free value = freed unit's damage-output ×
  remaining puppet turns × factor × break chance, minus the friendly damage cost.
- **Known limitation.** Uses the damage-output proxy, so it undervalues freeing a
  pure-support ally (a charmed healer healing the enemy reads as 0 output) —
  consistent with the charm-cast threat basis; revisit if it matters in play.
- **Signal for adjustment.** AI ignores a charmed ally with a strong freed value /
  KOs its own unit → check the gate. AI ever swings at a non-charmed ally → the
  guard regressed (should be impossible by construction). Frees worthwhile
  puppets and presses damage otherwise → close.

### Calculator Math targeting weights kills (S69 chunk 3)

- **What to watch.** A Calculator's Math Skill (Precision Fire) now killValue-
  weights its per-target damage, so a field-wide cast that catches a near-dead
  enemy is valued like a direct kill. Watch that the AI Calculator **picks the
  parameter/value set that finishes wounded enemies** rather than the one that
  merely chips the most full-HP targets — and that a Math kill competes properly
  with a direct attack in the pool (no more under-firing on wounded targets).
- **Why it matters.** Closes ADR-0092's deferred "Math under-competes on wounded
  targets" limitation. Heal / CT / buff Math options stay raw (unweighted) — only
  the damage option re-bases.
- **Signal for adjustment.** Calculator ignores a finishable enemy for a fatter
  raw-damage cluster → the weighting isn't biting (check the cap-then-weight
  order). Over-commits Math at the expense of a better direct attack → the
  MATH_SCORE_SCALE (1.0) vs the kill weighting is off. Finishes wounded clusters
  → close.

### Terrain blocks straight-line sight; bounded bow lobs (S69 follow-up, ADR-0117)

- **What to watch.** Straight-line spells now occlude on terrain mass (a hill/mesa
  above the sightline blocks), and bows lob over cover only up to +5 above the
  higher endpoint. Watch on elevation-rich maps (River Ridge and future mounts):
  (a) do LoS spells feel *fairly* blocked by hills — not so much that mages can't
  find shots, nor so little that high ground doesn't matter; (b) does **height**
  meaningfully open sightlines (perched/Vantage caster sees over a ridge a flat
  one can't); (c) do bows still feel like they "shoot over cover" while a real
  mountain stops them.
- **Why it matters.** Overturns a v1 simplification (terrain was transparent to
  sight). Balance-significant for the LoS spells; interacts with the **just-tuned
  S68 bow/Vantage** content — a flat-ground bow can no longer shoot over a hill.
- **Dials**: `ARC_LOB_CLEARANCE` (5, `src/engine/map/arc.ts`); the straight-line
  rule is the strict `ray < tile.elevation` occlusion (`line-of-sight.ts`, not a
  numeric dial — change is structural).
- **Signal for adjustment.** Mages can't get LoS on broken terrain / battles
  stall → the occlusion is too aggressive (revisit grazing tolerance, or whether
  some terrain should be "low" cover). Bows still clear implausibly tall obstacles
  / a mountain doesn't stop them → raise/lower `ARC_LOB_CLEARANCE`. High ground
  visibly opens shots and bows lob over walls but not peaks → close.

### AI MP-bottleneck gate + buff-aware cohesion (S73, ADR-0123)

- **What to watch.** (a) **No-loop confidence:** an MP-light unit that can make
  MP (Alchemist with Ether) at low MP should advance/engage, never re-brew-and-
  refill in place — the constructed repro proves the single decision, but watch a
  live battle for any residual idling. (b) **No over-correction:** a genuinely
  MP-dependent caster at low MP should *still* value an Ether (it gates on the
  kit, not current MP). (c) **Cohesion:** an AI team with an Enchanter should
  advance *grouped* so Auramancy hits 2+ allies — without any unit sitting in
  place to soak, and without packing so tightly that one enemy AoE kills several
  (Chris already saw two Enchanters die to one AoE; the AI can't yet weigh enemy
  AoE threat — that's the deferred positional threat-model).
- **Why it matters.** Both are refinements to the (good) advance-to-engage
  default; neither should make the AI more passive. Feel is unverified — the
  PixiJS harness can't drive both-AI battles (since S70).
- **Dials**: cohesion strength = `COHESION_BAND` (1, `src/ai/basic.ts`) — raise
  for tighter packing (watch enemy-AoE clustering). The gate is binary (kit-keyed)
  with no numeric dial.
- **Signal for adjustment.** AI still idles on self-restore → the gate isn't
  reaching the path (re-audit `bestThrowCandidate`). A low-MP caster stops valuing
  Ether → over-correction (the kit check is too strict). Enchanter team still
  scatters → raise `COHESION_BAND`. Units pack into one-spell-kills-several → it's
  too high, or the deferred enemy-AoE term is now needed. Grouped advance + multi-
  ally Auramancy + no stall → close.

### S74 caster-accessory batch — field-wide Calculator interactions (ADRs 0125–0128)

- **What to watch.** (a) **Ring of Caliora soft-lock** — Ring drains 20% of
  magical damage from target CT, **uncapped** (floors at 0). On a Calculator's
  field-wide Math Skill (Precision Fire) it drains CT off the *whole* matched
  enemy team per cast; repeated casts can perpetually deny tempo. (b) **Glove of
  Metria field-wide blowup** — +1 SP per target beyond the first applies to Math
  Skill too, so a 5-target Precision Fire gains +4 SP; stacked with the Ring on
  one Calculator, the field-wide curve is the batch epicenter. (c) **Pendant of
  Lumara multi-amp** — doubled Burn vs. healing economy; watch a Burn-stacking
  build (Spark/Flame Lance/Precision Fire + Pendant) outrunning heals. (d)
  **Greaves opener feel** — one guaranteed first action in 5v5; watch for a
  guaranteed-first Stop/alpha feeling oppressive (probably fine — one opener).
- **Why it matters.** Chris deliberately shipped the *strong* versions of Ring
  (no cap) and Glove (applies to Math Skill) to feel them out rather than
  pre-capping. The Calculator is the known curve-breaker; these two compound on
  it.
- **Dials.** Ring: `damageCtDrainPercent` (20) + the cheapest guardrail is a
  per-hit cap `min(floor(pct×dmg), CAP)` or a CT floor > 0, both localizable to
  `finalDamageCtDrainContributor`. Glove: `perExtraTarget` delta (1), or
  gate the contributor to exclude `math_skill` dispatch if field-wide is too
  much. Pendant: the `factor` (2) on the Burn entry.
- **Signal for adjustment.** A Ring-Calculator perpetually freezes the enemy
  team → cap or floor it. Glove makes field-wide Math the dominant strategy →
  exclude Math Skill or drop the per-target delta. Doubled Burn trivializes a
  no-cleanse comp → revisit the factor. Greaves opener decides games on turn 1 →
  reconsider the 100-seed. All feel fine across a few engagements → close.

### S74 AI increments — buff coverage + charged CT-race (ADR-0129)

- **What to watch.** (a) **AI A (buff coverage):** an AI Enchanter aims Auramancy
  at the densest reachable ally cluster (covers 2+), not a stray; doesn't stall
  for a better cluster; doesn't buff an already-buffed ally or splash an enemy
  when a cleaner anchor exists. Pairs with S73 cohesion (allies gather → caster
  aims at the gathering). (b) **AI B (charged CT-race):** a Hunter declines a
  tile-pinned Charged Attack on a target that will act (and move off the tile)
  before the charge resolves, preferring a non-acting target or another action —
  but still charges freely vs. slow / Stopped targets (no never-charge
  regression).
- **Why it matters.** Both are AI-scoring-only and **feel-unverified** — both-AI
  battles still can't be auto-driven in the preview (since S70); validation is
  unit-test-only.
- **Dials.** AI A coverage is subordinate (no constant — it competes on the
  shared scale). AI B penalty = `CHARGED_TILE_PIN_DODGE_PENALTY` (0.35,
  `src/ai/basic.ts`).
- **Signal for adjustment.** Enchanter buffs a lonely ally / over-packs into
  enemy AoE → A needs the deferred enemy-AoE term (not a coverage bug). Hunter
  never charges, or charges into obvious whiffs → tune the 0.35 penalty. Both
  read as intended in live play → close.

### Knife `attacker_speed` variance is an uncapped speed→damage multiplier (audited S74)

- **What to watch.** The knife weapon class (`physicalVariance: { kind:
  'attacker_speed' }`, Sai / Chef's Knife / Magebane) resolves its variance band
  as `center = Speed / 10`, **with no upper clamp** (`resolvePhysicalVarianceBand`,
  `src/engine/damage/handlers.ts`). At the design's intended Speed (~9–11) that's
  ~1.0× (neutral, as the Sai comment describes). Under Haste (×1.5) or
  speed-stacking it scales without bound: a verified case — Assassin, PA 5,
  Hasted to **Speed 28** — gave the Sai (WP 4) a **2.8× multiplier → ~56 dmg**,
  out-hitting her Scimitar (WP 7, flat ~1.0× → ~37). Damage formulas are
  **correct**; the surprise is that "variance" has become the dominant damage
  term for fast knife-wielders.
- **Why it matters.** A WP-4 knife out-damaging a WP-7 sword inverts the
  WP-leads-damage intuition, and the scaling is invisible (it rides the variance
  slot, not a stated multiplier). Haste + knife is effectively a hidden,
  uncapped damage amplifier that swords/axes never get. Chris's S74 call:
  **confirm and leave it for now** — flag, don't change.
- **Dials (if/when adjusted).** Clamp the `attacker_speed` center band near 1.0,
  or normalize around a baseline Speed (`1 + (Speed - 10) × k`), both in
  `resolvePhysicalVarianceBand`. Note the AI projection reuses the same band
  (`projectExpectedDamage`), so a fix updates AI valuation for free.
- **Signal for adjustment.** Fast knife builds (Haste / Assassin / Thief)
  dominate via raw weapon damage, or knife WP becomes irrelevant next to Speed →
  clamp/normalize the band. Plays fine because high Speed is itself costly/rare →
  leave as-is and close.

### S76 — Monk shipped at default tunings (awaiting playtest signal)

*Migrated from the S76 handoff so it survives into content sessions. The Monk
(14th class, ADR-0132) shipped at sane defaults; these are the live dials and
watch-fors that want real hand-play before any adjustment. The Bear's Heave
two-stage throw UI was **live-verified by Chris (2026-06-29) — resolved**, not
pending.*

- **What to watch (live coefficients).**
  - **Fists** PA×3 (Foxfire / Storm Stoop / Serpent's Coil); **Bear's Heave** 0
    (the throw + fall damage is the point). S76 bumped these 6/5/5 → 8/7/7 then
    settled; confirm the punch-vs-Fist economy reads right in hand-play.
  - **Chakra** heal PA×4 / MP restore PA×2 / mpCost 0 — gated by spending the
    turn. **Watch the self-sustain ceiling** on a 190-HP, no-body, high-evasion
    bruiser (the brief's flagged self-sustain risk).
  - **Foxfire Burn** 50% via PA+Brave (lands reliably; the Burn *tick* is
    MA-scaled → weak for the Monk by design — chip, not the point).
  - **Serpent's Coil CT refund** Speed×2 (~+20 CT at Speed 10) — watch for a
    dominant tempo loop.
  - **Vigilance** evasion +floor(PA/2) (reads base PA only; deliberately
    conservative — can climb if the Monk should be more evasion-strong).
  - **Counterpunch** PA×4 strike + knockback ~PA×4% at PA 9.
- **Why it matters.** The stance system is **AI-illegible** — the Monk reads
  weaker in `sim:both-ai` than in skilled hands, so don't tune it *down* off an
  AI-vs-AI floor. The anti-physical hard-counter profile (all-facing PA-evasion +
  Counterpunch + Chakra) concentrates counterplay onto magic — confirm it isn't
  oppressive on magic-light maps. The punch-sellout's exposure (no stance, no
  body) is the intended self-balancer.
- **What signal would indicate adjustment.** Self-sustain runs away on the
  bruiser build; the Monk dominates magic-light maps; a Serpent's Coil tempo loop
  emerges → tune the relevant dial. The Monk reading weak only in `sim:both-ai`
  is **not** signal (stance illegibility). The Monk isn't on a default team yet —
  slot it into a bundled team to get a floor read.
