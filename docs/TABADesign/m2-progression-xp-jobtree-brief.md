# M2 — Progression: XP & Job Tree (working brief)

**Status: working document.** Captures two *settled* M2 systems — the XP/level-up rules and the
class-progression job tree with its JP thresholds. Two pieces remain open and get appended before this
is implementation-ready: the **macro JP budget** (JP/battle, total) and the **per-ability JP costs**
(the costing/sequencing audit). Composes with the stat-curve brief: XP produces `level`, which the
stat curves consume — no shared surface, parallel-safe.

---

## Part A — XP / Level-Up  · SETTLED

### Mechanic (lifted from FFT)
- Each successful action earns `XP = base + (target_level − unit_level)`, floored at 1.
- `+10` for a KO — on top of the killing action's normal XP.
- At `per_level` XP the unit levels up; XP rolls over (subtract `per_level`, keep the remainder).
- **base = 10, per_level = 100** (FFT values; see rationale + caveat below).

### Rulings
- **Self-target** (self-heal/buff): delta = 0 → flat `base` (10).
- **AoE**: exactly ONE XP grant per action — *not* per unit hit — with the delta computed from the
  primary/representative target. Prevents AoE classes out-leveling by multi-hitting.
- **No-effect actions** award zero XP (healing a full-HP unit, re-applying an existing buff). This is
  the guard that closes the self-target grind exploit (delta-0 self-spam).

### Base value — rationale & caveat
- 10/100 leans into FFT's loop, where grinding earns *JP-toward-builds* as much as levels. It accepts
  a nonzero grind requirement (~0.4–0.5× the story-battle count at the ~45-battle length) as a
  **feature**, contingent on three things holding: optional content is fun (M4), difficulty rewards
  build investment, and JP pacing makes the grind visibly pay.
- **Watch-for:** the grind-free analysis showed that at typical activity (~6 actions/battle) a base of
  ~13–15 keeps a unit level-matched *without* grinding. Choosing 10 deliberately *requires* some grind;
  it is not an oversight. If the grind-as-feature conditions fail in playtest, raising base toward
  13–15 removes the grind tax without other structural change.

### Design context (rationale to preserve — not implementation)
- The delta term is a **negative-feedback controller**: base sets the *equilibrium gap* between a unit
  and content level, not the final level (content authoring sets the arc).
- **Story battles = fixed authored checkpoints** (delta vs the checkpoint, boosted when under-leveled).
  **Grind battles = party-scaled** (delta ≈ 0, flat base XP) — the catch-up path that adds levels while
  the story is paused.
- **The grind-free inequality:** a campaign needs no grinding only when
  `(actions·base + KO)/100  ≥  (level_range)/(story_battles − 1)`. This binds level range, battle count,
  and base into one relationship. At base 10 the ~45-battle 1→50 arc sits just under self-sufficient →
  the intended light grind.

---

## Part B — Class Progression / Job Tree  · SETTLED

### Starter rule
On hire/join a unit picks **one Tier 1 class** — physical or magical (six options). It arrives with
**100 JP**, enough for one entry ability. Requirement: every Tier 1 class has a usable active ability
costing **< 100 JP**, so every starter is immediately functional.

### Tier map (3-2-1 per half + hybrids)
```
              PHYSICAL                 MAGICAL                     HYBRID
  Tier 1   Alchemist, Monk, Hunter   Pyromancer, Hydrologist,      —
                                     Geosage
  Tier 2   Knight, Thief             Aethurge, Enchanter        Terraformer, Templar
  Tier 3   Assassin                  Calculator                 [capstone — TBD]
```

### Unlock thresholds (JP values all tunable)
- **500 JP in Tier 1** (of a half) → unlocks that half's **Tier 2** AND the *other* half's **Tier 1**.
- **1000 in Tier 1 + 500 in Tier 2** (same half) → unlocks that half's **Tier 3**.
- **500 in *both* halves' Tier 1** → unlocks **Hybrid Tier 2** (Templar, Terraformer).
- **1000 in Hybrid Tier 2** → unlocks **Hybrid Tier 3** (the capstone).
- **Whole tier opens** at threshold — every class in the tier becomes reclass-able at once. JP scarcity
  paces which you actually build; there is *no* pick-one-per-threshold gate.
- **Plot-special units** may start with a higher-tier class pre-unlocked (see Relief valve).

*Interpretation to confirm:* "in Tier N" = cumulative JP spent across that tier's classes within the
relevant half; T2/T3 thresholds are per-half; Hybrid T2 requires both halves' T1.

### Tier principle — diversity-protection, NOT power
Tiers gate the abilities/kits that most *flatten build diversity*, so players explore the space before
the dominant answers unlock. They do **not** gate raw strength (Tier 3's stats are nowhere near the
ceiling — Knight PA 10 and Aethurge MA 14 sit at Tier 2).
- **Tier 1 — forgiving generalists:** sustain + legible basics. The three martials stay safe/sustain;
  the three elements are clean basic damage. Both active healers (Monk, Alchemist) live here → the
  early game is **not** heal-starved.
- **Tier 2 — two things at once:** the **pure-damage pinnacles** (Knight, premier fighter; Aethurge,
  single strongest attack — Megavolt) *and* **orthogonal utility axes** (Enchanter AoE buffs; Thief
  steals buffs / hearts). Also gates the `stat × 1.25` supports (Martial Expertise on Knight, Conductor
  on Aethurge) — near-auto-includes on any damage unit, so holding them to Tier 2 forces players
  through other loadouts before the obvious pick arrives.
- **Tier 3 — highest-skill kits:** Assassin (Shadow Stitch, the most reliable CC) and Calculator
  (peerless shapeable reach). Gated by both complexity and power — the answers that would collapse
  tactical variety if handed out turn one.

### Crossover semantics
Because starters are balanced (3 physical / 3 magical) and 500-in-Tier-1 opens the *other* half's Tier
1 directly, reaching the other half needs **no forced hybrid detour** — a physical starter can be in a
magical class after a single threshold. The **hybrids are a separate reward** (500 in *both* halves'
T1), earned by genuine dual-world investment, which restores the "synthesis feels earned" quality.
Going *deep* in both halves is the above-and-beyond effort: two tier-ladders to climb on one campaign's
JP.

### Relief valve — plot-unique units (access ≠ mastery)
Early Chapter 1 introduces two **plot-unique** units with a Tier 3 class pre-unlocked: an **Assassin**
and a **Calculator**. This gives the player an early *taste* of Tier 3 (one unit each) without
unlocking Tier 3 for generics — replicating the capability across the roster still requires the climb.
It separates **access** (a design gift; advertises what's up the tree) from **mastery** (still gated),
and it makes the scarcity **diegetic** ("you've only met one person who can do this") rather than a raw
JP wall. It is also the concrete first use of the unique-character-override pattern: a unit that
*arrives* somewhere on the tree, where its position is characterization.

**Design rule (discipline):** pre-unlocked uniques are a **scarce authored resource with a headcount
budget** — characterization + advertisement, not a free balance-bypass. Anything handed via a
plot-unique sidesteps the entire gating structure, so it must be rationed. Two early Tier-3 uniques is
a taste; six is a lower tree wearing a story hat.

---

## Open — to settle before this is implementation-ready
- **Macro JP budget.** JP/battle rate (lean: mild level-scale so late battles can fund expensive
  capstones), total campaign budget, tuned so the **mastery target** — roughly one class near-mastered
  per chapter × 3, plus dabbling / going one-half-deep — is reachable, and the **two sinks** (ability
  unlocks + tree progression) balance without either trivializing the other. Tool-explorable like the
  XP economy.
- **Per-ability JP costs.** The costing/sequencing audit: ~6–9 abilities × 14 classes + the tier
  thresholds, each tiered (cheap basic / mid / expensive capstone / cross-build draw). Draw-pacing
  lives *here* — e.g. Calculator's Thoughtful Pacing is a pricey in-class capstone, not an early cheap
  unlock — because whole-tier-opens means class order can't pace a draw. Costs must sum to fit the
  macro budget at the mastery target.
- **Hybrid Tier 3 capstone class.** Deferred to a content-design session. Current loose idea: a Support
  ability granting unrestricted equipment combinations (FFT Onion Knight / FFV Freelancer direction) —
  the "conquered both worlds" generalist pinnacle.

## Composition / seams
- Feeds the **stat-curve brief** (`level` → base stats). Parallel-safe, no shared mutable surface.
- The `stat × 1.25` support gating couples the tree to the **ability-access system** (those supports
  are Knight/Aethurge abilities) — the JP-gating seam and the ability-access audit are the same M2
  substrate work.
- Pre-unlocked uniques are the first concrete consumer of the **unique-character override** layer
  (parked as an M0-model extension, M5-facing): the class-position override is a per-unit field.
