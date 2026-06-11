# Session 62 Brief: Templar — Substrate Audit + Foundation (class-arc opener)

## Context

The AI arc has closed enough to pivot to content (deployment sorting banked as a someday item). The **Templar** — a hybrid White Mage + Dragoon for the Glabados Church — is the next class. **Full spec lives in `templar-concept-notes.md`; this brief does not restate it.** The spec is settled at the design level with a handful of small open values (its "Open decisions" section).

The Templar is **substrate-heavy**: it bundles many mechanics, several of which may not exist in the engine yet (a spell revive, an AoE friendly-fire heal, the Jump leap, Lance pierce, Auto-Protect, Monkeygrip's one-handed-two-hander equip, an on-heal reaction, a new weapon type). *(Faith is confirmed pre-existing — see T1 — so the spells' scaling composes on it.)* So per the proven class arc — **blueprint → audit → substrate → class → polish** — this opening session is **audit-first**: classify every Templar mechanic as *exists / compose / net-new*, propose the substrate build order, and (budget permitting) ship the cheapest unblocking foundation. The audit scopes how many sessions the arc takes.

The concept-notes is the blueprint. This is the audit step.

Scope: **Large arc; this opener = audit (primary) + foundation (opportunistic).**

## Inputs (read first)

1. **`CLAUDE.md`** — conventions; the guide-changelog session-end requirement (Templar work is player-facing).
2. **`templar-concept-notes.md`** — THE spec. Every number and mechanic.
3. **Pattern sources to read for "does this exist / how is it done":**
   - **Alchemist** — Potion (PA heal) and Phoenix Down (revive) — the closest precedents for Cure and Raise.
   - **Pyromancer** — the AoE-expand support Cure should compose with; its `straight_line` line attacks (Flame Lance) as a line-shape precedent.
   - **The four Mages / `four-mages-design.md`** — whether magic already uses **faith** (the headline question).
   - **Knight** — Knight-Sword Brave rules (Defender), class gear-gating (head/body), the innate ×1.25 (Martial Expertise) as an equippable-pool example.
   - **Assassin** — Two Weapons (the dual-wield half of Monkeygrip's combo; the ×0.75 pattern).
   - **Terraformer / Calculator** — parameter-driven kit precedent; `system_damage` and status patterns (for Auto-Protect, Spiked-Mail-style equipment effects).
4. **`status-effects.md`, `core-types.md`, `battle-mechanics-guide.md`, `ct-system.md`** — for Auto-Protect/damage-reduction, the faith stat, charged-action resolution (Jump), and reaction triggers.

## Paths to survey before planning — the audit (this session's primary deliverable)

Classify each as **exists / compose-on-existing / net-new**, with a build-cost estimate. The headline first:

- **T1 — FAITH: RESOLVED (Chris).** Faith exists as a unit stat and already feeds various calculations — long-standing. So Cure, Raise, Emissary, and Faithstrider **compose on it directly, zero new substrate, and D1 dissolves.** No retrofit decision, no faith session. *This was the biggest unknown; it's gone, and the arc is meaningfully shorter for it.* (Audit still confirms the exact faith-factor hook Cure/Raise call, but as a lookup, not a build.)
- **T4 — Jump leap: now the headline unknown.** With faith settled, the largest single net-new mechanic is Jump. How do charged actions resolve today? Any precedent for an off-field / delayed-landing action, or is "leaves the field, lands for damage" net-new? Confirm the action-speed hook supports **3 × Speed**. (D3: full off-field leap vs. a simpler charged-strike v1.) Flag early if the leap balloons.
- **T2 — Spell revive (Raise).** Can the Phoenix Down revive effect be reused with a spell delivery + the MA×10×faith amount?
- **T3 — AoE friendly-fire heal (Cure).** Does a healing AoE with friendly-fire-on exist; does the Pyromancer AoE-expand support generalize to it; is the 1-cross shape available?
- **T5 — Lance pierce.** Any line-attack precedent (hits two units along the 2-tile line); does a *basic attack* support friendly-fire (the pierce clipping an intervening ally)?
- **T6 — Auto-Protect.** What damage-reduction effects exist (a Protect status?); is there an equipment-granted permanent-status pattern (Spiked-Mail-style) to hang it on?
- **T7 — Monkeygrip.** How is two-handed equip enforced; how hard to add "two-handers occupy one hand," and the budget-gated combo with Two Weapons (concept-notes "Build interactions")?
- **T8 — Unified Calling.** Is there an "on receiving healing" reaction trigger, or is that a net-new hook?
- **T9 — The smaller pieces.** Adding a new **weapon type** (Lance) + the three items (Lance, Imp Halberd, Defender); Faithstrider's Move+1 / Faith+10 (movement-ability + stat-mod precedent); adding the Templar to Knight head/body gear permission; the stat-block scaffold.

## Goal

**Audit (primary):**
- Every Templar mechanic classified exists/compose/net-new with build-cost; a **proposed substrate build order + session split**, ratified at plan-review.

**Foundation (opportunistic — only the cheap, low-risk, unblocking pieces the audit greenlights):**
- Likely candidates: the class stat-block scaffold; Knight head/body gear permission; Faithstrider's stat mods; the weapon items *if* the weapon-type addition (T9) is cheap. Big-ticket substrate (faith, Jump, Auto-Protect, pierce) is sequenced for following sessions, not forced into this one.

**Quality:**
- Tests for whatever foundation ships.
- ADRs: faith likely its own (especially if net-new); the other big mechanics each as they land.
- `docs/handoff.md`; `docs/guide-changelog.md` (Templar is player-facing — but the audit alone is not, so a stub unless foundation ships player-visible content); Vercel pre-flight.
- Human playtest only becomes relevant once playable content exists (later in the arc).

## Pre-implementation plan

Audit-first; **the audit is the deliverable.** Plan-review sequences the arc.

### Required first step: the substrate audit
Per "Paths to survey." Deliverables:
1. The exists/compose/net-new table (T1–T9) with build-cost estimates.
2. **The faith finding (T1)** and its design implication (D1) surfaced first.
3. A proposed build order + session split.
4. A shortlist of foundation pieces shippable this session without risk.

### Decision points
- **D1 — Faith scope.** ✅ Resolved — faith pre-exists, no retrofit decision. (Kept here only as a record that it was considered and closed.)
- **D2 — Substrate build order + session split.** From the audit. *Plan-review.*
- **D3 — Jump leap fidelity (now the main design call).** Full off-field leap vs. simpler charged-strike v1, depending on T4's cost. *Chris, once T4 lands.*
- **D4 — Foundation set this session** — which cheap pieces ship now vs. pure-audit. *Plan-review.*
- **Concept-notes open items** to settle as content lands: Auto-Protect definition (T6); Cure vertical tolerance; Imp/Imperial naming; confirm Unified Calling / Faithstrider are innate-free; Martial Expertise (~2) / Two Weapons (3) pool costs. Surface for Chris.

## Implementation work

Provisional; the audit confirms what (if anything) builds this session.

### 1. Audit (always)
- T1–T9 classification + build order + foundation shortlist.

### 2. Foundation (only audit-greenlit cheap pieces)
- Stat-block scaffold (HP 132 / MP 36 / PA 6 / MA 6 / Speed 8 / Move 2 / Jump 3 / evade 10-6-2).
- Knight head/body gear permission for the Templar.
- Faithstrider stat mods (Move+1 / Faith+10) if the movement-ability + stat pattern is trivial.
- Lance / Imp Halberd / Defender items *if* the weapon-type addition is cheap (Defender's Auto-Protect deferred until T6 builds it).
- Tests for each shipped piece.

## Acceptance criteria

- **Audit:** complete exists/compose/net-new table; faith finding + D1; build order; foundation shortlist — all to plan-review.
- **Foundation (if any):** shipped pieces tested green; nothing half-built (e.g., no Defender without Auto-Protect, no Cure without faith confirmed).
- **Quality:** `tsc -b` / `vite build` clean; ADR(s) as warranted; docs + changelog stub/entry; Vercel clean.

## Out of scope

- **Building the full class in one session** — explicitly. The audit prevents it.
- **Deployment sorting** and all AI carries.
- The concept-notes' larger watch-items (Auto-Protect tank stack, multiplicative healing stack) — those are *playtest* questions for when the class is playable, not this session.
- Standing carries (templates, Move-tier discussion, cosmetic items, etc.).
- **`templar-male/female.png`** — commit-or-remove is a one-off, not arc work (recommend just committing them).

## Files likely touched

Non-exhaustive; audit confirms.
- `src/content/classes/` — Templar scaffold (new).
- `src/content/abilities/` — Cure / Raise / Jump (as they land, later).
- `src/content/equipment/` — Lance type + three items.
- `src/engine/` — faith, Auto-Protect, Jump leap, pierce, Monkeygrip equip, on-heal reaction (the net-new substrate, sequenced).
- `src/test/session-62-templar-*.test.ts`.
- `docs/handoff.md`, `docs/guide-changelog.md`, ADR(s) in `docs/decisions/`.

## Workflow notes

- **Plaintext-first review required.**
- **Audit-first; the audit is the product.** Do not build big-ticket substrate before plan-review sequences it.
- **Spec authority:** `templar-concept-notes.md`. Where the engine differs from the spec's assumptions (audit-overturns-spec — expected), the audit flags it and Chris adjudicates; the implementer doesn't silently re-spec.
- **Guide-changelog:** player-facing content gets an entry; an audit-only session gets the stub.
- **Vercel pre-flight discipline.**
- **Mid-session design questions** route through Chris — most likely the faith scope (D1) and Jump fidelity (D3).

## Watch-fors

**This arc:** the Templar's full kit. **This session:** the audit + cheap foundation only.

**Specific:**
- **Jump leap is the headline unknown (T4).** With faith settled, the off-field leap is the one mechanic with no obvious precedent. Flag early if it balloons; D3 (full leap vs. charged-strike v1) is the relief valve.
- **Breadth.** Many new mechanics at once — the failure mode is trying to build half of them in one session and shipping all half-done. The audit + a disciplined build order are the guard.
- **No half-built content.** Defender without Auto-Protect, Jump as a stub — each should land whole or wait. Foundation = only pieces that are complete and low-risk.
- **Auto-Protect** is the second-largest substrate item — flag early if it's bigger than the spec's "reuse existing damage-reduction work" assumption.

## Estimated size

**Large arc, but shorter than feared — faith is confirmed, so no faith session and no roster-wide rebalance.** The remaining swing is Jump: if the off-field leap is net-new and large, plus Auto-Protect/pierce net-new, it's a few substrate sessions before the class assembles; if charged-action infrastructure mostly covers Jump and the rest composes, it's short. Plan-review turns the audit into the session map.

**Likely arc shape (audit confirms):** Auto-Protect + pierce + Monkeygrip + on-heal reaction (substrate) → Jump leap (the big one) → class assembly (stat block, command set, four innates, three weapons — the spells composing on existing faith/heal/revive infrastructure) → polish + playtest. Foundation pieces (scaffold, gear permission, items, Faithstrider mods) slot in wherever cheap.
