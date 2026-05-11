# ADR-0049: Availability tag + catalog-load validator

**Date:** 2026-05-11
**Session:** 25
**Status:** Accepted

## Context

The Cluster 2 substrate work (per audit Item 18) requires every ability,
item, and command set to declare whether the team-builder UI may
surface it. Session 25 lands the tag and the validator that enforces
it; the team-builder consumer ships in a later session.

Before this session, the catalog only validated duplicate ids at
construction. There was no concept of "this definition exists but
shouldn't appear in the picker." Without the tag, future team-builder
work has nothing to read; without enforcement at catalog load, a
content author could ship a half-tagged catalog and the bug would only
surface when the picker rendered.

## Decision

1. **Field placement.** A required `availability: 'available' |
   'hidden'` field on three base shapes:
   - `AbilityCommon` (covers `ActiveAbilityDefinition` and
     `PassiveAbilityDefinition`)
   - `EquipmentBase` (covers all four equipment kinds)
   - `CommandSetDefinition`

   Not on `StatusEffectType`, `ClassDefinition`, or
   `RulesetDefinition`. Those don't surface to a player-facing picker
   in the spec.

2. **Type lives in its own file.** `engine/catalog/definitions/
   availability.ts` exports `Availability`. The three shapes import
   from it. The single-purpose file is shorter than the alternative
   (re-exporting from one of the three base files), and a future
   "availability" addition (per-tag visibility, content-pack tier) can
   extend the type without touching the importing shapes.

3. **Validator at catalog construction.** A new
   `MissingAvailabilityError` (in `engine/catalog/errors.ts`) is
   thrown by `createCatalog` if any registered ability, item, or
   command set has a non-`'available' | 'hidden'` value (including
   `undefined`). TypeScript already requires the field; the runtime
   check guards against `as` casts and dynamic content.

   Co-located with `createCatalog` rather than a separate `validator.ts`
   module — single check, no current need for a validator surface
   beyond presence.

4. **Test-only definitions default to `'hidden'`.** The builder helpers
   in `engine/abilities/test-fixtures.ts` (`makePassive`, `makeActive`,
   `makeCommandSet`) stamp `availability: 'hidden'` on their output.
   Test-authored abilities don't surface to the team builder.

5. **Hidden in v1 content:** abilities `float`, `fly`, `discharge_strike`,
   `cure`; items `iron_helm`, `iron_mail`, `strength_ring`; command
   sets `white_magic`, `arcane_skill`. Everything else marked
   `'available'`.

   `white_magic` as a whole set is hidden (rather than just `cure`)
   per Chris's session-25 call — until the broader white-magic
   repertoire (Cura, Raise, etc.) lands, surfacing a single-member
   "White Magic (Cure)" picker entry feels thinner than the engine's
   ambitions.

## Rejected alternatives

- **Optional field with `'available'` default.** Cleaner ergonomically
  but loses the "no half-tagged catalog" guarantee. The team-builder
  doesn't care which side a missing field defaults to — it cares that
  every entry has an explicit answer.
- **Per-tag availability** (`'team_builder_visible' | 'ai_generation_visible'`).
  Speculative; v1 has no use case where the two diverge. If a future
  feature needs them to, extend the type.
- **Validator as a separate module.** No other validation surface in
  the codebase warrants the indirection today; co-locating with
  `createCatalog` keeps the check discoverable.

## Consequences

- Every ability / item / command set in `src/content/` and every test
  fixture that builds these definitions inline carries the field.
  Session 25 added the field to ~50 files in one pass.
- Future team-builder work reads `availability` directly; no
  intermediate filtering layer needed.
- A definition with `'hidden'` is still fully functional when authored
  onto a unit (test fixtures, system-emitted abilities like
  `discharge_strike`, current demo mage loadouts with `white_magic`
  on Second Action). Engine semantics are unchanged.

## References

- [`src/engine/catalog/definitions/availability.ts`](../../src/engine/catalog/definitions/availability.ts)
- [`src/engine/catalog/catalog.ts`](../../src/engine/catalog/catalog.ts) (`createCatalog` validator)
- [`src/engine/catalog/errors.ts`](../../src/engine/catalog/errors.ts) (`MissingAvailabilityError`)
- `docs/twentyOnePlanning/session-25-brief.md` (Item 18 in scope)
- `docs/audits/post-20-engine-audit.md` (Item 18 — original audit finding)
