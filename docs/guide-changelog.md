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

## Session 62 (2026-06-10)

Commits: `e2cc34f` (Defender, Faithstrider), `c159426` (Monkeygrip), `3747a82`
(Emissary, Unified Calling). (First content of the Templar class arc; the class
itself isn't playable yet — these pieces are universal/cross-class and usable
now.)

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
