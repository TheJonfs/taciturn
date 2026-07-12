# ADR-0146: AI competency refresh (pre-M4) — audit, effect-shape floor, gear valuation

**Status:** accepted (S89)
**Context:** `docs/TABADesign/taba-ai-refresh-brief.md` (audit-first by design;
Chris's rulings: WI4 delivers both worn-gear-aware scoring AND a
generator-consumable valuation function; checkpoint after the audit; the
architecture summary becomes a durable design doc). Audit findings:
`docs/TABADesign/taba-ai-refresh-findings.md`. The durable reference this
session established: `docs/design/ai-substrate.md`.

## What shipped

All seven scoped items (audit + fixes 1–7, none cut). The audit found the
substrate far stronger than the brief assumed — 5 of 6 levers already shipped
in S56–S76 — and the real gaps were **effect discriminants the scorer never
learned**. Fixes therefore compose into the existing unified pool; no engine
queries were added.

## Decisions

### 1. Per-class competence stays emergent — fixes are effect-shape branches

The audit confirmed the substrate's core property: there are no per-class
policies; a class plays well iff its kit's effect discriminants have scorer
branches. The refresh deliberately preserved that — every fix is a new
discriminant branch (grapple-throw, cleanse, removeKO) or a shared valuation
upgrade (debuff floor), never a `classId` special case. The coverage table in
`ai-substrate.md` is now the authoring checklist: new ability shapes must
either ride an existing discriminant or get a scorer branch.

### 2. Debuff floor values are content-declared (`aiHints.value`)

`StatusEffectType.aiHints` gained `value?: number` — a damage-equivalent floor
weight for landing the status (Stop 40, Don't Act 30, Slow 25, Silence 22,
Blind/Speed-Down 18, Poison/Hamstrung/PA-Down/MA-Down/Vulnerable 15,
Brave/Faith-Down/Burn 12, Movement-Debuff 10; AI-side default 12 for
undeclared). The scorer multiplies it by the engine's **real land chance**
(`computeStatusChance` — the same body the reducer rolls, so factors,
resistance, and hooks compose) and the target's HP ratio (control belongs on
healthy threats). Chris chose content-declared over an AI-side table so new
statuses stay self-describing, matching the `polarity` precedent. Vulnerable
keeps its superior setup→exploit marginal-damage math. This replaces the
pre-S89 bug where every damage-less debuff was scored through the
Magnetic-Mark proxy — the failure that made the Assassin ignore its whole kit.

### 3. Grapple-throw is fall-currency, enemies-only

`bestGrappleThrowCandidate` enumerates grab targets × throw-diamond
destinations from the current position (the utility-candidate boundary),
valued through the same `fallValueForOccupant` gate Worldcraft and knockback
read — one fall currency, no drift. Ally-rescue throws are ceiling, unvalued.
Flat throws score 0, so the Monk never shuffles an enemy sideways.

### 4. Raise and Esuna ride existing currencies

Revive: the "AI never casts Raise" exclusion is lifted; `effects.removeKO`
abilities are valued exactly like Phoenix Down (`maxHpBase × REVIVE_WEIGHT`),
no charge discount at the floor (a corpse can't dodge). Cleanse:
`effects.cleanse` abilities sum `CLEANSE_VALUE_PER_DEBUFF` over the footprint's
allies' *cleansable* debuffs (mirroring the dispatcher's `remedyImmune` skip),
deducting enemies caught in the diamond. Jump needed **no new machinery** — it
already rode the S74 charged tile-pin branch; S89 pinned it with a scenario
test (perch-camper answered by V6).

### 5. Reflect-awareness covers the item-field path only

Loadout reaction passives (Damage Split) were already feared via
`reactionPenalty`; equipment reflect (`physicalReflectPercent` /
`magicalReflectPercent`) was not. `reflectCostForAttack` nets the reflected
fraction off the attack's score as friendly fire against the attacker, with a
clean-kill exemption mirroring the engine's no-posthumous-reflect gate.

### 6. `scoreItemForUnit` is the M4 generator seam

New `src/ai/gear-valuation.ts`: pure, engine-typed
`scoreItemForUnit(catalog, item, profile)` + `rankItemsForUnit`, where the
profile is `{classId, pa, ma, usesMp}` — deliberately not a battle `Unit`,
because the generator ranks gear before any battle exists. Weapon offense =
WP × the wielder's attack stat × accuracy × kit affinity; stat lines, evasion,
resists, movement, buff grants, and recognized riders (procs, lifesteal,
reflect, MP discounts) get flat floor weights; exotic effects deliberately
score 0 past their stat lines (D-ai-1). The contract is relative ordering
within a slot. Consumed in M4 by the `generateSkirmishParty` replacement;
worn-gear *play* needed no work — the projection already runs the live
pipeline/hook surface, so stat gear composes on both sides.

## Rejected / deferred

- AI-side status weight table (rejected for `aiHints` — see D2).
- Tide Surge / ally-CT tempo, Steal MP, Scramble, stance strategy, AoE-heal
  splash, lifesteal/CT-refund rider valuation — deferred without loss;
  recorded in `ai-substrate.md`'s deferrals with the blueprint.
- Coverage-map-aware deployment — re-confirmed out (no placed enemies exist at
  deployment time; S66's centroid model stands).

## Consequences

- The Assassin, Monk, Templar, and Enchanter now clear the competency floor;
  the roster matrix in the findings doc has no broken entries.
- `docs/design/ai-substrate.md` is authoritative for the AI layer and must be
  updated when scorer branches / levers / constraints change.
- New tuning dials (all playtest-watch): `DEFAULT_DEBUFF_VALUE`, the per-status
  `aiHints.value` set, reflect fear (via `FRIENDLY_FIRE_PENALTY_FACTOR`), and
  every `W_*` weight in `gear-valuation.ts`. Gold-plating watch: if skirmishes
  now feel oppressive, these floors (not the offsets) are the dial to lower.
