# Session 25 Plan — Cluster 2 Substrate + UI Fold-ins

Pre-implementation plan for Session 25. Audit findings first, then architectural
decisions, then implementation order. Reviewed before code lands per the
session brief's plaintext-first discipline.

## 1. Audit findings

### 1.1 Catalog substrate

- `Registry<TId, TDef>` (`src/engine/catalog/registry.ts`) — only validates
  duplicate-id at construction. No content-shape validator.
- `Catalog` / `createCatalog` (`src/engine/catalog/catalog.ts`) — per-kind
  registries; constructor instantiates each. No availability check.
- `AbilityCommon` (`src/engine/catalog/definitions/ability-definition.ts:27`)
  is the shared base of `ActiveAbilityDefinition` and
  `PassiveAbilityDefinition`. One field add here covers both.
- `EquipmentBase` (`src/engine/catalog/definitions/item-definition.ts:27`)
  is the shared base of `WeaponEquipment | ArmorEquipment | HeadgearEquipment
  | AccessoryEquipment`. One field add covers all four.
- `CommandSetDefinition` (`src/engine/catalog/definitions/command-set-definition.ts:17`)
  is a single interface. One field add.
- `Tile` (`src/engine/types/tile.ts:13`) has no deployment-related field today.

### 1.2 Ruleset substrate

- `RulesetInitialCT` (`src/engine/types/ruleset.ts:161`): two variants —
  `fixed` and `speed_with_variance` (discriminated union).
- `resolveInitialCT` (`src/engine/setup/create-initial-state.ts:230`):
  exhaustive switch; uses `unitFloatFromKey(masterSeed, placementId)` for
  per-unit-stable randomness in `[0, 1)`.
- Default content ruleset (`src/content/rulesets/default.ts:141`):
  `{ kind: 'fixed', value: 0 }`.
- Test ruleset (`src/engine/catalog/test-fixtures.ts:123`):
  `{ kind: 'fixed', value: 0 }` — used by every engine integration test
  that builds state via `makeGameState`/`makeUnit`.

### 1.3 Tests that drive `createInitialState` against the **content** default ruleset

These need attention when the default flips to `uniform_int`:

| File | Pattern | Risk | Fix |
|---|---|---|---|
| `src/content/rulesets/default.test.ts:75` | `expect(...initialCT.kind).toBe('fixed')` | Will fail | Update assertion |
| `src/app/controllers/ai-controller.integration.test.ts` | `createInitialState(demoBattle, loadDefaultCatalog())` × 5 seeds × 2 assignments; asserts win-rate parity | Calibration may shift | Inline ruleset override → `{ ...defaultRuleset, initialCT: { kind: 'fixed', value: 0 } }` |
| `src/app/demo/orchestrator.test.ts` | Same pattern; asserts termination in 500 steps | Probably robust to CT∈[0,20] | Verify; override if it breaks |
| `src/content/battles/training-field-battle.test.ts` | `createInitialState(...)` for structural checks; never reads `unit.ct` | Unaffected | None |

These are **unaffected** (they build their own test ruleset or build state
without going through `createInitialState`):

- All `src/engine/actions/session-XX-integration.test.ts` — use
  `loadDefaultCatalog()` only as a definition lookup; state via `makeGameState`.
- `src/engine/setup/create-initial-state.test.ts` — uses
  `makeAbilitiesCatalog`/`defaultTestRulesets` → fixed/0.
- `src/engine/setup/initial-ct-variance.test.ts` — drives explicit ruleset
  variants per-test.

### 1.4 Knight class state

- `src/content/classes/knight.ts` has `firstActionCommandSet: 'battle_skill'`
  and `freeAbilities: {attack, move_plus_1, counter, damage_reduction}`.
- **`ClassDefinition` has no `secondaryCommandSets`/`commandSets` allowed-list
  field today.** Any catalog command set can be equipped on Second Action,
  subject only to `validateLoadout`'s structural rules.
- So the brief's "Knight class file cleanup — remove white_magic from secondary
  command sets" maps in code to:
  1. Hide `white_magic` command set with `availability: 'hidden'` (Chris's
     call to hide the whole set).
  2. Drop `white_magic` from the demo Knight's Second Action loadout
     (per question 2's confirmation).
- The class file itself doesn't change. (Optional: add a comment noting
  the v1 intent. Default: leave alone.)

### 1.5 Demo / training-field Knight loadout

- `KNIGHT_LOADOUT` in `src/content/battles/demo.ts:78` has
  `[second_action]: commandSetId('white_magic')`. **Change to omit the
  second_action entry** (set to `null` or remove the key — match the
  convention `validateLoadout` accepts).
- `training-field-battle.ts` inherits via spread, so the same one-line change
  reaches both battles.
- Demo mages (Earth/Water/Fire/Lightning) keep `white_magic` on Second Action
  in their existing loadouts. Engine-side they can still cast Cure — hiding
  is presentation-only (team builder + AI generation), not a gameplay block.

### 1.6 `consumed.waited`

- `TurnConsumption.waited` (`src/engine/types/turn-state.ts:34`):
  - **Written**: `reduceWait` (`src/engine/actions/reducers.ts:190`).
  - **Read**: `reduceTurnEnd` (`reducers.ts:1316-1330`) — comment explicitly
    states the flag no longer branches anything; retained only for "analytics."
  - **Asserted in tests**: `reducers.test.ts:110` (one direct assertion).
  - **Initialized in fixtures**: 7 fixture/test sites that build a
    `TurnConsumption` literal with `waited: false`.
- Safe to remove. The reduce code path that consumed it has already been
  removed.

### 1.7 Action menu — current Attack surface

- `TopLevel` in `src/ui/action-menu.tsx:216-249` renders: Move, Attack
  (conditional on `class.freeAbilities.has(attack)`), Act, End turn, Status.
- Attack's path: `pickFreeAbility` dispatch → `target-select` (skips
  command-set / ability-list).
- Act's path: `pickAct(activeCommandSets)` → if exactly one set,
  `ability-list` directly; else `command-set-select` first.
- Ability list is `AbilityListPicker` reading
  `turnFlow.abilitiesFor(commandSetId)` → walks the command set's `members`
  and decorates each active ability with disable info.

### 1.8 Action log — charged-resolve and segments

- `formatAction` `charged_action_resolve` branch (`action-log-format.ts:210-233`)
  currently emits `"{caster}'s {ability} resolves: {perTargetResults}"`. No
  explicit target slot.
- `LogRow.text: string` (`action-log-format.ts:59`). Rendered as a single
  span (`action-log-panel.tsx:141`).
- Charged actions store `targets: ReadonlyArray<{kind, unitId?, position?}>`
  (per `queue-tower.tsx:366-390`'s `describeChargedTarget` reader). The
  charged-action-resolve action payload itself only carries `chargedActionId`;
  the action's identity (caster + targets) is reconstructed at log-format time
  via the `chargedContext` map (`action-log-format.ts:96`).

### 1.9 QueueTower portrait flip

- Active anchor: `<img>` at lines 241-256 (`queue-tower.tsx`). Inline-styled,
  not parameterized on team.
- MiniPortrait: `<img>` at lines 408-420. Takes `classId, isCharged,
  fallbackColor`; needs `teamId` (or a flip flag) threaded in.
- Renderer convention (canvas sprites) flips enemy team via `scale.x = -1`
  per session 24.5 — using `transform: scaleX(-1)` on the React `<img>`
  matches that idiom directly.

### 1.10 Counts

- Abilities: **41** files in `src/content/abilities/` (one per ability;
  `index.ts` aggregates).
- Items: **5** (`long_sword`, `strength_ring`, `boots_of_haste`, `iron_helm`,
  `iron_mail`).
- Command sets: **7** content sets (`battle_skill`, `arcane_skill`,
  `earth_spells`, `water_spells`, `fire_spells`, `lightning_spells`,
  `white_magic`). One marked hidden (`white_magic`).
- Reaction compiler helper `compileReactionAbility` (`engine/abilities/
  reaction-compiler.ts`): builds `PassiveAbilityDefinition` from a `base`
  arg. Once `availability` is required on `AbilityCommon`, callers must pass
  it into `base`. Three reactions use this helper (Counter, Earth Resilience,
  Smolder, plus discharge, magnetic-mark — to be tagged `'available'` in bulk).

---

## 2. Architectural decisions

### Decision 1 — Availability field location

`availability: 'available' | 'hidden'` as a **required** field on three base
shapes:

- `AbilityCommon` (covers active + passive)
- `EquipmentBase` (covers all four equipment kinds)
- `CommandSetDefinition` (per Chris's call to hide the whole `white_magic`
  set rather than just `cure`)

Not on `StatusEffectType`, `ClassDefinition`, or `RulesetDefinition` —
those don't surface to a team builder in the spec.

### Decision 2 — Catalog-load validator

A new private function `validateRequiredAvailability(input)` inside
`createCatalog`. Runs after the per-kind `Registry` constructors return.
Iterates abilities, items, command sets, throws a new
`MissingAvailabilityError` (in `engine/catalog/errors.ts`) on absent field.

Why inline rather than a separate `validator.ts` module: the only check is
field presence, the codebase has no other validator surface, and TypeScript
already enforces presence at the type level — the runtime check is defense
against `as` casts or dynamic content. Co-locating with `createCatalog`
keeps it discoverable.

Validation runs at catalog construction (single point), not at battle-start.
A constructed catalog is the invariant.

### Decision 3 — `deploymentZone` tile field

`readonly deploymentZone?: TeamId | null` on `Tile`. Optional (omitted ≡
no zone). Authors set per-tile. No content uses it this session.

### Decision 4 — Initial-CT randomization

New variant `{ kind: 'uniform_int'; readonly min: number; readonly max: number }`
on `RulesetInitialCT`. Resolver clause:

```
case 'uniform_int': {
  const v = unitFloatFromKey(masterSeed, placement.id); // [0, 1)
  const span = ruleset.initialCT.max - ruleset.initialCT.min + 1;
  return ruleset.initialCT.min + Math.floor(v * span);
}
```

This is integer in `[min, max]` inclusive, deterministic given
`(masterSeed, unitId)`. Per-placement `initialCT` override still wins.

Default ruleset flips to `{ kind: 'uniform_int', min: 0, max: 20 }`.

### Decision 5 — Test ruleset preservation (option (a))

Per Chris's confirmation:

- `ai-controller.integration.test.ts` constructs an inline overlay catalog
  by importing the content modules and `defaultRuleset` and rebuilding via
  `createCatalog({ ..., rulesets: [{ ...defaultRuleset, initialCT: { kind:
  'fixed', value: 0 } }] })`. This isolates the AI calibration from the
  default-ruleset change.
- `orchestrator.test.ts` — run unmodified first. If it fails (CT∈[0,20]
  perturbs the 500-step bound), apply the same overlay.
- No exported helper in `loadDefaultCatalog` — keep the surface minimal.
  Two call sites at most; inline overlay is cleaner than API expansion.

### Decision 6 — Action-log team coloring (Path A — segments)

Replace `LogRow.text: string` with `LogRow.text: ReadonlyArray<LogSegment>`,
where:

```ts
interface LogSegment {
  readonly text: string;
  readonly team?: TeamId;
}
```

Formatter helpers added next to `formatAction`:

```ts
function unitSeg(state, id): LogSegment        // { text: name, team }
function chargedCasterSeg(state, casterId)     // alias for unitSeg
function plain(text: string): LogSegment       // { text }
```

`action-log-panel.tsx`'s `RowView` iterates segments and applies a per-team
CSS color via inline style. Team color map mirrors the existing
`TEAM_BORDER_COLORS` palette in queue-tower.tsx — `team_a` blue, `team_b`
red, fallback gray.

This is a breaking shape change for `LogRow.text`; no consumers outside
`action-log-panel.tsx` read it (the formatter is the only producer; the
panel is the only renderer).

### Decision 7 — Bulk availability tagging scope

- **Hidden** (`availability: 'hidden'`):
  - Abilities: `float`, `fly`, `discharge_strike`, `cure` (4 files).
  - Items: `iron_helm`, `iron_mail`, `strength_ring` (3 files).
  - Command sets: `white_magic` (1 file).
- **Available** (`'available'`): every other ability (37), item (2), command set (6).
- **Test fixtures** in `engine/abilities/test-fixtures.ts`:
  - `makePassive`, `makeActive`, `makeCommandSet` builders default to
    `availability: 'hidden'` (test-only definitions stay out of any future
    team-builder iteration).
- **Catalog test-fixtures** in `engine/catalog/test-fixtures.ts` and
  `engine/catalog/catalog.test.ts`: inline ability/item/command-set literals
  get `availability: 'hidden'` (test-only).
- **`initial-ct-variance.test.ts`** inline command-set literal: add
  `availability: 'hidden'`.

### Decision 8 — Attack-in-Act repositioning

`TopLevel` (action-menu.tsx) loses its Attack button. Top-level becomes
Move / Act / End turn / Status (4 items).

In `AbilityListPicker`: when the unit's class has `attack` in `freeAbilities`,
**prepend the Attack ability** to the displayed list of the chosen command
set's abilities. The splice happens in the React component — engine-side
loadout / command-set membership is untouched (Attack remains a class
free-ability, not a command-set member).

Multi-command-set future case (per question 3): Attack appears at the head
of every command set's ability list when the unit has it as a free ability.
That matches Chris's description "a Fire Mage with Lightning Magic backup
would see Attack, Fire Magic, Lightning Magic" — though re-reading, that
suggests the **picker** shows "Attack, Fire Magic, Lightning Magic" as
top-level options. The simplest reading: a flat list with Attack first,
then class-pinned command sets. For now: with single-set units, the flow
is Act → ability-list (Attack at top of the only set). The multi-set
implementation is deferred — current code path stays.

### Decision 9 — `consumed.waited` cleanup

Remove `waited` from `TurnConsumption`. Touch sites:
- `engine/types/turn-state.ts:34` — drop field.
- `engine/actions/reducers.ts:190` — drop the `waited: true` assignment in
  `reduceWait` (the `budget` zeroing remains).
- `engine/actions/reducers.ts:1316-1330` — clean up the comment that
  references the flag.
- 7 fixture/test sites — drop the `waited: false` initializer.
- `engine/actions/reducers.test.ts:104-110` — delete the assertion (the
  test's intent of "zeroes the budget" still stands).

### Decision 10 — Test strategy

New / extended tests:

1. **Catalog validator**: in `catalog.test.ts`, add cases that:
   - Construct a catalog with an ability missing `availability` (as `any`)
     and expect `MissingAvailabilityError`.
   - Same for an item and a command set.
   - Confirm a valid catalog with `availability` everywhere constructs fine.
2. **uniform_int initial-CT**: extend `initial-ct-variance.test.ts` with:
   - Range bound: every produced CT is in `[min, max]`.
   - Determinism: same seed + same unit id → same CT.
   - Per-unit-stable: two units with identical Speed land at different CT
     given different ids.
3. **LogRow segments**: in a new (or extended) `action-log-format.test.ts`,
   verify:
   - A `use_ability` row's actor segment carries the actor's team.
   - A `charged_action_resolve` row's caster + target segments carry their
     teams (actor team A, target team B).
   - Plain text segments have no `team` field.

---

## 3. Implementation order

1. **Availability substrate** — add field to 3 base shapes; new
   `MissingAvailabilityError`; validator call inside `createCatalog`;
   catalog tests. (Type-check will fail until step 4 lands; that's the
   guard.)
2. **`deploymentZone`** — one optional field on `Tile`.
3. **uniform_int initial-CT** — variant + resolver clause + default switch.
   Update `default.test.ts:75` assertion. Update
   `ai-controller.integration.test.ts` with the inline ruleset overlay.
   Extend `initial-ct-variance.test.ts`. Run `orchestrator.test.ts`; apply
   overlay if regressed.
4. **Bulk availability tagging** — 41 abilities + 5 items + 7 command sets
   + test fixtures + catalog test-fixtures. (Frees the type-check.)
5. **Demo Knight loadout cleanup** — drop `white_magic` from
   `KNIGHT_LOADOUT.actionBuckets.second_action` in `demo.ts`. Verify the
   training-field-battle test still passes.
6. **Attack-in-Act repositioning** — remove top-level Attack button; splice
   Attack into ability-list when class-granted-free.
7. **Action-log charged-target** — extend `formatAction`'s
   `charged_action_resolve` branch with target rendering.
8. **Action-log team coloring** — `LogRow.text` → segment array; formatter
   helpers; renderer in `action-log-panel.tsx`. New format test.
9. **QueueTower portrait flip** — thread `teamId` to `MiniPortrait`; apply
   `transform: scaleX(-1)` for `team_b`. Same on `ActiveUnitAnchor` img.
10. **`consumed.waited` cleanup** — type + writes + reads + asserts +
    fixtures.
11. **Final test run** — full suite. Live preview spot-check for the UI
    fold-ins (Attack-in-Act, log coloring, log target, portrait flip).
12. **ADRs + handoff**.

---

## 4. ADRs

Three at minimum (numbering continues from 0048):

- **ADR-0049 — Availability tag + catalog-load validator.** Field placement
  on the three base shapes; `createCatalog`-time validation; rationale for
  not adding to StatusEffectType/ClassDefinition; test-only default of
  `'hidden'`.
- **ADR-0050 — `uniform_int` initial-CT variant + test-ruleset preservation.**
  Default ruleset change rationale; inline-overlay pattern (option a) for
  affected tests; why not a `loadDefaultCatalog(opts)` API expansion.
- **ADR-0051 — `LogRow` segment-based shape (Path A).** Why segments over
  post-hoc string-pattern team-coloring; the `LogSegment` shape;
  caller-side migration (formatter is the sole producer, panel the sole
  consumer).

Optional fourth ADR if Attack-in-Act repositioning warrants documenting the
multi-command-set future call. Default: skip — the v1 single-set flow
doesn't expose the design question yet.

---

## 5. Out-of-scope reminders

Per the brief's "Out of scope" list, these are tracked for a future polish
pass and **not** addressed this session:

- Tile-info corner overlay (item 2 from Session 24.5 playtest review)
- Portrait restructure: black-bg + ring-outside-portrait (item 3 larger part)
- Charged-action timing projector accuracy
- QueueTower slot-in for charged-action resolves
- Charged-action animation pacing
- WAIT-CONFIRM keyboard support
- Mini-timeline for forecast Timing subsection

Plus the long-standing carry-forwards in `docs/handoff.md`.

---

## 6. Open questions

None at this point — Chris's answers (Q1: hide command set, Q2: empty Second
Action, Q3: flat list, Q4: option a, Q5: any unit-name segment) cover the
gaps the brief left.

Mid-session questions are routed to Chris if any of these surface:

- Catalog-validator API shape (unlikely; the pattern's straightforward).
- The AI-vs-greedy calibration shifts in a way the overlay can't recover.
- A `LogRow.text` segment-shape consumer outside `action-log-panel.tsx`
  exists that the audit missed.
