# Content ID Registry

*Started session 16 (2026-05-06).*

A flat lookup table of every content ID currently in the catalog: `id` (used internally everywhere — command sets, hook lookups, tests, debug fixtures) ↔ `name` (display string, freely renamable).

Use this as a quick reference when:
- Renaming abilities / statuses / classes (touch `name`, leave `id` alone unless you commit to a multi-file rename).
- Adding new content (pick an id that doesn't collide; add a row here).
- Reviewing the current content surface at a glance.

Keep this in sync with the catalog. If you rename a `name`, update the row. If you add a new content item, append a row.

---

## Classes

| ID | Name | File |
|---|---|---|
| `knight` | Knight | `src/content/classes/knight.ts` |
| `earth_mage` | Earth Mage | `src/content/classes/earth-mage.ts` |

## Command sets

| ID | Name | Members | File |
|---|---|---|---|
| `battle_skill` | Battle Skill | `attack` | `src/content/command-sets/battle-skill.ts` |
| `white_magic` | White Magic | `cure` | `src/content/command-sets/white-magic.ts` |
| `arcane_skill` | Arcane Skill | `bolt` | `src/content/command-sets/arcane-skill.ts` |
| `earth_spells` | Earth Spells | `earth_strike`, `earth_blessing`, `earth_curse` | `src/content/command-sets/earth-spells.ts` |

## Active abilities

| ID | Name | Bucket | Charged? | File |
|---|---|---|---|---|
| `attack` | Attack | first_action | no | `src/content/abilities/attack.ts` |
| `cure` | Cure | second_action | no | `src/content/abilities/cure.ts` |
| `bolt` | Bolt | first_action | yes (actionSpeed 25) | `src/content/abilities/bolt.ts` |
| `earth_strike` | Earth Strike | first_action | yes (actionSpeed 25) | `src/content/abilities/earth-strike.ts` |
| `earth_blessing` | Earth's Blessing | first_action | yes (actionSpeed 30) | `src/content/abilities/earth-blessing.ts` |
| `earth_curse` | Earth Curse | first_action | yes (actionSpeed 30) | `src/content/abilities/earth-curse.ts` |

## Passive abilities

| ID | Name | Bucket | File |
|---|---|---|---|
| `move_plus_1` | Move +1 | movement | `src/content/abilities/move-plus-1.ts` |
| `float` | Float | movement | `src/content/abilities/float.ts` |
| `fly` | Fly | movement | `src/content/abilities/fly.ts` |
| `counter` | Counter | reaction | `src/content/abilities/counter.ts` |
| `earth_resilience` | Earth Resilience | reaction | `src/content/abilities/earth-resilience.ts` |
| `earth_communion` | Earth Communion | support | `src/content/abilities/earth-communion.ts` |

## Status types

| ID | Name | Tag(s) | Stacking | Duration | File |
|---|---|---|---|---|---|
| `haste` | Haste | positive, time | REFRESH | per_unit_ct | `src/content/statuses/haste.ts` |
| `stop` | Stop | negative, time, mental | REFRESH | per_unit_ct | `src/content/statuses/stop.ts` |
| `charging` | Charging | neutral, time | REJECT | conditional | `src/content/statuses/charging.ts` |
| `regen` | Regen | positive | REFRESH | per_unit_ct | `src/content/statuses/regen.ts` |
| `movement_debuff` | Movement Debuff | negative, earth | REFRESH | per_unit_ct | `src/content/statuses/movement-debuff.ts` |
| `movement_self_buff` | Earthen Resolve | positive, earth | STACK_INDEPENDENT | per_unit_ct | `src/content/statuses/movement-self-buff.ts` |
| `blind` | Blind | negative, mental | REFRESH | per_unit_ct | `src/content/statuses/blind.ts` |
| `silence` | Silence | negative, mental | REFRESH | per_unit_ct | `src/content/statuses/silence.ts` |

## Rulesets

| ID | Name | File |
|---|---|---|
| `default` | Default Ruleset | `src/content/rulesets/default.ts` |

---

## Conventions

- **IDs are snake_case strings.** Branded types in code (`AbilityId`, `StatusTypeId`, etc.) wrap them.
- **Display names are freely flexible.** Rename in the `name` field of the definition; no other file changes needed.
- **Renaming an ID is a multi-file rename.** Touches the definition file, command set member arrays, tests, fixtures, and any debug references. Avoid unless the rename is high-value.
- **Earth Mage's "Earthen Resolve"** is the display name of the `movement_self_buff` status; the ID stays generic so future classes (Wind Mage, etc.) could use a similarly-shaped buff under a different display name without changing the engine wiring.
