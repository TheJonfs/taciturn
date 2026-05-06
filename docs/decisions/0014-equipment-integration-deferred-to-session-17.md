## ADR-0014: Equipment integration deferred to session 17

**Status:** Accepted
**Date:** 2026-05-06

## Context

The Battle Mechanics Guide treats `WP` (weapon power) as a separate factor in physical damage: `base_damage = PA × WP × power_coefficient`. Current code (`physicalPaWp` in `src/engine/damage/handlers.ts`) collapses WP into the ability's `power` field — the handler computes `baseDamage = PA × power` and a comment notes that real WP composition lands when equipment ships. The reconciliation report (item 1.1) flagged this divergence and asked: when does WP become real?

Sessions 14–20 plan four magical attacker classes plus a Knight expansion. The Mage classes don't depend on WP at all — magical damage scales on MA. Only the Knight expansion (session 17) introduces a class whose identity is tied to its weapon, and that's where WP-as-a-real-factor first matters for content. Building equipment infrastructure earlier (in session 14, alongside magical damage) would build the plumbing without a content consumer to validate the shape.

## Decision

**Equipment integration lands in session 17, alongside the Knight expansion.** Until then, abilities continue to embed WP into their `power` field; the rename is semantic, not structural — the engine field stays `power`, but it represents `WP × power_coefficient` (i.e., the *combined* weapon-and-ability scalar).

When session 17 lands, two things happen:
1. `physicalPaWp` (and any other physical handlers) refactor to read `WP` from the attacker's equipped weapon and compose `PA × WP × power_coefficient`. Abilities that previously embedded WP in `power` migrate to a smaller `power_coefficient` value (their old `power / weapon_WP`), so damage numbers match.
2. The first equipment definitions ship: a Knight sword (gives WP), plus 1–2 other equipment items (a stat-buff item like a "Strength Ring" and a status-applying item like "Boots of Haste") to exercise the equipment integration broadly enough that it isn't a single-consumer pattern.

## Consequences

- **Session 14 (magical damage) doesn't need to know about equipment.** Magical damage's `MA × power × Faith_factor` formula has no WP term. Session 14 can ship without any equipment plumbing.

- **Session 17's scope expands.** In addition to the Earth Mage AoE/Ultimate work and the Knight ability expansion, session 17 introduces equipment as a real concept: the `Equipment` type on Unit, equipment-slot definitions on classes, the equipped-weapon WP read at the physical base stage, and 2–3 starter equipment items. The session is already heavy; this is the right place because the Knight expansion is the first content that *needs* equipment.

- **The current `power` field is overloaded until session 17.** It means "the combined `WP × power_coefficient`". When session 17 splits them, existing physical abilities (Attack, future Knight Battle Skill abilities) need their `power` value reinterpreted. The migration is a values-only change — the type stays `power: number`, just with a different mental model.

- **Documentation now matches reality.** The Battle Mechanics Guide stays as-is (it already describes the eventual `PA × WP × power_coefficient` shape); the engine catches up in session 17. No spec lies in the meantime — the `power` field is documented as "the combined WP × coefficient until equipment ships."

- **AbilityDefinition's `power` field doesn't change name.** Renaming to `power_coefficient` would be churn for no current benefit (the spec talks about `power_coefficient` semantically; the type stays `power`). The rename is documentation, not code.

## Alternatives considered

**Land equipment in session 14, alongside magical damage.** Rejected because magical damage doesn't need it — building equipment without a content consumer that exercises it risks the shape being wrong. Session 17's Knight expansion is the natural first consumer.

**Land equipment in a dedicated session between 14 and 17.** Rejected because the only consumer in that window would still be the existing physical attack — nothing in 15 (charged actions) or 16 (Earth Mage) needs WP. A dedicated session would build infrastructure ahead of need.

**Keep the current "WP folded into power" pattern indefinitely.** Rejected — the content surface in session 17+ has classes whose identity is "weapon X gives me Y": the Knight's sword, future Lancer's spear, future Archer's bow. That distinction is meaningful and needs the WP factor real.

## References

- `src/engine/damage/handlers.ts` (`physicalPaWp`) — current handler with the WP comment.
- `docs/battle-mechanics-guide.md` — physical damage formula.
- `docs/roadmap-sessions-14-20.md` — session 17 scope.
- Reconciliation report item 1.1.
