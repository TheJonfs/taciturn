# Brief — Economy infrastructure (M3): currency · shops · nodes · recruitment

*Status: plaintext review by Chris before it ships to CC. Design source: `taba-economy-framework.md`
(settled except `D-econ-6`, the gil coefficient — placeholder constants for now). This brief builds the
**machine** and proves it on the **sandbox graph** with throwaway placeholder content. It deliberately
over-specifies — **audit the substrate first and prune**; some reward wiring likely already exists.*

---

## Context

M3's remaining beat is the economy. The framework is settled: **availability is a hard wall (story-gated),
money is a soft grindable gate**, no build locked out — only deferred. All three rewards (XP/JP/gil) derive
from enemy level, so a node's scaling **offset** is one lever driving both challenge and reward. Cleared
nodes open a repeatable **skirmish** valve; that valve's *fuel* (a generated enemy party) is M4 work, so we
**stub** it now and light it up later.

Critically: the implementer's **sandbox graph** (few nodes, return-to-previous-node enabled) is the proving
ground. We validate the whole machine there against placeholder bundles **before a single real campaign
bundle is authored**. The real bundle→node assignment needs the campaign graph + balance data and is **not**
this brief.

## Goal

Build the economy machine and prove its lifecycle end-to-end on the sandbox: earn gil from fights, watch a
cumulative shop pool grow as nodes clear, buy gear through the receipt door, return to a cleared node and
farm its skirmish for all three rewards, and hire a generic as a gil sink. All economic constants live in
one tunable config (balance retunes without code). Ship in 4 independently-testable stages.

---

## Design decisions — settled

- **D1 — Sell-back: partial ~50%, uniques unsellable.** The shop buys items back at a config-set ~50%
  rate (forgives mistakes, no equip-undo exists; not exploitable below 100%). `unique`-pool items are
  **blocked from selling** (single-instance story gear — an irreversible trap otherwise). Rate is a config
  constant.
- **D2 — Commerce (shop + recruitment) lives only at hub locations, not globally.** A location can *be* a
  hub. But hub-ness is **not** a mutually-exclusive type — see the location-capabilities note below: a hub
  can also host story battles and a skirmish valve at the same time (the Dorter pattern). Combat-node
  clears feed the cumulative pool; you spend it at hubs; "town trips" become a pacing beat.
- **D3 — Skirmish stub: N generics at node level.** Until M4's generator, a farmable node spawns N generic
  enemies (N = party size) at the resolved enemy level, simple Tier-1 classes. Throwaway; the seam is what
  matters.

### Location capabilities (from D2) — orthogonal, not a type enum

A location is **not** `combat` XOR `hub`. It carries **independent capabilities that can coexist and change
over campaign progress**:

- **`isHub`** — commerce (shop + recruitment) available here. Can be on/off, and can *turn on later* in the
  campaign.
- **`storyBattle`** — the authored fight *currently* armed at this location, or none. A location can host a
  *sequence* of distinct story beats over the campaign — cleared, then re-armed with a later one — while
  staying a hub in between.
- **`farmable`** — the skirmish valve (opens per lifecycle below).

This is the **Dorter pattern**: one location that hosts multiple story battles at different campaign points
*and* serves as a shop/recruit hub between those beats. Model these as orthogonal fields so a Dorter-style
location is authorable later **without a refactor**. Do **not** collapse them into a single mutually-
exclusive type.

**Scope for this brief:** the sandbox proves *coexistence* — one location that is simultaneously a hub, has
(or had) a story battle, and offers a skirmish — so the primitives are exercised together. The full
multi-beat **re-arming cycle** (author a queue of story battles that swap in over progress) is campaign
authoring, out of scope here; the only requirement now is that the data model doesn't preclude it. **The
sandbox needs at least one `isHub` location** to prove commerce.

---

## The one lever, as a function (build this seam first)

Everywhere enemy level is needed, resolve it through a single function:

```
resolveEnemyLevel(partyAvg, nodeOffset, difficultyFactor = 0) → partyAvg + nodeOffset + difficultyFactor
```

`nodeOffset` is per-node authoring; `difficultyFactor` is a **reserved additive global term, hardwired 0**
(D-econ-4: structure now, expose later — do **not** build UI for it). Additive, never multiplicative, so a
future difficulty setting preserves authored relative pacing. Rewards derive from the resolved level, so
this function is the single source for challenge *and* payout.

---

## Stage 0 — Currency + reward wiring (foundation)

**Party gil wallet** in campaign state: a single shared pool, grant/spend API, persists across nodes/saves
(same persistence path as JP/inventory).

**Reward-on-win hooks.** On battle completion (story *and* skirmish), award all three:
- **XP** `10 + target_level − self_level` per action (min 1) — **audit first: this almost certainly already
  fires** (equation is established). If so, Stage 0's XP work is "confirm it also fires on skirmishes."
- **JP** — its established level-scaled curve. Same audit note.
- **gil** `≈ X × Σ(enemy_levels)` per battle — **likely the only net-new reward.** `X` is a placeholder
  config constant (`D-econ-6`).

**Acceptance:** win a sandbox fight → gil increases by `X × Σ(enemy levels)`; XP/JP confirmed flowing;
wallet persists across a save/reload.

---

## Stage 1 — Node lifecycle + navigable map + skirmish stub

**Location lifecycle (capability-based).** A location becomes reachable, then over its life may have a
`storyBattle` armed (clearing it disarms that beat and may arm a later one, or none), may be `isHub`, and
may become `farmable`. These are the orthogonal capabilities above — not a single linear enum. The simple
combat node is just the degenerate case: `storyBattle` armed → cleared → `farmable`, never a hub.

**Navigable map (correctness-critical).** The map represents a location as a **returnable** place you travel
back to. Re-entering **resolves whatever is *currently available* there** — an armed `storyBattle`, and/or
commerce if `isHub`, and/or the skirmish if `farmable` — presented as options when several coexist. **The
one hard rule: never replay an *already-cleared* story beat.** Note the subtlety this stage must get right:
"don't replay the cleared beat" is *not* "never show a story battle on re-entry" — a location legitimately
re-arms with a *later, different* story beat (Dorter), which is a new fight, not a replay. So the guard is
per-*beat*-cleared, not per-location. This is the sharpest bug risk in the stage; test it on the sandbox
return path.

**Skirmish valve + stub seam.** A farmable node offers "Skirmish" (on-demand — click to fight; no
random-encounter timer). It calls:

```
generateSkirmishParty(resolvedEnemyLevel) → enemy party
```

stubbed per D3 now; **M4's generator replaces the stub at this seam, nothing else moves.** The skirmish
runs a normal battle and pays Stage 0 rewards.

**Acceptance:** clear a sandbox combat node → it shows farmable; travel back → skirmish launches, **not** a
replay of the cleared story beat → win → all three rewards paid; the cleared beat stays cleared. A location
that is `isHub` + `farmable` + (later) re-armed with a new story beat presents all currently-available
options without replaying the cleared one. No artificial anti-farm friction (reload-risk is the intended
governor).

---

## Stage 2 — Shops (cumulative, story-gated)

**`firstAvailableAt: nodeId` on buyable items.** The available pool = union of bundles from all cleared
nodes — **monotonic, never delists**. Seed **2–3 placeholder bundles** across sandbox nodes (throwaway
content, just to prove accumulation) — **NOT** real campaign bundles.

**Shop UI at hub nodes** (reuse Loadout/inventory patterns): accessed by traveling to a `hub` (D2); shows
the current available pool + gil balance; **buy** routes through the existing **receipt → `grantItems`**
door (the one path into inventory — uniqueness gate intact); **sell** at ~50%, uniques blocked (D1). The
*pool* is fed by all combat-node clears; the *access* is at hubs.

**Acceptance:** clear sandbox combat nodes in sequence → pool grows and never shrinks; travel to a hub →
shop shows the accumulated pool; buy an item → gil debits, item enters inventory via the receipt door;
sell debits inventory / credits gil at ~50%; uniques cannot be sold. Prices are placeholder config
constants.

---

## Stage 3 — Recruitment (gil sink)

**Hire a generic** at a chosen level, **capped at the party's current average** (never above — a hire tops
out at what an organic unit *starts* becoming; §6 framework). Priced:
- **Cost = f(chosen level)**, a config curve (placeholder, `D-econ-6`-adjacent). Higher level = more gil.
- **Tier-1 JP bonus at certain levels** — a high-level hire arrives with some JP in **Tier-1 jobs only**
  (functional on arrival, not a stat-shell), but the tree stays earned. Thresholds are config constants.

The hired unit is a real generic: passes **draft-legality**, gets legal starting gear, shows correct stats
via the existing `probeUnitStats` fold. **Access at hub nodes** (D2) — same commerce surface as the shop.

**Acceptance:** hire at level L (≤ party avg) → gil debits per curve, a legal generic joins with the Tier-1
JP bonus for L; hiring above party avg is impossible (UI caps it); the unit is immediately deployable and
draft-legal.

---

## Acceptance criteria (cross-cutting)

- **One lever:** all challenge/reward derives from `resolveEnemyLevel(...)`; the `difficultyFactor` term
  exists, is 0, and is not surfaced.
- **One door:** every item entering inventory (shop buy, hire's starting gear) goes through
  `grantItems`/receipt; uniqueness gate holds.
- **Persistence:** gil, node states, cleared-pool, and hired units all survive save/reload.
- **Legality:** hired units and bought/equipped gear pass the shared draft-legality resolver
  (three-resolver discipline — no economy-side legality copy).
- **Config-centralized:** gil coefficient `X`, item prices, sell rate, hire-cost curve, and Tier-1-JP
  thresholds live in **one tunable module**, each marked placeholder, so balance retunes without touching
  logic.
- **Display arms:** any new economy-facing field (price, hire cost, sell value) has a `formatItemDetail`/
  UI arm — no `SP +0`-class gaps.

## Out of scope

- **The real bundle→node assignment** (needs campaign graph + balance data — its own session). This brief
  uses throwaway placeholder bundles on the sandbox.
- **Final price/reward coefficients** (`D-econ-6`, balance-pending). Placeholders only.
- **The generated skirmish enemy party** (M4). Stubbed at the `generateSkirmishParty` seam.
- **Difficulty-knob UI** (reserved as the additive term at 0; not exposed).
- **AI valuation of effect weapons** on any authored/stub enemy loadout (standing deferral — keep effect
  weapons off enemy parties; the stub uses plain gear).
- Tailored Outfit / regen item (still on the M3 design slate, not built — don't cite it as a dependency).

## Files (audit to confirm; over-specified)

- `campaign/` node + state — lifecycle + **orthogonal location capabilities (`isHub` / `storyBattle` /
  `farmable`, coexisting; per-beat cleared-guard)**, offset field, gil wallet, cleared-pool, persistence.
- Battle-completion / reward path — gil award; confirm XP/JP already fire (prune if so).
- `resolveEnemyLevel` — new single-source level function (the reserved-difficulty seam).
- `equipment-pool.ts` — `firstAvailableAt` on buyables; placeholder sandbox bundles.
- Shop + recruitment UI at hub nodes — `grantItems`/receipt integration (buy/sell); `probeUnitStats` for
  the hired unit; reuse Loadout/inventory patterns.
- Sandbox graph — designate/add a `hub` node for commerce testing.
- Map UI — returnable cleared-node state; re-entry → skirmish not story replay; hub travel.
- One new **economy config module** — all tunable constants, marked placeholder.

## Workflow notes

- **Ship order 0 → 1 → 2 → 3**; each stage independently testable so Chris can playtest a layer before the
  next lands (substrate → playtest cadence).
- **Audit-first:** reward wiring (XP/JP), persistence, and the receipt door likely mostly exist — prune
  this brief against the substrate and report what was already there.
- The **DEV chips** (`🎒 Seed gear`, `📈 Grant JP`) stay as testing stand-ins; the economy is the *real*
  acquisition path alongside them, not a replacement of the dev tooling.
- Mid-session design questions route through Chris to the planner.

## Watch-fors (playtest, don't pre-nerf)

- **Income-to-price ratio** — the "meaningful choice without excessive grind" dial (§4). Can't tune until
  balance data, but flag if placeholders make farming absurdly fast/slow even roughly.
- **XP rubber-band on high-offset skirmishes** — a low unit farmed at `avg+10` gains huge XP (intended
  catch-up); watch it doesn't trivialize leveling.
- **Recruitment cap** — confirm hire-level can never exceed party avg through any path (the whole
  convenience-premium philosophy rests on it).
- **Navigable-map re-entry** — replaying an already-cleared story *beat* is the one most likely to bite;
  verify on the sandbox return path. Remember the guard is per-beat-cleared, not per-location (a re-armed
  later beat is a legitimate new fight).
- **Sell rate × uniques** (D1) — if selling uniques is allowed, it's an irreversible trap; lean is to block.

## Estimated size

Large — comparable to the gear UI brief, likely spanning sessions. The four stages are independently
shippable, so it need not land whole. Stage 0 is small (mostly confirm-existing + the gil hook); Stage 1
carries the real new machinery (node lifecycle, navigable map, skirmish seam); Stage 2 is shop UI on an
existing inventory substrate; Stage 3 is a contained sink. Audit may shrink Stage 0 substantially.
