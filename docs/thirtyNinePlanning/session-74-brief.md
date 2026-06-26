# Session 74 — AI position/CT increments + caster-accessory batch

*Mixed session: two AI behavior increments (both about reasoning over positions/CT) + four new
caster accessories. CT throughline — Greaves seeds CT, Ring of Caliora drains it, increment B
reasons about it; the **Calculator** (field-wide Math Skill) is the balance epicenter for three of
the four items and gets an explicit test step. The brief deliberately over-specifies; the audit
prunes/splits — realistically ~1.5–2 sessions, see D1/D2 for the likely carve.*

## Inputs

- **AI A (buff targeting):** the AoE-buff cast scoring / ability-targeting valuation; the shipped
  S73 cohesion (`isAoeBuffer`/`cohesionAnchor`) it pairs with; Auramancy's diamond-1 AoE footprint.
- **AI B (charged-attack CT):** the charged-attack scoring + the tile-pin resolution (post-ADR Hunter
  fix); the CT / turn-order model (time-to-next-turn, charge resolve-CT).
- **Equipment substrate:** `onFinalDamage` hook + Rasp Pendant (`system_mp_drain`) as the template
  for Ring of Caliora; the CT-adjust channel (Rapids Rush / Math Skill CT param) for the drain
  target; the outgoing-status-magnitude hook (Aura Mastery / S72 `amplifiable`+`magnitudeKind`) for
  Pendant of Lumara; the Burn model; **Chain Lightning's target-count scaling** as the precedent for
  Glove of Metria; the equipment catalog + unique-per-team rule.

## Goal

1. **AI A** — the AI aims its AoE buffs at the anchor that maximizes covered beneficiaries, not a
   lonely ally. Pairs with shipped cohesion (allies gather + caster aims at the gathering).
2. **AI B** — the AI stops throwing tile-pinned charged attacks at targets that will act (and move
   off the tile) before the charge resolves. Offensive half only.
3. **Equipment** — add the four accessories below, tuned so the field-wide-Calculator interactions
   aren't oppressive.

## The four accessories (mechanics + implementation note + balance flag)

- **Pendant of Lumara** — MA +2; doubles the per-stack multiplier on Burn *the wearer applies*.
  *Impl:* application-time magnitude modifier on an outgoing debuff — likely composes on the S72
  outgoing-status-magnitude hook if it's general (not buff-only); audit. *Balance:* lowest risk;
  fire-res is the natural brake. Watch multi-Burn-amp stacking vs healing.
- **Greaves of Seraphis** — Speed +2; wearer starts the battle at **100 CT** (acts first). *Impl:*
  battle-start CT seed + stat mod; easy. *Balance:* clean; the costed/unique re-introduction of the
  pre-emption the Haste bug used to give. Watch guaranteed-first-turn Stop/alpha feel in 5v5
  (probably fine — one opener).
- **Ring of Caliora** — MA +2; damaging spells also reduce the target's CT by **~20% of damage
  dealt** (% TBD). *Impl:* reuse `onFinalDamage` (Rasp Pendant pattern) → CT-adjust channel, gated
  to spell/magical damage. *Balance — flag hardest:* on field-wide Math Skill it drains CT off the
  whole enemy team per cast → tempo soft-lock. Wants a per-hit cap or a CT floor; **tune on the
  Calculator, not a single-target nuke.**
- **Glove of Metria** — MA +1; a spell hitting multiple targets gains **+1 SP per target beyond the
  first**. *Impl:* target-count-dependent SP; Chain Lightning is the cited precedent — audit whether
  reusable and whether AoE resolution permits count-then-resolve. *Balance:* large on field-wide
  (+4 SP across five) and punishes clustering (interacts with the AI's own S73 cohesion). First audit
  question: **does Math Skill count as multi-target for this?**

## Pre-implementation plan (audit)

- **AI A:** where AoE-buff cast-anchors are scored; add a coverage term (count weighted beneficiaries
  the diamond covers; skip allies who wouldn't benefit, e.g. already-buffed). Confirm it's subordinate
  (cast when coverage is good, don't stall for a better cluster).
- **AI B:** the CT comparison seam — can the scorer cheaply ask "does the target reach its next turn
  before this charge resolves?" If yes → the target can vacate the pinned tile → devalue (don't ban)
  the charge. No movement *prediction*, just a CT race check.
- **Equipment feasibility:** Glove target-count SP (Chain Lightning reuse? AoE count-then-resolve?);
  Ring CT-drain channel + cap shape; Pendant's hook coverage for outgoing debuffs; Greaves CT-seed
  site. Audit confirms which equipment pieces are cheap vs substrate-heavy → informs D2.

## Implementation work (independently prunable chunks)

1. **AI A — buff coverage targeting.** Coverage-weighted anchor selection for AoE buffs; subordinate.
2. **AI B — charged-attack CT devaluation.** CT-race check → value penalty on tile-pins the target
   can dodge by acting first. Offensive half only.
3. **Easy equipment — Pendant of Lumara + Greaves of Seraphis.** (Hook-reuse + CT-seed.)
4. **Substrate equipment — Ring of Caliora + Glove of Metria.** Gated on the feasibility audit;
   Glove may split out if Chain-Lightning reuse doesn't pan out.

## Acceptance criteria

- **A:** an AI Enchanter with several nearby allies anchors Auramancy to cover the cluster, not a
  stray; doesn't stall waiting for a better cluster; doesn't buff non-beneficiaries.
- **B:** the AI declines a tile-pinned charged attack on a target that will act before it resolves
  (prefers a target that won't, or another action); still uses charges freely vs slow / non-acting
  targets. No regression to never-charging.
- **Equipment:** each piece works per spec; **each damage/CT/SP rider explicitly tested on a
  Calculator (field-wide)** for the oppressive case; Ring's cap/floor holds; Greaves seeds CT once.
- Suite green; `tsc -b` + `vite build` clean; ADRs for any new substrate (CT-drain channel; Glove's
  target-count SP if built); reference/guide equipment sweep updated.

## Out of scope

- **Full movement prediction** (B's deep version — lead the target, pick its likely tile). B is the
  CT-race check only.
- **The AI *dodging* incoming charges** (the defensive half — harder; still deferred with the rest of
  the predictive-positional threat-model).
- The camping/high-ground half of the threat-model (unwanted).
- Future Burn/wand pieces beyond this batch.

## Decision points

- **D1 — one or both increments?** Lean **both** (A has a live symptom + pairs with cohesion; B is a
  narrow CT-check + addresses AI charge-whiffing). Drop B to a follow-up if the session feels heavy.
- **D2 — equipment scope / carve.** Lean: AI increments + the two easy accessories (Pendant, Greaves)
  as one pass; **Ring + Glove as a substrate follow-up** gated on D3. (This is the realistic
  ~1.5-session split.)
- **D3 — Glove of Metria feasibility** (audit-gated): build now if Chain-Lightning reuse is clean,
  else defer. Also settles whether Math Skill counts as multi-target for it.
- **D4 — Calculator guardrails:** Ring's CT-drain cap/% and whether Glove applies to Math Skill —
  the two levers that keep the field-wide case sane. Settle at plan review with the audit's numbers.

## Files (hedged — audit confirms)

AI: the buff-cast + charged-attack scorers (`src/ai/`), `cohesionAnchor`/`isAoeBuffer` neighbors.
Equipment: `onFinalDamage` site + a CT-drain action (sibling to `system_mp_drain`); the
outgoing-status-magnitude hook; battle-start CT seed; equipment catalog definitions; Glove's
target-count SP site (near Chain Lightning). ADRs; Vitest per item; reference/guide sweep.

## Watch-fors

- **The Calculator is the epicenter** — Ring (team-wide CT drain) and Glove (per-target SP) both
  compound on field-wide Math Skill, already the flagged curve-breaker. Guardrail + test there first.
- **Ring soft-lock** — perpetual CT-drain = a target that never acts (the loop pattern's cousin). Cap
  or floor it.
- **AI A over-cluster** — coverage-seeking the buff cast must not pull the caster into enemy-AoE range
  (the AI still can't weigh enemy AoE — same boundary as S73 cohesion).
- **AI B over-correction** — a value penalty, not a ban; charges stay good vs slow/non-acting targets.
- **Greaves CT-seed** must apply once at battle start, not re-trigger.

## Estimated size

Medium-to-large; realistically a session-and-a-half. AI A + B are each small-bounded. Equipment is
2 easy + 2 substrate-heavy (Ring's CT-drain channel; Glove's dynamic SP, feasibility-pending). D1/D2
carve it to fit; my lean is one pass of {A, B, Pendant, Greaves} and a substrate follow-up of {Ring,
Glove}.
