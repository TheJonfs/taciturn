## ADR-0136: The portrait override seam (class-independent character portraits)

**Status:** Accepted (seam laid; durable + speaker-link completion deferred to M5)
**Date:** 2026-07-01

## Context

Portraits are resolved purely from a unit's **current class + gender**
(`portraitUrlFor(classId, gender)`, called in ~8 places; the engine `Unit`
carries `gender` as a cosmetic field the renderer interprets — S55). Two futures
break that assumption:

- **Plot characters need a consistent face regardless of class.** In the campaign,
  a unit can **reclass freely**, independent of where it is in the story. A
  story-relevant character (say, a named lead) should keep *their* portrait even
  after switching from Templar to Knight — a face that endures is a property of
  the durable identity, not of the current class.
- **Story scenes (M5) have speakers**, some of whom are roster units and some of
  whom are story-only NPCs. Either way a line wants to show a portrait, with a
  sensible fallback when no bespoke art exists.

Deriving the portrait from the current class can't express either. Per ground
rule 5 (computed vs. stored), an enduring portrait is a **stored input** on the
durable identity, with class-derivation as the **fallback**, not the source of
truth — the exact shape of the existing `gender` cosmetic field.

## Decision

Introduce a first-class **`PortraitRef`** + a single resolver, so "which
portrait" is a value a consumer can name independently of a unit's class, and so
the override lands in **one** function rather than an N-site edit. Laid this
session (M1.5); the durable field + speaker link are deferred to M5 (both
additive on this seam).

### Shipped now (M1.5, `src/assets/portraits/index.ts`)

```ts
type PortraitRef =
  | { kind: 'class'; classId: ClassId; gender?: Gender } // derive from class; also a "pin"
  | { kind: 'fixed'; key: PortraitKey };                 // a bespoke/plot portrait by stable key

function resolvePortraitUrl(ref: PortraitRef): string | null;
```

- `resolvePortraitUrl` layers over the pure class-derived `portraitUrlFor`; a
  `class` ref resolves exactly as before. A `fixed` ref looks up `FIXED_PORTRAITS`
  (an **empty** registry until M5 art exists); an unknown key → `null` →
  colored-circle fallback, same as an unregistered class.
- Story-scene `DialogueLine.portrait` is now a `PortraitRef` — authored content
  points at a *portrait*, not a class.
- The other ~7 `portraitUrlFor` call sites (renderer, roster/deploy panels) stay
  class-derived; they migrate to `resolvePortraitUrl` only once the durable
  override below exists.

## Deferred to M5 — the completion to-do

These are the two connections that make "a roster unit speaks, with their
enduring portrait and a class fallback, automatically." Both are additive on the
seam above; neither is foreclosed.

1. **Durable per-unit override + threading (unit → portrait).**
   Add optional `portrait?: PortraitRef` to `CampaignUnit`. Thread it through the
   snapshot-fold → `UnitPlacement.portrait?` → engine `Unit.portrait?` → the
   renderer — the **exact `gender` cosmetic precedent** (an opaque field the
   engine carries but never acts on; the renderer interprets it). Then the ~7
   class-derived call sites resolve
   `resolvePortraitUrl(unit.portrait ?? { kind: 'class', classId, gender })`, so a
   bespoke face wins over class derivation in one place, and a unit with no
   override falls back to its class portrait **automatically**.

2. **Speaker → roster-unit link (line → unit).**
   Today a `DialogueLine` is `{ speaker: string, text, portrait?: PortraitRef }`
   — a free-text name + an independent portrait; nothing ties it to a durable
   unit. Add a way to reference a unit (e.g. an optional `unitId` / a `speaker`
   variant), so a line spoken by a roster unit draws its **name + portrait from
   the live `CampaignUnit`** — which matters precisely because the unit may have
   reclassed since the scene was authored. Story-only NPCs keep authoring a name
   + a `fixed`/`class` portrait (or nameplate-only).

3. **The fallback-chain choice (a small M5 call).**
   For a **roster unit**, class fallback is automatic via the `?? { kind:'class' }`
   pattern above. For a **bespoke NPC** whose `fixed` art is missing,
   `resolvePortraitUrl` returns `null` (blank plate/circle), **not** a class
   portrait — an NPC has no obvious class to fall back to. Decide at M5 whether to
   (a) require authors to supply a `class` ref as the NPC's look when no bespoke
   art exists, or (b) add an explicit fallback chain (`fixed` → provided `class`).
   Recommendation: (a) — keep the resolver a single lookup; make the fallback an
   authoring choice.

## Consequences

- When M5 authors scenes and plot characters, the override lands in the durable
  model + one resolver, not an 8-site refactor plus a content rewrite. An
  enduring portrait survives reclassing for free (it's a stored input, not a
  derivation).
- No art or new registry entries are needed to *start* using `PortraitRef`;
  `fixed` keys light up as their assets are added.
- No engine change was made this session; the deferred threading follows the
  established `gender` cosmetic-field path when it lands.
