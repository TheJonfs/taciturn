# Session brief — Team builder redesign

## Context

The team builder works functionally but makes you build half-blind and a piece at a time. Two problems, both structural rather than cosmetic:

1. **Decisions without decision-information.** Every choice — class, weapon, gear, ability — is a budgeted tradeoff, but the UI surfaces the *options* (names, costs) while hiding the *basis for choosing*. The weapon picker is the worst case (a flat, creation-ordered dropdown, names only, no stats until after you pick); abilities are checkboxes with a name and a cost and nothing about what they do. The class picker is the one place it's done right — rich comparative cards — and it's the in-house model for the fix.
2. **The build can't be seen as a whole.** A unit is a gestalt (class, gear, five equipment slots, four ability budgets, resulting stats), but the current linear top-to-bottom scroll — worsened by a class grid that never collapses — means you lose your budgets, picks, and stats out of view while you work.

Chris has approved a concept via mockup. The standalone reference is `team-builder-concept.html` (placeholder colors/icons against the game's dark theme — the Ivalician parchment skin is a separate later pass).

## Inputs

- `team-builder-concept.html` — the approved concept, two states: (1) the unit card with the abilities accordion, (2) an opened equipment slot. Open it in a browser.
- `team-builder-architecture.md` and the current builder/editor components.
- `detail-text.ts` — the existing tooltip/description source (feeds both the builder and the in-battle panel today).
- `content-integration-checklist.md` — the layer-sweep; this redesign is a large content/UI surface and will benefit from it.

## Goal

Rebuild the unit editor around a single large **unit card** (complete live stat line including Move and Jump; identity, gender, Brave and Faith consolidated into one section; class collapsed to a "change" control once chosen), an **accordion abilities** region (budgeted multi-select, one category open at a time), a grouped/sorted/searchable **equipment picker** (replacing the flat dropdown), a single **context inspector** that serves both equipment (stat delta vs equipped) and abilities (effect + budget fit), and a **leveled lineup** showing each unit's level. Structure now; the parchment reskin is out of scope.

## Pre-implementation plan (audit)

Report before building — likely pruning opportunities (audit-overturns-spec; the work below is over-specified):

1. **Live stats:** does the builder already compute the full combat stat line, and does it include Move and Jump? The current readout omits them — is that a display gap (cheap) or a computed-stats gap (deeper)? Ideally the card reuses the **engine's stat resolver** rather than a builder-local copy (three-resolver discipline), so class/gear/Brave/Faith changes show live and correctly.
2. **Inspector content source:** can the inspector consume `detail-text.ts` for abilities, and is there an equivalent source for equipment? The Player's Guide already writes equipment detail from the content modules — confirm a shared source so the inspector and the Guide don't drift (single source, two surfaces).
3. **Equipment enumeration:** how are equippable options listed and typed today? Grouping and sorting need a weapon/gear `type` field; confirm it exists or add it.
4. **Budget model + flex:** the per-category point budgets (1/3/3/3) and per-item costs — and how equipment flexes them (two-handed / Monkeygrip hand interactions, the support-budget interactions from the Templar/Assassin work). The accordion's budget meters and the picker's hand-slot logic both read this.
5. **Class picker → mode:** the current grid component, to convert it into a focused "pick" mode that the card's "change class" reopens.

## Implementation work

1. **Layout shell** — left leveled lineup + central unit card + the inspector below the card. The card is the bulk of the space (Chris's target: roughly 0.8 view-width, 0.5 view-height); the lineup keeps its column.
2. **Unit card** — larger portrait; identity (name, gender, Brave, Faith) in one section; complete live stat block (HP/MP/PA/MA/SPD/Move/Jump) updating on class/gear/Brave/Faith; class shown compactly with a "change class" control that reopens the full (big) class grid as a mode, then collapses back on pick.
3. **Accordion abilities** — four categories (Command sets / Reaction / Support / Movement); one open at a time to its full hoverable list, the rest collapsed to a summary line showing picks + budget; budget meters; cost rendered as pips; per-ability and category glyphs at the approved richness (wayfinding, redundant with text — never a required language). Selection is budgeted multi-select; the list is where hovering routes to the inspector.
4. **Equipment picker** — a slot opens a list **grouped by type and sorted**, with key stats inline (WP/range/MA/effect), a search field and a sort control; the currently equipped item tagged; hovering a candidate routes to the inspector. Respect hand-slot rules (two-handers, Monkeygrip) when filtering what a slot offers — and run the content-integration sweep, since that rule lives in several layers.
5. **Context inspector** — one box below the card that tracks focus: a hovered **equipment** candidate shows full detail + delta vs equipped (e.g. `+1 WP`, range unchanged, two-handed → empties left hand); a hovered **ability** shows its effect + how its cost fits the remaining budget. Content from the shared description source (item 2).
6. **Leveled lineup** — each unit slot shows its level (they differ: e.g. 25/24/26/23/27), in addition to the card's level badge.

## Acceptance criteria

- The concept's two states are reproduced: the unit card (complete live stats, accordion, ability inspector) and the opened equipment-slot picker (grouped/sorted/searchable, weapon inspector with delta).
- Stat block is complete (includes Move and Jump) and updates live as class/gear/Brave/Faith change.
- Abilities accordion behaves: one category open at a time, budgeted multi-select, collapsed categories summarize picks + budget.
- Equipment picker is grouped by type, sorted, searchable, with inline stats — no remaining flat creation-ordered dropdown.
- The inspector serves both equipment (delta) and abilities (budget fit) from one source.
- Levels show in the lineup.
- No functional regression: the builder still produces valid teams, validity reporting intact, hand-slot/budget rules still enforced.

## Out of scope

- The **Ivalician parchment reskin** — a separate aesthetic pass; build against the game's existing dark theme.
- Any change to the budget **model** (only its presentation) or to the underlying stat/content data.
- Battle, log, or AI changes.

## Files

- Team builder editor / unit-editor components — primary.
- Class-picker component (→ convert to a mode).
- Equipment dropdown/picker, ability list — primary rebuilds.
- The stat computation path the card reads (ideally the shared engine resolver).
- `detail-text.ts` and any equipment-description source — the inspector's content.
- Unit lineup component — for the level display.
- `team-builder-architecture.md` (reference); `team-builder-concept.html` (visual reference, concept only — do not copy its palette).

## Workflow notes

- Plaintext-review gate before building.
- Audit-and-report on the live-stats data gap (item 1) and the shared description source (item 2) before committing; route a reshaped scope back to Chris.
- Mid-session design questions to Chris.

## Watch-fors

- **Structure before skin.** Don't bake parchment; the concept's palette is placeholder. The reskin is its own pass.
- **Single source, two surfaces.** The inspector must share the item/ability description source with the Player's Guide — don't fork the content. (Same duplication theme the content-integration checklist tracks.)
- **Class-picker-as-mode** must preserve the rich comparative grid for the pick moment — that grid is the part that already works; the mode just gets it out of the way afterward.
- **Budget flex with equipment.** The picker's hand-slot filtering and the ability budget interact (two-handers, Monkeygrip, the Assassin/Templar support-budget cases) — and that rule is duplicated across layers, so apply the content-integration sweep.
- **Reuse the stat resolver.** Live card stats should read the engine's resolver, not a builder-local re-implementation, or the card and battle will disagree.
- **Icon discipline.** Wayfinding (type + category glyphs) redundant with text — the builder is a slow, deliberate surface, so icons must not become a language to learn.

## Estimated size

**Large.** Even with no engine change (likely — the audit may find the stat resolver and description source already exist and prune accordingly), the card, accordion, equipment picker, and inspector are substantial net-new UI, plus the class-picker-to-mode conversion. Worth scoping across more than one session with Chris after the audit — e.g. card + lineup + stats first, then the two pickers + inspector.
