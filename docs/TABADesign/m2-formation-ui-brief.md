# M2 Progression — Formation UI (implementation brief)

**Status:** review-ready draft. Plaintext review is a hard gate before implementer handoff.
**Visual source of truth (attached):** `formation-roster.html` (roster view) and `formation-celestial-2.html`
(unit dossier: reclass constellation + JP-spend). These are **standalone HTML with hardcoded data** — they
fix the *information architecture and aesthetic direction*, NOT the data layer. The real build wires every
number to the progression selectors below.
**Companion docs:** the S81 handoff (engine shape + selector names), `m2-jp-costing-budget.md` (the ~114
component costs), `m2-progression-jp-implementation-brief.md` (the mechanism this UI drives).

**What this brief is:** the between-battles Formation screen — a **roster view** and a per-unit **dossier**
(reclass + JP-spend). Equipment is a stubbed tab (M3 gear work, not designed). Together with the fold-stamp
flip (§ Implementation 5) this is the thing that **turns JP gating live** — gating is built and dormant
until a UI writes unlock state and the fold stamps the `usable*` masks. (XP/leveling is already live.)

---

## Context
The progression *engine* shipped and is tested (S81): per-class JP pools, derived spend, tier-slot
aggregates, tier gating, reclass access, the ~114-entry component catalog, and XP/leveling. No UI consumes
the reclass/spend selectors yet. This brief builds that UI against the exported selectors — it is
presentation over a settled model, near-zero collision risk with engine work.

## Inputs — the selectors this UI consumes (all from `src/campaign/progression/`, see `index.ts`)
- `availableInClass(unit, classId, catalog)` — the **purse** (earned − derived-spent). Per class.
- `spentInClass(unit, classId, catalog)` — **class-spent** (derived: sum of that class's unlocked-component
  costs). This is the star's brightness; it equals the learned set by construction.
- `earnedInClass(unit, classId)` — earned total (for the "X earned" line).
- `spentByTierSlot(unit, catalog)` → `Map<'${half}:${tier}', number>` — the **tier aggregates** (threshold
  currency). Powers the aggregate progress cards.
- `unlockedTiers(unit, catalog)` → open `${half}:${tier}` slots.
- `reclassableClasses(unit, catalog)` → classes a unit may become **right now** (already unions the
  plot-unique `classAccessOverride`). **THE single source of truth for which stars are open** — do not
  re-derive thresholds in the UI (that was the mockup's click-bug).
- `componentMetaOf(token, catalog)` → `{ cost, nativeClass, exportable }`; `COMPONENT_ENTRIES` /
  `COMPONENT_CATALOG` = the full price list.
- `CLASS_TIER_MAP` (classId → {half, tier}) — lays out the tree.
- Ops (UI commits): `unlockComponent`, `grantOnClassUnlock`, `canEquipPassive`.
- Class **display names via `catalog.name`** — ids are generic (`fire_mage`=Pyromancer,
  `water_mage`=Hydrologist, `earth_mage`=Geosage, `lightning_mage`=Aethurge). Never show ids.

## The three JP quantities — THREE distinct homes (the spine of the whole screen)
This is the one thing that must not be conflated (it was, twice, in prototyping):
1. **Class purse** = `availableInClass` — spendable now, per class. → dossier header ("Monk purse · 260 JP").
2. **Class spent** = `spentInClass` (DERIVED) — how built-up a class is. → the **star's brightness/size**.
3. **Tier-slot aggregate** = `spentByTierSlot` — the sum across a half's tier that thresholds gate on. →
   the **aggregate cards** on the Constellation tab.
Different scopes; the aggregate is NOT a per-class number. Label each by scope.

## Unlockables are a TAGGED UNION — `ability | item | mathParameter | mathValue`
The spend list is not just abilities. Present all four as typed rows (each with a type glyph):
- **Alchemist:** the 4 items (Potion/Phoenix Down/Remedy/Ether) are unlockables; Compound/Throw are
  always-on 0-JP shells → a note, not rows.
- **Calculator:** the 4 Parameters (CT/Height/Level/Current-HP) + 4 Values (Prime/3/4/5) are unlockables;
  the Math cast is the always-on shell; the 5 payloads are normal Command-Set actives.
See the mockup's Alchemist (Items section) and Calculator (Math Skill section) for the rendered treatment.

## Ability-type semantics the rows must convey
- **Actives / Items = unlock-to-USE.** "Learn · X JP" (affordable) / "X JP · short Y" / "✓ Learned".
  Affordability checks the component's **native-class purse**.
- **R/S/M passives = two states:** unlearned → "Learn · X JP"; learned → "✓ Innate" + a carry note. Two
  passives (Expert Former, Mathematician) are **conditional** — exportable like any passive but inert
  without their command set → note "works with [Worldcraft / Math Skill] equipped." They are **not** a
  locked category. *(See open question below re: `canEquipPassive`.)*

---

## View 1 — Roster (`formation-roster.html`)
Portrait-first gallery of all roster units; the entry point. Celestial treatment is *accent, in service of
triage* — recognition (face, name, class, level) leads.
- **Card:** portrait (domain-colored frame; **aura brightness scales with total investment** — veterancy at
  a glance), name (+ brass crest on plot-unique units), current class + level (domain-colored), a
  **JP-glint** badge (bright, gently twinkling) iff purse > 0 anywhere for the unit — the "go spend"
  triage signal — and a **constellation trace** (that unit's invested classes as domain-colored dots sized
  by spend — a build fingerprint).
- **Filters:** All / Has-JP / Physical / Magical / Hybrid (by current class domain).
- **Sorts:** Name / Level ↓ / Newest ↓ / Unspent-JP ↓.
- **Summary:** roster count, count with unspent JP, total idle JP.
- **Click a card → that unit's dossier.**
- **Two entry contexts** (design note, shared core): world-map (neutral management) vs pre-battle (opens
  with deployment context; the "done" action confirms deployment → fight). Build the shared card/grid core;
  the two contexts are a thin wrapping frame. Pre-battle deployment selection can be a follow-up.

## View 2 — Unit Dossier (`formation-celestial-2.html`)
- **Header:** portrait, name, level, current class + tier (domain-colored); the current class's **purse**,
  **spent**, **earned**. *(Also surface XP: a small "XP to next level" (`xp`/100) — but XP is a SINGLE
  per-unit value, do NOT mirror the per-class JP treatment for it.)*
- **Tabs:** Constellation (reclass) · Training (spend) · Equipment (stub, disabled, M3).

### Constellation (reclass)
- Tier tree as a star-chart: 3 domains (columns: Physical / Hybrid / Magical) × 3 altitudes
  (**Horizon** T1 / **Ascendant** T2 / **Zenith** T3). Each class = a star, from `CLASS_TIER_MAP`.
- **Star states:** current (brass halo) · open+visited (bright, size = `spentInClass`) · open+unvisited
  (thin outline) · locked (dashed + the unlock-condition text). **Openness = `reclassableClasses`** (single
  source). Locked-star copy = which threshold is short (derive from `spentByTierSlot` + thresholds).
- **Aggregate cards** (per half): show **both** tier slots — Tier I (/1000) and Tier II (/500) — with
  progress bars and a line naming which condition gates Tier III. (Tier III needs T1≥1000 AND T2≥500, so a
  single bar can't represent it — show both.)
- **Interaction:** click any open star → train there (reclass if not current, then open Training). The
  current star is clickable too (just opens its Training). Reclass writes current-class state.

### Training (JP-spend)
- The current class's unlockable components, grouped and typed: **Items** (Alchemist) · **Math Skill**
  (Calculator params+values) · **Command Set** (actives) · **Passives** (R/S/M). Combinator sections carry
  the "always-ready shell" note.
- Row states per the semantics above; **Learn spends the class purse** (`unlockComponent`), affordability
  vs `availableInClass`.
- **Buying can cross a tier threshold → a new class opens** (`grantOnClassUnlock` grants the tier-scaled
  purse: T1 100 / T2 200 / T3 300, + bound-50 random). Reflect with the star **ignite** feedback + a
  toast; the just-unlocked class then shows its full component list at its granted purse.

---

## Implementation work (over-specified; audit to prune)
1. **Roster view** — consume roster + per-unit selectors; render cards (portrait/aura/glint/trace/crest);
   filters + 4 sorts; summary; click → dossier.
2. **Dossier header + tabs** — per-class purse/spent/earned + XP-to-next; tab switching.
3. **Constellation** — star-chart from `CLASS_TIER_MAP`; states from `reclassableClasses` + `spentInClass`;
   locked copy + aggregate cards from `spentByTierSlot`; click → reclass.
4. **Training** — typed component rows from the catalog (ability/item/param/value); `unlockComponent` on
   buy; ignite + `grantOnClassUnlock` on threshold cross.
5. **Turn gating live** — flip `snapshot-fold.ts` `campaignPlacement` to stamp `usableActives` /
   `usableItems` / `usableMathParameters` / `usableMathValues` from the projections (`usableActiveIds`,
   `usableItemIds`, `usableMathParameterIds`, `usableMathValueIds`). Small change, but it's the step that
   makes unlock state *matter* in battle. Likely a separate commit after the UI writes real unlock state.
6. **Data dependencies (confirm/add):**
   - **Recruitment order** for Sort-by-Newest — the mock stubs a `joined` index per unit; `CampaignUnit`
     needs a monotonic join-index or `recruitedAt`. Confirm one exists or add it (small).
   - **Passive economic model** — confirm the learn-vs-export ruling (open question below).

## Acceptance criteria
- Roster: all units render with correct class/level; JP-glint appears iff the unit has any purse; trace =
  invested classes; all filters + 4 sorts work; click → dossier.
- Dossier: the three JP quantities read from their three selectors and reconcile (star `spentInClass` =
  sum of that class's learned-component costs; purse = `availableInClass`; aggregate = `spentByTierSlot`).
- Constellation: open stars == `reclassableClasses`; locked stars show the correct short-by amount; click
  open star → reclass + Training.
- Training: components grouped by token type; Learn spends the native-class purse; affordability correct;
  a purchase that crosses a threshold opens the new class with its tier-scaled grant and full list.
- Passives: two states; conditional passives noted; nothing shown as permanently un-exportable (pending the
  ruling).
- Gating live: after the fold flip, a locked component is genuinely unusable in battle (menu greyed /
  picker filtered) — the payoff.

## Out of scope
Equipment tab (M3 gear — hook only) · the "Level Up!" in-battle banner (separate animator primitive) ·
enemy progression authoring · pre-battle deployment-selection flow (build the shared roster core; the
deployment wrapper can follow) · spillover mechanic.

## Files (likely; audit to confirm)
- New: roster view, dossier view, star-chart, training-list components (+ tests).
- `snapshot-fold.ts` — the `usable*` stamp flip (gating-live step).
- `campaign/types.ts` — recruitment-order field if not present.

## Workflow notes
- **Plaintext review is a hard gate.**
- The mockups fix **information architecture (firm)** + **aesthetic direction (intended)**. If the celestial
  skin needs adjustment for perf/engine reasons, the *firm* parts are: three-quantity model in three homes,
  tagged-union typed rows, `reclassableClasses`-as-single-openness-source, gating legibility (locked stars
  say why), and the roster triage signals (glint, filters, sorts). The star-chart/aura/glint *language* is
  the intended direction, not a hard constraint on rendering tech.
- Compose on existing patterns (three-resolver discipline for any new gating query; post-state-absolutes).

## Watch-fors
- **Don't conflate the three JP quantities**; **spent is derived** (never store it).
- **`reclassableClasses` is the ONLY openness source** — re-deriving thresholds in the UI reintroduces the
  click-bug.
- **Field Kit vs item unlocks** (handoff): Field Kit stockpiles items at setup regardless of unlock; the
  Throw validator gates use, but the stockpile still holds it. Harmless, but if the *spend UI* reads the
  stockpile anywhere, don't infer "unlocked" from "stockpiled."
- **Tagged-union rows** are components, not bucket-abilities.
- **Display names via `catalog.name`.**

## Open question to resolve with the implementer (decides a UI note, not structure)
Does `canEquipPassive` return **false** for Expert Former / Mathematician on a foreign class (a real access
block — over-restrictive, needs a code fix), or **true**-but-inert (correct — only the "native-only" label
is wrong)? Chris's ruling: they ARE exportable, merely conditional on the matching command set. The UI is
built for the *true-but-inert* target either way; confirm whether this is a code fix or a doc fix. The
learned-passive **note** ("carries to other classes" vs a free-in-native/pay-to-export phrasing) also
depends on the final economic model — the row *states* are identical regardless; only the caption flips.

## Estimated size
**Large** — two full views + the gating-live flip + two data deps. Natural split: (a) roster + dossier UI
consuming the selectors, then (b) the fold-stamp flip that turns gating live once real unlock state exists.
