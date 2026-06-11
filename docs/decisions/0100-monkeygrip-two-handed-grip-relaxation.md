## ADR-0100: Monkeygrip — declarative two-handed-grip relaxation

**Status:** Accepted
**Date:** 2026-06-10

## Context

The Templar's **Monkeygrip** (Session 62, from FFTA) lets two-handed weapons
require only one hand, so the bearer can pair a two-hander with an off-hand item
— a shield, or (with Two Weapons, which grants the second swing) a second
two-hander (the budget-gated dual-two-hander combo). The two-handed rule is
enforced at **setup**: `validateEquipmentPlacement` (`create-initial-state.ts`)
throws when a two-handed weapon shares a hand with any off-hand item.

The design question (raised by Chris): how does Monkeygrip's relaxation differ
from how **Two Weapons** enables dual-wield?

**Finding — they are structurally different.** The equip validator **never
consults passives**. Equipping two weapons is *always* legal; Two Weapons only
grants the **second swing at attack time** via the `modifyDualWield` runtime
hook (the swing loop in `reducers.ts`). So there was **no precedent** for "a
passive legalizes a loadout." Monkeygrip is the first case where a passive
affects *equip legality* — a setup-time, static property, not a runtime behavior.

## Decision

### Declarative capability flag, read by the validator

Add `readonly relaxesTwoHandedGrip?: boolean` to `PassiveAbilityDefinition`.
Monkeygrip sets it `true` and carries **no runtime hook** (`hooks: []`).
`validateEquipmentPlacement` collects the unit's loadout passives
(`Object.values(placement.loadout.passiveBuckets).flat()`), looks each up in the
catalog, and if any declares `relaxesTwoHandedGrip` it **skips** the
two-handed-occupies-both-hands throw.

Rejected alternative — a new passive **hook** (e.g. `modifyTwoHandedGrip`) the
validator fires, symmetric with Two Weapons' `modifyDualWield`. Reasons against:

1. **Equip legality is static, not runtime.** It's settled once at setup; it has
   none of the per-action, state-dependent character the closed runtime hook
   surface (ground rule 8) exists to serve. A declarative flag models it honestly.
2. **The Two Weapons symmetry is superficial.** `modifyDualWield` fires at
   *attack time* — the natural home for hooks. Monkeygrip's concern is purely
   pre-battle. Reusing the hook machinery here would run a runtime-style hook in
   an unusual (stateless, pre-battle) context.
3. **Boundary stays clean either way.** The engine validator reads a *flag* off
   ability metadata via the catalog; it never references the `monkeygrip` id, so
   the engine/content boundary holds without needing a hook to launder it.

### Both hands, either direction

The relaxation lifts the rule symmetrically (the validator's two-handed check
already iterates rightHand↔leftHand both ways). So Monkeygrip permits a
two-hander + shield, a two-hander + one-hander, and a two-hander + second
two-hander. Whether the off-hand actually *swings* remains gated by Two Weapons
(`modifyDualWield`) at attack time — Monkeygrip only governs what may be equipped.

## Consequences

- The dual-two-hander combo is reachable exactly as the concept-notes' budget
  math intends: Monkeygrip (2) + Two Weapons (3) = 5 support points, affordable
  only by a class with one half innate (Templar has Monkeygrip free; Assassin has
  Two Weapons free; Knight is hard-locked-out at 5 > 3+1).
- First use of `relaxesTwoHandedGrip`; the field generalizes to any future
  "relaxes an equip rule" capability without a hook.
- Monkeygrip is authored `available` (any class can slot it for the 2-point
  Support cost); innate-free on the Templar is wired at class assembly (Step 5).
- No runtime cost — the flag is read once per unit at setup.

## Tests

- `src/engine/setup/session-62-monkeygrip.test.ts` — a two-hander + off-hand
  loadout is rejected without Monkeygrip and accepted (both hands equipped) with
  it, through the real `createInitialState`.
- `src/content/session-62-templar-foundation.test.ts` — the capability flag,
  empty hooks, and cost-2 Support shape.
