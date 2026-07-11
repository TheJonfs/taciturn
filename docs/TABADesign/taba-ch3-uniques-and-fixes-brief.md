# Brief — Debug JP tool · playtest fixes · Ch3 weapon uniques (×8)

*Status: plaintext review by Chris before it ships to CC. Decisions D1–D4 settled (recorded below as
rulings). This brief deliberately over-specifies — **audit the substrate first and prune anything already
present**; the composition seams below are expected to be mostly built already.*

---

## Context

M3 gear + inventory shipped (ADR-0143); manual playtest is finally live via the manage-roster screen +
the `🎒 Seed gear` DEV chip. First playtest batch surfaced two fixes and one testing-ergonomics gap, and
the 8 Ch3 weapon uniques (settled designs, `taba-equipment-lineup.md` §"Ch3 weapon uniques") are ready to
author. Bundling them: the uniques are content the implementer authors in the same pass as the fixes,
while the economy/acquisition plumbing is a separate later brief. These uniques are **seedable content**
for now — actual in-world placement/acquisition is the economy pass, not this brief.

## Goal

Ship, in order: (1) a repeatable debug JP grant that unblocks class-gated playtesting; (2) two playtest
fixes (Moon Robe, Katana crit verification); (3) the 8 Ch3 weapon uniques as authored content, with the
two engine seams they need and the light Holy damage-type payoff. Plus two **data checks** (no code
change) that feed balance/sequencing decisions back to the planner.

---

## Work item 1 — Debug JP grant (ship FIRST; unblocks the rest of playtest)

**What:** a repeatable dev action that grants **100 JP to every party member in each of their currently
*unlocked* classes**. Respects the job-unlock tree — it does **not** force-unlock. The playtester hits it
a few times, spends JP to buy abilities and cross unlock thresholds into higher classes, then hits it
again to fund the newly-unlocked tier. (D4 ruling.)

**Placement:** a sibling DEV chip to `🎒 Seed gear` on the manage-roster screen (e.g. `📈 Grant JP`).
No once-guard — repeatable by design.

**Acceptance:**
- Pressing it adds exactly 100 JP per unlocked class per party member; locked classes receive nothing.
- Repeated presses accumulate; a class unlocked *between* presses starts receiving grants on the next press.
- DEV-only surface (same gating as the seed chip); no path into shipped/campaign builds.

**Why first:** the current JP precision means the roster can't exercise its own breadth — Trident needs a
Templar, Command Cap needs a 2nd secondary, higher-tier classes need JP to reach. This unblocks that whole
band *and* doubles as the job-tree-unlock test rig.

---

## Work item 2 — Playtest fixes

### 2a. Moon Robe — effect mis-wired + missing display arm

**Intended effect:** ×1.5 to water-tagged damage. Compose path (per Chris): multiply water-tagged **Spell
Power by 1.5**.

**Observed (playtest):** projected water damage on-vs-off is **target-dependent** and far short of 1.5× —
124→136 vs a Pyromancer (~1.1×), **68→68** vs a Knight and vs a Calculator (no change). Display reads
`SP +0`.

**Diagnosis handed to you:** target-dependence localizes the bug to the **pre-mitigation / SP path**, not
a clean final multiplier (a true ×1.5-on-final-damage would be target-independent: 124→186, 68→102). The
zero-delta on Knight/Calculator is the sharp clue — even a resisted target should move *some* if SP
actually scaled, so the SP scaling is either not applying or applying wrong. Reconcile against the real
water-damage formula and make it the intended ×1.5.

**Two fixes:** (i) the effect itself; (ii) a `formatItemDetail` arm for the water-multiplier rider — the
`SP +0` string is the same missing-arm class as the 15 riders patched in S86. **This is a preview of a
discipline the uniques below need** (see Acceptance): every new rider needs an arm or it displays wrong.

### 2b. Katana — crit-magnitude verification (ordered)

Verify in this order; each gates the next:
1. **Does a landed crit produce bonus *magnitude* at all?** (Crit was historically chance-only; the S85
   crit-magnitude system must actually be producing extra damage on a crit. If not, the bug is in the
   crit-magnitude system, not the Katana.)
2. **Do the three crit-*chance* sources sum additively and apply to weapon attacks?** Vicious Dagger +25,
   Arcane Lens +10, Keen Visor +5 → confirm they stack onto base crit chance and affect basic/weapon
   attacks (not just abilities).
3. **Does the Katana double the crit *multiplier* on a landed crit?** (Its rider is crit-damage, not
   crit-chance — the two axes stay separate: chance sources raise frequency, Katana raises size.)

Report findings; only (3) is Katana-specific, (1)–(2) are system checks that happen to surface here.

---

## Work item 3 — Ch3 weapon uniques (×8)

Single-instance, found-not-shopped content. Seedable for testing now; placement is the economy pass.
**Sort:** 2 engine seams (Volley Bow, Del's Stave) + 1 light payoff (Holy type, for Excalibur); the other
5 **compose** existing patterns. Load-bearing rulings are called out per item — preserve them exactly.

### Full designs

| Unique | Family | WP·Acc | Effect | Engine |
|---|---|---|---|---|
| **Nandani's Wrath** | sword | 11·95 | Brave +11 (flat) | compose (stat stick) |
| **Cremation** | axe | 14·75 | axe variance; **on-hit: apply 2 Burn stacks** | compose |
| **Shadowblade** | knife | 6·95 | speed variance; **on-hit 50% (Brave/PA-modified): Speed Up (self) + Speed Down (target)** | compose |
| **Sline** | lance (2H) | 8·90 | lance variance/range; **basic attack strikes twice** | compose |
| **Golden Rod** | wand | 2·90 | **start of turn: −10% MaxHP & −10% MaxMP (LINEAR); +1 MA (stacking)** | compose |
| **Volley Bow** | bow (2H) | 8·40 | **basic attack hits diamond-1 (AoE) instead of single target; friendly-fires** | **SEAM** |
| **Del's Stave** | staff | 5·80 | **on cast: spend ALL current MP; the spell gains +1 SP per 10 MP spent beyond its base cost** | **SEAM** |
| **Excalibur** | Knight Sword (2H) | 16·95 | Brave variance; **Auto-Haste**; **Holy-imbued** | compose + Holy payoff |

### Per-item rulings & precedents

**Nandani's Wrath** — plainest of the eight, but Brave drives both physical damage *and* reaction trigger
rate, so its identity is a reaction-synergy sword (pairs with Counter/Counterpunch). Family = **sword**
(NOT Knight Sword — no Brave-damage-multiplier). Pure stat composition.

**Cremation** — feeds the Burn ecosystem. Precedents: Flametongue (weapon on-hit status), Slow Burn
(already applies 2 Burn stacks). **Watch:** 2 *guaranteed* stacks × Pendant of Lumara (Burn magnitude ×2)
is a high DoT ceiling — flag for playtest, don't pre-nerf.

**Shadowblade** — precedents: Speed Save (accumulating stat mod), contested on-hit status. **Load-bearing
ruling: the Speed Up (self) and Speed Down (target) both stack PERMANENTLY, both directions** (settled).
Degenerate lock only vs HP-sponge bosses, where the target's HP clock normally runs out first; if it ever
becomes a too-easy boss out, the lever is boss Speed-Down resistance, not a change here.

**Sline** — precedent: The Offering (×2 swings per weapon). Basic attack strikes twice. **Compounds with
The Offering → 4 strikes.** D1 ruling: **The Offering is NOT reworked** (it's a Mage War item, tuned for
Mage War). Instead, see Check 4b — compute the Sline × The Offering total at the Knight/Templar PA curve
so we can eyeball the multi-proc ceiling.

**Golden Rod** — Faustian countdown: dead & dry in ~10 turns without recovery, so it *forces* (not merely
rewards) a sustain pairing; the HP half is the lethal one and needs HP recovery (Tailored Outfit regen /
a healer / Star Robe). **Load-bearing ruling: the drain is −10% of MAX per turn, LINEAR** (flat 10% of the
maximum each turn, not compounding on current). Precedents: `system_damage` (the HP/MP drain channel),
start-of-turn trigger (Tailored Outfit), stacking MA (Terra Robe). Compose.

**Volley Bow** — **SEAM: weapon-attack-AoE shape.** Basic attack targets a diamond-1 area instead of a
single tile. This is an extension of the existing lance-piercing weapon-attack-shape seam, not greenfield
— audit that seam first. **Load-bearing ruling: it FRIENDLY-FIRES** (settled) — it's a starting-cluster
opener, deliberately not a safe melee tool. Confirm Aether Bloom expands *this* AoE (same question as
Palliative Pike's on-hit AoE — if that resolved during playtest, reuse the answer).

**Del's Stave** — **SEAM: dynamic per-cast SP from an MP dump.** On cast, spend all current MP; the spell
gets +1 SP per 10 MP spent beyond its base cost. **Load-bearing ruling: no artificial cap** — the MP
economy self-caps it (first spell hits huge off stacked MaxMP, but restore rates of 10–20/tick never
refill to peak, so later casts are ~normal). One-shot nova by construction. Confirm the incentive still
favors the *cheapest* spell (more leftover MP → more bonus SP) — that's intended, note if it reads wrong
in play.

**Excalibur** — the post-game **preview** (gated behind a tough optional Ch3 boss; intentionally
above-curve = victory-lap). Composes on precedents: Auto-Haste (Boots of Haste auto-status), imbue
(Flametongue), Brave variance (Absolom). Two family notes:
- **Knight Sword family** (D3): **live already** — Absolom and Defender are Knight Swords (docs label them
  plain "sword (2H)"; the family is real but under-labeled). Two-handed, damage carries a **user-Brave
  multiplier** — full WP×PA only at 100 Brave, scaling down below — in exchange for high WP + strong
  riders. The mechanic is battle-tested Mage War content, so Excalibur just adds a def to the family:
  effective damage WP16 × PA × (Brave/100) × Brave-variance, strong at high Brave, self-limiting at low.
  No new engine work here.
- **Holy imbue** (D2 payoff): see Work item 4.

---

## Work item 4 — Holy damage type (light payoff for Excalibur)

Holy + Dark resistance fields already exist as vestiges (e.g. Engineered Defenses adds them). D2 ruling:
**pay off the vestige** — introduce **Holy** as an imbue damage type that **no unit normally resists
without deliberate effort**. Intended footprint: Holy (and later Dark) become relevant only in
late-game / post-story bonus content, so initial gameplay impact is minimal — the point now is that
Excalibur's Holy-imbued damage resolves against the (mostly-zero) Holy resistance field like any other
imbued element. Light lift: the resistance plumbing exists; this wires an imbue tag to it. Do **not** add
Holy resistances to normal units, and do not build out Dark offense yet (out of scope).

---

## Work item 5 — Data checks (no code change; report numbers to planner)

These use the implementer's direct access to the stat equations. They produce numbers for balance/
sequencing decisions, not code.

**5a. Spiked Maul — Ch3 survival sweep.** The Maul (WP20, Reaction cap −3 is **intentional**, not a bug —
D-adjacent ruling) swings ~288–416 (WP20 × 16 PA × variance) on a L25 Knight. Using the HP-by-level
equations, find the Ch3 level band where a ~350 hit tips from "one-shots most of the field" to "one-shots
squishies / two-shots a Crystal-Plate tank." That band tells us **when in Ch3 to make the Maul available**
(story-sequenced unlock). Report the crossover level(s) by class archetype.

**5b. Sline × The Offering — multi-proc ceiling.** Sline is a late-Ch3 unique (back half), so check only
the **level ~35–50** Knight and Templar PA curve. Compute total damage for Sline alone (2 strikes) and
Sline + The Offering (4 strikes) at those PA values. We're not changing The Offering; this is a sanity
read on the multi-hit ceiling. Report the numbers.

---

## Acceptance criteria (cross-cutting)

- **Every new rider on the 8 uniques has a `formatItemDetail` arm** and displays correctly in the Loadout
  inspector, Team Builder, and in-battle panel (shared via `ui/index`). Do not repeat the Moon Robe
  `SP +0` gap — if a rider can't be expressed statically (on-hit procs, start-of-turn drains), give it a
  descriptive arm rather than a fallback.
- **Static stat riders show in the inspector's projected ± stats** (Nandani Brave+11, Excalibur, etc.),
  via the same `probeUnitStats` snapshot-fold path — no UI-side reconstruction (three-resolver discipline:
  live engine, AI projection, UI forecast share one resolver).
- **The two seams resolve identically in the live engine and any projection path** — a Volley Bow AoE or a
  Del's Stave nova must not throw or diverge when the AI-projection/UI-forecast resolver evaluates it, even
  though the AI doesn't yet *value* effect weapons (standing deferral).
- Debug JP grant: per Work item 1 acceptance.
- Moon Robe: on-vs-off is now target-independent ×1.5 on water damage; display arm correct.
- Katana: the three ordered checks reported.
- All 8 uniques seedable via the existing DEV path and pass draft-legality (2H uniques respect Monkeygrip
  rules; Knight Sword = 2H).

## Out of scope

- **Acquisition / placement** of the uniques (economy pass / findable-uniques flow — separate brief). The
  receipt → `grantItems` door stays the uniqueness gate; these are seed-only for now.
- **The Offering rework** (D1: explicitly not doing).
- **AI valuation** of effect weapons (standing deferral to the AI-capability beat) — keep these off
  authored ENEMY loadouts until then.
- **Dark offense / Holy resistances on normal units** — Holy is imbue-only here.
- Ch3 non-weapon story-artifacts, post-game busted-gear ladder (both undesigned/deferred).

## Files (audit to confirm; over-specified)

- `equipment-pool.ts` — the 8 unique defs + Moon Robe rider correction.
- Weapon-attack-shape seam (lance-pierce) — Volley Bow AoE extension.
- Spell-resolution / SP path — Del's Stave dynamic-SP-from-MP; Moon Robe water-SP ×1.5.
- Crit-magnitude system — Katana verification (no change expected unless a check fails).
- Damage-type / element defs — Holy imbue tag → existing Holy resistance field.
- `ui/index` `formatItemDetail` — arms for every new rider + Moon Robe.
- Manage-roster DEV surface — `📈 Grant JP` chip.
- Knight Sword family — live via Absolom/Defender; Excalibur adds a def, no mechanic work.

## Workflow notes

- Ship order: **Work item 1 → 2 → 3/4 → 5**. Item 1 unblocks the class-gated playtest that validates the
  rest; the data checks (5) can run whenever.
- **Audit-first:** the composition seams (on-hit status, accumulating stat mods, `system_damage`,
  start-of-turn triggers, auto-status, imbue) are expected to already exist — prune this brief against the
  substrate and report what was already there (audit-overturns-spec is the norm).
- Mid-session design questions route through Chris to the planner, not resolved unilaterally.

## Watch-fors (playtest, don't pre-nerf)

- Cremation (2 guaranteed Burn) × Pendant of Lumara (×2 magnitude) — DoT ceiling.
- Shadowblade permanent bidirectional stacking vs HP-sponge bosses.
- Del's Stave cheapest-spell incentive reading as intended vs exploit.
- Golden Rod's ~10-turn clock forcing a sustain pairing (intended) — confirm it's lethal without one.
- Volley Bow friendly-fire as a genuine constraint, not a gotcha.
- Excalibur's above-curve victory-lap power staying gated behind the optional boss.

## Estimated size

One session, front-loaded by the two weapon-attack/SP seams (Volley Bow, Del's Stave) — those are the real
lifts; audit may shrink them. The other 6 uniques are authoring, Holy is a light tag-to-existing-field
wire, the two fixes are small, and the debug chip is trivial. The two data checks are minutes of equation
work each.
