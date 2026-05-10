# Mage War Battle UI — Architecture Notes

*Living reference document for the in-battle UX. This is the largest design surface remaining for the post-Session 20 Mage War demo. Updated incrementally as design firms up.*

## Purpose and Scope

The battle UI is the React + PixiJS surface that runs during a battle, after deployment commit. It receives the initialized `GameState` and presents player-facing controls, information, and visual feedback for the duration of the battle.

This document covers the design of the in-battle experience: layout, action menu flow, target selection, forecasting, charged action timing, CT preview, status display, animation pacing, and battle-end. It does **not** cover the team builder (separate doc), deployment phase (separate doc), or the renderer's internal implementation (which is its own concern, guided by the UI's intent).

The architecture from existing docs is the foundation:
- React handles HUD elements, menus, side panels (everything outside the battle map).
- PixiJS handles the battle map canvas (tiles, units, terrain, animations, overlays).
- Engine validation is pure; UI calls `validateAction` and forecasting queries without committing.
- Action log drives all rendered animation; renderer paces from log entries.
- All UI ↔ Engine communication is via Action proposals and pure read queries.

## Framing Principles

Five principles anchor the design:

**1. Information-rich, not information-spare.** FFT was minimal; modern Mage War leans toward maximum transparency. Mechanics complexity (elemental wheel, status interactions, evasion-by-facing, multi-stat damage formulas) means players need full visibility to develop intuition. Hidden math punishes new players and slows playtest iteration. Hide things later only if a clear case emerges.

**2. Forecast-first, not commit-first.** Decisions move through three phases — *intent* (I'm thinking about doing this), *forecast* (let me see what would happen), *commit* (do it). The forecast phase is first-class: hovering a target shows expected outcome immediately; commit is a separate confirmation. Pure validation makes this cheap.

**3. The map is the protagonist.** PixiJS canvas takes 70-80% of screen real estate. React HUD elements are informational overlays anchored to corners or edges, not panels that compete with the map for attention.

**4. Animation pacing is player-controlled.** Default to medium pacing with player-side controls: 1× / 2× / skip-to-next-decision-point. The action log is the source of truth, so skipping changes nothing about state — just reads the next entry faster.

**5. The HUD is React; the map is PixiJS.** HUD elements sit on top of the PixiJS canvas in z-order. They read engine state via React props and dispatch action proposals; they don't know how PixiJS renders. The few areas that bridge — like "highlight reachable tiles" overlays — live in the renderer with a UI-set flag.

## Starting Layout

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Turn T0001                                                              │ ← top bar (slim)
├─────────────┬─────────────────────────────────────────────────┬─────────┤
│ ┌─────────┐ │                                                 │┌───────┐│
│ │ ▲ more  │ │                                                 ││ Action││
│ │ 5 [p]   │ │                                                 ││ Log   ││
│ │ 4 [p]   │ │                                                 ││       ││
│ │ 3 [p]   │ │                                                 ││ T0001 ││
│ │ 2 [p]   │ │       BATTLE MAP — PixiJS canvas                ││ T0002 ││
│ │ 1 [p]   │ │                                                 ││ T0003 ││
│ ├─────────┤ │       tiles, units, terrain, animations         ││  ...  ││
│ │ ACTIVE  │ │       + overlays for range, AoE, paths          ││       ││
│ │ Brun.   │ │       + tooltips on hover                       ││       ││
│ │ Earth M │ │                                                 ││       ││
│ │ HP 152  │ │                                                 ││       ││
│ │ MP 96   │ │                                                 ││       ││
│ │ CT 100  │ │                                                 ││       ││
│ │ ▲▲      │ │                                                 ││       ││
│ │ Move ✓  │ │                                                 ││       ││
│ │ Act ✓   │ │                                                 ││       ││
│ └─────────┘ │                                                 │└───────┘│
├─────────────┴─────────────────────────────────────────────────┴─────────┤
│ ┌─ Action Menu ──────┐    ┌─ Hover/Forecast ──────────────────────┐    │
│ │ ▶ Move (CT 30)     │    │ Target: Sparky (Lightning Mage)        │    │
│ │   Act ▾ (CT 20)    │    │ HP 80/127  •  47 dmg expected          │    │
│ │   Wait (CT 80)     │    │ 60% Move/Jump debuff                   │    │
│ │   Status           │    │ [ Confirm ] [ Cancel ]                 │    │
│ └────────────────────┘    └────────────────────────────────────────┘    │
│                                                  [⏵1×] [⏵⏵2×] [Skip]   │
└─────────────────────────────────────────────────────────────────────────┘
```

The left column is the **projection column / queue tower** — the active unit panel anchors at the bottom; upcoming events extend upward as compact mini-cards. Looking up the column is looking forward in time. (Detailed in its own section below.)

The right side is the **action log** — past events scrolling downward as new entries arrive. Past below, future above; the panels mirror temporal direction.

The bottom row hosts the **action menu** (player choices for the current turn) and the **hover/forecast panel** (live preview of what would happen if a hovered option were chosen). Speed controls live at the bottom-right.

The map dominates the visual center, with HUD panels framing it on three sides without cluttering the playing field.

## Decision Loop State Machine

```
        ┌─────────────────────────────────────────┐
        │           IDLE / AWAITING               │
        │  (turn started; menu shows top-level)   │
        └──┬──────────┬────────────┬──────────────┘
           │          │            │
        Move?       Act?         Wait?
           │          │            │
           ▼          ▼            ▼
   ┌────────────┐  ┌──────────┐  ┌─────────┐
   │ MOVE-SELECT│  │ ACT-MENU │  │ WAIT-   │
   │ (highlight │  │ (command │  │ CONFIRM │
   │  reachable │  │  sets)   │  │ (facing │
   │  tiles)    │  └──┬───────┘  │  + go)  │
   └──────┬─────┘     │           └─┬───────┘
          │           ▼             │
          │    ┌──────────────┐     │
          │    │ ABILITY-LIST │     │
          │    │  (scrollable │     │
          │    │   if long)   │     │
          │    └──────┬───────┘     │
          │           │             │
          │           ▼             │
          │    ┌──────────────┐     │
          │    │TARGET-SELECT │     │
          │    │ (range overlay,│   │
          │    │  AoE preview, │   │
          │    │  forecast)    │   │
          │    └──────┬───────┘     │
          │           │             │
          ▼           ▼             ▼
        ┌──────────────────────────────┐
        │    CONFIRM (forecast        │
        │    panel, Y/N prompt)       │
        └──────────┬──────────────────┘
                   │
                   ▼
              ┌──────────────┐
              │ ANIMATING /   │
              │  RESOLVING    │
              └───────┬──────┘
                      │
                      ▼
            (back to IDLE if budget   
             remains; else TURN_END)
```

Cross-cutting state: **STATUS-VIEW** (read-only inspection of active or any unit) — accessible from any state, returns to caller. Any sub-state can transition back via **CANCEL** to its parent state.

## State-by-State Breakdown

**IDLE / AWAITING.** Turn started. Active unit info panel shows current HP/MP/CT, statuses, "Move available / Act available" indicators. Action menu shows top-level options: **Move** (greyed if budget consumed), **Act** (greyed if budget consumed), **Wait**, **Status**. Map in inspection mode — hover tiles for tile info, hover units for stats and statuses. Camera defaults to centered on active unit.

**MOVE-SELECT.** Renderer overlays reachable tiles in movement color. Considers terrain costs, Jump-over-water rule, current Move stat. Hovering shows path, move cost ("5 of 6 used"), resulting facing. Forecast shows destination tile properties and tile-property triggers (hazardous terrain, etc.). Click a tile → CONFIRM.

**ACT-MENU.** Submenu of command sets — typically 2 (Primary + Secondary), 3 with Magus Crown, or 1 if no secondary equipped. Each entry shows command set name and identity tag. Click → ABILITY-LIST.

**ABILITY-LIST.** Scrollable list of abilities in the chosen command set. Each row shows: name, MP cost (greyed/red if unaffordable), bucket cost or charge time indicator, brief description. Long lists scroll; default sort by command-set order, with options for MP cost or recently-used. Hover populates forecast with ability details. Click an ability → TARGET-SELECT.

**TARGET-SELECT.** Map overlays valid targets in target-highlight color (red for hostile, green for ally, both for either). Tiles outside range/LoS dimmed. Hovering populates forecast with full outcome. Click target → CONFIRM.

**CONFIRM.** Modal/expanded forecast with **Confirm / Cancel** buttons. FFT-style yes/no prompt. Default behavior; preference toggle in settings allows skip-confirm for power users.

**WAIT-CONFIRM.** Cardinal direction picker for facing choice. Click direction → commit Wait + facing → TURN_END.

**STATUS-VIEW.** Read-only inspection: full stat breakdown, equipped abilities, equipment with effects, current statuses with durations and sources. Can be triggered for the active unit (via menu) or any other unit (via clicking them in inspection mode). Returns to caller on close.

**ANIMATING / RESOLVING.** Action committed; engine reduced; renderer plays animation. UI mostly disabled — only animation speed controls (1×, 2×, skip) remain active. On animation completion: transition to IDLE if budget remains, TURN_END if not.

## The Forecast Pipeline

The forecast panel is the heart of the information-rich philosophy. Content is computed by calling pure engine functions (`validateAction`, `computeOutcomeForecast`, `projectChargedActionResolution`, `projectTurnEndCT`) without committing actions.

### Hovering a target in TARGET-SELECT (most info-dense)

```
┌─ Forecast: Earth Strike on Sparky ─────────────┐
│ Target: Sparky (Lightning Mage, Red)            │
│  HP 80/127  •  Facing North                     │
│                                                 │
│ Hit:           Auto (magical)                   │
│ Damage:        47 expected     [▸ details]      │
│ Status:        Move/Jump debuff                 │
│   Chance:      60%  (after MA/Faith)            │
│   Duration:    3 turns                          │
│                                                 │
│ Caster cost:   4 MP  (96 → 92)                  │
│ Action speed:  Instant                          │
│ End-of-turn CT: 0  (standard Act cost)          │
│                                                 │
│ Reaction risk: Sparky has no reactions equipped │
│                                                 │
│            [ Confirm ]  [ Cancel ]              │
└─────────────────────────────────────────────────┘
```

The damage `[▸ details]` expander shows the full breakdown when clicked: `12 MA × 8 SP = 96; × 0.49 Faith = 47; × 1.00 element = 47`. Collapsed by default to keep the panel readable; expanded by click for players learning the system.

Variance is shown when applicable (e.g., "60-87" for an axe attack with [0.9, 1.3] variance) with the expected value as the primary number.

### Charged action targeting (adds Timing subsection)

```
┌─ Forecast: Earth Quake on Sparky (charged) ────────┐
│ Target: Sparky (Lightning Mage)                     │
│  HP 80/127  •  Position (8, 9)                      │
│                                                     │
│ Damage:        62 expected     [▸ details]          │
│ Status:        Stop, 70% chance, 2 turns            │
│                                                     │
│ ─── TIMING ──────────────────────────────────────   │
│ Action Speed:   25 CT to charge                     │
│ Resolves at:    Event 5 of projection               │
│                                                     │
│  Now ─→ E1 Tank acts ─→ E2 Wave acts ─→             │
│        E3 Sparky acts ─→ E4 Brunhilde charges done─→│
│        E5 ⚡ Earth Quake fires ─→ E6 Sparky acts    │
│                                                     │
│ Target's next turn:  Event 6 (after your spell)     │
│ Result: ✓ Resolves BEFORE Sparky's next turn        │
│                                                     │
│ Caster cost:   8 MP  (96 → 88)                      │
│                                                     │
│             [ Confirm ]  [ Cancel ]                 │
└─────────────────────────────────────────────────────┘
```

The mini-timeline shows the next 5-7 events around the resolution moment. The spell's resolution event is highlighted (red/orange), the target's next turn highlighted differently. The pass/fail line ("Resolves BEFORE / AFTER target's next turn") is the at-a-glance answer; the timeline is the receipts.

If the spell would resolve **after** the target's next turn (target moves out of the way) or after their second turn, the line is visually flagged — orange highlight, warning icon — so the player notices without reading carefully.

The timeline also flags any noteworthy events between commit and resolve (target's auto-Haste making them act sooner; a Burn stack ticking on the target that might KO them and leave the spell with no target; etc.).

### Hovering a tile in MOVE-SELECT

Path visualization on the map plus forecast panel showing:
- Path summary (e.g., "5 tiles, costs 6 move points")
- Destination properties (elevation, terrain type, deployment-zone status)
- Resulting facing on arrival
- Tile-property triggers (hazardous terrain damage, slipping, etc.)
- End-of-turn CT projection if Move-only is committed

### Hovering an ability in ABILITY-LIST (no target yet)

Static ability information: range, AoE shape, effects, MP cost, action speed, status riders, damage formula structure. No target-specific math.

### Hovering an empty tile or AoE-on-tile abilities

Forecast shows all units in the AoE footprint, each with their individual outcomes.

### Forecast panel updates at hover speed

Sub-100ms target — `validateAction` and the projection queries are pure and cheap. The panel re-renders on every hover-target change without perceptible lag.

## CT Cost Preview in the Action Menu

The action menu shows projected end-of-turn CT for each option. Engine support: `projectTurnEndCT(unit, plannedActions, currentState) → number` — pure function returning the CT a unit will have at turn end given a planned action sequence. UI calls this once per menu option, passing currently-consumed budgets plus the candidate next action.

Idle state (nothing consumed yet):

```
┌─ Action Menu ─────────────────┐
│ ► Move           (end CT: 30) │
│   Act ▾          (end CT: 20) │
│   Wait           (end CT: 80) │
│   Status                      │
└───────────────────────────────┘
```

Once Move is consumed, the menu re-renders with remaining options:

```
┌─ Action Menu (Move consumed) ──┐
│   Move ✓ (-70)                │
│ ► Act ▾          (end CT: 0)  │
│   Wait           (end CT: 30) │
│   Status                      │
└───────────────────────────────┘
```

The annotation updates dynamically as the player navigates the menu — hovering "Wait" without committing shows what end-of-turn CT *would be* if Wait were chosen now. Ability-specific CT modifiers (a hypothetical "+25 CT bonus on Wait" Support, a Quickdraw that grants +30 CT after use) are baked in via the `projectTurnEndCT` query.

For abilities with their own CT modifiers, the same projection appears in the ability forecast:

```
│ Caster CT impact: turn ends at CT 30        │
│   (Quickdraw: +30 CT bonus after use)       │
```

This is the load-bearing piece for multi-turn planning — players can see exactly when they'll act next and tune their choices accordingly.

## Cancel / Back Navigation

Every sub-state has an obvious back path:
- TARGET-SELECT → ABILITY-LIST (right-click, ESC, or "Back" button)
- ABILITY-LIST → ACT-MENU
- ACT-MENU → IDLE
- MOVE-SELECT → IDLE
- CONFIRM → previous state (TARGET-SELECT or MOVE-SELECT)

Player commitments matter only at CONFIRM. Anything before that is exploratory and freely cancelable. This supports the information-rich philosophy: players can drill into "what would Earth Strike do to that target?" without committing, then back out and consider alternatives.

## Special Cases

**Charged actions.** When committed, the action enters the projection queue with a charge timer. The unit's turn ends. UX:
- Forecast panel during TARGET-SELECT shows the Timing subsection (above)
- After commit, the casting unit shows a "charging" indicator (status icon on map)
- The charged action appears in the 20-event projection
- If interrupted (caster KO'd, Silenced, Don't Act applied, etc.), the action fizzles with a clear visual cue and an action log entry

**Magus Crown / multi-secondary.** Three command sets in ACT-MENU instead of two (Primary + Secondary 1 + Secondary 2). Order set in team builder. No structural difference — just an extra option.

**Reactions.** Passive, triggered by other units' actions. Don't appear in the action menu. Visible on the unit's status panel. Trigger animations when they fire. Optionally: forecast panel for an incoming attack on me could show "Counter will fire at 30% chance" — enhancement, not load-bearing.

**Out-of-budget options.** Move greyed when consumed; Act greyed when consumed; abilities greyed when MP-insufficient or status-blocked. Hovering a greyed option shows *why* it's unavailable in the forecast panel ("Insufficient MP — need 8, have 4" or "Silenced — voice abilities blocked").

**Damage forecast detail expander.** Collapsed by default to avoid info overload; expander reveals full math (base × Faith × element × variance). Players who want to learn click expand; players who already know just see the result. Acts as a future filter point if we ever want a "simplified" mode.

## Animation Speed Controls

Persistent in the bottom-right of the screen:
- **1×** — default speed
- **2×** — fast (animations play in half time)
- **Skip** — jump to next decision point (animations elide; engine state advances normally)

The skip-to-next-decision-point reads forward in the action log to the next moment requiring player input, then renders the resulting state without playing intermediate animations. Useful for AI turns the player wants to fast-forward, or for replay viewing.

## Status Display and Unit Detail Panels

The battle UI presents unit and status information at three tiers of disclosure, each a strict subset of the next. Same content, different density.

### Tier 1: On-Map Display

Each unit token on the map shows:
- **Class portrait** (2D sprite asset, also reused in info panels)
- **Team color border** around the token (red or blue)
- **HP bar** beneath the token (slim, color-coded — green high, yellow mid, red low)
- **Status indicator** (zoom-dependent — see below)

For the active unit specifically: a subtle pulsing glow or arrow indicator above the token. Charged-action casters show a "charging" indicator (small spell-circle icon) on the unit token, persistent until the action resolves or fizzles.

**Status indicator zoom tiers:**
- **High zoom** (tile size ≥ 96px): up to 3 status icons attached to the bottom of the unit token, with "+N" overflow if more. Priority: negative-tag first (visible threats), then positive-tag, then neutral. Within each tag, most-recent first.
- **Low zoom** (tile size < 96px): single composite indicator. Color-coded dot near the token (red if any negative, green if only positive, no dot if no statuses).

### Tier 2: Hover Tooltip

Appears next to cursor with a brief delay (~300ms) when hovering a unit. Compact (~250×180 pixels), scannable.

```
┌─ Sparky (Lightning Mage, Red) ──┐
│ Level 25                         │
│                                  │
│ HP   80 / 127     CT  43         │
│ MP   45 /  80     Sp  9          │
│                                  │
│ Br/Fa: 70 / 70                   │
│                                  │
│ ▲ Auto-Haste   ⊙ Move-debuff (3) │
│ + 1 more status                  │
│                                  │
│ Range from Brunhilde: 4 tiles    │
└──────────────────────────────────┘
```

Contents: name/class/team/level, current HP/MP/CT and key stats (Speed, plus PA or MA depending on class), Brave/Faith, top 2-3 statuses with brief duration, "+N more" overflow indicator, range from active unit.

### Tier 3: Full Unit Detail Panel

Opens on click of any unit (or via "Status" from the active unit's action menu). Modal-ish — sits on top of action menu but doesn't fully block other UI. Designed as a single panel with collapsible sections.

```
┌─ Sparky — Lightning Mage Level 25, Red Team ───────────────┐
│ [PORTRAIT]                                          [ × ]  │
│                                                            │
│ ▼ STATS                                                    │
│   HP    80 / 127         MP   45 /  80                     │
│   PA     4               MA   17                           │
│   Speed  9               CT   43                           │
│   Move   3               Jump  3                           │
│   Brave  70              Faith 70                          │
│   Evade  Front 8 / Side 5 / Back 0                         │
│                                                            │
│ ▼ ACTIVE STATUSES                                          │
│   ▲ Auto-Haste             from Auto-Haste Boots           │
│     Speed × 1.5  •  Permanent (battle duration)            │
│                                                            │
│   ⊙ Move/Jump Debuff       from Brunhilde, Earth Strike    │
│     Move -1, Jump -1  •  3 turns remaining                 │
│                                                            │
│   ⊕ Vulnerable             from Sparky's prior cast        │
│     Next damage × 1.5  •  Until consumed                   │
│                                                            │
│ ▶ RESISTANCES                                              │
│ ▶ LOADOUT                                                  │
│ ▶ EQUIPMENT                                                │
│ ▼ REACTION RISKS  (when viewing enemy)                     │
└────────────────────────────────────────────────────────────┘
```

**Default expansion behavior:**
- **Stats** and **Active Statuses** expanded — most time-critical info
- **Resistances**, **Loadout**, **Equipment** collapsed — secondary details, expand on demand
- **Reaction Risks** expanded by default for enemy units, collapsed for self/ally — mirrors typical use case (player wants to know what reactions an enemy has waiting)

**Active Statuses entries** show: matching icon, polarity glyph (▲ positive, ▼ negative, ⊙ neutral, ⊕ conditional), name, magnitude/effect in human-readable form, duration (turns remaining, "Permanent", or "Until consumed"), source ("from Brunhilde, Earth Strike" / "from Auto-Haste Boots" / etc.). Multi-stack statuses show stack count badge.

**Resistances** as a compact element + tag table with current values. Hovering a value breaks down all sources contributing to the total ("Lightning Mage class +50, Wizard's Robe -25 = +25 net"), keeping the information-rich philosophy. Future filter-out candidate if this becomes overwhelming.

**Loadout** in two sub-blocks: Action commands (Primary, Secondary 1, optional Secondary 2 with Magus Crown) and Passive buckets (R/S/M with cost-used vs cost-available).

**Equipment** as 5 rows showing slot type, item name, brief effect summary. Hover for full description.

**Reaction Risks** lists equipped reactions with trigger condition, chance, and effect — primarily useful when inspecting enemy units. Hidden when viewing self.

### Active Unit Panel (Tier 1.5)

The bottom-left "Active Unit" panel is persistent during a unit's turn. Effectively Tier 2 content locked to the active unit:

```
┌─ Active: Brunhilde (Earth Mage) ─┐
│ Level 25                          │
│                                   │
│ HP  152 / 152      MP  96 / 100   │
│ CT  100            Sp  8          │
│ Move 3  Jump 3                    │
│                                   │
│ ▲ Auto-Regen  ▲ Auto-Haste        │
│                                   │
│ Move ✓ available  Act ✓ available │
│                                   │
│ [ Open full details ]             │
└───────────────────────────────────┘
```

Compact essentials plus a button to open the full detail panel for the active unit. Visually anchors the bottom of the projection column / queue tower (see "Projection Column" section below) — the column unifies the active unit panel with the upcoming-event mini-cards as one continuous visual.

### Routing into the Full Detail Panel

Three entry points converge on the same component:
1. **Click any unit on the map** → full detail panel for that unit
2. **Click "Status" in the active unit's action menu** → full detail panel for active unit
3. **Click "Open full details" in the active unit panel** → same as #2

The component is the same; only the bound unit changes. Read-only in battle — loadout and equipment changes happen in the team builder, not mid-fight.

**Sticky behavior**: the panel stays open during TARGET-SELECT so a player can keep an enemy's stats visible while targeting them. Dismissed only by ESC or click-outside.

### Status Visual Language

Icons use consistent visual grammar across all tiers:
- **Color coding by polarity**: positive uses green/blue tints; negative uses red/orange; neutral uses grey/yellow
- **Glyph by status type**: simple iconography (flame for Burn, snowflake for Freeze, lightning for Haste, eye for Sleep, etc.)
- **Border treatment by source**: solid border for spell-applied; dashed for equipment-applied; dotted for class-trait
- **Stack count badge**: small numeric badge in the corner for stacking statuses

Hover any status icon (anywhere in the UI) → mini-tooltip with name, magnitude, duration, source, brief description. Click → opens the full detail panel scrolled to that status.

### Tooltip-on-Tooltip Pattern

The Tier 2 hover tooltip shows status icons; hovering a status icon within the tooltip shows its description in a nested sub-tooltip. Standard hover-within-hover with brief delay. If the pattern proves clunky in practice, fallback option: click on the icon to pin the Tier 2 tooltip; hover the icon within the pinned tooltip for the sub-tooltip. Start with hover-within-hover as the simpler default.

### What Lives in the Status List vs. Computed Stats

Equipment effects fall into two categories:
- **Equipment hooks that modify stats directly** (Diamond Bracelet's +1 PA / +1 MA, Lightfoot's +1 Move/Jump/Speed): factored into displayed stats, not in status list.
- **Equipment-applied statuses** (Auto-Haste from Boots, Auto-Regen from Tintinibar, Auto-Shell from Sorcerer's Robe): in status list with source attribution to the equipment piece.

Spell-applied statuses are in the status list with source attribution to the spell + caster. Wand-passive applied effects (Wand of Depths' resistance shift on hit) appear as statuses with appropriate duration and source.

This keeps the status list focused on "things actively happening to this unit" while the stat block reflects the static result of equipment.

## Animation Pacing and Action Log Display

Animation pacing and the action log panel are designed as a single connected system: the action log is the source of truth that drives both the visual rendering (each entry → animation in PixiJS) and the textual scrollback presentation (each entry → row in the action log panel). Same data, two presentations.

Implications:
- Each action type has a defined visual representation (animation timing) and textual representation (log entry format).
- "Pacing" is fundamentally about how long each entry's visualization takes.
- Skip mode doesn't skip log entries — the player still sees what happened textually, just faster visually.
- Rewatch / replay is reading log entries again from a checkpoint; same machinery.

### Animation Timing Palette

Default durations at 1× speed (starting points, tuned in playtest):

| Action | Default duration | Notes |
|---|---|---|
| Move (per tile) | 150ms | Smooth interpolation; total = tiles × 150ms |
| Basic melee attack | 700ms | Windup → strike → impact |
| Spell cast (instant) | 900ms | Channel → cast effect → impact |
| Charged spell resolve | 1100ms | Release → travel → impact |
| Status application | 400ms | Brief flash of status icon on target |
| Damage number popup | 500ms | Float up + fade out (overlaps with strike) |
| Knockback | 400ms | Travel arc to destination tile |
| KO / unit drop | 700ms | Slump animation, then settled |
| Turn transition | 250ms | Camera nudge to next active unit |

Each log entry carries its expected animation duration. Renderer paces entry-by-entry. Total turn-animation = sum of contained entries' durations + ~100ms inter-entry gaps for breathing room.

### Sequential vs Concurrent

**Sequential by default** for first playable: action A's animation completes before action B starts. Easier to follow causality.

Natural exception: damage number float-up overlaps with the strike animation (~200ms into the strike). They're causally paired so they should feel simultaneous.

For AoE hits to multiple targets, damage numbers stagger by ~50ms based on each target's distance from the caster — keeps things readable while preserving the AoE feel.

Concurrent-animation polish (e.g., simultaneous AoE impacts) deferred until first playable feels too sequential.

### Speed Controls Behavior

- **1×** — full timing as above, the discovery default.
- **2×** — durations halved; animations remain readable. Likely the practical default for experienced players.
- **Skip** — animations effectively instant (~50ms each). Action log entries appear at readable pace; renderer jumps to final state of each action quickly. Player still sees damage numbers and status flashes briefly but doesn't wait.

Auto-pause behavior across all speed modes:
- **KO of a unit**: ~400ms pause on the slump moment, even at 2× or Skip
- **Charged action resolution**: ~300ms pause on the resolve moment
- **Battle-end conditions reached**: ~500ms pause before transition to results screen

These are emotionally weighty moments that deserve a beat regardless of speed setting.

### Action Log Entry Indexing

Each unit turn or charged action resolution event is one **T-event**, indexed sequentially with zero-padding for visual alignment: `T0001`, `T0002`, `T0003`, etc. (Padding to 4 digits keeps spacing consistent up to T9999; battles will rarely run past a few hundred turns, but the format scales gracefully.)

Within a single T-event, multiple actions can occur (Move + Act sub-entries, status ticks at turn start, end-of-turn cleanup). They group as sub-entries under the parent T-event.

Battle initialization entries occur before T0001 and use the `[init]` tag.

System events that occur between unit turns (status ticks not tied to a specific unit's turn, environmental damage, etc.) get their own T-numbers if they're independent log events.

### Log Entry Format

Compact one-liner per T-event, click to expand for full detail.

**Compact view:**

```
[init] Battle begins on River Ridge
[init] Brunhilde gains Auto-Regen (from Tintinibar)
[init] Sparky gains Auto-Haste (from Auto-Haste Boots)
[init] CT initialized: Brunhilde 12, Sparky 8, Tank 18, ...

T0001: Brunhilde — Move + Earth Strike on Sparky → 47 dmg, debuff
T0002: Sparky — Move + Bolt on Brunhilde → 32 dmg
T0003: Tank — Move + Attack on Wave → 76 dmg (crit!)
   ↳ Wave's Counter → Tank 24 dmg
T0004: Wave — casts Frost Wave on Knight (charging, resolves T0007)
T0005: Brunhilde — Wait
T0006: Tank — Move + Attack on Wave → 58 dmg
T0007: [charged] Frost Wave resolves on Knight → 38 dmg (from T0004)
T0008: [tick] Burn ×3 on Knight → 18 dmg (Knight 80 → 62 HP)
T0009: Knight — Wait
[ko] Knight defeated by ongoing Burn damage at T0008
[end] Red Team wins (all enemies defeated)
```

**Expanded view (T0001 example, after click):**

```
T0001 — Brunhilde (Earth Mage):
  ↳ Moved (3, 5) → (4, 6) [3 move points used]
  ↳ Cast Earth Strike on Sparky:
      • 47 damage dealt (Sparky 80 → 33 HP)
      • Move/Jump debuff applied (60% chance, succeeded; 3 turns)
      • Caster MP: 96 → 92
  Turn ends, CT 100 → 0
```

Same content as the forecast panel's expanded breakdown — symmetrical UX between "what would happen" (forecast) and "what did happen" (log entry).

**Reactions** appear as indented sub-entries under their triggering action:

```
T0003: Tank — Move + Attack on Wave → 76 dmg (crit!)
   ↳ Wave's Counter → Tank 24 dmg
```

**Charged action cross-references** annotate both the cast and the resolution:

```
T0004: Wave — casts Frost Wave on Knight (charging, resolves T0007)
...
T0007: [charged] Frost Wave resolves on Knight → 38 dmg (from T0004)
```

Hover either entry to highlight its counterpart.

**System event tags:** `[init]` (battle start), `[tick]` (status tick events), `[charged]` (charged action resolve), `[ko]` (unit defeated), `[end]` (battle end). Visually distinct from unit T-events at a glance.

### Action Log Panel Layout

```
┌─ Action Log ────────────────────┐
│ ▲                               │
│ [init] Battle begins on River   │
│        Ridge                    │
│ [init] Brunhilde gains Auto-Reg │
│ [init] Sparky gains Auto-Haste  │
│                                 │
│ T0001: Brunhilde — Move +       │
│        Earth Strike → 47 dmg ▾  │
│                                 │
│ T0002: Sparky — Move + Bolt →   │
│        Brunhilde 32 dmg         │
│                                 │
│ T0003: Tank — Attack → Wave     │
│        76 dmg (crit!)           │
│   ↳ Wave's Counter → Tank 24    │
│                                 │
│ T0004: Wave — casts Frost Wave  │
│        (resolves T0007)         │
│                                 │
│ ─── newest entries ↓ ───        │
│ ▼                               │
│                                 │
│ [Auto-scroll: ON]               │
└─────────────────────────────────┘
```

- New entries append at the bottom (chat-style); auto-scroll follows the latest by default.
- Auto-scroll toggle disables follow-newest when player is reviewing earlier entries.
- Click any entry's chevron (▾) to expand it inline showing full detail.
- Click a charged-action commit entry → highlights its corresponding resolve entry (and vice versa).
- Filtering controls (by team, by event type, etc.) deferred until playtest reveals demand. First playable: show everything.
- Panel collapses to a thin tab on the right edge when not in active use; expands to ~280-320px when open.

### Click-to-Rewatch Behavior

Two tiers, sequenced by complexity:

**Tier A — animation rewatch (first playable):** Click a log entry → renderer plays its animation again at current speed. Engine state stays current; this is purely visual. Player can re-watch interesting moments without affecting state.

**Tier B — state rewind / replay (deferred):** Click a log entry → renderer rewinds to immediately before that entry, then plays forward. Engine state reconstructed from log replay (works because every action is deterministic given its stored seed). Full timeline scrubbing.

Both use the same log infrastructure; Tier B is the "replay system" feature that comes later, but the architecture supports it cleanly.

### KO Presentation and Movement Interaction

When a unit reaches 0 HP, slump animation plays at the moment of damage (~700ms). Damage number shows the lethal blow. Unit token transitions to a "downed" state — translucent or grayed.

**KO'd units stay on the map**: they remain visible at their KO location, retain their position information for status restoration mechanics, and act as terrain-like markers. This aligns with:
- Future revival abilities (need a position to revive on)
- The 3-turn KO timer with permadeath if not revived (rule already in design — units permanently leave the battle if not revived within 3 of their own would-be turns)
- Tactical visibility (player sees where the casualty was, not a vanished unit)

**Movement interaction with KO'd units:**
- Other units may *move through* a KO'd unit's tile during pathfinding (path-traversal allowed)
- Other units may *not end* their move on a KO'd unit's tile (the tile counts as occupied)
- Standard ally/enemy traversal rules still apply: move through allies allowed, move through enemies blocked, never end on any occupied tile

This needs engine verification — pathfinding should treat KO'd units as ally-traversal (regardless of original team) for "move through" purposes but as obstacles for "end on" purposes.

### Damage Number Visual Style

Color-coded by outcome type:
- **White**: standard damage
- **Red, larger font**: critical hit
- **Light blue**: damage absorbed by resistance ("damage halved" or similar)
- **Yellow**: status effect that didn't apply (saving throw / resisted)
- **Green**: healing
- **Purple**: MP drain (Rasp Pendant)
- **Orange**: fall damage

Numbers float up ~30-40 pixels over the 500ms duration with ease-out curve, fade out the last 200ms. Multi-target AoE staggers numbers by ~50ms based on target distance from caster.

### Battle-Start Animation Sequence

When the first turn begins:
1. Camera fades in from overview to active unit (~500ms)
2. Battle-init entries (auto-statuses, initial CT) appear in quick succession in the action log
3. Top bar populates with battle info
4. Active unit panel slides in
5. Action menu becomes available

Total intro: ~2 seconds. Skippable by hitting any speed control or input.

## Camera and Map Navigation

### Camera State

The camera carries three pieces of state: world-space position `(x, y)`, zoom scale, and active interpolation target. All camera changes interpolate smoothly; no instant snaps. State machine:

```
IDLE — at rest at current position/zoom
  ↓
AUTO-INTERPOLATING — animating to a target (turn snap, charged-action resolve)
  ↓
USER-DRIVEN — player actively WASD-panning or zooming
  ↓
IDLE
```

Player input transitions to USER-DRIVEN at any time and overrides AUTO-INTERPOLATING.

### Default Zoom and Starting View

On battle start, camera positions to fit the whole map (or close to it) within the draw area. Lets the player begin with a bird's-eye perspective and decide whether to focus on their own units or inspect the enemy lineup. For River Ridge's 14×14 layout with deployment zones at opposite ends, this naturally shows both teams plus all neutral terrain.

Starting zoom = minimum zoom (full map fits draw area). Player can zoom in for detail or stay at overview.

### Auto-Pan Rules (Simple)

The camera auto-pans in only two situations:

1. **Turn start** — pan to the active unit at the start of their turn.
2. **Charged action resolution begins** — pan to the resolution location (target unit or target tile) at the moment a charged action begins resolving.

Each auto-pan is smooth (~500ms ease-in-out). After it completes, the camera does not move again until the next turn or charged-action-resolve event. AoE spells, multi-target abilities, knockback effects, and other multi-stage actions play out wherever they happen — no further camera nudges.

The player gets oriented to "this is where the action is starting" but isn't yanked around as the action plays out across the map. Trade-off: occasionally parts of an action play out partly off-screen (e.g., a wide AoE hits a target at the viewport edge). Player can pan or zoom out to see them, or rely on the action log to catch what they missed. This is a deliberate choice for camera predictability over comprehensive auto-coverage.

### Pan Controls

WASD as the primary pan input:
- **W / S** — pan up/down on the map
- **A / D** — pan left/right
- Hold to pan continuously; release to stop

Pan speed scales with zoom: `base_speed × (1 / zoom_factor)`. Faster pan when zoomed out (so navigating across the map at overview is reasonable); slower when zoomed in (precise positioning).

Boundary constraints: viewport center stays within map plus ~2 tiles of overshoot margin. Hard stop at the boundary, with a subtle visual cue (edge glow) when WASD-panning hits the limit.

Deferred / lower priority: edge-of-screen mouse-pan, arrow keys as alternates to WASD, mouse-drag to pan. All easy adds; just not first-priority.

### Zoom Controls

Two simultaneous inputs:

- **Mouse wheel** — zoom-toward-cursor. Each tick = ~10% zoom delta. Scroll up to zoom in; scroll down to zoom out.
- **Clickable +/- buttons** — zoom-toward-screen-center. Each click = ~20% zoom delta (faster than wheel since clicks are intentional discrete actions). Persistent UI element, probably bottom-right near the speed controls.

Both call the same `applyZoom(deltaFactor, focalPoint)` function — only the focal point differs.

Continuous zoom from `min_zoom` (full map fits in draw area) to `max_zoom` (single tile fills screen). The 96px tile-size threshold for status icon strip vs composite indicator is calculated by the renderer from current zoom × tile pixel count; UI doesn't track it directly.

A small zoom percentage indicator appears briefly on zoom change (e.g., "75%"), fading after ~1.5 seconds.

### User Input Override

WASD pan or zoom interaction transitions camera to USER-DRIVEN state, cancelling any in-progress AUTO-INTERPOLATING animation. Camera stays where the player left it until the next auto-snap event (turn start or charged action resolve).

Pan-during-auto-pan does **not** auto-resume after release. The manual position is respected until the next auto-snap.

### Selection Model

Click semantics by current UI state:

| Click target | IDLE | MOVE-SELECT | TARGET-SELECT |
|---|---|---|---|
| Friendly unit | Open detail panel | Path target if walkable | Target if valid |
| Enemy unit | Open detail panel | Blocked | Target if valid |
| KO'd unit | Open detail panel | Path through (can't end on) | Usually invalid (revive abilities excepted) |
| Empty tile (land) | Inspection mode | Path target if reachable | Usually invalid (tile-target abilities excepted) |
| Water tile | Inspection mode | Path target if water-traversable | Usually invalid |
| Off-map | Dismiss panels | (Cancel via ESC, not click) | (Cancel via ESC, not click) |

**Inspection mode** (click empty tile in IDLE) populates the forecast panel with tile info:
- Coordinates (x, y, layer)
- Elevation
- Terrain type and properties
- Move cost from active unit (if reachable; "unreachable" otherwise)
- LoS implications (does this tile block sight from active unit's position?)
- Deployment zone marker (if applicable)
- Any units on the tile (with quick HP/MP readout)

Pinned — persists when cursor moves elsewhere. ESC clears the pin.

### Hover Behavior

Parallel to click but transient:

- Hover unit → Tier 2 tooltip (designed earlier) appears near cursor after ~300ms delay
- Hover tile during IDLE → forecast panel transient inspection (reverts when cursor moves)
- Hover tile during MOVE-SELECT → path preview overlay + cost
- Hover tile/unit during TARGET-SELECT → target forecast (designed earlier)

Hover is transient; click is pinning. Clicking pins the inspection so it persists; hovering elsewhere doesn't disturb a pinned panel.

### Click-Off-Map Behavior

- **In IDLE state**: clicking empty area off the map dismisses any open detail panel and clears any pinned inspection. Standard "click outside to close."
- **In MOVE-SELECT or TARGET-SELECT state**: clicking off-map does nothing. Cancellation requires explicit ESC or right-click (which dispatches to the back-navigation pattern).

### Layer Toggle (Deferred)

Single-layer maps (River Ridge included) need no UI for this. When multi-layer maps come online (bridges, upper floors), the design adds:
- Layer indicator in top bar
- Hotkey for cycling layers (probably PageUp/PageDown or Q/E)
- Visual treatment of inactive layers (semi-transparent)
- Click disambiguation when a tile has multiple layers

For first playable: layer 0 only. The renderer reads tile layer info but doesn't surface a toggle.

### Visual Feedback

- Cursor coordinates shown subtly in a corner (e.g., "Tile (5, 8)") when hovering over the map
- Zoom percentage indicator briefly visible on zoom change
- Pan boundary edge glow when WASD-panning hits the limit

Optional / deferred:
- Mini-map showing camera position relative to whole map
- Edge-of-screen mouse-pan
- Arrow keys as alternate pan inputs

## Projection Column / Queue Tower

The 20-event projection lives as a vertical column on the left side of the screen, anchored at the bottom by the active unit panel. Looking up the column is looking forward in time: the next event is directly above the active unit, then the one after that, and so on. The visual metaphor — *above = later* — is intuitive, and the column is always visible without requiring the player to open a separate panel.

Pattern inspired by the recent FFT remake (Ivalice Chronicles). The active unit is "row 0" rendered as a full-detail panel; upcoming events are mini-cards extending upward as a unified column.

### Column Layout

```
┌─────────────────────────┐
│ ▲ scroll for more       │ ← if events above visible range
│ ┌─────────────────────┐ │
│ │ 5  [PORTRAIT]   ⚔  │ │ ← upcoming event #5
│ │    Sparky           │ │
│ │    Lightning Mage   │ │
│ └─────────────────────┘ │
│ ┌─────────────────────┐ │
│ │ 4  [PORTRAIT]   ⚔  │ │
│ │    Tank             │ │
│ │    Knight           │ │
│ └─────────────────────┘ │
│ ┌─────────────────────┐ │
│ │ 3  [PORTRAIT]   ✦  │ │ ← charged action resolution
│ │    Wave (Frost Wv)  │ │   (spell-circle icon overlay)
│ │    on Knight        │ │
│ └─────────────────────┘ │
│ ┌─────────────────────┐ │
│ │ 2  [PORTRAIT]   ⚔  │ │
│ │    Brunhilde        │ │
│ │    Earth Mage       │ │
│ └─────────────────────┘ │
│ ┌─────────────────────┐ │
│ │ 1  [PORTRAIT]   ⚔  │ │ ← next event
│ │    Sparky           │ │
│ │    Lightning Mage   │ │
│ └─────────────────────┘ │
├─────────────────────────┤
│ ACTIVE UNIT panel       │ ← bottom anchor (full detail)
│ Brunhilde (Earth Mage)  │
│ Level 25                │
│                         │
│ HP 152/152  MP 96/100   │
│ CT 100       Sp 8       │
│ Move 3   Jump 3         │
│                         │
│ ▲ Auto-Regen ▲ Auto-H.  │
│                         │
│ Move ✓ available        │
│ Act ✓ available         │
│                         │
│ [ Open full details ]   │
└─────────────────────────┘
```

Default position: bottom-anchored, showing the active unit and 5-7 upcoming events. The full 20-event horizon is reachable via scroll.

### Mini-Card Design

Each upcoming event is a compact card showing only what's needed to identify the upcoming actor:
- **Position number** (1, 2, 3, ...) in a corner badge — the player's primary "I act in N events" indicator
- **Portrait** of the unit (~50-60px square; reuses the same asset as the active unit panel)
- **Team color border** around the card (red or blue) for instant team identification
- **Name and class** below or beside the portrait, ellipsis-truncated if too long. Full name appears in hover tooltip.
- **Event-type icon** in a corner for non-standard events:
  - Default unit turn — implicit (no icon, or a subtle sword/normal-action mark)
  - Charged action resolution — spell-circle icon overlay on the casting unit's portrait
  - Forced action (Stop-skipping a turn, Sleep-skipping, etc.) — appropriate status-derived icon

Mini-card height: ~60-70px. Mini-card width: matches the active unit panel (~280px column width).

No HP, MP, statuses, or other detail on mini-cards. Click for the full detail panel.

### Charged Action Representation

Charged action mini-cards use the casting unit's portrait with a small spell-circle icon overlay in a corner. Border treatment differs slightly (different color or pulsing animation) to signal "spell event, not unit's normal turn."

Hover tooltip shows the spell name, target, and projected outcome:

> "Frost Wave (charged) — Wave casting on Knight, resolves at event 3"

Click opens a charged-action-specific detail panel showing spell info, charge progress, target, and projected outcome — distinct from the unit detail panel.

### Hover and Click

- **Hover mini-card** → that unit (or the charged-action target) briefly highlights on the map. Bridges abstract "row 3 in queue" with concrete spatial location. Small tooltip shows name and CT-to-act.
- **Click mini-card** → opens the full Tier 3 detail panel for that unit (or the charged-action detail panel for charged events).

### Scrolling Behavior

Mouse wheel over the projection column scrolls within the column without affecting the map. Subtle "▲ more above" indicator at the top of the visible projection signals events extending beyond view.

When a new turn begins, if the player has manually scrolled to view further-out events, the column auto-snaps back to bottom-anchored. The active unit is always visible without manual re-anchoring.

### Beyond the 20-Event Horizon

Top of the full projection range (event 20) shows clean truncation with a subtle "+ further events" indicator. Clean cutoff rather than fading; the player sees what's coming for the next ~3-5 turns, which covers most decision-making.

### Tiebreak Ordering

Events occurring on the same engine tick (simultaneous CT-100 reaches) appear in deterministic tiebreak order resolved by the engine. UI shows them as sequential rows; no special "tied" visualization. Engine resolves ties by Speed first, then by stable secondary criterion (probably unit ID).

### Visual Unification with Active Unit Panel

The active unit panel and upcoming-event mini-cards share visual style — column-aligned width, consistent portrait sizing, matching team color borders. The active unit gets full-detail rendering; upcoming events are compact mini-cards. The column reads as a unified "you, then them, then them" rather than "active panel + separate projection list."

## Battle-End and Results Screen

When a victory condition triggers (last enemy KO'd, objective reached, etc.), the battle transitions through a brief celebration beat before settling into the results screen.

### Victory Transition

1. The action that triggered the victory finishes its animation normally (~700-1100ms depending on action type).
2. ~500ms auto-pause on the moment of resolution (matches the general battle-end auto-pause rule).
3. Victory text overlay appears centered on the screen for ~1.5 seconds:
   - "Red Team Victorious" / "Blue Team Wins" in pass-and-play mode (neutral framing — both players see the same screen, so single-perspective "Victory" / "Defeat" doesn't fit).
   - "Victory!" / "Defeat" in Player vs AI mode (single-perspective makes sense there).
   - Color-coded by winning team; large readable text with a brief scale-in animation.
4. Overlay fades; results screen panel fades in with the map still visible behind it.

### Results Screen Layout

The map remains visible behind a translucent results panel covering most of the central screen area. Action log stays in its right-side panel (still scrollable; players can read through the full battle history). Camera and inspection controls remain functional.

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Turn T0017 — Battle Complete                                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  [translucent map view behind...]                                        │
│                                                                          │
│         ┌─────────── BATTLE COMPLETE ─────────────┐                     │
│         │                                         │                     │
│         │   RED TEAM VICTORIOUS                   │                     │
│         │   Battle ended on turn 17               │                     │
│         │                                         │                     │
│         │   ─── Per-Unit Stats ──────────────     │                     │
│         │   Red Team:                             │                     │
│         │     Brunhilde (Earth)  Dmg 142 / 33     │                     │
│         │     Sparky (Lightning) Dmg 218 / 91 ✓   │                     │
│         │     Tank (Knight)      Dmg 84  / 110    │                     │
│         │     Wave (Water)       Dmg 67  / 28     │                     │
│         │                                         │                     │
│         │   Blue Team:                            │                     │
│         │     Steel (Knight)     Dmg 89  / 152    │                     │
│         │     Pyre (Fire) [LOST] Dmg 102 / 127 ✗  │                     │
│         │     ...                                 │                     │
│         │                                         │                     │
│         │   ─── Permadeath Casualties ───────     │                     │
│         │   Pyre (Fire Mage, Blue) — fell at T13  │                     │
│         │                                         │                     │
│         │   [ Rematch ] [ New Battle ] [ Menu ]   │                     │
│         │   [ Save Replay ]                       │                     │
│         └─────────────────────────────────────────┘                     │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Per-Unit Stats Display

For each unit on each team, show:
- **Name and class** (with team color)
- **Damage dealt / damage taken** (the most-used at-a-glance metric)
- Optional: KOs scored, healing dealt, statuses applied, distance moved
- **Status indicator** for outcome:
  - ✓ if the unit dealt the killing blow on a permadeath casualty (rough MVP signal)
  - ✗ if the unit was permadeath'd themselves
  - (no marker) if standard survivor or KO'd-but-not-permadeath

Stats can be derived from the action log post-hoc — each action carries enough metadata (actor, target, damage values, status applications) to compute these. The engine doesn't need to track stats during the battle in real-time.

### Permadeath Casualty Section

Permadeath is a tactical and emotional event worth its own callout. The results screen lists each permadeath'd unit by name, class, team, and the turn at which they fell. This is also the data point most relevant for future multi-battle modes (campaign progression, persistent rosters), where a permadeath in one battle has consequences in subsequent battles.

### Permadeath UX During Battle

When a unit hits the 3-turn KO timer expiry mid-battle:
- Unit token is **removed from the map** entirely (not left as a tombstone — the unit is permanently gone).
- Action log gets a `[permadeath]` system entry: e.g., `[permadeath] Pyre (Fire Mage) lost at T0013 (3-turn timer expired)`.
- The unit's tile becomes free again; standard tile occupancy rules apply.
- Per-unit stats accumulate on the action log up to the moment of permadeath; results screen shows their full contribution.

### Post-Battle Interaction

The map remains interactable behind the results panel:
- Click any unit on the map → opens their detail panel (read-only, showing final stats).
- Hover any unit → tooltip with final state.
- Scroll the action log → full battle history.
- Pan and zoom the map normally.

What's disabled:
- Action menu (no more turns to take).
- Forecast pipeline (no actions to forecast).

The active unit panel area can show the team summary or the final action log entry instead.

### Exit Buttons

Core actions on the results screen:
- **Rematch** — same teams, same map, same level. Quick replay path.
- **New Battle** — return to the battle setup screen with teams loaded but rebuildable.
- **Main Menu** — full reset back to the application's top.

Nice-to-have:
- **Save Replay** — save the action log to a file or generate a share-link. Architecturally trivial (action log is already serializable + per-action seeds make replay deterministic), so worth including in first playable if implementation cost is low.

The action log stays accessible via its own panel; no separate "View Action Log" button needed.

## Battle Setup and Title Screen

The battle setup flow connects the application's main menu to the team builder, deployment phase, and battle UI. It's the configuration surface that determines what kind of battle the players are about to play. (This section may eventually split into its own doc as the meta-flow expands; for now, captured here alongside the battle UI it leads into.)

### Title Screen

Application entry point. Static screen with:
- **Splash image** (in development) as the visual anchor / background
- **Game title** as the primary visual element
- **Menu options** (centered, vertical list):
  - **New Battle** — only fully-functional option for first playable
  - **Settings** — opens the settings panel
  - (Future: Saved Replays, Campaign Mode, About, Quit)
- **Version indicator** in a corner (e.g., "v0.1")

### Battle Setup Screen

Single-screen configuration. Player picks "New Battle" from the title screen and lands here.

```
┌─────────────────────────────────────────────────────────┐
│  Battle Setup                              [Back ←]     │
├─────────────────────────────────────────────────────────┤
│                                                         │
│   PLAYER MODE                                           │
│   ( ) Pass-and-Play (2 humans, same device)             │
│   (•) Player vs AI                                      │
│                                                         │
│   MAP                                                   │
│   [ River Ridge ▼ ]   14×14 — ridge with river/islands │
│   [ Map thumbnail / preview ]                           │
│                                                         │
│   BATTLE LEVEL                                          │
│   [────────●─────] Level 25                             │
│   (Affects all unit stats; default 25)                  │
│                                                         │
│   AI DIFFICULTY                       (Player vs AI only)│
│   [ Standard ▼ ]                                        │
│   (Currently: Tier 1.5 AI; more tiers in future)       │
│                                                         │
│                              [ Configure Teams → ]     │
└─────────────────────────────────────────────────────────┘
```

When a more detailed rule-set customization option is added in the future, it will likely open in its own panel (rule overrides, team-uniqueness exceptions, etc.). For first playable, the four shown configuration options are sufficient.

### Configuration Options

- **Player Mode**: radio-button choice between Pass-and-Play (two humans, same device) and Player vs AI (one human, one AI).
  - Determines whether the team builder shows the team switcher (Pass-and-Play uses both teams; Player vs AI hides the AI team's construction).
  - AI Difficulty option only shows when Player vs AI is selected.

- **Map**: dropdown of available maps. Currently only River Ridge for first playable. Each entry shows a brief description (dimensions, key feature). Optional thumbnail preview alongside the dropdown.

- **Battle Level**: 1-50 slider, default 25. Applies to all units in both teams equally. Numeric value displayed beside the slider.

- **AI Difficulty**: placeholder dropdown for future AI tiers. For first playable, single option ("Standard") representing the Tier 1.5 AI. Hidden when player mode is Pass-and-Play.

### Configuration Stickiness

Selections persist within the session. After completing a battle and clicking "New Battle" from the results screen, the configuration screen returns with the previous battle's selections intact. Player can adjust before starting another battle.

Stickiness is in-memory only for first playable; persistent (across-session) settings via localStorage would be a future feature.

### Player Mode Flow Implications

**Pass-and-Play**:
1. Battle setup commit → team builder opens with both teams active (switcher available)
2. Both players build their teams; commit
3. Deployment phase opens with both teams placing units (switcher; blind picks via social trust on shared device)
4. Battle proceeds with control alternating

**Player vs AI**:
1. Battle setup commit → team builder opens with only the human player's team active (switcher hidden)
2. Player builds their team; commit
3. **At commit moment, AI generates its team** (random valid team for first playable; future: archetype-based generation per AI tier)
4. Deployment phase opens with player placing their units; AI auto-places its units when player commits
5. Battle proceeds with player and AI alternating turns

### AI Team Generation (First Playable)

When the player commits their team in Player vs AI mode, the AI generates a team using the same rules as the manual team builder:
- 4 distinct classes (random subset of the 5)
- Equipment respecting class restrictions and team-uniqueness
- Random secondary action(s)
- R/S/M buckets filled to capacity with random legal abilities
- Default Brave/Faith (70/70)
- Same battle level as player's team

Identical to the team builder's "Random Fill" feature; the AI team is a random fill committed automatically.

Future tiers replace random generation with archetype-based or counter-pick generation. Architecture supports this via the same team-data structure — the AI module just consumes battle config + catalog and returns a valid `Team` object.

### AI Deployment (First Playable)

When the player commits placement in Player vs AI mode, the AI auto-places its units. Algorithm sketch for first playable:
- Distribute units across the team's deployment zone (spread out, not clustered)
- Default facing toward the enemy zone centroid
- Essentially the deployment-phase "Auto-place all" button executed for the AI side

Future AI tiers can use map-aware placement (rangers on high ground, tanks in front, etc.) — that's content for the AI module, not the setup screen.

### Connection to Team Builder

Battle setup commits a `BattleConfig` object containing:
- `level: int` (1-50)
- `mapId: MapId` (currently only `river_ridge_v1`)
- `playerMode: 'pass_and_play' | 'player_vs_ai'`
- `aiDifficulty?: AIDifficultyId` (only when Player vs AI)
- `catalogVersion: string` (for remote-play compatibility, even if unused first playable)
- `ruleSet: 'mage_war_v1'`

Team builder receives this on entry and uses it to configure (whether to show the switcher, whether to enable AI team generation on commit, etc.).

### Settings Access

Settings is accessible from the title screen menu and from the in-battle pause menu. Both routes open the same settings panel. Settings affect things like default animation speed, confirm-step preference, etc.

For first playable, settings are minimal: probably just animation speed default and confirm-step toggle.

## AI Turn UX

When an AI-controlled unit becomes the active unit, the experience looks visually identical to a player turn. The AI unit appears at the bottom of the queue tower as the active unit; its team color (red or blue) frames both the on-map token and the active unit panel; the camera auto-pans to it via the standard turn-start rule.

The AI computes its action synchronously (within a few hundred ms at worst) and dispatches it to the engine. Animation plays normally; action log records the events the same way as a player turn.

Player perspective: they're watching the battle play out. No "AI thinking..." indicator since the computation is fast enough to feel instant. No "what the AI is considering" preview — straight into the animation. Keeps the experience predictable and skips a layer of UI complexity that doesn't add player value for a fast, deterministic AI.

Speed controls remain available during AI turns and behave identically. A player who wants 1× for their own turns and 2× during AI turns can adjust the speed control as the active turn changes. The control is global state; the player adjusts it per their preference.

## Settings Menu

Accessible from two routes:
- Title screen "Settings" option
- In-battle pause menu "Settings" option

Both routes open the same settings panel.

V1 settings:
- **Default animation speed** — 1× / 2×, defaulting battle to start at this speed
- **Confirm-step preference** — confirm-by-default (recommended) or skip-confirm (power user)
- **Status icon density preference** — standard (icon strip at high zoom, composite at low zoom — current default) or minimal (composite indicator regardless of zoom, for clutter-sensitive players)
- (Future: sound toggles, accessibility options, persistent settings via localStorage)

Settings persistence: in-memory only for first playable. Settings revert to defaults on application reload. Future feature: localStorage persistence so settings survive between sessions.

Audio is out of scope for first playable; sound toggles will appear when audio ships.

## Battle-Pause / Out-of-Turn UI

Pressing **ESC** during a battle opens a pause overlay. While paused:
- Animation playback halts (renderer stops updating)
- Engine processing halts (no new actions resolve, AI doesn't act)
- Map and HUD remain visible behind the overlay (translucent backdrop)
- The action log is scrollable; players can review what's happened

Pause overlay options:
- **Resume** — closes overlay, resumes animation and engine processing
- **Settings** — opens settings panel (same as title screen route)
- **Surrender** — confirmation dialog ("Forfeit this battle?"), then surrendering team is marked as defeated and battle transitions to results screen
- **Main Menu** — confirmation dialog ("This will end the current battle"), then transitions to title screen, abandoning current battle state

Pause behaves identically in Pass-and-Play and Player vs AI modes.

### Save-and-Resume (Deferred)

Save-and-resume of mid-battle state is deferred for first playable. Architecturally trivial to support in the future — `GameState` is fully serializable; the action log + per-action seeds enable deterministic replay — but the UI flow (save dialog, load dialog, save-slot management) is additional work that isn't critical for first playable. Worth flagging that this is one more functionality to add at some point.

## Engine Requirements

Items added to the engine implementation backlog from this design pass:

- **`projectChargedActionResolution(action, target, currentState)` query.** Pure function returning the projected resolution event for a charged action plus the surrounding 5-7 events for context. Used by the forecast panel's Timing subsection.
- **`projectTurnEndCT(unit, plannedActions, currentState)` query.** Pure function returning the projected end-of-turn CT for a unit given a planned action sequence. Accounts for ability-specific CT modifiers, status-driven CT effects, and standard Move/Act/Wait costs. Used by the action menu's cost preview annotations and the forecast panel's CT impact line.
- **20-event projection panel data.** The existing `projectTurns` query needs to return at least 20 events including charged action resolutions and forced-action events (Stop-skipping a turn, etc.) — not just unit turns. Each event needs metadata for UI rendering: entity ID (the unit or casting unit), action type tag (`unit_turn` / `charged_resolve` / `forced_skip`), CT-to-act, and for charged events specifically: target ID and ability ID. Events occurring on the same engine tick must be ordered deterministically (Speed first, then stable secondary criterion such as unit ID) so the projection column renders consistently across queries.
- **Status icon zoom-tier rendering hook.** Renderer needs to know whether to show full status icon strips (high zoom) or composite has-status indicator (low zoom). Probably internal to renderer, but the threshold (e.g., tile size ≥ 96px) should be a configurable parameter.
- **Forecast hover throttling.** UI calls forecast queries on every hover-target change; ensure these are cheap enough to call at hover speed (sub-100ms) without bogging down. Likely already true given pure-function design but worth verifying once integrated.
- **Pathfinding traversal rules with KO'd units.** Confirm engine pathfinding allows moving *through* KO'd units' tiles (regardless of original team) but does not allow *ending* on them. Standard rules: move through allies allowed; move through enemies blocked; never end on any occupied tile. KO'd units count as occupied for ending but as ally-traversable for path-through.
- **3-turn KO timer with permadeath rule.** Confirm engine implements the rule that KO'd units remain on the map and stay revivable for 3 of their own would-be turns, after which they're permanently removed from the battle. (Design already has this rule; flag for engine verification at integration time.)
- **Camera state with smooth interpolation.** Renderer-side first-class concern: world-space position, zoom scale, target-state for animations, smooth interpolation between current and target. UI dispatches camera events; renderer applies transformations.
- **Auto-pan trigger on turn-start.** Renderer subscribes to turn-start events and triggers camera animation to center on the active unit at current zoom.
- **Auto-pan trigger on charged-action-resolve.** Renderer subscribes to charged-action-resolve events and triggers camera animation to the resolution location (target unit or target tile).
- **WASD pan input handling.** UI keyboard handler dispatches pan deltas to the renderer with boundary constraints and zoom-scaled speed.
- **Mouse wheel zoom with focal point.** UI captures wheel events and dispatches zoom-toward-cursor to the renderer; clickable +/- buttons dispatch zoom-toward-center.
- **Click-target dispatch and hit-testing.** On map click, renderer provides hit-testing (which unit/tile was clicked); UI handler dispatches based on current state.
- **Hover throttling for tile inspection.** Cap forecast updates at ~30Hz when hovering over the map to avoid noise.
- **Permadeath casualty tracking in battle outcome.** When the 3-turn KO timer expires and a unit is permanently removed, the engine should record this as part of the battle's outcome state — even if first playable doesn't use it for anything. Future multi-battle modes (campaign, persistent rosters, league play) will need to know which units were permadeath'd in each battle. Minimum data: unit ID, team, turn at which permadeath occurred. The action log entry `[permadeath]` provides this information; engine should also expose it as a structured field on `GameState.outcome` for easy querying.
- **Battle outcome data structure.** `GameState.outcome` (or equivalent) should be populated on `battle_end` with: winning team, turn count, list of permadeath casualties (with turn of loss), and reference to full action log. Per-unit stats can be derived from the action log post-hoc and don't need to be eagerly stored. (This may already be partly in scope from earlier sessions; flag for engine verification at integration time.)
- **AI team generation function.** `generateRandomTeam(battleConfig, catalog) → Team` produces a valid 4-unit team respecting all team builder rules (class/item uniqueness, R/S/M bucket capacity, equipment class restrictions). Used by Player vs AI mode at player team commit. Architecture supports future archetype-based or counter-pick variants by replacing this function (or making it a tier-parameterized factory).
- **AI deployment function.** `generateDeployment(team, mapZone) → UnitPlacement[]` produces valid placements for a team within its deployment zone with sensible default positioning and facing. Used by Player vs AI mode at player deployment commit. First playable uses simple distribute-across-zone logic; future tiers can add map-aware placement.
- **Pause/resume control.** When the application is in a paused state, the engine processing loop must halt — no actions are dispatched (AI doesn't compute new turns; charged action resolutions don't fire from CT advancement; status ticks don't trigger). Resume restores normal processing. The renderer separately halts animation playback. Both are application-level concerns; the engine just needs to not auto-process while paused. (Likely already supported since the engine is action-driven and simply not-dispatching-actions equals paused; flag for verification at integration.)

## Open Items / Subsystems Still to Design

*(Battle UI design surface is now substantively complete. Remaining open items are content design and implementation, not UI architecture.)*

- **Specific R/S/M ability content per class** — depends on Session 20 ability summary
- **Specific spell content per class command set** — depends on Session 20 ability summary
- **Sample team templates** for first playable testing — designed as content, not UI
- **Polish and refinement** of all the above based on first playable iteration

## Decisions Captured

- Confirm-by-default for action commits, with a settings toggle for skip-confirm.
- Damage detail expander collapsed by default.
- Status icon strip on map at high zoom; composite has-status indicator at low zoom.
- Move cost as a number with a small visual indicator (filled boxes), since information-rich philosophy favors precision.
- 20-event projection in a dedicated expandable panel from the top bar.
- Charged action timing visualization includes a mini-timeline showing the resolution event in context with surrounding events.
- CT cost preview baked into action menu options as live annotations.
- Animation speed controls (1×, 2×, skip) persistent in bottom-right.
- The action log is the source of truth for both rendering and replay; skipping animations changes nothing.
- HUD elements are React components overlaying the PixiJS canvas; the few render-side bridges (range overlays, AoE preview) live in the renderer toggled by UI flags.
- Three-tier disclosure pattern for unit information: on-map (Tier 1) → hover tooltip (Tier 2) → full detail panel (Tier 3), with each tier a strict subset of the next.
- Active unit panel is persistent Tier 1.5 content during the unit's turn (compact essentials plus link to full panel).
- Three entry points (click unit on map, "Status" from action menu, "Open full details" from active unit panel) all converge on the same full detail panel component.
- Full detail panel has collapsible sections; Stats and Active Statuses expanded by default; Reaction Risks expanded by default for enemies, collapsed for self/ally; other sections collapsed.
- Resistances breakdown shows all contributing sources plus net total (information-rich; future filter-out candidate).
- Status visual language: color by polarity, glyph by type, border treatment by source, stack count badge for stacking statuses. Consistent across all tiers.
- Hover-within-hover for nested tooltips as the simpler default; click-to-pin fallback if needed.
- Equipment with stat-modifying hooks shows up in the stat block; equipment that applies statuses shows up in the status list with source attribution.
- Detail panel is sticky during TARGET-SELECT (player can keep enemy stats visible while targeting).
- Sequential animation by default; concurrent only for causally-paired pairs (damage number with strike, AoE staggered ~50ms by distance).
- Action log uses T#### indexing with 4-digit zero padding; each unit turn or charged action resolve is one T-event; sub-actions group under the parent T-event.
- System events tagged with `[init]`, `[tick]`, `[charged]`, `[ko]`, `[end]` for at-a-glance distinction from unit T-events.
- KO'd units stay on the map as grayed/translucent tokens, supporting revival mechanics and the 3-turn permadeath timer; pathfinding allows traversal through but not ending on KO'd unit tiles.
- Click-to-rewatch in first playable plays the animation again without changing engine state (Tier A); full state-rewind / replay (Tier B) deferred to post-first-playable.
- Damage numbers color-coded by outcome type (white standard, red crit, blue resistance-absorbed, yellow status-resisted, green heal, purple MP drain, orange fall).
- Auto-pause on significant events (KO ~400ms, charged resolve ~300ms, battle end ~500ms) regardless of speed setting.
- Default starting view: full map fits in draw area (bird's-eye); player adjusts from there.
- Auto-pan only on turn-start and charged-action-resolve-begin; no further camera movement during an action's own animation. Trades occasional off-screen action for camera predictability.
- WASD as primary pan input; mouse wheel + clickable +/- buttons for zoom. Zoom-toward-cursor for wheel; zoom-toward-center for buttons.
- Continuous zoom from min (full map fits) to max (single tile fills screen). Pan speed scales inversely with zoom.
- Click empty tile in IDLE = pinned inspection mode; click off-map in IDLE dismisses panels; cancel during selection requires ESC/right-click, not click-off-map.
- Layer toggle deferred until multi-layer maps come online; River Ridge and first playable are layer-0 only.
- 20-event projection lives as a "queue tower" vertical column on the left side, anchored at the bottom by the active unit panel. Looking up the column = looking forward in time. Always visible, no separate panel to open.
- Mini-cards in the projection column are compact: position number, portrait, team color border, name+class, event-type icon. No HP/MP/status detail — those come from clicking through to the full detail panel.
- Charged action mini-cards show the casting unit's portrait with a spell-circle icon overlay; click opens charged-action-specific detail panel showing spell info, charge progress, target, and projected outcome.
- Hover mini-card highlights the unit on the map briefly (bridges queue position to spatial location); click opens full detail panel.
- Mouse wheel scrolls within the projection column without affecting the map; column auto-snaps back to bottom-anchored on new turn.
- Clean truncation at the 20-event horizon with "+ further events" indicator.
- Active unit panel and upcoming-event mini-cards share visual style as a unified column; active unit gets full-detail rendering while upcoming events are compact.
- Tiebreak ordering for simultaneous CT-100 events is deterministic (Speed first, then stable secondary criterion); shown as sequential rows in the projection.
- Battle-end transition: final action animation completes → ~500ms auto-pause → Victory/Defeat text overlay (~1.5s) → results panel fades in over translucent map view.
- Pass-and-play uses team-neutral framing on the overlay ("Red Team Victorious"); Player vs AI uses single-perspective framing ("Victory!" / "Defeat").
- Results screen keeps the map visible and inspection UI active (click for unit details, hover for tooltips, action log scrollable). Action menu and forecast disabled.
- Per-unit stats on results screen derived from the action log post-hoc; engine doesn't track stats in real-time during battle.
- Permadeath during battle: unit token removed from map entirely (no tombstone marker); action log gets `[permadeath]` system entry; tile becomes free.
- Permadeath casualties tracked in battle outcome data structure for future multi-battle modes (even if first playable doesn't use it).
- Results screen exit options: Rematch / New Battle / Main Menu (core); Save Replay (nice-to-have).
- Application entry is a title screen with splash image background, game title, and main menu (New Battle, Settings; future: replays, campaign, etc.).
- Battle setup is a single-screen configuration (no wizard) with player mode, map, battle level, AI difficulty (when applicable). Future detailed rule-set customization opens in its own panel.
- Player Mode determines team builder switcher visibility (Pass-and-Play shows it; Player vs AI hides it) and whether AI team generation fires on player commit.
- AI team generation in Player vs AI mode happens at the moment the player commits their team — same moment as the player's commit, AI generates a "shadow" valid team. First playable uses random fill; future tiers use archetype/counter-pick generation.
- AI deployment auto-fills when the player commits placement in Player vs AI mode. First playable uses simple distribute-across-zone logic; future tiers can be map-aware.
- Saved team loading lives inside the team builder, not the battle setup screen — battle setup always starts the team builder with a clean slate, with a "Load Team..." button accessible inside.
- Configuration sticky within session (in-memory); persistence across sessions deferred to future work.
- AI turns visually identical to player turns (same active unit panel, camera auto-pan, animation timing); team color framing distinguishes who's acting. No "thinking..." indicator or pre-action plan preview — straight into animation.
- Speed controls remain available during AI turns and adjust independently of player turn speeds.
- Settings menu reachable from both title screen and in-battle pause menu, opening the same panel; v1 settings include default animation speed, confirm-step preference, and status icon density preference.
- Settings in-memory only for first playable; localStorage persistence is a future feature.
- ESC during a battle opens a pause overlay; pause halts both renderer animation and engine processing; pause options are Resume / Settings / Surrender / Main Menu.
- Surrender ends the battle with the surrendering team marked defeated and transitions to the results screen.
- Save-and-resume of mid-battle state deferred; architecturally trivial to support later given action log + serializable GameState, but UI flow is additional work.
