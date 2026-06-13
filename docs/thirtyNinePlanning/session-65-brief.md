# Session 65 brief — Knight content, equipment expansion, MP rebaseline + Barrier audit

*(Numbering: S62 Templar, S63 log + small items, S64 team-builder redesign, so this is S65.)*

## Context

A content-and-tuning session bundling several settled items plus one audit-first piece. Two design throughlines run under it:

- **A control sub-game** — abilities that displace or disable (Bull Rush knockback; the Assassin's Shadow Stitch ~2/3 Stop) and gear that resists them (the new Barbut). The disable statuses need to matter for the resistance gear to earn its slot.
- **An MP economy** — turning MP from a non-constraint into a managed resource for the caster classes, with sustain options (the new Circlet, Thoughtful Pacing, Alchemist Ethers, Rasp Pendant) becoming real choices.

One item (the Barrier attack-blocking question) is **audit-first**: report before remedying, because its fix could be a one-line reclassification or a systemic LoS change depending on what the audit finds.

## Inputs

- `playtest-backlog.md` — the captured items and their watch-flags.
- Existing patterns to mirror: the **Pointy Hat**'s Silence-resistance (for the Barbut); **Thoughtful Pacing**'s per-step MP hook (for the Circlet's per-turn regen); **Lightning Stab**'s damage-plus-rider shape (for Bull Rush); the **Hydrologist** water-AoE knockback / Worldcraft displacement (the substrate Bull Rush should reuse); the S60 **arc / straight_line / LoS** system (for the Barrier audit).
- `content-integration-checklist.md` — new ability + new equipment touch multiple layers; run the sweep.
- The Taunt guard is already in place (**ADR-0104**).

## Goal

Suppress Taunt and add **Bull Rush** to the Knight; add three equipment pieces (**Battlemage's Chain**, **Barbut**, **Circlet**); apply the **MP rebaseline** with the Circlet's MP regen; and **audit** what the Terraformer's Barrier blocks before deciding its remedy.

## Pre-implementation plan (audit)

Report before building — some of these likely prune work:

1. **Barrier attack-blocking (the audit-first piece).** Report: what a Barrier blocks by attack property; the full list of attacks carrying the **arc** property; and whether arc-ignores-LoS-vs-Barrier is intended for *all* of them (bows included) or whether the Blow Dart is the only mis-fit. The remedy is gated on this (see Implementation §2) and routes back to Chris.
2. **Knockback substrate for Bull Rush.** Confirm the Hydrologist's AoE knockback / Worldcraft displacement exposes a reusable knockback effect Bull Rush can ride (so it's "weapon attack + knockback + MP cost," not a bespoke mechanic). Confirm it interacts with elevation/Pit/Valley (knock-into-hazard).
3. **Status-resist generalization for the Barbut.** Confirm the Pointy Hat's Silence-resistance mechanic generalizes cleanly to a set of three statuses (Stop / Don't Move / Don't Act) at −50%, and how it stacks with the universal Focus Band's −25%.
4. **Per-turn regen hook for the Circlet.** Confirm Thoughtful Pacing's MP-restore hook (or the baseline per-turn MP regen) can host a per-turn `MA / 2` regen on a gear piece.
5. **Current MP base values.** Confirm the exact current bases so the rebaseline deltas land correctly (memory has Aethurge/Pyromancer/Hydrologist/Geosage 60, Calculator 47, Terraformer 35).

## Implementation work

### 1 · Knight — suppress Taunt, add Bull Rush
- Remove Taunt from the Knight's kit (the ADR-0104 guard stays as a general net; the Taunt *redesign* remains a future session, not this one).
- Add **Bull Rush**: a weapon attack with a fairly high chance of **knockback**, cost paid in **MP**. It must **deal damage** (the Taunt-audit lesson: no-damage abilities are AI-invisible — the effect rides a real hit). Reuse the knockback substrate from §2 of the audit.

### 2 · Barrier audit → remedy (gated on the audit + Chris)
- After the audit reports, the remedy is one of: **(A)** Blow Dart is mis-typed as arc → reclassify to straight_line (surgical; Chris's lean); **(B)** Barrier blocks arc too (categorical — buffs Barrier, re-balances its S60 anti-straight-line-mage role); **(C)** height-aware arc (lobs over low cover, blocked by tall walls). **Route the choice back to Chris with the audit findings.** Implement A if confirmed; B/C are larger and may defer.

### 3 · Equipment expansion (run the content-integration sweep)
- **Battlemage's Chain** (body): HP +80, MP +10, MA +1. Pure stat block.
- **Barbut** (heavy head; Knight/Templar): HP +30, incoming chance of Stop / Don't Move / Don't Act reduced 50%. Mirror the Pointy Hat's status-resist.
- **Circlet** (mage head): HP +10, MP +10, plus **MP regen `MA / 2` per turn** (mirror Thoughtful Pacing's hook).

### 4 · MP rebaseline
- Aethurge, Pyromancer, Hydrologist, Geosage: 60 → **48**.
- Calculator: 47 → **37**.
- **Terraformer: stays at 35** (deliberately out of the rebaseline — its MP funds its core Worldcraft loop).
- Martial classes (Knight, Templar, Assassin, Alchemist, Hunter): unchanged.

## Acceptance criteria

- Taunt no longer appears in the Knight's kit; Bull Rush is present, deals weapon damage, has a high knockback chance, costs MP, and respects elevation (knock-into-hazard works).
- The Barrier audit is reported (block-by-property + arc-attack list + intent assessment); remedy A applied if Chris confirms, or the decision is parked for B/C.
- Battlemage's Chain, Barbut, and Circlet exist, equip on the right slots/classes, and surface correctly in the team-builder and the in-battle panel (detail-text etc. — the integration sweep passed). Barbut's resistance and Circlet's `MA/2` regen function.
- The four mages read 48 MP, Calculator 37, Terraformer 35 (unchanged), martials unchanged.
- `tsc -b` + `vite build` clean; tests green.

## Out of scope

- The **Taunt redesign** (long-term; this is suppression only).
- Barrier remedies **B/C** unless the audit and Chris choose them.
- The **Bull Rush brief-was-not-needed** content beyond the single ability (no broader Knight kit rework).
- Parchment reskin; AI MP-economy work (flagged below as a consequence to watch, not built here).

## Files

- Knight command-set / Battle Skill content (Taunt removal, Bull Rush add).
- The knockback / displacement effect (reused by Bull Rush).
- Barrier / arc / LoS resolution (audit; remedy A = the Blow Dart's attack property).
- Equipment content + registries (portrait/detail-text/taglines as the sweep requires); the status-resist hook (Barbut) and per-turn regen hook (Circlet).
- Class stat blocks (MP rebaseline).
- `content-integration-checklist.md` (run it); `playtest-backlog.md` (source).

## Workflow notes

- Plaintext-review gate before building.
- The Barrier remedy decision routes back to Chris after the audit; don't pick B/C unilaterally.
- Mid-session design questions to Chris.

## Watch-fors

- **MP rebaseline is coupled to the Circlet regen** — test them together; the regen only earns its slot because MP is now scarce.
- **Calculator net power** — the −10 MP and the recent faith buff interact (harder per cast, fewer casts); watch whether this quietly resolves the "slightly strong" flag rather than needing a separate nerf.
- **AI MP economy** — the scorer doesn't pace MP or value sustain, so scarcity may hit AI mages harder than human players and widen the gap. Not built here; watch for AI mages running dry and stalling.
- **Thoughtful Pacing may become a near-universal mage staple** once MP is tight — if it does, it likely wants tuning (future).
- **Battlemage's Chain feeds the tanky-self-sustainer Templar** that's still on the balance watch — test Templar sustain with this equipped.
- **The control sub-game** (Bull Rush / Shadow Stitch / Barbut) only works if the disable statuses meaningfully matter — confirm the Barbut earns its slot in practice.
- **Bull Rush knockback rides the AI's existing Worldcraft fall scoring** (knock into Pit/Valley) — a point in its favor for AI-legibility, but confirm the AI values it.
- **Integration sweep** for the new equipment and ability — the rules/registries are duplicated across layers (the checklist's standing concern).

## Estimated size

**Medium** — the settled items are individually small (one ability, three equipment pieces, a handful of stat edits), and the Barrier audit is a small investigation with a likely one-line remedy (A). **Large tail risk** only if the Barrier audit pushes to remedy B or C, which would be a systemic LoS change — that decision parks with Chris rather than expanding scope unannounced.
