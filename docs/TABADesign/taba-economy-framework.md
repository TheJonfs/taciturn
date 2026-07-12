# TABA Economy Framework (draft for review)

*Status: framework skeleton for discussion, not settled tuning. Open calls marked `D-econ-N`. The
centerpiece for this pass is §9 — the unlock-bundle model that IS the story-gating spine.*

---

## 1. The model in one line

**Availability is a hard wall; money is a soft, grindable gate.** Story/location progress determines
*what exists to buy or find at all*; money determines *how much of the available set you can own right
now*. No build is ever locked out by poverty — only **deferred**. Grinding relaxes the money gate toward
owning the current stock, without ever unlocking something the story hasn't made available. (Same
"deferred, not denied" principle already applied to gear via capacity, now applied to the whole economy.)

Two axes, never confused:
- **Story-gating (hard):** binary, earned by progress. The wall.
- **Money + grind (soft):** analog, earned by effort. The throttle within the wall.

---

## 2. Node lifecycle & the offset lever

Every combat node moves through three states:

**locked** → **story-available** (the authored, win-once fight) → **cleared & farmable** (a repeatable
generated-skirmish pool opens at that location).

Clearing the *story* fight never reopens it; it lights up the *skirmish* valve beside it. Same place, two
fight types: the authored gate and the repeatable grind.

Each node carries a **scaling offset** — a signed number added to the party's average level to set the
fight's enemy level. This single field is the load-bearing lever of the whole system:

> **The offset is one lever doing two jobs.** It selects grind *challenge* AND, because every reward
> derives from enemy level (§3), it selects grind *reward*. It is also the encounter-difficulty authoring
> tool — a node authored at `avg+10` simply *is* "the AI batting ten levels above you," delivered through
> the scaling policy. "How the AI challenges the player" and "how content scales for grinding" were never
> two systems; they're this one number, tuned per node.

Different locations scale differently: some target `avg+0` (a fair fight, safe farm), others `avg+5` or
`avg+10` (a stretch fight, richer but riskier). The offset is per-node authoring.

---

## 3. The three rewards derive from enemy level — and scaling converts them from *power* to *breadth*

All three rewards key off enemy level, so the offset drives them automatically:

| Reward | Formula (established) | Under scaling, it buys… |
|---|---|---|
| **XP** | `10 + target_level − self_level` per action (min 1) | **Roster breadth / catch-up.** A rubber-band: underleveled units gain fast, at-level units gain little. Holds pace, doesn't outrun content. |
| **JP** | its own level-scaled curve | **Ability breadth.** More of the tree. |
| **gil** | `≈ X × Σ(enemy_levels)` per battle, `X ≈ 100` | **Gear breadth.** More tools. |

The conceptual key: **when content rises with you, none of these three trivializes the game — each
becomes *breadth*, not *power*.** JP widens your ability set, gil widens your gear set, and XP — the one
scaling quietly redefines — stops meaning "get ahead" (impossible when content tracks you) and starts
meaning "bring underleveled units *up* to baseline." That makes **XP the on-ramp for recruitment** (§6):
the rubber-band is precisely what makes a cheap, underleveled hire viable to grind up quickly.

This is why rewarding all three (not gil-only) is correct: scaling neutralizes the power-creep worry
*structurally*, so there's no reason to amputate two-thirds of the grind payoff. Grinding is
resource-*positive* and quick — a fact that matters for pricing recruitment (§6).

---

## 4. Two income streams; their ratio is the whole feel

- **Main-path income (scarce):** authored fights pay once. Tuned tight — this is what makes purchase
  choices real opportunity costs.
- **Repeatable skirmish income (the valve):** cleared nodes farm generated fights for all three rewards.
  This is what makes "grind toward breadth" possible at all.

The **ratio** of guaranteed-main-path to optional-repeatable income *is* the "meaningful choices without
excessive grinding" dial. Main-path alone should force real choices; the valve should relax them over
reasonable effort, not a slog (the XP rubber-band and scaled gil both work in the player's favor here).

**Dependency:** the skirmish valve needs a *generated enemy party* to fight — that's M4's generative work.
So the economy **machine** (currency, shops, node-state, offset, reward hooks, recruitment) is
**M3-buildable now**; the skirmish valve is authored now but **lights up when M4 fuels it**. The economy
does not block on M4; it has one input that arrives later.

---

## 5. Shops: cumulative & story-gated

Shop stock is a **monotonic pool** — reaching a node adds its bundle (§9) permanently; nothing ever
delists. "Grind later to backfill what you skipped" only works if past stock stays purchasable. Unlock is
additive; the pool only grows.

Uniqueness stays gated by the **receipt → `grantItems`** door (the one path into inventory), so
single-instance uniques can't be duplicated through the shop even as their *availability* is node-keyed
like everything else.

---

## 6. Recruitment as a gil sink

Hire generics at **better than level 1**, up to the **party's current average level** — no "locked into
your starting units," no long catch-up tax. Two priced dimensions:

- **Hire level → cost.** Cost is a function of the chosen level (higher = more gil). Capped at party
  average — you can never buy a unit *better* than one grown organically; only *to the baseline* one
  would reach, faster.
- **Tier-1 JP bonus at certain levels.** A high-level hire arrives with some JP in **Tier-1 jobs only**,
  so it's a functional unit on arrival, not a stat-shell with no abilities — but climbing the tree stays
  earned through play. Money buys you *into* the game with a viable unit; it never buys you *out* of
  progression.

**Pricing stance (settled): hire-high is a convenience premium, not a strategic edge.** Because grinding a
cheap low-level recruit is resource-*positive* and fast (the XP rubber-band accelerates exactly the units
that need it), hiring high can't be in-game-*optimal* — it's paying gil to skip real-world minutes. The
premium self-tightens correctly: it bites hardest early/mid (gil scarce, competes with urgent gear),
decays to pure convenience once rich. We are **not** trying to make hire-high strategically live (it
can't beat the resource value of the grind it replaces, and shouldn't).

---

## 7. Prices are tuned to grind-*time*, not absolute numbers

The tuning target is never "the Katana costs 800." It's "**acquiring a region's stock takes roughly N
skirmishes**," and prices derive from that against the scaled income rate. Because income scales with
level, prices likely scale by tier too (a Ch3 restock costs Ch3-level gil), keeping *time-to-acquire*
roughly stable across the game rather than letting late-game gil trivialize early prices.

*Illustrative only (pending balance data):* if a `avg+0` skirmish of ~5 on-level enemies pays
`5 × L × 100` gil, then a mid-tier item priced at ~`8–12 × L × 100` is "a few farms." The coefficients are
downstream of playtest — this is the *method*, not the numbers.

---

## 8. Story-battle scaling & the difficulty knob

Story-battle scaling is **partial** for now — deliberately, because "partial" spans the full range from
"scale nothing" to "scale everything," so we keep every option open. Working lean: scale the **gates/
bosses** (enforce mastery exactly where the campaign tests you), leave **some regular story fights fixed**
(so a grinded party earns the occasional steamroll — the power-fantasy payoff, *and* a mercy valve: a
player walled at a hard gate can grind a little to clear a *fixed* fight, where full scaling would wall
them permanently). This gives difficulty a *rhythm* instead of uniform grind.

**Player-facing difficulty knob — structure now, expose later (`D-econ-4`, settled).** We won't ship a
difficulty setting up front, but we reserve the seam so it composes in cleanly later. The reserved shape is
specific and load-bearing:

> **Effective enemy level = `party_avg + node_offset + difficulty_factor`** — three **additive** terms on
> one level-resolution. `node_offset` is *authoring* (fixed per node, the designer's intent for this
> location); `difficulty_factor` is *global player input* (one value, applied everywhere; defaults to 0 =
> today's behavior). They must **sum**, not multiply or entangle. Additive keeps the authored difficulty
> *rhythm* intact at every knob setting — a +10 stretch node and a +0 farm node both shift by the same
> amount, preserving their *relative* pacing. A multiplicative or folded difficulty term would distort
> that relative spacing at non-default settings, silently rewriting the pacing you authored.

So the seam to reserve isn't "a difficulty variable" in the abstract — it's *a second additive term on the
same level-resolution the offset already feeds*. If `node_offset` exists as a real field now,
`difficulty_factor` is one more addend later and nothing else moves. Reserve it; leave it 0.

> **Coupling to keep in pocket:** under absolute-level scaling, turning difficulty *up* also raises rewards
> — hard mode is also fast-progression mode. Usually desirable (more tools offset more challenge). If we
> ever want "harder, *not* richer," that knob alone would need to scale enemy level for challenge while
> holding reward to party-average. Not a problem now; just not a surprise later.

---

## 9. ★ The unlock-bundle model (the story-gating skeleton)

This is the spine: **story-gating = assigning items to unlock bundles keyed to nodes.** The machinery is
simple; the *authoring* is the real design work, and it's what we most need to talk through.

### 9.1 Mechanism

Every buyable item gets a **`firstAvailableAt: nodeId`**. Clearing that node adds it to the permanent pool
(§5). A **bundle** is the set of items sharing a `firstAvailableAt` — the *unit* of story-gating. Findable
uniques work the same way, but their "unlock" is "becomes findable at node X" via the receipt door rather
than "enters shop stock."

So the whole story-gating design reduces to two questions, repeated per item:
1. **Which bundle is it in?** (what unlocks together)
2. **Which node does that bundle key to?** (when it unlocks)

### 9.2 Proposed grouping logic (four rules, in priority order)

1. **Tier-gate (hard ceiling).** An item's power band sets the *earliest* region it may appear. This is
   the wall — WP20 gear cannot precede the level where it stops one-shotting the field (cf. the Spiked
   Maul survival sweep, which *derives* such a gate from HP-by-level data). Balance data sets these
   ceilings.
2. **Theme-cluster (flavor & legibility).** Within its tier, group items by narrative association: a
   class-introduction node unlocks that class's signature gear; a themed region unlocks themed gear
   (a volcanic pass → fire kit); a merchant hub → a broad general restock. Makes unlocks feel *authored*,
   not arbitrary, and lets the shop double as worldbuilding.
3. **Lane-stagger (pacing).** Don't dump weapons + armor + accessories at a single node. Stagger lanes
   across adjacent nodes so each clear is a meaningful-but-digestible refresh, not a flood-then-drought.
4. **Anchor placement (hand-set overrides).** Specific items pinned to specific moments regardless of
   flow: Spiked Maul at its survival-derived level; findable uniques at their story beats; Excalibur
   behind the post-game boss. Anchors win over the flow rules.

### 9.3 Starting partition already exists

`taba-equipment-lineup.md` already organizes the catalog by chapter and by lane/tier — that's ~80% of the
tier-gate classification done. The bundling work is largely **refining that chapter/lane organization into
node-keyed bundles**, then applying theme-cluster + lane-stagger for pacing, then dropping in anchors.

### 9.4 Two validations, now cleanly separable (the sandbox changes the sequencing)

The implementer has a small **sandbox graph** (a few nodes) with **return-to-previous-node** enabled. That
splits what we can prove into two independent layers:

**Mechanics — provable in the sandbox NOW, no real graph needed:** node clears → flips to farmable; the
skirmish valve opens; the cumulative pool actually accumulates as you move; `firstAvailableAt` gates stock
correctly; returning to a prior node and farming feeds all three rewards; the offset produces the intended
challenge/reward. That's the entire §2–§5 machine, verifiable against 3–4 dummy nodes + placeholder
bundles. **The economy brief can target the sandbox as its proving ground** — build the machine, seed two
or three placeholder bundles, validate the full lifecycle end-to-end *before a single real bundle is
authored*. The machine de-risks independently, in parallel (a nice echo of "the skirmish valve waits on M4
but the machine doesn't").

**Content authoring — still waits for the real graph:** which items in which bundle at which story beat.
Inputs needed:
- **The campaign node graph** with per-region target level bands (from `campaign-decomposition.md` /
  chapter briefs) — so bundles key to real nodes and tiers match the offsets those nodes carry.
- **Balance data from current playtest** — sets the tier ceilings (esp. the Spiked Maul crossover, the
  "too strong?" items that may want later gates, the "too weak?" items that may want earlier ones).

**Granularity (`D-econ-5`, settled): one bundle per major node**; minor nodes usually carry none (not
every fight is a shop event).

---

## 10. Open decisions register

- **`D-econ-1` — reward scales with absolute level.** ✅ **Settled:** yes. All three rewards derive from
  enemy level (party-avg + offset); higher-offset nodes pay more, with reload-risk as the natural governor.
- **`D-econ-2` — which story battles scale.** 🔶 **Partial** (lean: gates/bosses scale, some fixed).
  Range-preserving; may resolve into `D-econ-4`.
- **`D-econ-3` — recruitment premium type.** ✅ **Settled:** convenience premium; hire capped at party
  average; Tier-1-only JP bonus; never better than organic.
- **`D-econ-4` — player-facing difficulty knob.** ✅ **Settled:** structure the seam now, expose later.
  Reserved as an **additive** global term: `effective_level = party_avg + node_offset + difficulty_factor`
  (defaults 0). Additive to preserve authored relative pacing (§8). Watch the harder-also-richer coupling.
- **`D-econ-5` — bundle granularity.** ✅ **Settled:** one bundle per major node; minor nodes usually
  none.
- **`D-econ-6` — gil coefficient `X` and per-tier price scaling.** ⬜ Open, downstream of balance data
  (§7). Method settled, numbers pending.

---

## 11. Sequencing / dependencies

- **Proving ground = the sandbox graph.** The economy brief targets the implementer's few-node sandbox
  (return-to-previous-node enabled), not the real campaign graph. Build the machine, seed placeholder
  bundles, validate the §2–§5 lifecycle end-to-end there (§9.4). Machinery de-risks before any real
  content is authored.
- **The return-to-node toggle makes the graph *navigable*, which the brief must honor.** The world map now
  represents a **returnable state** — a cleared node is a place you can go *back to*, with its skirmish
  valve lit — and **re-entering a node loads its farmable state, not a replay of the story fight**. That's
  the difference between "linear campaign + a pointer" and "a map you traverse"; the sandbox is where to
  shake it out.
- **M3-buildable now:** currency, cumulative shops + `firstAvailableAt` bundles, node three-state + offset
  field (reserve the additive `difficulty_factor` term at 0), reward hooks (equations exist), recruitment
  sink, receipt/`grantItems` uniqueness gate.
- **Lights up with M4:** the generated-skirmish valve (needs generative enemy parties as fuel). Authored
  now against a stub; live when M4 lands.
- **Feeds from current playtest:** tier ceilings (§9.2 rule 1), which items want later/earlier gates.
- **Not this framework:** the actual bundle→node assignment (needs the real graph + balance data) and
  final price coefficients (needs balance data).
