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
