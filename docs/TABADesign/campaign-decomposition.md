# Taciturn Campaign Engine — Decomposition (working doc)

> **Status: working / in progress.** A living organizing document for taking Taciturn from
> a single-battle engine to an integrated campaign/story game (FFT-style story between
> battles). It captures what's *aligned* so far and flags what's *still to decide*. It is
> the campaign-scale sibling of `ai-capability-expansion-blueprint.md`. It will be iterated
> as we hold per-layer design conversations; it is **not** an implementation plan yet.
>
> **Parallel tracks:** battle-engine and Mage War work (AI refinement, new classes,
> equipment) continues alongside — and *feeds* — this effort, because that work lands in the
> shared core both games use. Campaign development does not pause it.

---

## 1. Vision

A multi-battle campaign powered by the Taciturn engine, eventually weaving story/character
between battles. Generic units become a cohesive narrative cast over time.

**Name:** *There and Back Again: A Fifty-Years War Story* — **TABA**. A slice of the untold latter
part of Ivalice's Fifty Years War, predating the events of Tactics itself (Mage War's Gariland
Academy sits in the same world, so the two share a setting by construction). The "out and back"
framing fits both the journey and the spine — a unit goes out to a battle as a snapshot and returns
as deltas.

## 2. Foundational constraint — three parts, one engine

Preserve **Mage War as a standalone functional game** while building the campaign. Three
code regions:

- **Mage War shell** (thin) — the specific interface to set up and drive single battles.
- **Campaign shell** (large; name TBD) — the whole wrapper: persistence, progression,
  economy, flow, generation, save/load, story.
- **Shared core** — the gameplay engine **and all content** (classes, abilities, equipment,
  statuses). Consumed by both shells, with minimal duplication.

**The invariant that makes this work (non-negotiable):** the core is *product-agnostic* —
it **emits a superset** of data/signals, and each shell **consumes the subset** it needs. The
canonical example: end-of-battle emits XP/JP/wound deltas; Mage War ignores them, the
campaign reads them. No shell-specific logic leaks into the core. **Content lives in the
core**, so "add a class/equipment and it works in both" is true by construction.

*Maps onto the existing six-layer architecture:* Engine, AI, Content, Renderer are already
the shared core; the coupling to separate lives at the setup/UI/App edge, plus enriching the
battle-result schema to emit the superset. A boundary-drawing job at one seam, not a
re-architecture.

## 3. The spine (the architectural pivot)

Almost everything is a layer on three new abstractions that don't exist in a single-battle
engine:

1. **Persistent, serializable campaign-state container** — the one object holding everything
   that carries between battles (roster, inventory, money, progress, flags, completed nodes).
2. **Persistent unit identity** — a durable entity carrying level, XP, JP, learned abilities,
   gear, and (when it lands) wounds/permadeath. No longer ephemeral per battle.
3. **Battle as a pure transition** — snapshot of persistent units *in*, result + deltas *out*.
   The campaign is a **state machine wrapping this pure function.**

Three hard problems collapse out of this: **save/load** = serialize the campaign state;
**Formation screen** = the team-builder components pointed at campaign state instead of a
one-shot config; **"don't hard-code N battles"** = the flow is a data-driven *graph* of
battle-nodes. The spine is also the product-agnostic seam from §2 — the deltas-out boundary
is exactly where Mage War and the campaign diverge in what they consume.

## 4. Dependency layering (draft — to be locked)

Build foundations before what stands on them. Each layer tagged with its rough home
(core / MW-shell / campaign-shell).

- **L0 — spine** *(core: state model + battle boundary; campaign-shell: the container's
  owner)*. Serializable + data-driven from the first commit. Expensive to rework.
- **L1 — the loop** *(campaign-shell, reusing core team-builder components)*: data-driven
  battle-graph + Formation refactor + deploy-K-of-N from the roster. A playable multi-battle
  skeleton, no progression yet.
- **L2 — progression** *(core: XP/JP/level mechanics + JP-gated unlock; campaign-shell:
  spending UI)*: refactor "everything unlocked" → earned.
- **L3 — economy** *(core: equipment/tier data; campaign-shell: money/inventory/shop)*:
  unlocking + tiers. Home of the Steal-Equipment plant.
- **L4 — authoring + generation** *(core: content schema; campaign-shell: authoring +
  generators)*: authored parties/maps per node, the one-per-class relaxation (both sides),
  generative enemy teams (and maybe maps).
- **L5 — story** *(campaign-shell)*: narrative layer; depends on all of it.
- **Cross-cutting:** save/load (a property of L0, designed-in, not bolted-on); the
  data-driven mandate (threads every layer).

## 5. Subsystem list (partial — completeness pass pending)

From the vision + the ones easy to neglect:
- Team persistence beyond map cap (roster N, deploy K) + permadeath lifecycle.
- Unit progression: XP/JP, leveling, JP-gated ability unlock.
- Economy: money, inventory, equipment unlocking, tiers (strictly-better/worse vs today's
  balanced lineup).
- **Unit acquisition** — how the roster *grows* toward N (recruit / unlock / buy?). A real
  subsystem, not free.
- **Outcome → reward schema** — what a battle yields and how win/loss/objectives drive it.
- **Flow topology** — FFT story is a *branching graph* (required + optional battles), not a
  list; L1's graph must support that.
- Party authoring + the one-per-class relaxation (both sides).
- Generative enemy teams (and possibly maps).
- Save/load.
- Story / character / narrative.
- **Design-identity shift (philosophical):** once tiers + leveling land, balance moves from
  "roughly-balanced symmetric skirmishes" to "a tuned difficulty curve with deliberately
  asymmetric power." A different balancing discipline we're signing up for.

## 6. Guiding principles / invariants

- **Generalize the *shape*, not the machinery.** Per layer, build the minimal version that
  doesn't *foreclose* the big version (data-driven, serializable, graph-not-list) — not the
  maximally-flexible version. Hard-coding 3 battles is the under-generalization mistake;
  building a branching-save-system before two battles work is the equally-silly
  over-generalization mistake.
- **Emit the superset, consume the subset** (§2). Keeps the core product-agnostic.
- **Content lives in the core.** Available to both games by construction.
- **The battle stays pure.** Snapshot-in, deltas-out; the campaign wraps it as a state
  machine. Protects the "reuse the in-battle code entirely" goal.
- **Mage War stays standalone and functional** throughout.

## 7. Open decisions / next decomposition steps

1. **Lock the subsystem list + the dependency graph** — substantially advanced; the §8 roadmap
   encodes the dependency order. A full completeness pass on §5 still pending.
2. Per layer: pin the generalization invariants + the minimal increment that proves it — pending,
   per-milestone (starts with M0).
3. ~~Identify the first vertical slice~~ — **RESOLVED: M0 (§8).**
4. ~~Name the larger game~~ — **RESOLVED: TABA (§1, locked 2026-06-28).**
5. **(Next) the M0 design conversation → brief → implementation.** The roadmap is locked; M0 is
   the thing to design in detail when ready.

---

## 8. Roadmap — milestones M0–M5 (locked 2026-06-28)

Operationalizes the §4 layering as a **vertical-slice-first** build order. The principle: the spine
(§3) is the expensive-to-rework foundation, so the first milestone *de-risks it end to end* before
any feature layer stands on it; everything after is additive thickening. Battle-engine / Mage War
work continues in parallel — it lands in the shared core and feeds this.

- **M0 — Spine slice (the de-risker). ✅ SHIPPED 2026-06-29 (S77, ADR-0133).** Built as
  authored: `src/campaign/` shell region (durable `CampaignUnit` + container + serialization;
  snapshot-fold / `summarizeBattleResult` / apply-back; node graph + loop + localStorage
  save/resume) + a Formation screen and a `BattleView` `onBattleEnd` hook, all reusing the
  unchanged engine. Two linear nodes (River Ridge → Stonebridge), roster N=8 / deploy K=5,
  heal-to-full between battles, lost-unit marking, retry-on-loss. **No engine changes.** The
  delta boundary is established (summarizer emits the superset; M0 consumes win/loss + survival).
  Original scope below.
- **M0 — Spine slice (the de-risker).** Two hand-authored battles, one persistent roster,
  deploy-K-of-N, fight node A → carry the *same units with their state* → fight node B, with
  **save/resume** and win/loss. Exercises every hard part at once: serialization, persistent unit
  identity, battle-as-pure-transition, the Formation refactor (team-builder on campaign state), the
  data-driven 2-node graph. **Locked scope:** save/load IN; progression OUT (units carry state, don't
  level); encounters authored, not generated. The **delta boundary is established here** — the
  battle-result emits the superset (XP/JP/wounds/outcome); M0 consumes only win/loss + unit survival
  (proves "emit superset, consume subset" on day one). *Head-start:* the **S70 registry/combiner seam
  is DRAWN** — it already defines a battle node as map + deployment zones + teams.
- **M1 — The loop. ✅ SHIPPED 2026-06-30 (S78, ADR-0134).** Generalized M0's linear array into a
  forward-branching graph (`src/campaign/graph.ts`: nodes + outcome-aware directed edges, where a
  node's win-edges *are* the player's map choices — fork / skippable side-node / terminal all fall
  out of one rule). Position widened `nodeIndex` → `currentNodeId` (save format v2; old v1 saves
  don't resume). Built the **interstitial framework**: an open-set, typed beat-sequence run by a
  type-agnostic runner (the slot M1.5 story-scenes plug into), shipping `result-summary` (one beat,
  win/loss/complete variants — victory/defeat/result unified, not forked) + `world-map-choice` (a
  placeholder SVG choose-next map). Authored a 5-node graph (River Ridge → fork → Stonebridge's
  skippable Mountain Pass → convergent "The Return" finale). Player-choice-on-win + retry-on-loss
  (D1); forward DAG (D2). **No engine changes.** Still no progression. Original scope below.
- **M1 — The loop.** Thicken L1 into a branching battle-graph (required + optional nodes, win/loss
  routing) — navigable flow, not hard-coded A→B. Still no progression.
- **M2 — Progression.** XP/JP, leveling, JP-gated unlock; "everything unlocked" → earned. The RPG
  heart and the design-identity shift to a tuned curve / deliberately asymmetric power.
  **(Before M3 — locked: growth before gear.)**
- **M3 — Economy + acquisition.** Money, inventory, equipment tiers/unlocking, and roster growth
  (the unit-acquisition subsystem). The Steal-Equipment plant.
- **M4 — Authoring + generation.** Encounter authoring matures (the S70 seam is the down-payment),
  the one-per-class relaxation (both sides), generative enemy teams.
- **M5 — Story.** The TABA narrative layer (§1).

**Dependency logic:** L0 hard-blocks everything; L1 needs L0; M2/M3/M4 each need L0+L1 but are
loosely ordered *relative to each other* (reorderable by what makes it feel like a game soonest —
M2-before-M3 is the deliberate "growth before gear" call). M5 needs all of it.

**Why this is lower-risk than it looks:** mostly *new shell code wrapping the existing pure battle*,
not surgery on the engine — which is exactly why Mage War stays standalone. The only early core
change is the delta boundary (M0).
