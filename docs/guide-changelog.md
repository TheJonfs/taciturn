# Guide Changelog

A one-way handoff channel from **implementer sessions** (this lineage — game
code, in this repo) to the **guide-writing sessions** (a parallel set of Claude
Code sessions maintaining the player guide). Implementer sessions **append**;
guide sessions **read**. The guide sessions don't need to diff the whole repo or
wait for Chris to point at changes — they read this file top-down until they hit
the last session they've already processed.

## What goes here (the filter)

**Only player-facing changes** — anything a player reading the guide would need
to know:

- Ability behavior, mechanics, rules (e.g. a targeting/trajectory change).
- Numbers a player would care about (damage, range, cost, durations) when the
  change is meaningful, not incidental.
- New/removed/renamed content (abilities, classes, items, maps, statuses).
- UX the player interacts with (targeting flows, HUD, tooltips) when behavior —
  not just polish — changes.

**Not** here (invisible to players, so out of scope):

- Internal refactors, type changes, module moves.
- **AI behavior / scoring changes** — the AI playing better or worse is not a
  rules change. (Watch for the subtle case: a *content* change that also touches
  AI — log only the content half.)
- Test changes, tooling, build, docs.

When in doubt: *would this change a sentence in the player guide?* If no, skip it.

## Format

- **Newest session on top.** Guide sessions read down until they reach their
  last-processed session, then stop.
- Each session is a `##` heading: `## Session NN (YYYY-MM-DD)`.
- Lead with the **commit hashes** that carry the player-facing change — the
  guide session's cursor and its way back to the diff/notes.
- Bullet the changes in **player-facing terms** ("what changed for the player"),
  grouped by ability/system. Point to the ADR for mechanical depth.
- If a session has **no** player-facing changes, still add a one-line entry
  saying so (`_No player-facing changes._`) — it tells the guide side the
  session was processed and skippable, not missed.

---

## Session 99 (2026-07-22) — Generated enemies fight for real (M4 generator)

Commits: `see git log` (feat(campaign): M4 enemy generation). ADR-0160.

- **GLOBAL DIFFICULTY INCREASE: every generated enemy now fights with a full
  loadout and real gear.** This covers skirmish parties AND the story battles
  whose lineups aren't hand-authored (most of Chapter 1). Named units (Theo,
  Wiegraf, the Ruk captain, Oscar/Tina) are unchanged.
- **Enemies equip what they learn.** A generated enemy's JP budget still buys
  its class curriculum in order, but the kit is now *deployed*: Reaction/
  Support/Movement passives are equipped to capacity (an enemy Knight
  counters, an enemy Thief moves like a thief), and a high-level enemy that
  finishes its class tree diversifies into a SECOND class — wielding that
  class's command set as its secondary (e.g. a veteran Monk who also casts
  fire magic). Low-level enemies stay single-class.
- **Enemies wear level-appropriate shop gear** (weapon, armor, headgear,
  accessory, off-hand), chosen to fit their class and kit. Gear tier follows
  the enemy's LEVEL with no story cap: roughly L1–12 wears Ch1 gear, L13–24
  Ch2, L25+ Ch3 — so an over-leveled enemy can carry equipment the player
  can't buy yet. Two exclusions, guaranteed: **unique items never appear on
  generated enemies**, and neither do the exotic effect items (Prism Wand,
  Scouring Wand, Healer's Staff, Epee, Palliative Pike, Moon/Terra Robe).
- **Skirmish parties are now themed by location.** Each node fields one of
  its authored enemy ARCHETYPES — Ordallian Patrol, Bandits, Hedge-Mages,
  Poachers — a weighted class mix with flavor names ("Bandit Thief",
  "Ordallian Hunter"). Chapter-1 casts top out at Tier-2 classes: no
  Assassins or Calculators, at any level.
- **Repeat skirmishes vary.** Each skirmish WIN at a node rerolls the next
  party there (composition and gear). Reloading a save does not reroll —
  the party you saw is the party you fight.
- Story-battle enemy lineups authored in the Cartographer without explicit
  loadout/gear overrides inherit all of the above as their defaults (the
  editor shows exactly what will ship).

Commits: `see git log` (feat(content+campaign): Zelmonia Hills).

- **The first Theo Renault battle (Zelmonia Hills) is now fought on its own
  battlefield** — a 16×16 highland ridge — instead of reusing River Ridge.
  Player deployment is on the southern low ground; Theo and his troops hold
  the northern heights.
- **The enemy party there is now six units** (up from five): Theo plus five
  authored soldiers, including two named ones (Oscar, a Hydrologist who also
  casts earth magic; Tina, an Alchemist stocked with Potion / Phoenix Down /
  Ether). Levels 3-4.
- **What did NOT change:** the retreat rule (drive Theo below 15% and he
  escapes alive — he cannot be slain), the Flametongue reward, and Theo
  himself (L4 Hunter, Pin Down only in this first duel).
- Zelmonia Hills also joins the quick-battle map picker.
- **Fix: skirmishes at the Theo nodes no longer crash at battle start.**
  Skirmishes were inheriting the story battle's victory conditions (which
  reference Theo, who isn't in a skirmish); a skirmish is now always a plain
  "defeat all enemies" fight. This had been broken at Zelmonia Hills and
  Mount Eska since skirmishes shipped — nobody had skirmished a Theo node
  before.

## Session 98 (2026-07-20)

_No player-facing changes._ (The Cartographer map-authoring tool — a DEV-only
editor at `?cartographer` — the migration of the six shipped map modules to
its generated format, its Tier 2 enemy-lineup authoring mode, and its Tier 3
per-enemy kit/loadout/gear overrides. Map data is verified identical and the
enemy-kit refactors are behavior-preserving; nothing a player sees changed.
ADR-0157/0158/0159.)

## Session 97 (2026-07-19) — bridge over/under UI + decks walkable (ADR-0156)

Commits: `ef6e2b0` (walkability fix), `fb55d6a` (deck lift), `07f5624` (picking + chip).

- **You can now walk ONTO bridge decks.** A bug from the bridge session made
  deck tiles unenterable for every class — fixed. Any unit can climb onto a
  span from an approach within its Jump (Alvera's deck is one step up from
  both banks).
- **Bridges now render with the deck visibly lifted** off the ground below:
  the span floats up-and-left with a shadow, and the river underneath peeks
  out along the deck's right/bottom edges with its own elevation number.
  Move and targeting highlights light each layer separately — a blast that
  would hit both the deck and the water under it shows both lit.
- **Clicking over/under a span now does what you mean.** If only one layer
  is a legal move destination or valid target, the click picks it
  automatically — you can order a unit into the water UNDER the bridge by
  clicking the cell (previously impossible). The visible ground sliver is
  also directly clickable.
- **New: the stack chip.** When BOTH layers of a bridge cell are valid (e.g.
  a Hydrologist who could stop on the deck or swim beneath it), a small
  two-button picker appears beside the cell showing each layer's elevation
  number — tap the one you mean. It also appears while confirming a move to
  a bridge cell (tap the other number to switch layers before confirming)
  and when hovering a span outside your turn to inspect the tile under it.
  Works by tap — no modifier keys.

## Session 96, continued further (2026-07-18) — rampart walls + BRIDGES (ADR-0155)

Commits: `a71bb7c` (ramparts + picker), `37a51e0` + `3b9ec03` (bridges).

- **Alvera's building walls** now use the dressed-stone rampart terrain
  (Stonebridge's keep art) — visibly architecture, not grass. Both new Ch1
  maps also joined Mage War's New Battle picker.
- **BRIDGES.** Alvera's western river crossing (x=2, spanning the river
  between the manor and the SW house) is the game's first true bridge:
  walk OVER the span or wade UNDER it — two different places at the same
  map square.
  - Straight-line spells pass beneath the span (only the deck's own
    1-tile-thick body blocks); a bridge overhead still covers you from
    lobbed/arcing attacks, exactly as before.
  - Area spells decide who's hit by their vertical tolerance: a blast
    anchored under a high bridge leaves the bridge-standers safe (and
    vice versa); a low span can catch both layers at once.
  - **Bridges are destroyable — permanently.** A Terraformer's Pit or
    Valley on a span smashes it: everyone on it falls the FULL height to
    whatever lies below (at Alvera: into the river), and no Worldcraft
    revert ever restores it. Raising earth (Pillar/Hill) can't target a
    deck — but a raise UNDER a span that crowds it too closely RAMS it
    apart (its occupants land on the risen ground, usually softly).
  - The enemy AI weighs smashing an occupied bridge the same way it
    weighs shoving you off a cliff — don't loiter on spans near an
    enemy Terraformer.
  - Interim UI note: stacked squares still draw only the bridge and the
    elevation digits overprint; a unit underneath stays clickable, but
    expect visual rough edges until the over/under interface pass lands.

## Session 96, continued (2026-07-18) — new maps: Oskun Fields + Alvera Village

Commits: `e05cc08`. Map specs: `docs/maps/oskun-fields.md`, `docs/maps/alvera-village.md`.

- **Chapter 1's first two story battles have their own battlefields** (both
  previously reused River Ridge):
  - **Oskun Fields** (first battle): open farmland split by a winding shallow
    stream — wadeable everywhere it runs. Your company deploys on the west
    bank; the enemy holds knolls across the ford. High ground on the western
    ridge (up to elev 6) and a south-central hill; a deep pond in the SW corner.
  - **Alvera Village** (second battle): a riverside village with real
    **buildings** — walls too tall to jump, interiors entered only through
    door gaps (four buildings, four doors). A deep river crosses the map with
    two shallow fords and a dry eastern flank route. You defend from the
    village road; the enemy assaults from the fields across the river. Walls
    block straight-line spells like terrain — the lanes are true cover.
- Wiegraf still joins the Oskun fight as a guest (new position, west bank).

## Session 96 (2026-07-18, same day) — weapon-ranged skills, gear changes refill HP/MP (ADR-0154)

Commits: `febcacf` (weapon-ranged), `ed4a612` (vitals refill).

- **Weapon skills now truly use your weapon's reach.** Charged Attack and Pin
  Down (Hunter) previously kept their bow-style 2–5 band even with a dagger or
  bare hands — a melee Hunter could shoot across the map. Now every
  weapon-delivered skill (Marksmanship, the Knight's Battle Skills, Steal
  HP/MP, basic Attack) reaches exactly as far as the equipped weapon: a bow's
  full band (dead zone included), or adjacent-only for melee weapons and
  fists. The flip side is intended: a bow-wielding Knight's Battle Skills now
  strike at bow range. Ability tooltips say "weapon range" instead of fixed
  numbers.
- **Changing gear or class between battles now updates current HP/MP.**
  Equipping a +MaxMP piece (e.g. Padded Jacket) used to leave the unit at its
  old current MP for the next fight; reclassing had the same staleness. Any
  equip, unequip, or class change now re-fills the unit to its new effective
  full — both directions (removing the piece lowers current to the new max).

## Session 95 (2026-07-18) — earning-coverage audit, stock-refresh notice, bigger world map (ADR-0153)

Commits: `a6023bc` (earning fixes), `5ec9e43` (JP follows XP), `eada1b0`
(item display), `d8be26e` (stock badge + map), `8e0d9f4` (placard/subtitle).

- **XP/JP now awarded for several actions that silently earned nothing:**
  - **Worldcraft casts** (Pillar/Pit/Hill/Valley/Barrier) — terraforming earns.
  - **Attacking a Barrier** (the single-target basic-Attack route) earns.
  - **Bear's Heave** (the real grapple throw — repeat heaves earn each time).
  - **Steal MP** (draining a target with MP; an empty target still earns nothing).
  - **Chakra** when it refuels an **ally's** MP (pure self-refuel still doesn't earn).
  - **Rapids Rush (Tide Surge)** — a landed CT surge earns at resolve.
- **Charged casts that do nothing no longer earn.** Since campaign XP shipped,
  EVERY charged resolve awarded XP even on a total miss or a no-op (e.g. Esuna
  with nothing to cleanse). Whiffed nukes now earn 0, same as instant misses.
- **The earning rule, stated:** an action earns iff it changed something other
  than the caster's own bookkeeping (own MP/position/CT never earn; changes to
  other units and to the battlefield always do). JP triggers exactly when XP
  does — the two can no longer disagree.
- **Known quirk:** throwing/knocking a unit to a lethal fall doesn't pay the
  +10 KO bonus (the fall is a separate event); the base award still lands.
- **New-stock notice on the world map:** when a shop restocks in a town you've
  left (Alvera restocks after Old Ordal and again after Mount Eska), that town
  shows a gold **"new stock!"** badge on the Road Ahead until you visit it, and
  the aftermath scene mentions the restock.
- **The Road Ahead is bigger** — the world map now uses most of the screen.
- **Item text fixes:** all five lances now state their 2-tile **pierce** line
  (behavior unchanged — it was always there, just undisplayed); the Prism
  Wand's extra-Burn-stack line now correctly says it applies to **elemental**
  casts, not "all casts".
- **Guest turns read "Ally's turn — <name>"** instead of "Opponent's turn";
  shop subtitles speak as the town ("Alvera Village keeps its own shelves").

## Session 94, batch three (2026-07-14) — earning gaps, fightier low-level enemies, richer purses (ADR-0152 addendum)

- **Compound now earns XP/JP** (flat base — it's self-targeted), matching
  Throw Item. The award line still appears when the turn ends.
- **Zero-damage throws earn too:** Bear's Heave and other pure-displacement
  moves count as connecting actions — for your units and enemies alike
  (that's why the enemy Monk seemed to earn nothing).
- **Low-level enemies actually fight now.** The AI was planning around
  abilities the unit hadn't unlocked, and when that plan fell through it
  gave up its turn — the wandering you saw. It now plans only with what a
  unit truly knows: expect the L2 monk to punch (hard — Barehanded), the
  poacher to reposition and line up Charged Attack.
- **Gil doubled:** battle awards now pay 20 gil × total enemy levels.
- **Math Skill earns:** a calculation that connects — even a pure tempo
  shift like Exact Rhythm — now awards XP like any other action (and the
  log's JP note appears with it).

## Session 94, batch two (2026-07-14) — playtest fixes + the enemy-kit framework (ADR-0152)

From Chris's Chapter 1 speedrun:

- **Fixed: weapon procs no longer double-pay XP/JP.** An attack whose wand
  resonance fired was earning (and logging) the award twice; procs now earn
  nothing — one action, one award.
- **Fixed: Compound and Throw Item work.** They ride the Alchemy command
  set wherever it's wielded (Alchemist primary or anyone's secondary);
  which ITEMS you can throw is still gated by what you've unlocked.
- **Fixed: the world map no longer "loses" your next destination** after a
  Manage Roster detour from a just-finished scene.
- **Fixed: a canvas crash** (Pixi text teardown) that could hit during play.
- **Enemy kits now scale with level:** a generated enemy "spends" level ×
  100 JP down its class tree in order — an L2 rebel knows one or two
  basics, not Tidal Wave. Enemy Brave/Faith roll the same 50–70 band as
  your recruits, and enemies carry at least a Dagger where their class
  can hold one.
- **The winning blow now finishes animating** (plus a short beat) before
  the victory screen appears.
- **Names match genders** for rolled recruits and hires, and roster cards
  in Formation/Manage show ♀/♂.

## Session 94 (2026-07-13) — Ch1 feedback round: kits, per-town shops, story-first towns, map reveal (ADR-0151)

Same-day revisions from Chris's first Chapter 1 playthrough — several change
what the guide says about towns and starting abilities:

- **Starting abilities are now small for the named cast:** Lumen knows only
  Scorch; Chris only Power Attack; Clio joins with only Water Lash; Sera
  joins already knowing Hamstring (her restricted signature); Thessaly joins
  with one Math line (Exact Rhythm + Height + Prime). Everything else is
  earned with JP. (Round two, same session:) the four rolled starting
  recruits also begin with just ONE skill — their class's cheapest:
  Potion, Charged Attack, Bear's Heave, Rock Toss. Only tavern HIRES
  still arrive with the full Tier-1 kit (you pay for the convenience).
- **Class innate passives arrive equipped** on every new unit (yours and
  enemies): a fresh Knight has Counter/Martial Expertise/Bravestrider slotted,
  a fresh Pyromancer has Ignition/Aether Bloom/Smolder/Hotfoot, etc. They
  cost nothing in their own class and can be unequipped like anything else.
- **Each town sells only ITS gear now** — Alvera doesn't carry Zarghidas's
  starter kit; the Staff of Abundance / Tome of Power / Arcane Robe
  restocks still appear AT Alvera after Old Ordal / Mount Eska clear.
  Selling works anywhere.
- **Towns with a story battle fight first:** on first arrival the battle
  starts directly; the shop/recruit menu appears only after the town's
  story is cleared. (Campaign start likewise opens on the Zarghidas scene
  now, not a menu.)
- **The map reveals as you travel:** only visited places and your current
  choices are drawn — plus Old Ordal and Viura, visible from the start as
  the far-off destination. Everything else appears as the road opens.
- Lumen and Chris swapped starting body armor (Jacket/Vest).
- Dev-only (not player-facing, listed for completeness): a level-up debug
  chip joins the JP one.

## Session 93 (2026-07-13) — CHAPTER 1 IS THE LIVE CAMPAIGN (ADR-0150)

The M1 test campaign (River Ridge → The Return) is **replaced wholesale** by
the real Chapter 1 — this reshapes most of what a campaign guide would say:

- **New campaign map:** a 13-stop road out of Ivalice and back — Zarghidas
  Trade City → Oskun Fields → Alvera Village → Zelmonia Castle → Zelmonia
  Hills → Grek Forest → Fort Cator → Ordal Canyon → Old Ordal → Mount Eska →
  Ester Road → Ruk Village (finale). Old Ordal also shows a **dashed road to
  Viura** that never opens — the capital stays on the horizon. Old saves from
  the test campaign are discarded (can't resume onto removed nodes).
- **New starting party:** Lumen (L1 Pyromancer, Wand of Lumen) and Chris (L1
  Knight, Iron Sword — can also switch to Alchemist from the start, with 100
  JP banked there) plus **four rolled recruits** (Alchemist, Hunter, Monk,
  Geosage — names, genders, and Brave/Faith 50–70 rolled fresh at each New
  Campaign; the Geosage carries the Wand of the Deepwood). Everyone starts at
  level 1. The old L25 test roster is gone.
- **Companions join as the story unfolds:** Clio (L2 Hydrologist) after
  Alvera, Thessaly (L3 Calculator) after Grek Forest, Sera (L5 Assassin)
  after Ordal Canyon — where she first fights beside you as a **guest**.
- **Guest allies (first shipped use):** Wiegraf Folles (L2 Alchemist with
  Potion + Phoenix Down) fights alongside the party at Oskun Fields, and Sera
  at Ordal Canyon. Guests are AI-driven and uncommandable, fight on your
  side, and don't count against the 5-unit deploy cap.
- **Special battles:** Theo Renault, an Ordallian commander (Hunter), bars
  Zelmonia Hills (L4) and returns at Mount Eska (L10). He **cannot be
  killed** — drive him below ~15% HP (or sweep his escort) and he retreats.
  Ester Road and Ruk Village are **subdue-secret** fights: beat every
  deserter (Ester) or just the Rebel Captain (Ruk) below 25% HP **without
  killing a single enemy** for a better outcome the story remembers; one
  enemy death locks you to the standard defeat-all path.
- **Unique gear from story beats:** Pendant of Lumara (Oskun, for Lumen's
  fire lesson), **Flametongue** (Zelmonia Hills, after Theo retreats),
  Freelancer's Charm (Mount Eska).
- **Shops now follow the story:** four hub towns (Zarghidas, Alvera, Zelmonia
  Castle, Fort Cator) unlock gear in waves — Zarghidas starter kit at
  campaign start; Alvera's caster gear when it's cleared; the castle's Heavy
  lane on arrival; Fort Cator's Cutlass lane at node 5; and late-chapter
  restocks (Staff of Abundance + Tome of Power after Old Ordal, Arcane Robe
  after Mount Eska). Anything unlocked is buyable at any hub. **Real stub
  prices** replace the flat 500-gil default for all Ch1 stock (basics
  ~150–300, standard ~300–500, premium ~500–700). Gauntlet of Might and
  Mantle of Protection are no longer buyable in Ch1 (held for Ch2).
- **Farmable stops:** Oskun, Zelmonia Hills, Grek Forest, Ordal Canyon, Mount
  Eska, and Ester Road offer repeatable skirmishes once cleared; Old Ordal
  and Ruk Village offer nothing after their stories (in Ch1).
- Caveat for the guide: battles currently recycle existing battlefields with
  placeholder enemy lineups, and scenes are one-line author's notes — real
  maps, enemies, and dialogue land in later milestones. Structure, joins,
  shops, and special-battle rules above are real and stable.

## Session 92 (2026-07-12) — Ch1 substrate: outcome conditions, flags, phantom edge, guests (ADR-0149)

_No player-facing changes in shipped content._ (Four campaign capabilities
landed for the upcoming Chapter 1, none yet used by any shipped battle:
victory conditions beyond defeat-all — subdue-without-killing wins with
good/standard outcomes, boss retreat thresholds, death-protected units that
retreat instead of dying; a persistent campaign-flag store with
outcome-branched post-battle scenes; phantom map destinations shown but
never reachable; and guest allies — player-side AI-driven units. When Ch1
battles author these, the guide will need sections on subdue objectives,
outcome-dependent scenes, and uncontrollable guest allies.)

---

## Session 91 (2026-07-12) — Engagement queues + per-beat edge gating (ADR-0148)

_No player-facing changes in shipped content._ (A campaign-model capability
landed: a location can now host an ordered queue of story engagements —
return visits play new stories that open different map roads, the FFT
Igros-Castle shape — and map roads can open per story beat instead of
per location. Every shipped node plays **identically** (all are
single-engagement; the defaults reproduce the old behavior exactly), and
old saves load unchanged. When Chapter 1 content ships a real camp using
this, THAT session's entry will carry the player-facing description.)

## Session 90 (2026-07-11) — Atlas node-authoring tool, structural tier (ADR-0147)

_No player-facing changes._ (A DEV-gated campaign graph editor, a `chapter`
field on campaign nodes, and internal module splits/codegen. The world map
renders pixel-identically; no ability, item, node, or mechanic changed.)

## Session 89 (2026-07-11) — AI competency refresh (ADR-0146)

_No player-facing changes._ (Enemy AI competency floor — enemies now use
grapple throws, damage-less debuffs, Raise, Esuna, and Jump, and respect
reflect gear — but AI playing better is not a rules change per the filter
above. No ability, item, or mechanic changed. The `aiHints` additions on
statuses are AI-only metadata.)

## Session 88 (2026-07-11) — TABA campaign economy: gil, world-map travel, skirmishes, shops, recruitment (ADR-0145)

Commits: `86ba0c0` (gil) · `bb155a8` (map + skirmish) · `8671c94` (shops) ·
`5612ace` (recruitment). Campaign mode only — Mage War untouched. **All
prices/rewards/curves are placeholder numbers** pending the balance pass;
describe mechanisms, not values, in the guide.

- **Gil (party money) exists.** Winning any campaign battle pays gil scaled to
  the total levels of the opposing force (currently 10 × the sum of enemy
  levels). One shared party purse, shown on the world map, the post-battle
  spoils line, and every commerce screen. Losses pay nothing. The purse
  persists in the save.
- **The world map is now navigable.** Cleared locations stay on the map as
  returnable places (gold ring) alongside the forward frontier (blue ring).
  You can travel back to any visited location that still offers something —
  story progress remains gated by clearing battles, but nothing behind you
  closes. **A cleared story battle never replays.**
- **Skirmishes (repeatable farming).** Every cleared combat location opens a
  skirmish valve (marked "skirmish" on the map): an on-demand fight on that
  location's battlefield against a generated band of Tier-1 generics, scaled
  to your party's average level plus a per-location offset (e.g. Mountain
  Pass runs +2, River Ridge −1). Skirmish wins pay full XP, JP, and gil —
  farm freely; there is no anti-farm timer. Losing a skirmish costs the
  attempt (retry offered against the same band).
- **Shops at hub locations.** Stonebridge is the first hub — its location
  menu offers a Shop (and it does so even before you clear its own story
  battle: you choose between marching on the enemy and browsing). Shop stock
  is **cumulative and story-gated**: each cleared location contributes its
  item bundle to one global pool that never shrinks; you access the pool at
  any hub. Buying routes into the party inventory; **selling returns 50% of
  the buy price**, only for unequipped instances, and **unique items can
  never be sold** (the row says why). Prices are flat placeholders (500 gil)
  for now.
- **The party marches on the map.** The company is marked by a gold banner
  standing at its current location; picking a destination sends the banner
  walking along the roads (through intermediate stops on a long return trip)
  before the destination opens — the FFT world-map beat. Respects the OS
  reduced-motion setting (instant travel).
- **Recruitment at hubs.** Hire a generic soldier at a chosen class and
  level: any Tier-1 class (Alchemist, Monk, Hunter, Pyromancer, Hydrologist,
  Geosage), **level capped at your party's current average** — hires can
  never outlevel your organic units. Cost scales with level; hires at level
  10/20/30+ arrive with a JP signing bonus in their own class (200/500/900
  JP) so they're functional on arrival. Hires come with legal starter gear,
  join the roster immediately deployable, and are named from a wandering-
  soldier pool (Bram, Odette, Fenwick, …).

## Session 87 (2026-07-10) — TABA Ch3 weapon uniques ×8 + Moon Robe fix (ADR-0144)

Commits: `d07ec84` (Moon Robe) · `9c3ef10` (Katana verification) · `d55ece0`
(six compose uniques + Holy) · `6584ba5` (Del's Stave) · `70984ea` (Volley Bow).
**TABA-campaign-only content** (all uniques are hidden from Mage War); the Moon
Robe fix and the crit verification apply to the shared engine.

- **Moon Robe now actually works**: water-tagged spell damage is a true ×1.5,
  identical against every target (it previously did nothing unless another
  Spell Power item happened to be equipped). Its tooltip now reads
  "Spell Power: × 1.50 on water-tagged casts" instead of "+0 SP".
- **Katana confirmed correct** (no change): crits deal 1.5× damage by default;
  Vicious Dagger +25 / Arcane Lens +10 / Keen Visor +5 crit chance stack
  additively and apply to weapon attacks; the Katana doubles the crit
  *multiplier* (1.5 → 3.0) and does not touch crit chance.
- **Eight Ch3 unique weapons** (single-instance, found-not-shopped; in-world
  placement comes with the economy pass — dev-seed only for now):
  - **Nandani's Wrath** (sword 11·95): Brave +11 — raises physical damage AND
    reaction trigger rate; the Counter/Counterpunch synergy sword.
  - **Cremation** (axe 14·75, axe variance): every landed hit applies 2 Burn
    stacks, guaranteed.
  - **Shadowblade** (knife 6·95, speed variance): 50% on-hit "Speed Steal" —
    the wielder gains permanent stacking +1 Speed, the victim takes permanent
    stacking −1 Speed. Both directions accumulate all battle.
  - **Sline** (lance, two-handed, 8·90, reach 2 + pierce): the basic attack
    strikes twice. Composes with The Offering for four strikes.
  - **Golden Rod** (wand 2·90): a pact — every turn start the wielder loses
    10% of Max HP (it CAN kill you) and 10% of Max MP, and gains a permanent
    +1 MA stack. Bring a healer or die rich.
  - **Del's Stave** (staff 5·80): every magical cast spends ALL your MP; the
    spell gains +1 Spell Power per 10 MP spent beyond its cost, no cap. One
    huge nova, then normal casts — and cheaper spells get bigger bonuses.
  - **Volley Bow** (bow, two-handed, 8·40, range 2–4): the basic attack hits a
    diamond-1 AREA around the aimed tile — you can aim at empty ground — and
    it hits allies in the blast. Each unit rolls accuracy separately.
  - **Excalibur** (Knight Sword, two-handed, 16·95): Brave-variance damage,
    permanent Haste while equipped, and Holy-imbued strikes (resisted only by
    gear that carries Holy resistance, e.g. Mantle of Protection). The
    post-game preview behind a tough optional boss.
- **New statuses players will see**: Speed Up (Shadowblade), Gilded Focus and
  Golden Rod's Pact (Golden Rod) — all with tooltips.
- **Dev-only, worth knowing for testing writeups**: a 📈 Grant JP chip beside
  the gear-seed chip on the manage-roster screen (+100 JP per unlocked class
  per press, repeatable).

## Session 86 (2026-07-10) — TABA M3 gear UI: equip between battles (ADR-0143)

Commits: `ce02d04` · `9d5f286` · `3f94ad6` · `3eeb908` · `3779318`.
**TABA-campaign-only** — Mage War's Team Builder behavior is unchanged.

- **You can now equip gear on campaign units between battles.** The dossier's
  Loadout tab is a merged two-column view: EQUIPMENT (five slots — right hand,
  left hand, headgear, armor, accessory — each opening an inline picker) beside
  the ability sections. The old "Equipment · soon" tab is gone.
- **Party inventory.** The team owns items as counted instances: equipping uses
  a free instance, unequipping (or swapping) returns it to the pool, and an
  item equipped on one unit isn't available to another until freed. Your
  starting loadouts count as owned — unequip day-one gear and it goes to the
  stores. A unit lost to permadeath takes its equipped gear with it.
- **Slot pickers show what you own** — grouped by weapon family / gear kind,
  searchable, with a short stat line and the free count (×N) per item. Only
  legal choices are offered: class restrictions, the two-handed both-hands
  rule (relaxed by Monkeygrip), and the no-dual-wield-without-Two-Weapons rule
  all filter the list. Placing a two-hander auto-empties the off-hand.
- **Capacity is equipment-adjusted live** — Spiked Maul drives the Reaction
  bucket to 0/3 in the view (your class-innate reaction still fits; imports
  don't, per S85's cost-weighted ruling).
- **Invalid loadouts are flagged, never auto-fixed.** If gear pushes a filled
  bucket over capacity (or a reclass strands now-illegal gear, or Freelancer's
  Charm sits beside class-restricted pieces), the unit keeps the state but
  shows: a ⚠ badge on its roster card, a "loadout invalid" chip + dashed-out
  stats in the dossier, and a warning banner naming the exact cause ("Reaction
  over capacity: 3 equipped, 0 available — Spiked Maul −3"). **Invalid units
  cannot be deployed** until fixed.
- Density: the reclass chips now sit behind a "Change class" button, and the
  Secondary/Reaction/Support/Movement sections collapse with their picks and
  used/capacity still visible in the header.
- (Dev builds only: a "Seed gear" chip on the manage screen stocks the stores
  with 10 of everything for playtesting — real acquisition ships with the
  economy pass.)
- **Addendum (`1eff54b`): Loadout ergonomics.** The inspector strip now floats
  at the bottom of the view while you browse (sticky — it never scrolls out of
  reach), pickers cap their height and scroll inside, and hovering a pick also
  previews it on the TOPLINE stats — the header numbers switch to the
  projected values in green (up) / red (down) and restore on unhover.
- **Addendum (`681871f`): the dossier now shows REAL stats and previews picks.**
  The header stat row is equipment/passive-composed (what battle will actually
  use), with Move and Jump added. Hovering any gear candidate, passive, or
  secondary command in the Loadout tab opens an inspector strip with its full
  mechanical detail and the projected stat changes as ±chips (swap-aware: it
  accounts for the item you'd displace). The exotic S85 gear finally describes
  itself — CT-refund weapons, lifesteal robes, spell procs, buff-duration
  staves, the Freelancer's Charm rule, and the rest all render their effects.
  All five named leads (Lumen, Chris, Clio, Thessaly, Sera) now wear the
  crest/"named" badge (two were missing it).
- **Addendum (`6984343`): roster management is now reachable BEFORE a battle.**
  The deploy-selection screen has a "Manage Roster" button that opens the full
  Formation surface (dossiers, gear, loadouts, reclass, JP-spend); "← Back to
  Deploy" returns to deploy selection with any fixes applied. Previously
  management was only reachable from the world map after winning a node — you
  can now tune loadouts before the very first battle.

## Session 85 (2026-07-09) — TABA M3 equipment expansion: 51 items across three gear generations (ADR-0142)

Commits: `1e00ae7` → `f848b8d`. **TABA-campaign-only** — none of this appears in
Mage War (its lineup is frozen and regression-pinned), except one deliberate
bug fix noted at the end.

- **Chapter 1 gear generation (new, 10 buyables):** Iron Sword (WP5), Cutlass
  (WP4, +5F/+2S evade), Woodman's Axe (WP7·75, swingy), Short Bow (WP3·40, full
  bow behavior incl. height rules), Dagger (WP2, **50% on-hit Vulnerable** —
  the setup knife; the proc never amplifies its own hit), Padded Vest (HP+50),
  Padded Jacket (HP+30/MP+15), Chain Shirt (Heavy: HP+80, +15 all-element res),
  Linen Robe (mage: HP+20/MP+20/MA+2), Arcane Robe (mage: HP+10/MP+20, +25 all
  res). **23 existing Ch2 items are also available from Chapter 1** in TABA
  (the element wands, Staff of Abundance, most heads/off-hands/accessories —
  the "demoted" set), plus Pendant of Lumara and Flametongue as Ch1 story
  uniques.
- **Chapter 2 additions (7):** Runic Staff (MA+5, Speed−2), Wand of Expanse
  (**your magical area spells grow one step** — stacks with Aether Bloom),
  Choir Staff (**buffs you cast last +1 turn**, and magical casts charge +5
  faster), Warmage's Edge (PA+1/MA+2 — the first dual-stat weapon), Runecrown
  (MP+20/MA+2/+1 spell power), Meditant's Cowl (MP+40, magical casts charge +5
  faster), Keen Visor (Hit ×1.1, Crit +5).
- **Chapter 3 gear generation (33):** highlights —
  - **Katana**: critical hits deal **double damage** (crit ×1.5 → ×3.0).
  - **Manaeater Blade**: WP 14, but your MaxMP is **halved**.
  - **Epee**: a basic Attack refunds **PA-worth of CT** (once per action).
  - **Spiked Maul**: WP 20 — the game's biggest hit — but your **Reaction
    bucket capacity drops to 0** (no reaction passives at all while wielding).
  - **Gaia's Axe**: earth-imbued strikes (target earth res applies) + your own
    earth res +50.
  - **Estoc**: a knife that stabs at **2-tile reach**. **Main Gauche**: +20/15/10
    evade. **Master/Sniper Bow**: the Hunter-optimized vs reliable bow pair.
  - **Trident**: lance package + **Templar Arts charge +5 faster**.
    **Palliative Pike**: every landed hit heals allies (not enemies, not you)
    adjacent to YOU for MA×4 — Aether Bloom widens the pulse.
  - **Prism Wand**: all four element-wand utilities on ANY elemental spell
    (+1 range, +1 AoE elevation, +5 cast speed, +1 spell power, +1 Burn stack).
  - **Scouring Wand**: every landed poke permanently shreds **−33 ALL
    elemental resistances** (stacks without limit — and resistance has no
    floor, so it keeps scaling).
  - **Battle Staff**: your basic attack uses **MA instead of PA**. **Healer's
    Staff**: your basic attack **heals its target** (MA × 6, Faith-scaled,
    never misses — and yes, it heals an enemy if you aim at one).
  - **Channeler's Hat**: incoming damage **halved while you're charging**.
  - Bodies: Crystal Plate (HP+200/+33 res/Speed−1), Masterwork Mail (33%
    physical thorns), Mithril Chain, Sensei's Gi, Expert's Tunic (MP costs
    ×0.75), Stealth Suit (evade/mobility scout). Heads: Titan's Helm, Command
    Cap (**+1 secondary command set** for non-mages, Speed−2). Off-hands:
    Mirror Shield (**20% magical thorns**), Abjurer's Codex (**your MA is
    added to all elemental resistances**), Talisman of Endurance (negative
    statuses land ×(1 − max(PA,MA)/100)). Winged Boots (Move+1, **Jump+5**).
  - **The four element robes** (each plays its element against type): Moon
    (water damage ×1.5), Star (heal 25% of fire damage you deal), Terra
    (**+1 MA per earth spell cast**, stacks all battle), Void (lightning
    damage marks Vulnerable, 50% Faith-scaled).
- **Freelancer's Charm** (Ch1 unique): **+1 secondary command set**; you
  cannot wear a class-restricted (Heavy/Magical) body while it's equipped —
  "the generalist travels light."
- **New statuses:** **Terra Attunement** (+1 MA/stack) and **Scoured** (−33
  all-element res/stack, permanent, cleansable as a negative status).
- **Mage War fix (the one shared change): Livre of Urgency now actually
  speeds up buff casts.** Its "+5 charged action speed on every magical cast"
  silently skipped non-damaging spells (Protect, Haste, etc.) — a bug
  contradicting its own description. Damage spells are unchanged.
- **Availability note:** within TABA, items are gated by CHAPTER only for now
  — shops/costs/locations arrive with the economy pass. Uniques' acquisition
  flows (story pickups) aren't wired yet.

## Session 84 (2026-07-05) — TABA chapter-1 plot-unique units (ADR-0141)

Commits: `1df3efd`, `3eede12`, `c2201b3`, `a8fa759`, `9ed6e5b`, `7fa6788`,
`602f396`. **Campaign mode only** — Mage War is unaffected (these are plot-unit
signatures, hidden from the MW picker).

The five chapter-1 leads are now real characters with signature kit, built on
three reusable systems. **New concept: the chapter number** — a battle's chapter
(1–3) scales three of the signatures.

- **Lumen — Ascendant Flame** (innate): her **fire** damage is multiplied by
  **1 + 0.1 × chapter** → ×1.1 / ×1.2 / ×1.3 across the campaign. Fire-only,
  caps at ×1.3.
- **Chris — Bulwark Oath** (innate, "cover"): an ally standing **adjacent** to
  Chris (within 3 elevation) has **10 % × chapter** (10/20/30 %) of an incoming
  hit **redirected onto Chris as raw damage**, which then goes through **his own**
  Protect / resistances / armor — so a well-defended Chris soaks it better. (v1:
  the soak doesn't trigger his reactions and can't be dodged.)
- **Clio — Tidal Cadence** (innate): on **every turn Clio takes**, each living
  ally gains **3 × chapter CT** (a small team-tempo boost). She doesn't boost
  herself.
- **Sera — Hamstring** (new Assassin active, Sera-only): MP 8, ranged
  (4 h × 3 v, needs line of sight), instant, no damage. Applies **Hamstrung** —
  a **stacking, permanent** debuff: each hit is **−1 Move and −1 Jump**, each
  floored at 0 on its own. Several hits fully immobilize (Move 0 **and** Jump 0);
  a target can be Move-locked while still able to climb. Lands on the same
  Brave-and-Speed roll as Shadow Stitch / Blowdart. Sera earns it as a purchase
  (~200 JP), not a freebie.
- **Thessaly — two exclusive Math components** (Calculator, Thessaly-only,
  buyable): a new **XP** parameter (targets by each unit's XP) and a new
  **Square** value (selects units whose parameter is a perfect square:
  1, 4, 9, 16, 25…). Together they expand her Math targeting grid from 4×4 to
  5×5. Bought, not granted — earned over the campaign.

**Unit-restricted purchases:** in the between-battles Training screen, Sera's
Hamstring and Thessaly's XP / Square appear **only** for those two units — a
generic Assassin or Calculator never sees them.

**Portraits:** the five leads now have bespoke portraits that stay with them
across reclassing — visible in **story-scene dialogue**, **in battle** (map
token, turn queue, deployment panel), and the between-battles **Formation
roster** (both the cadet cards and the unit dossier now show each unit's face
instead of a letter — plot faces where they exist, otherwise the class + gender
portrait).

## Session 83 (2026-07-04) — TABA Formation UI + JP-gating goes live (ADR-0140)

Commits: `39d9d66`, `e196821`, `48d3491`, `42fb3b5`, `a4445a3`. **Campaign mode
only** — Mage War single battles are unaffected (they stay fully unlocked).

The between-battles **Formation** screen now exists, and JP progression finally
*matters in battle*:

- **Roster screen** — a gallery of your cadets: face, name, current class +
  level, a glint badge on anyone holding unspent JP, and a "constellation trace"
  of the classes they've invested in. Filter by All / Has-JP / Physical /
  Magical / Hybrid; sort by Name / Level / Newest / Unspent JP.
- **Unit dossier → Constellation** — the class tree as a star-chart across three
  domains (Physical / Hybrid / Magical) and three altitudes (Horizon / Ascendant
  / Zenith). Each class is a star; brightness = JP invested; locked stars say
  what opens them. Tap a lit star to **reclass** into it (or train it).
- **Unit dossier → Training** — spend that class's JP to learn its components
  (actives, passives, and for Alchemist/Calculator their items / math
  parameters+values). Crossing a spend threshold **opens a whole new tier of
  classes** and grants them a starting JP head-start.
- **Unit dossier → Loadout** — choose a **secondary command** (from a class
  you've trained an active in) and slot your **Reaction / Support / Movement**
  passives. Your own class's passives are free to slot; passives carried from
  another class cost bucket space.

- **JP-gating is now LIVE in campaign battles.** A unit can only use abilities /
  items / math targeting it has **unlocked** — locked ones are greyed in the
  action menu / filtered from pickers. Starting units are pre-unlocked with the
  kit they already carry, so nothing you begin with is suddenly unusable; gating
  bites on anything you gain access to but haven't trained yet.

Reclassing rebinds a unit's primary command to the new class. XP/leveling
(shipped S81) is unchanged.

**The Formation screen is now reachable in the campaign** — on the world map
(between battles), a **"Manage Roster"** button opens the roster/dossier, where
reclass, JP-spend, and loadout changes apply to your real company and persist
into the next battle. (A pre-battle entry point is still to come.)

In the dossier: **changing a unit's class now lives on the Loadout tab** (a
"Class" section with the open classes) — clicking a star on the Constellation
just opens that class's Training page. **Reclassing now unequips the passives
that don't carry to the new class** (your old class's innate passives you never
exported), freeing those slots instead of leaving them stuck.

**Progression is now visible in battle.** A unit's detail panel shows its **XP
toward the next level** (`N / 100`), and the action log records the **XP and JP a
unit earned** for each connecting action as a collapsed ledger detail (turn on
"Show ledger" to see it) — for your own units.

**Enemies can now be authored with progression too** (levels + limited kits),
and they level up mid-battle like your units. First use: **River Ridge's opening
battle** — its garrison is now a tuned **Level 22** team (a rung below your Level
25 veterans), each enemy limited to a **basic two-ability kit** (no ultimates), so
the opener is a teaching fight rather than a wall. The finale that revisits River
Ridge keeps the tougher full-strength enemies. (Enemy tuning is data — expect it
to shift as the campaign's difficulty curve is authored.)

---

## Session 82 (2026-07-04) — Hunter MP costs (Scramble, Pin Down)

Two Hunter Marksmanship commands that had been shipping at **0 MP** now carry a
cost:

- **Scramble** — now **2 MP** (was free). A light tax so the ignore-jump-limit
  repositioning hop isn't a free every-turn reset.
- **Pin Down** — now **6 MP** (was free). The reliable no-damage Slow is a real
  action-economy swing, so it's now a resource to spend — the Hunter's 28 base MP
  funds roughly four pins a battle.

No change to either ability's effect, range, or hit formula — only the MP cost.

---

## Session 81 (2026-07-04) — TABA M2 XP & mid-battle level-up (ADR-0139)

**Player-facing (campaign mode).** Units now earn **XP** and **level up
mid-battle**, FFT-style:
- Each connecting action that has an effect earns the acting unit XP =
  **10 + (target's level − your level)** (minimum 1), **+10 for a KO**. Misses,
  reactions, and no-effect actions (healing a full-HP unit, re-applying a buff
  you already have) earn **nothing**.
- At **100 XP** a unit **levels up on the spot** — its stats grow and its current
  HP/MP jump by the increase (the action log shows "reached Level N!"). Leftover
  XP rolls over. Levels carry between battles.
- Only campaign units level (Mage War is unchanged). Enemies don't level yet.

(Mechanics depth: ADR-0139. The stat growth per level is the ADR-0137 curve.)

## Session 81 (2026-07-04) — TABA M2 JP progression substrate + costs (ADR-0138)

No player-facing changes. Built the JP economy under the hood: the per-class JP
ledger / unlock-token / class-tier tree, the per-action earning rule (actor +
1/8 roster spillover), the active-use gating *mechanism* (a per-unit allowlist
the engine consumes opaquely), and the real per-ability JP costs (~110, from the
budget doc). None of it is surfaced to the player yet — the gating masks (for both actives
and the Alchemist/Calculator combinator pickers) are built and enforced but not
stamped in play, and there's no reclass/spend UI; Mage War and the M0/M1 campaign
play byte-unchanged. Player-facing JP mechanics land once the fold stamps the
masks + the reclass/spend UI ships.

---

## Session 80 (2026-07-02) — per-class level→stat curves (ADR-0137)

Level now drives a **real per-class stat curve** for the five level-driven base
stats (PA, MA, HP, MP, Speed), replacing the old ±10%-HP/MP + ±1-dominant-stat
slot modifier. **At L25 every class is unchanged** (the curve is anchored to
today's stat block), so the tuning baseline is identical. The curves only diverge
*away* from L25.

Two things a guide reader should note:

- **Mage War's mages re-tune slightly.** The Knight (L25) is unchanged; the four
  mages deploy off-L25 and shift to the curve's values:
  - **Earth Mage** (L24): HP 101→**109**, MP 43→**47**, Speed 8→**7**.
  - **Fire Mage** (L26): HP 107→**100**, MP 53→**50**, PA 4→**5**, MA 13→**14**.
  - **Lightning Mage** (L23): HP 78→**83**, MP 43→**46**, Speed 9→**8**.
  - **Water Mage** (L27): HP 112→**108**, MP 53→**51**, PA 4→**5**, MA 13→**14**.
- **Team-builder units at non-baseline slots** (slots 1–4, which map to
  L24/26/23/27) shift the same way — a player building a team sees these curve
  values, not the old modifier's.

Curve shape, for the guide's stat section: PA/HP/MP grow **linearly**, MA grows
**quadratically and is uncapped** (a high-level mage's MA accelerates — by
design), and Speed grows to a **plateau at L50** and never exceeds it from base
growth (fast builds come from Haste/gear, not levels). Full per-class L1/L25/L50
tables are in ADR-0137 / the M2 brief.

---

## Session 79 (2026-07-01) — TABA campaign M1.5 (story scenes)

Commit: `c1dd956`. ADR-0135.

The campaign now weaves **story scenes** between and around battles. A node in
the campaign is no longer always "one battle" — it's an authored sequence, where
a battle is one kind of moment among others.

- **Story scenes before, after, and instead of battles.** You'll now read
  click-through dialogue (speaker portrait + lines) at several points:
  - a **pre-battle scene** before **River Ridge** (the opening march-out);
  - a **post-battle scene** after **Stonebridge** (the aftermath);
  - a **standalone story node, "The Crossing,"** on the southern route (via
    Marshmoor) — a scene with **no fight**, then onward to the finale.
- **A new stop on the world map.** "The Crossing" appears on the map between
  Marshmoor and The Return; the south route now passes through it.
- **Prose is placeholder.** The scenes are Ivalician-flavored filler spoken by
  your roster — the point this milestone proves is the *slots*, not the writing;
  real story is a later milestone (M5).
- **No mechanics changed.** No leveling, gear, or battle-rule changes — story
  scenes are narrative only. (Reloading mid-scene resumes you at the world map.)

## Session 78 (2026-06-30) — TABA campaign M1 (branching + world map)

Commit: `1009bb1`. ADR-0134.

Second TABA milestone: the campaign is now a **branching path** you navigate at a
**world map**, not a fixed two-battle line. Still no progression (leveling/gear
come later).

- **Branching campaign.** After winning a battle you choose your next
  destination at a **world map** — a stylized map showing your position and the
  routes open to you. The campaign is a forward path of battles that ends at a
  final "The Return" battle.
- **A real fork + an optional detour.** The opening battle (**River Ridge**)
  branches into two routes — **Stonebridge** (north) or **Marshmoor** (south).
  The Stonebridge route offers an **optional side battle** (**Mountain Pass**)
  you can take or skip; both ways rejoin the finale. (The map is a placeholder
  visual — structure over art, to be reskinned later.)
- **Post-battle result screen.** Winning a battle now shows a **result summary**
  — each deployed unit listed as **Survived / KO / Lost** — before the map. This
  is the same screen for a win, a loss (**Defeat**, with Retry), and the final
  **Campaign Complete** victory.
- **Losing** still lets you **retry the battle from your last save** (unchanged).
- **Autosave & resume:** the campaign autosaves **right after you win a battle**
  (as well as when you start the next one), so if you close the game after a win
  but before choosing your next destination, **Resume drops you back at the world
  map** — you won't have to re-fight the battle you already won. (Save note: the
  save format changed this milestone, so an **in-progress M0 campaign won't
  resume** — start a new campaign.)
- *Still not in the campaign:* leveling/XP, JP/ability unlocks, money/shops/gear,
  recruiting, story. The single-battle "New Battle" (Mage War) mode is unchanged.

## Session 77 (2026-06-29) — TABA campaign M0 (the spine slice)

Commits: `731c421` (design docs), `f0cbe9b` (Chunk 1), `44e44c0` (Chunk 2),
`382ac6d` (Chunk 3a), `13fe997` (Chunk 3b). ADR-0133.

First milestone of **TABA** ("There and Back Again"), the campaign mode: a unit
roster that persists across an authored sequence of battles. M0 is the minimal
two-battle vertical slice that proves the spine; progression, economy, the shop,
story, and branching are later milestones.

- **New: a campaign mode** reachable from the title screen — **New Campaign** and
  **Resume Campaign** (the latter enabled only when a save exists).
- **Two linear battles** (River Ridge → Stonebridge) fought by **one persistent
  company of 8 units**. The same units carry from battle to battle.
- **Formation screen:** before each battle, pick **up to 5 of your 8** units to
  deploy; the rest sit out. Then the normal deployment + battle play out.
- **Between battles:** survivors and the downed are **healed to full**; a unit
  that was permanently removed (crystallized) is **marked lost and can't be
  deployed again** (its record is kept). *Note: wounds do not yet carry between
  battles in M0 — everyone is healed.*
- **Save/resume:** the campaign **autosaves between battles** (one slot); Resume
  Campaign continues it. **Losing a battle** lets you **retry it from your last
  save** (the failed attempt is discarded) or quit to the title.
- **Win both battles** → a campaign-complete screen.
- *Not yet in the campaign:* leveling/XP, JP/ability unlocks, money/shops/gear
  changes, recruiting, story, and branching paths. Units fight at a fixed level
  with their authored loadouts. The single-battle "New Battle" (Mage War) mode is
  unchanged.

## Session 76 (2026-06-28)

- **New class: the Monk** (14th class, 6th physical) — a barehanded, PA-scaling,
  stance-dancing martial artist with self-sustain and a grapple-throw. Squares
  the roster to 6 physical / 6 magical (+2 hybrids).
  - **Stats:** HP 190 / MP 26 / PA 9 / MA 4 / Speed 10, Move 3 / Jump 3, evasion
    11/8/3 (the highest base in the roster). **Gear: Universal Head + Accessory
    only — NO body armor, NO off-hand, NO weapon.** HP reads high but nets only
    ~210 effective (no body slot to stack) — an evasion-and-sustain bruiser, not
    an HP wall. Near-hard-counters physical; genuinely fragile to magic.
  - **PA is the monostat:** it drives damage, evasion (Vigilance), and the
    counter (Counterpunch).
  - **Innate passives** (free, one per bucket): **Counterpunch** (Reaction — on
    an adjacent non-healing physical hit, swing back for PA×4 with a PA-scaled
    chance to knock the attacker back 1; ranged/magic don't trigger it),
    **Barehanded** (Support — while both hands are empty, Weapon Power = PA, so
    the basic Attack punch hits for **PA²**), **Vigilance** (Movement — raises
    evasion on **all** facings, including the back, by half your PA → anti-flank).
  - **Command set: Martial Arts** — **Chakra** (heal HP **and** restore MP for
    yourself + a 1-diamond, PA-scaled, no Faith, never crits; clears your stance
    to neutral — the heal-but-expose tradeoff; friendly-fire AoE like Cure) plus
    the four elemental **Fists**, each `PA × coefficient`, element-tagged
    (reduced by the target's resistance in that element; absorbed if they resist
    it past 100), each setting a **stance** and carrying a rider:
    - **Foxfire** → **Fox Stance** (+50 Fire / −50 Earth), 50% Burn (lands via
      PA+Brave).
    - **Bear's Heave** → **Bear Stance** (+50 Earth / −50 Lightning) — a
      **grapple-throw**: grab an adjacent unit (enemy or ally) and place it on
      any tile within 2; 0 direct damage, but a ledge drop deals unmitigated
      falling damage. Throw enemies onto hazards / off ledges, or reposition allies.
    - **Storm Stoop** → **Falcon Stance** (+50 Lightning / −50 Water) — a 3-tile
      line attack.
    - **Serpent's Coil** → **Serpent Stance** (+50 Water / −50 Fire) — refunds
      Speed×2 CT on a hit (your next turn comes sooner).
  - **Stances are mutually exclusive:** a new Fist replaces the prior stance;
    Chakra clears to neutral. The basic punch sets **no** stance — so the harder
    a Monk leans on the PA² punch for raw damage, the more magic-exposed it is.
    The Monk's only elemental resistance is its active stance + a resistance head.
  - **The PA² punch is uncapped by design** — melee-committal and self-punishing
    (no stance up while punching), countered by magic and by kiting it down.
- _(Tuning note: the Monk's coefficients — Fist power, Chakra magnitude, Burn
  rate, CT-refund, Vigilance evasion — are starting values and may shift after
  playtest.)_

---

## Session 75 (2026-06-27)

- **Stop now disables reactions, not just turns.** A **Stopped** unit no longer
  fires **any** reaction — **Counter**, **Damage Split**, **Discharge**, **Tidal
  Pull**, **Smolder**, **Earth Resilience**, etc. are all suppressed for the
  duration of Stop. Previously a Stopped unit skipped its turn but still reacted
  normally when attacked. Stop is now a full "frozen in time" lockdown.
  - **Contrast with Don't Act:** Don't Act still **allows** reactions (you can't
    *plan* to act, but reflexes happen). Stop suppresses them. If you want to
    shut down an enemy's Counter/Damage Split, Stop does it; Don't Act does not.
  - ADR-0131.
- **New bundled team: "T-Munny"** in the builder's "Load Default" picker
  (alongside Gravity Well, High Ground, Mage War, Chain Reaction, The
  Irregulars, Claude's Bulwark, Claude's Answers). Knight / Thief / Enchanter /
  Templar / Water Mage — a sustain-and-control roster (team-wide Damage Split,
  Speed/Resistance Saves, Earth Communion + Flow State + Short Charge spine).
- **Target highlights now reflect intent by color.** When you pick an ability,
  the valid-target tiles are tinted by what the ability *does*:
  - **Green** — beneficial: heals, **revives (Raise)**, and **buffs** cast on
    allies (Protect / Shell / Haste / etc.). Buffs used to highlight **red**,
    which wrongly read as a hostile aim.
  - **Magenta** — offensive: damage and debuff casts. (Damage targets were red,
    which clashed with Team B's red — a highlight read as team color, not aim.)
  - **Amber** — neutral/utility: Math Skill previews, Barrier placement, and
    other casts that aren't clearly helpful or harmful.
- **New equipment: Twist Headband** (headgear). Universal — any class can equip
  it. **+10 Max HP, +2 PA.** A generically-useful martial head option with no
  class restriction.
- **Revive abilities now highlight KO'd allies.** **Raise** (and Phoenix Down)
  now show downed allies as valid targets when you're aiming them. Previously
  Raise highlighted nothing — KO'd units were filtered out of every target
  preview, so the one thing Raise can target was invisible.

_(Also this session, not player-facing: a test/debug-only headless both-AI
battle runner + action-log inspection seam for AI feel-verification, ADR-0130;
and the team-export tool now preserves hand-set unit genders.)_

---

## Session 74 (2026-06-25)

### Four new caster accessories (2026-06-26)

Commits `9ac8a49` (Greaves), `126f72d` (Ring), `352c014` (Glove), `981e065`
(Pendant). All four are **accessories** (any class may equip; unique-per-team by
the usual catalog rule). ADRs 0125–0128.

- **Greaves of Seraphis** — Speed +2, and the wearer **starts the battle acting
  first** (begins at maximum CT). One guaranteed opener per battle.
- **Ring of Caliora** — MA +2, and the wearer's damaging **spells** also drain
  the target's CT by **20% of the damage dealt** (pushing the target's next turn
  later). Spell damage only; no effect from weapon hits. On a Calculator's
  field-wide Math Skill this drains CT off every matched enemy at once.
- **Glove of Metria** — MA +1, and the wearer's spells gain **+1 Spell Power for
  each target beyond the first** (a 3-target cast is +2 SP, a 5-target cast +4).
  Applies to AoE spells **and** field-wide Math Skill — casting wide hits harder.
- **Pendant of Lumara** — MA +2, and **Burn the wearer applies deals double
  damage per stack**. Fire resistance still reduces the (doubled) Burn ticks.

### Two new bundled teams + Charged Attack retargeting (2026-06-25)

Two new bundled teams in the builder's "Load Default" picker (alongside Gravity
Well, High Ground, Mage War, Chain Reaction, The Irregulars):

- **"Claude's Bulwark"** — Enchanter / Knight / Templar / Earth Mage / Alchemist.
  A sustain-and-buff bulwark (uniform Damage Split + Earth Communion, heavy
  support spine).
- **"Claude's Answers"** — Hunter / Lightning Mage / Knight / Assassin /
  Calculator. An offense-focused counter to the Bulwark (burst / reach / tempo,
  no dedicated healer).

Default teams are convenience presets built from existing content, not new
mechanics — noted only so the picker's roster stays accurate if the guide lists
the bundled teams.

### Charged Attack is now a tile-targeted aimed shot

- **Charged Attack (Hunter, Marksmanship) now commits to a tile, not a unit.**
  You pick the tile the target is standing on; the shot resolves after the
  charge and hits **whoever is on that tile at resolution** — so if the target
  **moves off the tile before it resolves, the attack misses**. Previously it
  could pin the unit and follow it (guaranteed hit even if the target moved).
- **Player takeaway:** Charged Attack is now a positional gamble — lead the
  target or fire when they're pinned/committed, because a mobile target can
  step out of it. (Other charged spells still track their target as before;
  this change is specific to Charged Attack.)
- The enemy AI also aims Charged Attack at a tile now, so it can whiff if you
  move the targeted unit during the charge.

### Buff forms no longer stack with their cast versions

- **The "always-on" equipment buffs and their spell versions no longer
  compound.** Haste, Protect, Shell, and Regen each come in two forms — a
  permanent one from gear (Boots of Haste, Defender, Sorcerer's Robe,
  Tintinibar) and a timed one from a spell (the Enchanter's Auramancy Haste /
  Protect / Shell, the Geosage's Life from the Loam). Previously a unit could
  hold **both** and get the effect twice (e.g. Boots of Haste + cast Haste →
  ~×2.25 Speed instead of ×1.5).
- **Now only one applies at a time.** If a unit already has the gear form,
  casting the spell version on it does nothing to that unit (the cast still
  buffs other allies in its area). So you can't double up Haste/Protect/Shell/
  Regen on one unit anymore.
- **Player takeaway:** put your buff spells on allies who *don't* already carry
  the equipment form — doubling no longer pays off. A Boots-of-Haste user is
  already Hasted; spend the cast elsewhere.

## Session 73 (2026-06-23)

_No player-facing changes._ AI-only tuning (ADR-0123): the AI no longer loops on
self-restoring MP it doesn't need (a low-MP Alchemist now advances instead of
re-brewing Ether), and a team with an Enchanter advances grouped so Auramancy
lands on more allies. No game rule, content, or UX changed.

## Session 72 follow-up — Aura Mastery (new Enchanter Support) (2026-06-22)

Commits: `f4b08a3`. ADR-0122.

- **New Support: Aura Mastery** — the Enchanter's second native Support (free for
  the Enchanter; costs 1 for any class that equips it). **The buffs you *cast*
  land ~33% stronger.** It deepens: Haste, Protect, Shell (the Enchanter's
  Auramancy), **Regen** (the Geosage's Life from the Loam), **Engineered
  Defenses** (the Calculator), and the **Crit boost** from Static Embrace.
  - Concretely at the default: Protect/Shell go from halving damage to cutting
    ~⅔ of it; Haste goes from ×1.5 to ~×1.67 Speed; Regen / Engineered Defenses /
    Crit Modifier all land ~33% bigger.
  - **Only your spell-cast buffs.** Buffs granted by equipment (Boots of Haste,
    Sorcerer's Robe, the Circlet, etc.) and flat stat boosts (PA/MA/Move/Jump Up,
    the on-hit "Save" buffs) are **not** affected.
  - With Support capacity 3, an Enchanter can run **Short Charge *and* Aura
    Mastery** together — faster *and* stronger auras.

## Session 72 follow-up — Protect & Shell now halve damage (2026-06-22)

Commits: `d06ff4e` (with shared-hook refactor `4456778` underneath). ADR-0121.
Affects **every** source of Protect/Shell (the Enchanter's casts, Defender's
Auto-Protect, Sorcerer's Robe's Auto-Shell).

- **Protect and Shell now multiply incoming damage by ×0.5** rather than adding
  +50 resistance. Protect halves incoming **physical** damage; Shell halves
  incoming **magical** damage — applied *after* your resistances set the rate.
  - **What changes in practice:** they now **stack with your resistances** instead
    of competing with them. Before, Shell's +50 only mattered if it beat your
    element resistance (they didn't add up); now a resistant unit *and* Shell is
    reliably tankier — e.g. a Geosage (fire-weak) hit by a 150 fire spell now
    takes **75** with Shell (the weakness halved), where it previously dropped to
    50 by overriding the weakness.
  - **They don't reduce magic/physical you absorb.** If you've stacked resistance
    past 100 so an element *heals* you, Protect/Shell leave that healing intact —
    they only cut damage, never your absorption.
  - Shell no longer contributes to *reaching* absorption (it's not a resistance
    number anymore); absorption still comes from resistance gear like the
    Capacitor Ring.

## Session 72 — Enchanter (new class) (2026-06-22)

Commits: `75543ad` (chunk 1 — Auramancy actives), `32f2990` (chunk 2 — RSM),
`4c84126` (chunk 3 — class wiring). See ADR-0120.

- **New class: the Enchanter** — the dedicated ally-buff caster (13th class, 6th
  magical; flavored portrait the Enchantress). Stat line: HP 103 / MP 40 / PA 3 /
  MA 10 / Speed 10, Move 3 / Jump 2, Evade 6/4/0. Wears universal + mage gear.
  Selectable in the Team Builder and deployable on every map. Auramancy is its
  First Action set; **its offense has to come from a secondary command set** —
  on its own it buffs and basic-attacks.
- **Auramancy (4 abilities)** — all charged, area-of-effect (a 1-square diamond),
  and **friendly-fire-on** (the diamond also catches the caster and any enemy
  standing in it — place it on your own cluster):
  - **Haste / Protect / Shell** — apply Haste (Speed ×1.5), Protect (half
    incoming physical), or Shell (half incoming magical) to everyone in the area
    for several turns. ~90% to land on a normal-Faith ally; the chance **rises
    with the caster's MA and falls on low-Faith allies** (a faithless ally is
    pointedly harder to buff). MP 10 / 8 / 8.
  - **Esuna** — cleanses ailments (Poison, Blind, Silence, Stop, Don't Act/Move,
    Slow, Burn…) from everyone in the area. Always works, ignores Faith. Leaves
    committed stat-downs (PA/MA Down, etc.) alone — same set Remedy cures. MP 8.
- **These cast buffs are stealable** — a Thief's Steal Buffs can lift a Haste /
  Protect / Shell the Enchanter cast right off the target.
- **R/S/M kit:**
  - **Resistance Save** (Reaction) — on taking magical damage, permanently gain
    +10 to every elemental resistance (earth/water/fire/lightning). Stacks all
    battle, uncapped, persists through KO.
  - **Short Charge** (Support) — all your charged spells resolve ~33% sooner.
    Works on any class's charged abilities; instants are unaffected.
  - **Float** (Movement, revived) — cross shallow **and** deep water at no extra
    move cost, and take **no fall damage** (knockback off a ledge, a tile
    collapsing). No flight / elevation change.
- **Note for existing classes:** Short Charge and Float are equippable by other
  classes too (Short Charge speeds any charged kit; Float is a strong
  water-map / anti-knockback Movement option).

## Session 71 follow-up — Gender visible in battle (2026-06-20)

- **A unit's gender now shows in battle**, not just on its portrait. The unit
  detail panel (click a unit) spells it out on the identity line — e.g. "L23
  Aethurge · ♂ Male · Team …" — and the turn-queue mini-cards show a small ♀/♂
  next to the class. Gender gates Steal Heart (charm only crosses Male ↔ Female),
  so it's now readable for planning charms without inspecting portraits.

## Session 71 follow-up — Team Builder levels are now fixed per slot (2026-06-20)

See ADR-0087 (S71 amendment).

- **Each roster slot now has a fixed level** — Slot 1 = L25, Slot 2 = L24, Slot 3
  = L26, Slot 4 = L23, Slot 5 = L27 — shown correctly from the start and on every
  slot, filled or empty. Previously the levels were assigned by a unit's *rank
  among your filled units* (so the pills shifted as you filled the team and only
  settled once it was full). A unit now takes its slot's level regardless of how
  many other slots are filled or in what order.
- **Consequence for teams under 5 units:** because level follows the slot, *where*
  you place a unit now sets its level. A 3-unit team in slots 1/3/5 is L25/26/27
  (it used to be L25/24/26 wherever you placed them); leaving Slot 1 empty means
  no L25 unit. Full 5-unit teams are unchanged.

Two small bug fixes from a playtest report.

- **Throw Item targeting fixed.** Picking a target with Throw Item now works
  whenever *any* item you're carrying can legally be thrown there — previously it
  silently cancelled back to the menu if the *first* item in your bag happened to
  be incompatible with that target. The concrete case: a full-HP unit holding a
  Phoenix Down (which can only be thrown at a KO'd unit) but no Potion couldn't
  target itself, even though it had a Remedy / Ether it could throw. Now the item
  picker also greys out items that can't be thrown at the chosen target (e.g.
  Phoenix Down on a living unit) with the reason, instead of letting you pick a
  dud. Throw Item is also disabled outright (with a "Compound first" hint) when
  your bag is empty. **KO'd allies now light up as Throw targets** when you're
  carrying a Phoenix Down (they were previously not highlighted, so reviving by
  throw wasn't discoverable).
- **The battle-end summary's turn number now matches the action log.** "Battle
  ended on turn T####" previously counted only unit turns and ignored
  charged-spell resolutions (which each get their own T-number in the log), so the
  two disagreed in any fight with a charged spell. Both now use the same count.

## Session 71 follow-up — Math Skill status applications drop Faith (2026-06-19)

See ADR-0119 (Update). Extends the #15 Faith sweep to the Calculator's status
applications — they were the one place Math Skill still leaned on Faith.

- **Math Skill statuses no longer scale with Faith** — they scale with the
  Calculator's MA only, like the rest of the kit. Base chances were lowered to
  keep the landing rates roughly where they were: **Precision Fire's Burn 50→25%**,
  **Sculpted Enhancement's PA/MA Up 50→25%**, **Engineered Defenses 80→40%**. Net
  effect at a typical Calculator (MA 9): about the same odds as before (~45% /
  ~45% / ~72%), but now independent of either side's Faith — and they get more
  reliable as the Calculator's MA grows. (Tuning watch item; numbers may shift.)

## Session 71 — Behavior audits & fixes (chunk 2) (2026-06-19)

Commits: `76d6f32`. See ADR-0119. Two behavior fixes from the new-player
playtest; the rest of the chunk-2 findings audited as already-correct (no change).

- **Templar Jump now uses up your Move for the turn.** Committing Jump (the
  charged Dragoon leap) forfeits your Move — you can't Jump and then also walk in
  the same turn. (It doesn't make the turn cost more CT; it just blocks the second
  mobility action.)
- **Exact Rhythm (Math Skill) hits ~2× harder.** Its CT push no longer scales with
  Faith — magnitude is now `SP × MA`, matching Precision Fire and Targeted
  Treatment. The Calculator's Math Skill output is meant to be a faith-independent
  instrument; Exact Rhythm was the last one still faith-scaled.
- **No change (audited, already correct):** Bull Rush and the other Knight Battle
  Skills are already melee-only; Rasp Pendant already drains MP only on direct
  attacks/ability damage (not DoTs/reflect/fall); Worldcraft still doesn't trigger
  Flow State's CT refund (by design); Ignition already applies Burn on *any*
  magical damage (its tooltip was fixed in chunk 1).

## Session 71 — Legibility & polish (chunk 1) (2026-06-19)

Commits: `5cf3d3b`. New-player legibility batch — tooltip corrections,
Team Builder affordances, targeting recolor. No mechanics changed; the audit
found the underlying behaviors were already correct, so these are *what the
player sees*, not *what the game does*.

- **Tooltip corrections** (the text was stale or missing; the mechanics were
  already as described below):
  - **Damage Split** now reads "reflect **half** the damage back and heal
    yourself for the other half" (it never reflected the full amount — old text).
  - **Tidal Pull** rewritten from the mechanic: "on taking a non-healing hit,
    gain **+20 CT** — your next turn comes sooner." It pulls *your* turn forward,
    not the enemy toward you (the old "pull" wording misled).
  - **Ignition** now reads "on dealing magical damage of **any** element (not
    just fire), apply 1 Burn." (It always fired on any magical damage — the
    "fire-tagged casts" wording was the bug.)
  - **Spiked Mail** now lists its retaliation: "on taking physical damage,
    reflect 20% back at the attacker."
  - **Wand of Potential** now lists its "+1 Spell Power on lightning casts."
  - **Wand Resonances** (all four wands) now name the resistance shift each
    applies on hit and its direction — Depths +25 fire/−25 lightning, Deepwood
    +25 lightning/−25 fire, Lumen +25 earth/−25 water, Potential +25 water/−25
    earth.
- **Team Builder legibility:**
  - **Empty unit slots now show the level** a unit placed there would receive
    (muted), so you can see a slot's level before committing a unit.
  - **Your chosen class's own active skills** now appear: the class's First
    Action command set is pinned at the top of the Command sets list (tagged
    "Class") and hoverable for its full detail — previously only the *secondary*
    command-set options were inspectable.
  - **Gender now shows on every roster card** (e.g. "Pyromancer · ♀ Female"), and
    the gender toggle's tooltip notes it gates **Steal Heart** (charm only crosses
    Male ↔ Female) — so you can plan charm builds without guessing.
- **Targeting color:** Math Skill target previews (and the Barrier line picker)
  now paint matched tiles in a distinct **amber** instead of red. Red read as
  "Red Team," which was misleading for Math Skill — it matches by formula and can
  land on your own units. Single-target attack targeting (always an enemy) stays
  red.

## Session 70 — Mountain Pass map + split deployment zones (2026-06-19)

Commits: `fec6b0e`, `6cce2b5`, `0b8d238`. See ADR-0118.

- **New map: Mountain Pass** (16×16). A narrow NW→SE pass — a broad low NW
  valley, a central low spine, and a tight SE defile walled by the bottom-center
  massif and the rising NE ridge. Selectable on the battle-setup screen alongside
  River Ridge, Stonebridge, and Marshmoor.
- **Split deployment zones.** A side's deployment area can now be **two (or more)
  separate regions**, each with its own **unit cap**. Mountain Pass uses this for
  an ambush layout: one side (the *victim*) deploys as a single block in the NW
  valley; the other (the *ambusher*) splits across two SE-heights positions
  flanking the defile — **up to 3 units on the SW massif and up to 2 on the NE
  edge**.
- **Deployment UX for caps.** When placing into a capped split zone, once a
  sub-zone is full its remaining tiles **dim and stop accepting units** — place
  the rest in the other sub-zone. (The existing three maps are unchanged: each is
  a single uncapped zone per side, so nothing about deploying on them changes.)

## Session 69 follow-up — terrain blocks sight; mountains block lobs (2026-06-17)

Line-of-sight now respects terrain elevation. See ADR-0117.

- **Hills and raised ground now block straight-line spells.** The seven
  line-of-sight spells (Lightning Bolt, Scorch, Water Lash, Megavolt, Chain
  Lightning, Fireball, Flame Lance) are blocked when a tile's terrain rises
  above the line between caster and target — not just by barriers, but by the
  **ground itself**. Previously a straight-line shot passed through any hill
  (you could fire through a mountain); now a hump between you and your target
  breaks the shot.
  - A **level shot across flat ground** and a shot that **rides a smooth slope**
    still connect — only terrain that rises *above* your sightline blocks.
  - **Height beats cover:** standing higher (earned high ground, or a Hunter's
    Vantage +2) raises your sightline so you can see *over* a ridge a
    ground-level caster can't. To see over a hump into a pit behind it, you need
    enough height to clear the crest.
- **Bows still lob over cover — but not over mountains.** Bow shots (and other
  arcing/lobbed attacks — Rock Toss, Earthquake, Cataclysm, Tidal Wave,
  Maelstrom, Discharge Strike) still arc over walls and low humps as before, but
  an obstacle that rises **more than 5 elevation above the higher of you and your
  target** now blocks the lob. Walls and buildings: still cleared. A genuine
  mountain: blocked. (5 is the same height delta at which a bow's damage already
  falls to zero.)
- **Player takeaway:** on elevation-rich maps, terrain is now real cover against
  line-of-sight spells, and the high ground lets you shoot over it. Bows keep
  their reach over ordinary cover but can't lob over a peak.

---

## Session 69 — AI self-state valuation (2026-06-17)

_No player-facing changes._ (AI scoring only — the enemy AI now values
charming/freeing units, stealing buffs, and field-wide kills; no game rule,
content, or UX changed. ADR-0116.)

---

## Session 68 — bow accuracy/power pass (2026-06-17)

Commits: `e9144f5`.

Both bows buffed, to lift the Hunter out of being the lowest-output build (a
damage-over-time re-analysis with the new stats + Vantage confirmed it was
accuracy-starved and far behind on raw damage):

- **Longbow** — accuracy **33 → 40**, weapon power **7 → 9**.
- **Riptide Bow** — accuracy **33 → 40**, weapon power **5 → 7**.

The accuracy bump fixes the bow's real bottleneck (reliability) at every range;
the power bump pays off **earned high ground** — a Hunter shooting from a height
(naturally seized or built by a Terraformer), especially with **Vantage**, now
out-damages a Knight, while a Hunter on flat ground still sits well below the
front-line classes. Taking the high ground is now a concrete tactical payoff.

## Session 68 — Vantage (Hunter Support) (2026-06-17)

Commits: `eaf115c`. New ability. See ADR-0115.

- **Vantage** (Support, **free on the Hunter**, costs 1 for other classes) —
  your **attacks resolve as if you stood 2 tiles higher** than you actually
  stand. It's purely offensive and applies only to *your own* attacks; it
  never changes how high you count when you're the target, and it doesn't
  affect movement, Calculator height math, or area effects. Concretely it
  improves four things when you attack: the downhill **damage bonus** on bows
  (height-based variance), the **high-ground accuracy** bonus (you count as
  "higher" more often), a bow's **range-from-height**, and **line of sight** —
  you can shoot over cover (including a Terraformer's **Barrier**) that would
  otherwise block the shot. Because only bows scale damage/range with height,
  Vantage is shaped for archers, but any straight-line attacker can use the
  shoot-over-cover effect — e.g. an **Aethurge** clearing a Barrier wall with
  Lightning Bolt. (Starting value is deliberately strong and may be tuned down.)

## Session 68 — tuning & dual-wield fix (2026-06-17)

Commits: `b511733` (Knight/Hunter tuning), `fcc5ec8` (dual-wield fix).
Balance tuning and a dual-wield correctness fix. See ADR-0114 for the fix.

- **Dual-wield now uses each weapon's own accuracy and damage variance.**
  Previously, when wielding two different weapons (Two Weapons), *both*
  swings borrowed the main-hand weapon's accuracy and variance while still
  using each hand's own weapon power. That let you pair, say, a high-accuracy
  main weapon with a heavy low-accuracy off-hand and have the off-hand swing
  inherit the good accuracy. Now each swing is self-contained: the off-hand
  swing uses the off-hand weapon's accuracy and variance. **Matched pairs
  (two of the same weapon type) are unaffected.**
- **Knight base Speed 9 → 8.** The Knight acts slightly less often — a
  counterweight to its uniquely broad equipment access (off-hand, head, and
  body options most classes lack), and to set it apart as the slow, heavily-
  armored bruiser.
- **Hunter rebalanced into a PA/Speed middle ground.** PA 6 → 7, Speed 9 →
  10, MA 3 → 5. The Hunter is now faster than the Knight and hits a bit
  harder, sitting between the Knight (power) and Assassin (speed). The MA
  bump makes the Hunter a better fit than the Knight for a magic-leaning
  secondary command set.

_Guide impact (this session's four S68 entries together):_ the **Hunter class
spread** is the big one — refreshed stat block, a new native Support (Vantage),
buffed bows, and a sharpened identity (the mobile **high-ground specialist**
whose damage is earned through positioning) — its role prose likely wants a
review, not just a stat refresh. The **Knight spread** needs its stat block
(Speed 8) and a light "slowest, most heavily-equipped bruiser" framing. The
**Armory** gains four pieces (Vicious Dagger, Scimitar, Wand of Potential,
Gauntlet of Might) and the two bows' new numbers. The **Two Weapons / dual-wield
mechanics** note should reflect per-weapon accuracy & variance.

## Session 68 (2026-06-16)

Commits: `0078713`. Four new requisition pieces enter the armory (all
unique-per-team, like the rest of the gear). See ADR-0113 for the new Spell
Power mechanic.

- **Vicious Dagger** (Knife) — WP 5, 95% accuracy, and **+25% critical-hit
  chance** for its wielder. The crit bonus is per-unit (it applies to *every*
  hit the wielder lands, including the off-hand swing under Two Weapons) and
  **stacks** with the base 5%, the Arcane Lens (+10%), and Static Embrace's
  Crit Modifier. The crit anchor of the knife family.
- **Scimitar** (Sword) — WP 7, 95% accuracy, **Speed +1**. A sidegrade to the
  Longsword: one point less weapon power in exchange for tempo. The Longsword
  still hits harder per swing.
- **Wand of Potential** (Wand) — WP 2, 90% accuracy. Two effects: on every
  basic hit it applies a **Resonance** that makes the target **+25% resistant
  to Water and −25% resistant (more vulnerable) to Earth** (completing the
  four-wand elemental rotation), and it grants its holder **+1 Spell Power on
  lightning-tagged magic** — e.g. Lightning Bolt's power rises from 12 to 13
  (~+8% damage), Bolt from 5 to 6 (~+20%). The Spell Power bonus applies only
  to the holder's own lightning *spells* (not physical lightning attacks, not
  other elements, not allies). The Aethurge's natural sidearm.
- **Gauntlet of Might** (Accessory) — **PA +3.** A potent, contested boost to
  every physical-power effect; the unique-per-team rule means only one unit can
  wear it.

---

## Playtest fixes (2026-06-15)

- **Raise (Templar) and Phoenix Down are now KO-only.** Neither can be used on a
  living ally as a heal — both target only KO'd units, to revive them. (The
  post-revive heal is unchanged.) Use Cure / Potion / Regen to heal the living.
- **Steal Heart targeting fixed.** It now correctly offers opposite-gender
  targets even for units whose gender was never explicitly set in the team
  builder (they use the class's default gender — the one the portrait shows).
- **Steal Buffs / Steal Heart now show a connect % in the forecast** when you
  aim them, like other contested abilities. (Reminder: Steal Buffs can't take a
  buff that comes from equipment, such as a Defender's Protect — only buffs that
  were cast on the target transfer.)

---

## Thief session — follow-up tweaks (2026-06-15)

- **Pin Down (Hunter) now derives its range from the equipped bow** — and, with
  that, picks up the bow's **high-ground range bonus** it previously lacked. A
  Hunter shooting Pin Down from higher elevation now reaches farther (same
  rule as a regular bow shot). With the current bows the base range is
  unchanged (2–5); the new part is the elevation reach.
- **Steal MP (Thief)** likewise uses the equipped weapon's range now (see the
  chunk-1 entry below) — both fixes route through the same weapon-delivery
  path.

---

## Thief session — chunk 2: Steal Heart (2026-06-15)

The Thief's capstone. See ADR-0111 for mechanics.

- **Steal Heart** (Thievery, 24 MP) — the biggest swing in the game.
  **Charms** a target for 3 turns: while charmed, the target acts on the
  Thief's side (you pick its moves). On paper it's still an enemy — it counts
  for its own team's win/loss, and its old allies still treat it as a friend
  (so you mostly use the puppet to attack its own side).
  - **Gender-gated:** targets the opposite gender only (Male ↔ Female).
  - **Hard to land:** a Brave/PA contest at base 10% — ~31% with no setup,
    ~48% fully equipped, higher if you've dropped the target's Brave first.
    Capped at 95%, never guaranteed. A set-up-or-don't-bother capstone.
  - **Fragile:** any *attack* damage the charmed unit takes has a 50% chance
    to snap the charm early (damage-over-time ticks don't).
  - **No chaining:** after a charm ends, the target is briefly immune to being
    re-charmed; and at 24 MP against a 28-MP bar, you can't spam it.
  - Charming the last living enemy does **not** win the battle — the charm is
    temporary.

---

## Thief session — chunk 1 (2026-06-14)

New class: the **Thief** (12th class, 5th physical). See ADR-0110 for mechanics.

- **New class — Thief.** A fast, slippery skirmisher built around resource
  theft. Stats: HP 90 / MP 28 / PA 7 / MA 3 / Speed 11, Move 3 / Jump 3,
  evasion 8 / 4 / 0 (front/side/back), universal gear. PA is its everything-
  stat. First Action set is **Thievery**.
- **Thievery (actives):**
  - **Steal HP** (5 MP) — a melee weapon strike for 75% of a normal attack's
    damage that heals the Thief for 50% of the damage dealt. Evadable.
  - **Steal MP** (3 MP) — a weapon strike that drains PA×3 MP from the target
    and restores half of the MP actually removed to the Thief. Uses the
    equipped weapon's range (adjacent with a melee weapon, 2–5 with a bow).
    Evadable; the refuel scales with what the target actually had to give.
  - **Steal Buffs** (4 MP) — a ranged (line-of-sight) theft that, on a Brave/PA
    contest, strips every buff off the target and applies them all to the
    Thief. Doesn't take debuffs, Stop, or charging states.
- **Thief native passives (free on the Thief; available to others at cost):**
  - **Slip Free** (Reaction, 1) — when a timed debuff (Stop, Slow, …) is
    applied to the Thief, it shrugs off one turn of the duration; a 1-turn
    debuff is shrugged off entirely. Brave-gated (higher Brave = fires more
    often).
  - **Momentum** (Support, 1) — refunds a little CT after any non-magical
    action, the basic Attack included (the inverse of the Water Mage's Flow
    State). Move and Wait don't refund.
  - **Move +2** (Movement, 2) — +2 to Move Range (the Thief reaches effective
    Move 5).
- **Not yet:** the charm capstone (Steal Heart) — shipped in chunk 2 (entry
  above); the Thief isn't in the default playtest teams yet.

---

## Session 66 (2026-06-14)

_No player-facing changes._ AI-only work (ADR-0109): the AI now values
knock-into-hazard fall damage, conserves MP when low (scarcity-scaled spend
penalty), and places units by role at deployment (melee front, ranged/casters
back). Mechanics, content, and player-visible UX are unchanged.

---

## Session 65 (2026-06-13)

Commits: Barrier darts; Bull Rush + PA_factor; equipment + MP economy. See
ADR-0108.

- **The Knight loses Taunt and gains Bull Rush.** Bull Rush is a normal weapon
  strike (same damage as Attack, 6 MP) that, on hit, has a **high chance to knock
  the target back one tile** — enough to shove an enemy off a ledge or into a
  Pit/Valley for fall damage. The knockback chance scales with the Knight's Brave
  and PA; a high-Brave target resists being shoved. (Taunt is gone from the
  Knight's kit but still exists for other uses.)
- **Lightning Stab's Silence now scales with PA instead of MA — and lands more
  often.** Because a Knight's PA is much higher than its MA, the same ability now
  silences a target meaningfully more reliably (roughly half the time on a typical
  hit, up from about a third). It's now a solid anti-mage tool, and its Silence
  and Bull Rush's knockback rates rise together with PA-boosting gear.
- **The Assassin's ranged darts now require line of sight.** **Blowdart**,
  **Shadow Stitch**, **Undermine**, and **Sow Doubt** changed from arcing to
  straight-line — a wall, a unit, or a Terraformer's **Barrier** between you and
  the target now **blocks the dart**. Positioning behind cover defends against the
  Assassin's poison/Stop/Brave-drain/Faith-drain pressure for the first time.
- **Three new equipment pieces:**
  - **Circlet** (mage head): HP +10, MP +10, and **regenerates MA ÷ 2 MP each
    turn**. A sustain option for the tighter MP economy below.
  - **Barbut** (heavy head; Knight / Templar): HP +30, and **halves the chance of
    incoming Stop / Don't Move / Don't Act**. A counter to disable-heavy enemies.
  - **Battlemage's Chain** (heavy body; Knight / Templar): HP +80, MP +10, MA +1
    — a durable hybrid body sharing the Knight/Templar heavy-armor slot, aimed at
    the Templar's martial-caster build.
- **MP rebaseline (caster classes have less MP):** the four elemental mages —
  **Geosage, Hydrologist, Pyromancer, Aethurge** — drop from 60 to **48** base
  MP, and the **Calculator** from 47 to **37**. The **Terraformer stays at 35**;
  martial classes are unchanged. MP is now a resource to manage, not an
  afterthought — the Circlet, Thoughtful Pacing, Ethers, and the Rasp Pendant are
  now real sustain choices.

### Playtest fixes (same session)

- **Jumping now dodges an in-flight charged action aimed at you.** If a charged
  spell (enemy *or* ally) was already locked onto a unit and that unit Jumps
  before the spell goes off, the spell now misses it — Jump takes the unit off
  the battlefield for real. (Previously the charge still landed on the airborne
  unit.)
- **Cure's area is now a diamond.** At its base size it's the same 5 tiles as
  before, but when boosted by Aether Bloom it grows into a full diamond (13 tiles)
  instead of a thin cross (9) — matching the elemental area spells.
- **Polearm/Lance attacks now reach high or low targets correctly.** A piercing
  weapon attacking a target within its vertical range but at a large elevation
  difference was silently connecting with nobody (the attack happened but dealt no
  damage). It now strikes the target as its range allows.

## Dual-wield reach is now per-weapon (2026-06-12)

Commit: `87e57a4` (per-swing range gating). See ADR-0107.

- **In a dual-wield attack, each weapon only hits if the target is in THAT
  weapon's range.** Pairing a long-reach weapon (Lance, range 2) with a short one
  (a melee sword, range 1) no longer lets the short weapon ride the long one's
  reach. An **adjacent** target is hit by both; a target **2 tiles away** (e.g.
  diagonally) is hit only by the longer weapon. Two equal-range weapons (two
  knives) are unchanged — they always both reach the targets you can pick.

## Dual-wield + piercing weapon fix (2026-06-12)

Commit: `40ed7dc` (pierce × dual-wield). See ADR-0107.

- **A dual-wielder whose main-hand weapon pierces now swings both weapons.**
  Previously, equipping a piercing weapon (Lance, Imp Halberd) in the dominant
  hand alongside Two Weapons silently dropped the off-hand swing — the unit hit
  once instead of twice. Now both swing: the **piercing weapon pierces the line**
  (hits the target and the tile behind), and the **off-hand weapon hits the
  primary target**. A lone piercing weapon, two non-piercing weapons, and all
  spells are unchanged. If the guide ever says a piercing weapon can't dual-wield
  a second swing, drop that caveat.

## Damage Split rebalance (2026-06-12)

Commit: `746610c` (Damage Split half-reflect). See ADR-0106.

- **Damage Split now reflects HALF the damage, not the full amount.** When a unit
  with Damage Split survives a hit for X, it now deals **X/2** back to the
  attacker and heals **X/2** on itself (previously: full X back, X/2 healed). The
  reaction is still Brave-gated, still bypasses defenses, and still won't trigger
  the attacker's own reactions — only the **reflected number changed**, from full
  to half. If the guide describes Damage Split as a full-damage counter, correct
  it to a half/half split.

## Team builder redesign — follow-ups (2026-06-12)

Commits: `58c4c72` (Wand of Lumen detail), `a373017` (Chain Reaction team).
Continued polish on the rebuilt team builder; one item-detail correction worth
the guide's attention.

### Wand of Lumen — its bonus Burn effect now shows in the item detail

- The Wand of Lumen's detail used to list only WP/accuracy and its on-hit
  resistance-shift proc. It also has a **bonus effect that was never displayed**:
  when its wielder casts a **fire-tagged** ability that applies Burn, the Burn
  lands with **one extra stack**. This is an existing mechanic (nothing changed
  about the wand) — only the builder now surfaces it. If the guide's Wand of
  Lumen entry omits the extra-Burn-stack effect, add it.

### New default team — "Chain Reaction"

- A fourth bundled team in the builder's "Load Default" picker (alongside Gravity
  Well, High Ground, Mage War): Assassin / Calculator / Hunter / Terraformer /
  Lightning Mage. Default teams are convenience presets, not new mechanics —
  noted only so the picker's roster is accurate if the guide lists the bundled
  teams.

## Team builder redesign (2026-06-11)

Commits: `3f6cdc5` (Pass 1 — unit card), `6f31e11` (Pass 2 — pickers + inspector).

A structural redesign of the **pre-battle team builder** — a player-facing
screen, but **no game mechanics, stats, or content behavior changed**. Mostly
out of scope for the guide; logged so the cursor is complete and for the one
piece of new player-visible reference (weapon families).

### Team builder — rebuilt around a single unit card

- Each unit is now one large card: bigger portrait, identity (name, gender,
  Brave, Faith) in one place, the **complete live stat line now including Move
  and Jump** (the old readout stopped at Speed), and the class shown compactly
  with a "Change class" control that reopens the full class grid.
- Equipment is now a **grouped, searchable picker** (by weapon family) instead
  of flat dropdowns; abilities are a **budgeted accordion** (one category open at
  a time). A single **inspector** shows a hovered item's detail and its change
  vs. what's equipped, or an ability's effect and how its cost fits the budget.
  These are presentation changes — the budgets, costs, and equip rules are the
  same as before.

### Weapons now grouped into families (reference only)

- Weapons carry a family used to group the picker: **Swords, Knight Swords,
  Knives, Axes & Hammers, Polearms, Bows, Wands, Staves**. This is new
  *reference* vocabulary — no weapon's stats, range, or behavior changed. If the
  guide ever lists weapon types, these are the canonical names (knight swords are
  their own family, distinct from regular swords; axes and hammers share one).

### Tidewalker — description corrected (no mechanics change)

- The builder's Tidewalker text wrongly claimed **"+1 Move Range."** Tidewalker
  has **never** granted Move Range — it only makes **water tiles cost 1 less to
  move through (minimum 1)**: shallow water 2→1, deep water 3→2. The mechanic is
  unchanged; only the wrong description was fixed. If the guide describes
  Tidewalker as a Move-Range buff, correct it — it's a water-terrain cost
  reducer, full stop.

## Session 63 (2026-06-11)

Commits: `96b3d5f` (Calculator Faith removal), `96195ab` (Brine), `a50ba1d`
(KO summary), `b3bd121` (action-log redesign).

### Action log — redesigned as an events view with a per-turn ledger

- The log now shows **events only** by default — the meaningful beats of a turn
  (moves, attacks, abilities, status landings, damaging DoT ticks, KOs,
  reactions that fire). The bookkeeping it used to re-narrate — CT changes,
  MP/HP regen, status countdowns, KO timers, non-firing reactions — is collapsed
  into a per-turn **ledger**. Click a turn's header (or the global "Show ledger"
  toggle) to reveal it. Nothing is lost — it's default-hidden, not deleted.
- The `[tick] / [end] / [ko]` text tags are gone, replaced by a small icon
  gutter + weight/color: a **kill line is emphasized** (large, red-tinted, with
  a "— KO" marker folded onto the killing blow).
- A damaging status tick now reads as **one line** (e.g. `Burn → Tina 9`)
  instead of a separate "ticked" + "took 9 dmg" pair; the tick/expiry detail
  lives in the ledger.
- **KO countdowns no longer appear as log lines** — they already show on the
  unit (map sprite + detail panel), so the per-tick rows moved to the ledger.
- Guide note: the old per-row click-to-expand (raw action dump) is gone; the
  turn ledger replaces it. Exact icons/colors are not final — visual polish may
  shift after a playthrough.

### Calculator — Precision Fire & Targeted Treatment now scale on SP × MA (no Faith)

- Both Math Skill abilities **dropped their Faith term**. Damage (Precision Fire)
  and healing (Targeted Treatment) are now `SP × MA` — **deterministic** (no
  Faith swing) and roughly **double** their previous output at typical Faith. A
  deliberate buff; SP values are unchanged.
- Precision Fire's **Burn proc is unaffected** — its chance to apply still rolls
  the normal Faith × MA gate. Only the up-front damage/heal number changed.
- Note this is specific to these two abilities; all other Faith-scaled spells
  (the Templar's Cure/Raise, the mages' strikes, etc.) are untouched.

### Brine (Hydrologist) — Speed debuff doubled to −2 per cast

- A landed Brine now applies **−2 Speed** (was −1), permanent and stacking, so
  two casts reach −4. Cast cost, range, and ~51% land chance are unchanged. Speed
  drives turn frequency, so this is a meaningful tempo debuff now worth a slot.

### End-of-battle summary — counts every KO

- The post-battle KO timeline and MVP tally now record **every** knockout,
  including a unit downed again after a Raise / Phoenix Down revival (previously
  only the first KO per unit was counted). The in-battle action log likewise
  shows a fresh KO line on each re-down.

### Taunt — flagged for redesign (no change yet)

- An audit found Taunt's "40% chance to ignore the Knight" doesn't behave as
  described (it's effectively all-or-nothing per ability, and the AI doesn't
  respond to it). **Behavior is unchanged this session** — it's slated for a
  ground-up redesign. Treat the current Taunt write-up as provisional; don't
  build new guide detail on its exact percentages until the redesign lands.

## Session 62 (2026-06-10)

Commits: `e2cc34f` (Defender, Faithstrider), `c159426` (Monkeygrip), `3747a82`
(Emissary, Unified Calling), `bddf3df` (Lance, Imp Halberd + pierce), `5d75929`
(Jump), `0435d04` (the **Templar class**). The full arc shipped this session —
**the Templar is now a playable class.**

### The Templar — a new playable class (hybrid healer/Dragoon)

A slow, balanced holy knight of the Glabados Church: **HP 132 / MP 36 / PA 6 /
MA 6 / Speed 8**, Move 2 (→ 3 with its innate Faithstrider), Jump 3. It wields
any weapon, and is the **second class that can wear Knight head and body armour**
(not Knight shields). Its command set — **Templar Arts** — is three abilities:

- **Cure** — a charged **area heal** (1-square cross, ~MA × 8 × Faith). Friendly
  fire is on: the cross heals allies *and* any enemies caught in it, and the
  caster too. Fast to land (so placement is a fair reactive puzzle). MP 8.
- **Raise** — a charged **revive** spell: brings a KO'd ally back and heals them
  (~MA × 10 × Faith; ≈ 37 HP at base with Emissary). MP 12.
- **Jump** — the **off-field leap**: the Templar vaults off the board (becoming
  **untargetable** while it charges), then comes down on a target tile for
  **PA × WP, doubled with a Lance**. Reaches far and high (range 6, up to 6 in
  height — it can strike units perched out of melee's reach). The target can
  **dodge by leaving the tile** before it lands. The charge is faster the higher
  the Templar's Speed. MP 6.

Its four **innate** abilities (free on the Templar; cost points for other
classes): **Emissary of Murond**, **Monkeygrip**, **Unified Calling**, and
**Faithstrider** — all detailed in their own entries below.

Other classes can raid Templar Arts (for the healing — and, with a Lance, the
Jump) or take Monkeygrip, just like any secondary command set / passive.

- **New weapon — Defender (Knight Sword).** A two-handed sword (WP 11, accuracy
  95) that grants **Auto-Protect**: while wielded, the bearer permanently takes
  **50% less physical damage**. Weapons are universal, so **any class can equip
  Defender** for that defensive aura — but it's two-handed, so no shield or
  off-hand alongside it (yet). Its damage variance scales with **Brave** (like
  Absolom), rewarding high-Brave wielders.
- **New movement ability — Faithstrider.** A Movement passive (cost 2) granting
  **+1 Move and +10 Faith**. The Faith boost cuts both ways: it strengthens the
  bearer's own healing/revival spells **and** makes them take more magical
  damage. Free on the Templar (when it ships); any class can slot it for the
  Move+Faith trade.
- **New support ability — Monkeygrip.** A Support passive (cost 2) that lets
  **two-handed weapons be held in one hand** — so the bearer can carry a
  two-hander **and** an off-hand item (a shield, or a second weapon). Lets any
  class pair, e.g., **Defender + a shield**. Note: holding a weapon in the
  off-hand only gives a *second attack* if you also have **Two Weapons**;
  Monkeygrip alone just makes the loadout legal. Free on the Templar (when it
  ships).
- **New support ability — Emissary of Murond.** A Support passive (cost 1):
  **all healing the bearer applies is boosted +25%**. Works on healing spells
  and on healing items the bearer throws (e.g. a Potion or Phoenix Down). Does
  **not** affect Regen (recurring-status healing). Stacks multiplicatively with
  Faith and MA bonuses, so an invested healer compounds noticeably. Free on the
  Templar (when it ships).
- **New reaction ability — Unified Calling.** A Reaction passive (cost 1): when
  the bearer **receives a one-time heal** (a healing spell, or a Potion/Phoenix
  Down used on them), they **recover MP equal to their PA**. Does not trigger on
  Regen. Lets a healer who heals (or is healed) keep their MP topped up — on the
  Templar, healing yourself helps pay for the next cast. Free on the Templar
  (when it ships).
- **New weapon class — Lance (Lance + Imp Halberd).** Two-handed reach weapons
  (range **2 tiles, up to 4 in height** — longer than a sword's 1) that **pierce**:
  a basic attack hits the target **and the unit directly behind it** along the
  line. If an **ally** stands between you and your target, the pierce **hits them
  too** — mind your lines. The **Lance** (WP 10) is the striker; the **Imp
  Halberd** (WP 8, **+1 MA**) trades raw power for magic, favouring a healer build.
  Both are universal (any class can wield them). Pierce only triggers on the basic
  attack; targeting snaps to the nearest cardinal direction.

## Session 61 (2026-06-10)

_No player-facing changes._ (Barrier denial — an AI behavior so a Terraformer
walls off threats to its allies — is invisible to game rules. ADR-0098.)

## Session 60 (2026-06-10)

Commits: `9f44013` (the cut). See ADR-0097.

- **Seven spells now require line of sight.** **Lightning Bolt**, **Scorch**,
  **Water Lash**, **Megavolt**, **Chain Lightning**, **Fireball**, and **Flame
  Lance** changed from arcing to straight-line trajectories. They can now be
  **blocked by terrain, units, and barriers** between caster and target — cover
  matters for these attacks for the first time. Previously they lobbed over any
  obstruction.
  - For the three area attacks among these (**Chain Lightning**, **Fireball**,
    **Flame Lance**), line of sight is required only to **reach the target
    point**; the blast/area still spreads from there normally, even behind cover.
- **What did NOT change:** **bows** (basic shots and Charged Attack) and the
  lobbed/area attacks — **Rock Toss**, **Earthquake**, **Cataclysm**, **Tidal
  Wave**, **Maelstrom**, **Discharge Strike** — still arc over obstructions and
  ignore line of sight. An archer can still shoot over a low wall; a thrown/
  detonating attack still lands behind cover.
- **Player takeaway:** cover (including a Terraformer's Barrier) now breaks those
  seven bolt/beam spells but not bows or lobbed attacks. Positioning behind
  terrain is a real defense against the affected mages.
