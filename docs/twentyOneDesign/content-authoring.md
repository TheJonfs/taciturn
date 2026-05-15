# Content authoring conventions

Design conventions that apply across content authoring sessions —
equipment, abilities, and future content classes. Each entry captures
intent, not pattern: the *why* of a design pattern that has accrued
from prior sessions, in a form discoverable by future authoring
sessions.

Authoring patterns themselves (how to declare a `statMods` field, what
`PartialBaseStats` looks like) live in the item / ability definition
modules. This doc is the design layer above those.

---

## HP-on-every-armor-piece

Every armor and head equipment piece in the catalog grants at least
some HP via `statMods.maxHpBase`, even if its primary value is
elsewhere (resistance, capacity bump, stat trade).

**Rationale.** Mage damage at higher MA is large in absolute terms —
a Lightning Mage with high MA and no native defenses can one-shot a
unit in light-or-no armor through clean elemental matchups. HP scales
the chunkiness of every hit relative to the unit's effective pool;
without a baseline HP commitment from every armor piece, a unit's
practical durability collapses to "what their class baseline gives
them," which is too low against magical-tier output.

**How to apply.**

- New head pieces should grant at minimum `maxHpBase: 10`.
- New body armor should grant at minimum `maxHpBase: 20`, generally
  higher (the body slot is where most HP lives).
- Even niche / specialist pieces (the Mage Tricorn's Brave bump,
  Crusader's Helm's Faith bump) carry a small HP value so they don't
  become "naked the body slot" plays.
- The principle is asymmetric: weapons / accessories / shields don't
  have to carry HP. The constraint is on the slots whose primary
  contract is "absorbs incoming damage."

**Watch-for.** When authoring a new piece whose distinct identity
feels watered down by an HP bump, push back on the *amount*, not the
floor — drop to the minimum (10 / 20) rather than dropping HP
entirely.

---

## Tradeoffs-not-tiers

Equipment offers *build choices*, not *power tiers*. A new piece
should differ from the existing pool along *multiple axes* — some
better, some worse — rather than being strictly better or strictly
worse than what already exists. The same applies to ability content.

**Rationale.** A strict tier means the optimal play is always
"equip the highest-tier piece I can," which collapses the team
builder's choice surface into a checklist. A real tradeoff means
the player has to read the engagement (opponent composition, map,
team archetype) and pick — that's where the depth lives.

**How to apply.**

- Before authoring a new piece, audit the existing pool for its slot
  / class restriction. List what the new piece is *better* than the
  existing options at, and what it's *worse* at. If both columns
  aren't populated, redesign before authoring.
- "Better at HP but worse at MP" is a tradeoff. "More HP and more
  MP at the same cost" is a tier bump.
- Tradeoffs can compose across multiple dimensions: Light Robe vs.
  Sorcerer's Robe is "narrower elemental coverage but higher per-
  element resistance, more HP, no Move bonus, less MP" — a four-
  axis tradeoff.
- The tier check applies within the same class restriction: a
  Knight-only piece doesn't have to trade off against a Mage-only
  piece; the meaningful comparison is among slot-and-class peers.

**Worked example — Light/Dark Robe revision (S37).**

The original Light Robe / Dark Robe specs (paired four-element
resistance, +50 HP, no MP) read as strictly worse than Sorcerer's
Robe (Move +1, +50 to all four elements, +30 MP, Auto-Shell
statusGrant). Same slot, same class restriction, less of everything.
The revised specs:

| | Sorcerer's Robe | Light Robe | Dark Robe |
|---|---|---|---|
| HP | +30 | **+75** | **+75** |
| MP | +30 | +20 | +20 |
| Movement | **+1** | — | — |
| Fire resist | +50 | **+75** | — |
| Lightning resist | +50 | **+75** | — |
| Water resist | +50 | — | **+75** |
| Earth resist | +50 | — | **+75** |
| Auto-Shell | **yes** | no | no |

Each option dominates the others on some axes:
- **Sorcerer's Robe** for all-element balanced coverage + mobility +
  the Auto-Shell magical resist.
- **Light Robe / Dark Robe** for higher single-pair elemental
  resistance against a known opponent element — but at the cost of
  narrower coverage, no Auto-Shell, no Move bonus, less MP.

The decision-relevant axes are "do I know what element my opponent
leans?" and "do I value mobility / MP / breadth more than peak
matchup resistance?"

**Watch-for.** A new piece that's "the best at X" without giving up
something else is the tell. If the only thing it loses on is "it
costs the slot" — that's not a tradeoff, that's a tier bump.

---

## Where this doc lives

`docs/twentyOneDesign/content-authoring.md`. New conventions that
emerge from authoring sessions get appended; existing entries get
revised when the rationale shifts. Reference from new-content session
briefs so the principles inform authoring before the audit catches
violations.
