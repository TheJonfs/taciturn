# TABA Equipment Expansion — buyables (implementation brief)

**Status:** review-ready draft. Plaintext review is a hard gate before implementer handoff.
**Source of truth (attached):** `taba-equipment-lineup.md` — the full authored roster (every item, stats,
effects, per-chapter/lane), plus two consolidation sections the implementer works from directly: the
**engine-dependency staging plan** and the **open-decisions register**. This brief is the *framing +
constraints*; the lineup doc is the *content*.
**Scope:** the **buyable** lineup across all three chapters. **Out of scope:** findable-uniques (undesigned),
the availability/economy pass (story-gating, costs, currency), post-game busted gear.

---

## D1 — THE HARD CONSTRAINT: Mage War's equipment lineup is FROZEN
Mage War's equipment roster and tuning are a validated, shipped showcase. **None of the new TABA items
appear in Mage War** — not the Ch1-new pieces, not the Ch3 pieces (several of which deliberately punch
above Mage War's L23–27 tuning), not the TABA-specific availability shuffles. The entire expansion is
**TABA-scoped**. Mage War must play *identically* after this work (regression-verified).

**What that means concretely:**
- **Existing items** (the current Mage War set = TABA's Ch2 anchor) stay available in Mage War exactly as
  now. In TABA they also serve as the Ch2 tier, and some are *demoted* to earlier TABA availability — but
  that demotion is a **TABA-availability fact only**; it does not touch Mage War.
- **New items** (Ch1-new, Ch3-new) are **TABA-only** — never surfaced in Mage War shop / loadout / drops.

**First question for the implementer (D1a):** how is item availability currently scoped? Audit the item-
availability model and propose the isolation mechanism — per-product item pools, a TABA-only tag, or
availability-keyed-by-campaign. This is **Stage 0** because every other stage adds items *into the TABA
scope*, so the scope must exist first. Over-specified here so the audit can pick the cleanest fit.

---

## Context
TABA = three gear generations, one per chapter (coarse power step-function, smoothed within-chapter by stat
curves + story-gated availability). Ch2 = the Mage War set (validated anchor); Ch1 authored *down*, Ch3
authored *up* (middle-out). The design rationale, tradeoffs, and per-item flags all live in the lineup doc.

## Inputs
- `taba-equipment-lineup.md` (roster + the two consolidation sections).
- The existing Mage War equipment data (the frozen set / Ch2 anchor).
- The **engine-dependency staging plan** (in the doc) — this *is* the build order.

## Goal
Add the TABA buyable equipment as **TABA-scoped** content without altering Mage War's frozen lineup; build
the five engine prerequisites the effect-items need; stage per the dependency plan.

## Implementation work (staged per the dependency plan)
**Stage 0 — isolation substrate (D1a).** Establish TABA-vs-Mage-War item scoping so new items are TABA-only.
Prerequisite for everything below.

**Stage 1 — element-effect substrate verify (highest-leverage).** A dozen+ items ride "element-tagged
damage + element-triggered effects" (Flametongue, Gaia's Axe, Prism Wand, all four robes, and the Lumen
passive from the plot-units work). **Confirm this substrate is robust before authoring the element items** —
if it's solid (Lumen's passive / Flametongue suggest so) they compose cheaply; if shaky, a dozen items
wobble at once. Audit-first here specifically.

**Stage 2 — flat batch (no engine work; the bulk of the content).** Author all flat-compose items into the
TABA scope: armor (bodies/heads/off-hands all three chapters), accessories, stat-stick weapons. Per the
"FLAT / LOW-COMPOSE" list. This is most of the roster and needs no capability work — it can proceed in
parallel with Stage 3.

**Stage 3 — engine prerequisites (the long pole; start early, run parallel to Stage 2).** Build the five new
capabilities (each blocks specific items):
1. **Crit-*magnitude* system** — Katana (crit is currently chance-only; there's nothing to double yet — this
   builds the tunable crit-damage quantity, then Katana doubles it).
2. **Attack-as-heal + ally-retarget** — Healer's Staff (attack targets allies, resolves as heal).
3. **Attack-stat swap** — Battle Staff (weapon attack uses MA not PA; Barehanded PA² is the precedent).
4. **Charging-conditional damage modifier** — Channeler's Hat (−50% incoming *while charging*; charge-state
   is already known via the auto-hit rule).
5. **Equip-legality override** — the Ch1 breadth-enabler (first instance; author generally — a future
   universal-equip item is instance two).

**Stage 4 — confirms + effect-items (as capabilities land).** Verify the six CONFIRMS (Estoc melee-range,
Trident scoped-action-speed, Gaia's imbued-physical, Palliative Pike weapon-AoE-expand, Scouring res-floor,
Spiked Maul reaction-cap), then author the effect-weapons + robes.

## Acceptance criteria
- **Mage War regression: unchanged.** Its item pool, availability, and tuning are identical post-work
  (explicit regression check — this is the #1 criterion).
- New items appear in **TABA contexts only** (absent from Mage War shop/loadout/drops).
- Each item's stats/effects match the lineup doc.
- The five prerequisites function (crit-magnitude tunable; Healer's Staff heals allies; Battle Staff MA-attack;
  Channeler's charge-reduction; equip-legality override applies).
- Flat items compose correctly; the element substrate carries the element items.

## Out of scope
- **Findable-uniques** (undesigned — separate design pass).
- **The availability/economy pass** — story-gating shop stock by location, costs, currency. This brief adds
  the item *content* into the TABA scope; the fine-grained *when/where/cost* gating within TABA is deferred.
  **Interim note:** absent that pass, TABA items may be broadly available at once — acceptable for now
  (TABA equipment-balance testing is downstream of the economy pass). *Cheap optional interim:* tag items
  with their chapter so Ch3 gear doesn't leak into Ch1 testing, but full story-location gating is deferred.
- **Post-game busted gear** (separate economy / bonus-boss ladder).
- **Any Mage War change** (frozen — D1).

## Files (likely; audit to confirm)
- Equipment data / item definitions (the new items).
- The item-availability / scoping model (Stage 0 — TABA-vs-Mage-War).
- Engine files for the five prerequisites (crit / attack-resolution / charge / equip-legality).

## Workflow notes
- **Plaintext review is a hard gate.**
- `taba-equipment-lineup.md` is the content source of truth — author from it; don't re-derive stats here.
- The **open-decisions register** (in the doc) lists still-pending magnitude/confirm questions (Spiked Maul
  cost, Moon×Conductor stacking, Golden-Hairpin×Expert's-Tunic MP-stacking, etc.). **Surface these during
  audit** — several depend on engine facts the audit reveals (e.g. Spiked Maul's cost hinges on the default
  Reaction cap; Scouring's ceiling on the res floor). Flag, don't guess.
- **Over-specified scope** — audit to prune (the substrate assumptions may already be cleaner than assumed;
  "audit-overturns-spec" is the persistent pattern).

## Watch-fors
- **Mage War isolation is the #1 watch** — regression-test that Mage War is untouched; don't let new items
  leak into its pool.
- **The element-effect substrate** — verify early (Stage 1); many items depend on it simultaneously.
- **The five prerequisites are the long pole** — start them early (Stage 3 parallel to Stage 2), not after
  the flat batch.
- **Magnitude open-decisions** — don't hardcode contested magnitudes; surface them (register in the doc).

## Estimated size
**Large** — most of the roster is flat authoring (fast), but the five engine prerequisites + the isolation
substrate + the element-substrate verify are real capability work. Explicitly staged (Stage 0 → 1 → 2‖3 →
4) across multiple sessions/commits per the dependency plan; the flat batch can ship well before the
effect-items.
