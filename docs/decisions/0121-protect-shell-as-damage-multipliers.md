# ADR-0121 — Protect / Shell reworked from additive resistance to one-directional damage multipliers

**Status:** Accepted
**Session:** 72 (2026-06-22)
**Relates:** ADR-0015 (signed-max resistance composition), ADR-0057 (resistance absorption), ADR-0028 (compose-via-existing-hook), ADR-0120 (Enchanter / cast Protect+Shell).

## Context

Protect and Shell were authored as additive `modifyResistance` buffs (+50 to the
`physical` / `magical` tag respectively). Because resistance composes by
**signed-max across the damage's tags** (ADR-0015), that produced behavior the
designer found unintuitive:

- Shell's +50 *competed* with elemental resistance rather than stacking — adding
  fire resistance under Shell did nothing until it exceeded 50 (max-wins).
- It *overrode* elemental vulnerabilities rather than mitigating them — a Geosage
  (native fire −50) hit by a fire-magical spell went from 150 damage to **50**
  (the +50 magical tag won the signed-max over −50 fire), not a halving to 75.
- It could never reach absorption itself (only Shell feeds the `magical` tag, and
  it's REFRESH-capped at 50), yet it lived in the same "resistance number" space
  as the absorption mechanic, muddying the model.

After working through the alternatives (keep as-is; true 0.5× multiplier;
+50 to all element tags), Chris chose a refined multiplier form.

## Decision

**Protect and Shell are one-directional damage multipliers, not resistance
numbers.** Each registers an `onDamageReceived` handler (the suppressed Damage
Reduction passive's precedent) that pushes a multiplier into `ctx.multipliers`
when the damage carries its tag (`physical` / `magical`):

- **Factor = `(100 − magnitude) / 100`, clamped at 0.** Magnitude is reinterpreted
  as the **% reduction** (default 50 ⇒ ×0.5). Keeping the value in `magnitude`
  (not a hardcoded 0.5) means the planned buff-amplifier scales the cut by scaling
  the magnitude (60 ⇒ ×0.4), consistent with the additive-magnitude buffs.
- **Applied after resistance, before variance/crit** (the existing target-stage
  order: `resistance_check` → `fireOnDamageReceived`). So resistance sets the
  starting rate and Protect/Shell halve it: Geosage fire 150 → **75**; neutral
  target 100 → **50**.
- **One-directional.** `raw = (base + additives) × ∏multipliers`, and at
  `onDamageReceived` time the only sign-flipping multiplier present is the
  resistance factor. So the handler computes the running product and **skips the
  reduction when it is already negative** (resistance > 100 has flipped the result
  to absorption) — Protect/Shell never reduce damage you *absorb*. A target
  absorbing 50 keeps absorbing 50.

The behavior lives once per buff (`protectMitigationHook` / `shellMitigationHook`
in `protect.ts` / `shell.ts`) and is shared by the permanent equipment-grant type
and the timed cast sibling (the regen / regen_auto pattern, ADR-0120) — so a buff
behaves identically regardless of source.

## Consequences

- **Protect/Shell now COMPOUND with native resistance** (multiplicatively) instead
  of competing with it (signed-max). A resistance-stacked unit + Shell is reliably
  tanky against magic — a genuine power increase versus the old max-wins brake.
  Flagged for the playtest pile.
- **They no longer participate in the resistance/absorption game.** Shell can't be
  pushed over 100 to flip an element; absorption comes solely from `modifyResistance`
  sources (Capacitor Ring, Engineered Defenses, etc.). Resistance Save and
  Engineered Defenses remain additive-resistance buffs — unchanged.
- **The AI's `projectExpectedDamage`** reuses the live `onDamageReceived` handler
  (it's not a random-rolling stage), so projected damage accounts for Protect/Shell
  automatically — no AI change.
- **Tooltips updated** (`detail-text.ts`): Protect/Shell now read "halves incoming
  physical/magical damage." The Enchanter's cast-Protect/Shell ability lines
  ("half incoming …") were already accurate.
- Tests in `session-29` (Shell/Protect composition) and `session-62` (Defender's
  Auto-Protect) rewritten to drive `onDamageReceived` (including the one-directional
  absorption case). Suite green (2018).

## Note on Protect

Chris's directive described the magical (Shell) behavior; the change was applied
symmetrically to Protect so the two buffs stay the same *kind* of thing. Physical
damage is usually single-tagged, so Protect rarely hit the signed-max quirk, but
the symmetry keeps "+50 Protect / Shell" meaning one consistent mechanic.
