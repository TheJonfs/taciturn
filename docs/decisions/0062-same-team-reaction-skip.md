## ADR-0062: Same-team reaction skip

**Status:** Accepted
**Date:** 2026-05-12

## Context

Reactions in v1 (Counter, Smolder, Discharge, Tidal Pull, Earth Resilience) fire via `runOnActionTargeted` when a unit is targeted by another unit's action. The pre-Session-29 implementation didn't filter by team, so an ally healing or buffing another ally could trigger that ally's adversarial reactions — Counter would swing back at a friendly Cure caster, Smolder would Burn the friend who buffed them. This isn't a bug per se (the engine doesn't have an intrinsic notion of "adversarial reaction"), but it conflicts with the game's design intent: reactions read as "I retaliate against threats," which should not fire on allies.

The audit (Session 29) revealed a clean chokepoint: `runOnActionTargeted` is the single site where reactions are enumerated from a triggering event. The filter slots in cleanly.

## Decision

**`runOnActionTargeted` skips reactions when the incoming action's `actorId` exists AND its owner is on the same team as the reacting unit. Returns an empty array immediately, before handler collection.**

```ts
if ('actorId' in args.incomingAction) {
  const source = state.units.get(args.incomingAction.actorId);
  if (source !== undefined && source.team === args.unit.team) {
    return [];
  }
}
```

System actions (no `actorId` on the envelope — `turn_start`, environmental damage, `system_damage` from a status tick) fall through unfiltered. A unit can still react to fall damage or other environmental sources.

The runner returns `[]` (empty surviving reactions) rather than emitting a "filtered" diagnostic; the Brave roll never fires for filtered cases.

No new field on reaction definitions. A future `triggerOnAllies?: boolean` opt-in would allow per-reaction override (a berserker-class trait, an "ally-protection" reaction), but no current content needs it — adding the field now would be authoring against hypothetical requirements per CLAUDE.md.

## Rationale

**Default behavior is "skip same-team."** This is the design intent for every v1 reaction. None of the v1 set (Counter, Smolder, Discharge, Tidal Pull, Earth Resilience) makes sense firing on an ally:
- Counter swings back at the attacker; a friendly Cure isn't an attack.
- Smolder Burns the attacker; Burning your healer is anti-team.
- Discharge magical-retaliates the attacker; same logic.
- Tidal Pull bumps the attacker's CT down; punishing a buff caster is anti-team.
- Earth Resilience reduces incoming damage; an ally heal isn't incoming damage.

The opt-in `triggerOnAllies` field is the cleaner shape *when content asks for it* — a berserker-class trait could legitimately fire reactions on allies. Until that content ships, the field is unauthored.

**Chokepoint at the runner entrance, not the handler.** Two implementation sites were possible:
- **At the runner** (chosen) — filter before handler collection. Saves the active-handler collector pass when the result will be empty anyway.
- **At each handler** — each reaction's onActionTargeted body checks `args.unit.team === args.attacker.team`. Distributes the filter, repeats the check per-reaction, and forgets the check on a new reaction author's first try.

The runner-side filter is the engine-uniform answer. Author writes a reaction handler without thinking about team filtering; the chain does the right thing by default.

**System actions fall through unfiltered** because they have no `actorId`. The check is `'actorId' in args.incomingAction` — falsy for `turn_start`, `system_damage`, `status_tick`. Reactions still fire for environmental damage (fall damage triggers Counter, hypothetically — except Counter's targeting type-checks block self-targeting). Status-tick-targeted reactions also pass through. The "actor is on the same team" check is the gate; "no actor" is the gateless path.

**Null-safe source lookup.** `state.units.get(args.incomingAction.actorId)` may be undefined for KO'd or removed units (rare but possible in a chain — a reaction firing against a unit that died mid-chain). In that case, the filter falls through (no team match check possible) and the reaction fires. Reasonable: if the actor is gone, the reaction targeting the action's effect (which is still in flight) should still resolve.

## Consequences

- **Brave roll never fires for filtered cases.** The runner returns `[]` before the Brave-gating logic. Saves a small amount of work (one `runModifyStatQuery('brave')` per filtered call). Per-action seed determinism is preserved: filtered calls don't consume a seed slot.

- **No content changes.** Every v1 reaction continues to behave the same way against cross-team actors. Same-team triggers (which would previously have rolled and possibly fired) now consistently no-op.

- **Test coverage in `session-29-integration.test.ts`.** Three cases pinned: same-team skip, cross-team passthrough, system-action passthrough.

- **`triggerOnAllies` reserved for future content.** When a content author surfaces a real "fires on allies too" need, the field lands then with a per-reaction default of `false` to preserve current semantics.

## Alternatives considered

**Per-handler filtering.** Rejected — distributed responsibility, easy to forget on new reactions.

**Add `triggerOnAllies?: boolean` field now (default false) for explicit opt-in.** Considered — would document the semantic at the reaction-definition site rather than just in the runner. Rejected for now per CLAUDE.md's "don't add features for hypothetical future requirements" — no v1 content needs the opt-in.

**Filter at the action-commit site (refuse a Counter from emitting when same-team).** Rejected — commit-site filtering would interact with chain depth and reaction-cap accounting in non-obvious ways. The enumeration-site filter is the cleanest.

**Tier-based filtering (Equipment-tier reactions skip same-team, others don't).** Rejected — the per-tier discrimination has no design support; the rule "reactions don't fire on allies" applies uniformly.

## References

- `src/engine/hooks/runners.ts` — `runOnActionTargeted` same-team filter.
- `src/engine/actions/session-29-integration.test.ts` — same-team skip, cross-team pass, system action pass.
- ADR-0021 — reactions and Brave gating.
- ADR-0024 — action chain and reaction-cap accounting.
