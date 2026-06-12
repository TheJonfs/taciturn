## ADR-0105: Weapon-type classification field

**Status:** Accepted
**Date:** 2026-06-11

## Context

The team-builder redesign (the team-builder brief, Pass 2) groups the
equipment picker's candidates by weapon family — Swords, Knight Swords, Knives,
Axes & Hammers, Polearms, Bows, Wands, Staves — the way the approved concept
does. Weapons carried no field that expressed that family. They do have a
damage `tags` array (`'sword'`, `'knife'`, `'axe'`, `'lance'`, `'bow'`,
`'staff'`, `'wand'`), but it is a *damage-composition* tag, not a
classification, and it can't distinguish a knight sword from a regular sword —
both tag `'sword'`; the difference (two-handed, Brave-variance) lives in other
fields.

The codebase already *thinks* in these families: the per-weapon
`physicalVariance` arms are authored per family (knives `attacker_speed`, bows
`height_delta`, knight swords `attacker_brave`), and the variance-doc comments
name "the knife class", "the bow class", "the Knight Sword class". The
classification was implicit; the picker needed it explicit.

## Decision

Add a `WeaponType` union and an optional `weaponType` field to
`WeaponEquipment`:

`sword | knife | knight_sword | axe | polearm | bow | wand | staff`

- **`knight_sword` is distinct from `sword`** — the two-handed, high-WP,
  Brave-variance swords (Absolom, Defender) are their own family, per the
  variance authoring already in place.
- **`axe` covers axes *and* hammers** (War Axe, Bolt Hammer) — one family, per
  Chris's call. They already co-tag `'axe'`.
- The eight families were chosen for **mechanical meaning, not just display**
  (Chris): each behaves differently today (variance arms) and the field is the
  hook where future per-family mechanics attach.

**Optional at the type level, enforced for real content by a loader test.**
`weaponType?` rather than required: the engine's many throwaway test-fixture
weapons (which never reach the picker) would otherwise all have to carry a
meaningless value — churn across ~15 unrelated test files. Instead, every real
content weapon declares it, and `loader.test.ts` asserts *every available
weapon has a weaponType*. The picker buckets a missing value into a catch-all
"Other weapons" group, so an unclassified weapon surfaces loudly in the UI
rather than vanishing.

## Consequences

- The team-builder equipment picker groups/sorts by `weaponType`; the field has
  no engine-mechanics consumer yet (display + classification only).
- A new weapon must set `weaponType` or the loader test fails — fail-loud for
  the place it matters (real content), no friction for engine fixtures.
- The field is the designated extension point if a future mechanic keys on
  weapon family (e.g. a class that may only equip knives, a per-family passive).
  Promoting it to required would then be a deliberate change with a fixture
  sweep, not a silent default.
- Distinct from `tags`: `tags` stays the damage-composition channel;
  `weaponType` is the classification. They overlap in spelling for most
  families but are not the same field (knight swords are the worked example).
