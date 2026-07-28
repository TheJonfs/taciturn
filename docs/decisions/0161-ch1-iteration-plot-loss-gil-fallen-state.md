# ADR-0161: Ch1 iteration fixes — plot-unit must-survive, starting gil, fallen state

**Status:** accepted (S100)
**Context:** the Ch1 iteration brief (`docs/TABADesign/taba-ch1-iteration-brief.md`).
Chris played the first three story battles fresh: won all three, but lost a
generic at Alvera, nearly lost Lumen at ticks, and found two mechanical gaps —
a plot character reaching KO did NOT end the battle, and a permadeath was
communicated only by the unit's silent absence from the next lineup. Alongside:
zero starting gil locked the player out of the gear-investment loop that is the
intended answer to the deliberate 2–3 level deficit.

## Decision 1 — plot-unit permadeath ends the battle as a loss

**Engine:** a new `VictoryPredicate` discriminant, `unit_lost { anyOf: UnitId[] }`
(`engine/types/battle-outcome.ts`, evaluator clause in
`evaluate-battle-outcome.ts`). Semantics: satisfied when ANY listed unit has
`removed === true && retreated !== true`.

- **Permadeath, not KO** (Chris's call, this session): the loss fires when the
  three-turn KO revival window expires (`system_ko_tick` → threshold →
  `system_unit_removed`), NOT at the hp → 0 moment. Reviving a downed plot unit
  during the countdown avoids the loss entirely — the countdown IS the tension.
- **Retreat excluded:** a death-protected retreat also flips `removed`
  (unit.ts), and a retreat is not a loss — the check mirrors the apply-back's
  `lost` classification exactly.
- `anyOf` is an OR over units — the one place the predicate grammar needed an
  OR, kept local to the discriminant rather than adding a general `any_of`
  combinator nobody else needs.

**Campaign:** the condition is **auto-composed, never authored**.
`withPlotLossCondition` (`campaign/plot-loss.ts`) runs inside `foldBattle` — the
single fold entry every campaign battle (story AND skirmish) launches through —
and prepends a loss condition (winner = enemy team, description
`PLOT_LOSS_DESCRIPTION`) listing every DEPLOYED player-team unit whose id is in
`PLOT_UNIT_IDS`, guests excluded. Composing over the folded config means:

- Joined plot units (Clio, Thessaly, Sera) are covered the day they join — no
  per-node authoring to forget.
- **Skirmishes are covered** (Chris's call): losing a plot unit in an optional
  skirmish is the same game-over. The existing loss path already implements the
  agreed "revert to save": a loss applies nothing back — campaign state is
  untouched, i.e. exactly the last save — and the result screen offers retry.
- A guest is not must-survive unless a battle authors its own condition; a
  generic still permadies without ending the battle (Alvera was correct).

**Communication:** the campaign loss screen previously claimed "Your company was
routed" regardless of cause. `ResultSummaryBeat` gains an optional `lossReason`;
the driver passes it when the fired condition's description matches
`PLOT_LOSS_DESCRIPTION`, and the screen names the fallen-leader cause instead of
a rout the field may not show. One beat type still renders all outcomes — no
screen fork.

## Decision 2 — permadeath is a communicated STATE, not an absence

The roster already retains lost units (`fate: 'lost'`, D-D). Two surfaces now
render it:

- **Manage-roster gallery** (`RosterView`): a fallen card renders memorialized —
  desaturated, dimmed, "† Fallen" badge, no idle-JP glint (the "go spend" nudge
  is moot), still openable (the dossier is the memorial). Previously a lost unit
  showed as a NORMAL editable card here.
- **Formation deploy picker** (`FormationScreen`): a non-interactive "Fallen"
  memorial strip below the deployable list, so the loss is visible exactly where
  the player would look for the missing unit.

Both are deliberately styled as a **state a future revive could clear** (the
brief's open thread — permadeath-classic vs a recovery path — is NOT decided
here; nothing in the data or UI assumes final death beyond the existing `fate`
field). The `?formation` dev harness seeds one fallen cadet so the state is
previewable without fighting a unit to removal.

## Decision 3 — starting gil 2000 (the headroom dial)

`STARTING_GIL` 0 → 2000 (`economy-config.ts`, placeholder — now the third gil
dial D-econ-6 moves together with `ENEMY_GEAR_GIL_PER_LEVEL` and item prices).
The party's intended answer to the standing level deficit is gear investment;
at 0 gil the player can't enter that loop before Oskun. The Zarghidas opening
marker scene now also nudges the player to shop before marching (text
interpolates `STARTING_GIL`, so a retune can't desync the copy). The Oskun
offset and the whole-chapter curve stay calibration-pass items — deliberately
untouched.

## Content riders (same session, no separate ADR)

- **Zelmonia Hills rocky banding:** Mountain Pass's treatment rethresholded for
  the 2–14 range (`gte 11 → rock`, `gte 7 → grass_rock`) so elevation reads
  without the digits. Purely cosmetic (both terrains are plain `land`). Edited
  as spec data — survives the Cartographer round-trip (codegen test pins it).
  Prose: `docs/maps/zelmonia-hills.md`.
- **`roof` terrain type** for Alvera's architecture: registry-tagged `land`
  (walkable, like rampart), added to every class's `canEnter`, the renderer
  palette (terracotta fallback), the texture manifest (two PLACEHOLDER shingle
  SVGs — Chris swaps in authored art in place), and the Cartographer's
  `TERRAIN_VOCABULARY`. Verified end-to-end: brush → override → real-renderer
  shingles.

## Rejected / deferred

- **Immediate-loss-at-KO** — rejected in favor of the revival-window semantics
  above.
- **Revival mechanic** (church/aftermath revive, gil or story cost) — open
  thread, deliberately not decided; the fallen state is built not to prejudge
  it.
- **A general `any_of` predicate combinator** — not needed; `unit_lost.anyOf`
  covers the one OR case.
