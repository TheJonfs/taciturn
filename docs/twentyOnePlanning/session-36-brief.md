# Session 36 Brief: Phase E — Team Builder UI

## Context

Phase E continues. Session 35 landed the deployment phase as a separate App-shell screen (`DeploymentScreen`), with `buildDeployedBattleConfig` integrating deployment output into the existing battle config + `createInitialState` pipeline. River Ridge expanded to 4v4 (Blue Knight + 3 Mages; Red Knight + 3 Mages); `demoBattle` stays 3v3 as the engine smoke-test fixture.

Session 36 ships the **team builder UI** — the screen between battle setup and deployment, where players assemble their team's class, equipment, and ability loadout before placement. Per Chris's calls:

- **Flow shape (a):** Title → Battle Setup → Team Builder → Deployment → Battle (team builder always present with "load default" affordance)
- **Team size locked at 4** for River Ridge (Mage War's default; future maps with new classes may expand)
- **Two default team templates:** the adjusted-for-validity current test team + a pure-Mage team (one of each element)
- **Per-slot equipment dropdowns** with class-restriction filtering AND **unique-per-team enforcement** (each team gets exactly one instance of any equipment item, to force tough choices)
- **Ability selection** — class passives free by default; cross-class abilities available at cost (using existing substrate per Chris's read; audit confirms)
- **Single-use teams** (no persistence)
- **Test team loadouts adjusted** to be legal under unique-per-team constraint

The team builder's output replaces `DeploymentScreen`'s current hardcoded `riverRidgeBattle.team_a` units, feeding the deployment phase's input contract.

End of session: clicking "Start River Ridge" from battle setup opens the team builder; player either builds from scratch or loads a default; clicks "Continue to Deployment" with a valid team; deployment phase consumes the built team and proceeds to battle. The full flow Title → Battle Setup → Team Builder → Deployment → Battle is end-to-end functional.

## Inputs (read first)

In recommended order:

1. **`CLAUDE.md`** — project conventions.
2. **`docs/handoff.md`** — Session 35 handoff. Particularly the `DeploymentScreen` input contract, the `__taciturnDeployDebug` precedent for browser verification of UI surfaces with synthetic event limitations, and the `BattleRenderer.destroyed` scoped guard pattern.
3. **`docs/twentyOnePlanning/roadmap-sessions-21-plus.md`** — Session 36 entry; Sessions 37+ for context.
4. **`docs/decisions/0049-...`** — `Tile.deploymentZone` substrate (team builder validates against map zone capacity at output time).
5. **Ability slot / capacity substrate ADRs** — survey for the existing cost-system pieces. Likely candidates: the ability-bucket / slot-capacity ADRs that drive Steel Helm and Augmentor. **This is critical audit input.**
6. **`src/content/battles/river-ridge-battle.ts`** — current Blue and Red loadouts; the audit identifies all unique-per-team violations.
7. **`src/content/items/`** — equipment catalog; class restrictions; slot assignments.
8. **`src/content/classes/`** — class definitions, default abilities (active + passive).
9. **`src/content/abilities/`** — ability definitions, costs (if present), slot assignments.
10. **`src/app/DeploymentScreen.tsx`** — current input contract (`BattleConfig` template); the team builder's output flows in here.
11. **`src/app/App.tsx`** — screen-state selector; team builder adds a new screen.

### Paths to survey before planning

Current-tree audit. Particularly:

- **Ability cost / slot / budget substrate.** Per Chris's read: most of the necessary pieces are likely already in place from prior sessions. Audit identifies:
  - How abilities are assigned to a unit (slot-based? array-of-abilities? bucket-keyed?)
  - Whether each ability has a cost field (numeric? typed?) and whether the engine consumes it
  - Whether units have an ability budget / slot capacity that gates how many abilities they can carry
  - How items like Steel Helm / Augmentor modify this capacity (the existing budget consumers)
  - Whether class passives are baked into the class baseline or applied via the ability selection layer
  
  **The audit's findings shape the brief.** If substrate is largely complete, the team builder wraps it in UI. If pieces are missing (e.g., no per-ability cost data; no enforcement at battle-start), the brief covers what's needed to close the gap.

- **Current loadout violations.** Enumerate every item appearing more than once on either Blue or Red team in `river-ridge-battle.ts`. The audit produces a violations list; plan-review settles the new legal loadouts.

- **`DeploymentScreen` input contract.** Current shape: `template: BattleConfig` + `currentTeam: TeamId`. The team builder produces something that flows in here. Audit identifies whether the output is a complete `BattleConfig` (team builder replaces Blue, retains Red authored), or a `Team` record that's merged into the template, or another shape.

- **`createInitialState` consumption.** Per S35: the deployment integration was minimal-surface (deployment is strictly upstream). Confirm the team builder maintains this — its output flows into the same downstream pipeline unchanged.

- **Existing class baselines.** Confirm what abilities each class has by default. The team builder shows these as "class default — free" in the ability picker; cross-class additions surface from other classes' default sets at cost.

- **Existing item class-restrictions and slot assignments.** The equipment dropdowns filter by class + slot. The audit confirms the data shape so the UI filtering is correct.

### Architectural decisions

After the audit:

1. **Team builder as separate App-shell screen.** Following S35's pattern, the team builder mounts as `'teamBuilder'` screen state in `App.tsx`. Props in: `mapTemplate: BattleConfig` (River Ridge for now, future map-selection-aware). Props out: `team: Team` (or shape determined by audit per decision 8). Static React mostly; no Pixi renderer mounted here (the team builder is a pure UI screen — class portraits, dropdowns, panels).
   - **Recommendation: separate screen.** Audit confirms; matches S35's approach. **Settle at plan-review.**

2. **Team builder state machine shape.** Two reasonable shapes:
   - **A — Flat editable state with per-change validation.** Team config is a typed record (`unit[0..3]`: class, equipment per slot, abilities); any change re-validates the whole team. Simpler; familiar React form pattern.
   - **B — State machine with explicit edit states.** `idle → editing_unit[n] → (class | equipment | ability) → committed`. Each sub-state has its own UI surface. Matches `deployment-flow.ts` / `turn-flow.ts` pattern.
   
   **Recommendation: A.** The team builder isn't a sequential interaction (like deployment is, with discrete pick-tile → pick-unit → pick-facing steps). It's an editable form with persistent validity feedback. Flat state matches the UX better. The state can still be typed cleanly and have computed validity. **Settle at plan-review.**

3. **UI layout shape.** Proposed at plan-review; reasonable starting shape:
   - **Header area:** "Build Your Team" title; "Load Default" dropdown affordance; "Back to Setup" button
   - **Team roster column (left):** 4 unit cards, each showing class portrait + name + class label + brief stats; clicking a card selects it for editing
   - **Edit panel (right):** for the currently-selected unit — class picker (5 cards), equipment per-slot dropdowns (5 slots), ability picker (class defaults shown as free + cross-class options at cost)
   - **Footer / validation panel:** "Continue to Deployment" button (greyed until team is valid); validation messages (which constraint is violated)
   - **Plan-review settles** specifics like sidebar vs. tabbed layout, dropdown vs. modal pickers, validation message placement.

4. **Class selection UI.** Five classes (Knight + 4 Mages). Card-pick rather than dropdown — the class is the unit's identity; visual prominence helps. Each card shows portrait + class name + role tagline. Click a card to commit the class to the currently-selected unit.
   - **Recommendation: card-pick.** **Settle at plan-review.**

5. **Equipment per-slot UI.** Dropdown per slot (5 slots: right-hand, left-hand, head, body, accessory). Each dropdown:
   - Shows items eligible for the unit's class
   - Filters out items already used elsewhere on the team (unique-per-team enforcement)
   - Includes a "none / empty" option for unequipped slots
   - Sorts items by relevance (perhaps by slot defaults or by power level — settle at plan-review)
   - When opened, shows item stats / effects inline (or via DetailHover affordance, mirroring S31 unit-detail pattern)

6. **Ability picker UI.** Audit-dependent on the substrate shape; reasonable starting design:
   - **Class defaults** displayed prominently as "[Class] — Default Abilities" with "Free" indicators. These are always equipped.
   - **Cross-class abilities** shown grouped by source class. Each shows its cost (whatever the substrate's cost field is — number, slot count, etc.).
   - **Budget indicator** shows remaining capacity (whatever shape the substrate gives — total slots, points, etc.).
   - Selected cross-class abilities show as checked; selecting consumes budget; deselecting frees it.
   - Equipment that modifies budget (Steel Helm, Augmentor, etc.) updates the indicator live as equipment changes.

7. **Unique-per-team enforcement.** The team builder enforces this client-side via filtered dropdowns (item used elsewhere doesn't appear in the dropdown). Plus a substrate-level validation gate at "Continue to Deployment" time as a safety net (in case state gets weird via load-default or future cross-team copying).
   - **Recommendation: both.** UI prevents the violation; validation gate catches edge cases. The validation gate also produces clean error messages when needed (e.g., a default template fails to load because it's stale relative to current items).

8. **Output contract shape.** Audit-determined. Reasonable shapes:
   - **A — Team builder produces `Team` record.** Just the team's units (class + equipment + abilities per unit). `DeploymentScreen` accepts `mapTemplate: BattleConfig` + `playerTeam: Team` and merges at deployment time. Clean separation.
   - **B — Team builder produces full `BattleConfig` with placeholder placements.** `DeploymentScreen` takes the config and overrides positions during deployment. More coupling but fewer transforms.
   - **C — Team builder produces a new typed `BuiltTeam` record** that flows through deployment to a final `BattleConfig` constructed at "Start Battle" time. Cleanest typed boundary.
   
   **Recommendation: settle in plan-review after audit confirms what `DeploymentScreen` expects today.** Default expectation: **A** (cleanest separation; smallest interface change to `DeploymentScreen`).

9. **Default team templates location.** New content folder: `src/content/teams/`. Each template is a TypeScript file exporting a team record. Two templates for v1:
   - **`current-test-team.ts`** — the adjusted-for-validity current Blue test team (audit identifies what changes were needed)
   - **`pure-mage-team.ts`** — four Mages (Earth + Water + Fire + Lightning), one each; loadouts diversified for unique-per-team compliance
   
   The "Load Default" dropdown lists both; selecting one populates the team builder state from the template.

10. **Test team violations and adjustment.** Per Chris's call: adjust the test teams to be legal under unique-per-team. The audit produces the violations list; plan-review settles the new legal loadouts. The Red team is similarly adjusted if it has violations.
    - The current playtest read on River Ridge's 4v4 was on the prior (invalid) loadouts; the new valid loadouts may shift balance. This is acknowledged-but-acceptable scope; balance reads on the new team happen post-S36.

11. **Ability cost system implementation.** Per Chris's read: substrate is largely present. Audit confirms what's there and what's needed. **The audit's findings determine the implementation:**
    - **If substrate is complete:** team builder UI surfaces the existing mechanics. Class defaults free; cross-class abilities consume the existing budget; equipment that modifies budget composes correctly.
    - **If substrate has gaps:** the brief covers what's needed to close them (likely a small amendment, not a full design). Plan-review surfaces the gap and Chris settles whether to close it in S36 or defer.

12. **Validation logic.** Team is valid when:
    - All 4 units have a class assigned
    - No equipment item appears more than once on the team
    - Each unit's ability budget is non-negative (selected abilities fit within budget)
    - No equipment violates class restrictions
    
    Validity is a computed predicate over the team state; "Continue to Deployment" is gated on it. Validity feedback surfaces inline as messages or per-unit indicators (settle at plan-review).

13. **"Load Default" mechanism.** The dropdown lists templates; selecting one replaces the current team state with the template's content. Confirmation: probably yes (a "this will overwrite your current team" modal), unless the team is empty/untouched. Settle at plan-review.

14. **Roster stats display scope.** S35 carry: the deployment roster shows base PA/MA/Speed + effective HP/MP, not per-frame `runModifyStatQuery` values. The team builder faces the same question: what stats to show on unit cards, in the edit panel, in the team summary?
    - **Recommendation: per-frame `runModifyStatQuery` values shown in the team builder.** The team builder is where players are making equipment choices that affect stats; showing the live computed values gives them direct feedback. The deployment roster's base-stats display stays as-is (roster panel is a glance, not an editing surface) — but the inconsistency between the two surfaces is worth Chris's explicit settle.

15. **Test strategy.**
    - **Team builder state:** unit tests for state mutations (class change, equipment change, ability toggle); validity predicate tests
    - **Equipment filtering:** unit tests for class-restriction filter + unique-per-team filter
    - **Default template loading:** integration test that load-default produces a valid team
    - **Output contract:** integration test that team builder output flows into deployment + battle start cleanly
    - **Test team validity:** structural test that both Blue and Red rosters in `river-ridge-battle.ts` (post-adjustment) are unique-per-team compliant
    - **UI surfaces:** smoke tests; the team builder is mostly React form state, so testing the state mutations + validity is more valuable than testing rendering
    - Following S35's precedent: end-to-end manual verification via a dev-debug surface if the canvas-event system is involved (likely not — team builder is DOM-only); test through React Testing Library or vitest-supplied DOM otherwise.

16. **Order of work.**
    - Audit (substrate, violations, output contract)
    - Test team loadout adjustments (content edit; lands early so subsequent work consumes valid baselines)
    - Default team templates authored
    - Team builder state machine + validity predicate
    - Class + equipment selection UI
    - Ability selection UI (substrate-dependent)
    - "Load Default" affordance
    - Output contract + integration with `DeploymentScreen`
    - End-to-end loop verification

17. **36a/36b split allowance.** Larger surface than typical UI sessions. If audit reveals substrate gaps that require substantive new code, or if the UI work balloons:
    - **36a:** Team builder UI scaffold + class/equipment selection + default templates + test team adjustments + output contract to deployment
    - **36b:** Ability selection + cost system integration + validation polish
    
    Likely no split if Chris's substrate read holds. Audit determines.

The plaintext plan is reviewed before code lands.

## Implementation work

Following plan approval, items land in audit-then-build order: substrate gaps and output contract settled before UI work commits.

### Item 1: Audit findings + design recap

- Plan-review document captures the audit's findings: existing cost substrate shape, current loadout violations, `DeploymentScreen` input contract, default template shapes
- Architectural decisions per the plan-review settle the implementation shape

### Item 2: Test team adjustments

- Per the audit's violations list and Chris's plan-review settle: edit `river-ridge-battle.ts` Blue and Red rosters to be unique-per-team compliant
- This lands early so subsequent work consumes valid baselines
- Tests: structural compliance test ensures no future regression

### Item 3: Default team templates

- New folder `src/content/teams/`
- `current-test-team.ts` — the adjusted Blue test team as a template
- `pure-mage-team.ts` — four Mages (one of each element) with diversified loadouts
- Both templates compliant with unique-per-team
- Tests: template structure validates; loaded into team builder state correctly

### Item 4: Team builder state + validity

- New `src/ui/team-builder-state.ts` (or similar) — flat editable state per decision 2A
- Validity predicate per decision 12
- Tests per decision 15 (state mutations + validity)

### Item 5: TeamBuilderScreen + UI

- New `src/app/TeamBuilderScreen.tsx`
- Screen layout per decision 3 (refined at plan-review)
- Class selection UI per decision 4 (card-pick)
- Equipment per-slot dropdowns per decision 5 (class + unique-per-team filtering)
- "Load Default" dropdown per decision 13
- "Continue to Deployment" gated by validity
- "Back to Setup" routing

### Item 6: Ability selection UI

- Per decision 6 (class defaults free; cross-class at cost; live budget indicator)
- Substrate consumption — audit-confirmed pieces wired in; gaps closed if any
- Tests: ability budget tracks correctly; equipment-modified budget composes; selection respects available budget

### Item 7: Output contract + DeploymentScreen integration

- Audit-confirmed shape (default A: team builder produces `Team`; `DeploymentScreen` merges with map template)
- `App.tsx` threads team builder output through to deployment
- Tests: integration test of full Battle Setup → Team Builder → Deployment → Battle flow

### Item 8: Validation logic + UX

- Validity predicate per decision 12
- Inline feedback per the plan-review settle (per-unit indicators? footer panel?)
- "Continue to Deployment" gating

### Item 9: End-to-end verification

- Manual playtest: full flow from title screen through team builder (build from scratch and load default) into deployment and battle
- Verify that built teams produce identical battle behavior to authored teams when configured equivalently
- Verify dev-debug surfaces for any canvas-related verification (likely not needed here; team builder is DOM)

## Acceptance criteria

**Flow:**
- Title → Battle Setup → Team Builder → Deployment → Battle is end-to-end functional
- "Back to Setup" from team builder returns to battle setup
- "Continue to Deployment" from team builder transitions to deployment with the built team

**Team builder UI:**
- 4 unit slots displayed; click to select for editing
- Class card-pick for selected unit (Knight + 4 Mages)
- Equipment per-slot dropdowns with class-restriction + unique-per-team filtering
- Ability picker showing class defaults (free) + cross-class options (with cost)
- "Load Default" dropdown lists current-test-team + pure-mage-team templates

**Test team compliance:**
- Both Blue and Red teams in `river-ridge-battle.ts` are unique-per-team compliant
- A structural test asserts this and would fail on regression
- The adjusted teams play (no broken loadouts; equipment slots filled correctly)

**Default templates:**
- "Load Default" → "Current Test Team" populates the team builder with the adjusted Blue team
- "Load Default" → "Pure Mage Team" populates with four Mages, one of each element, diversified loadouts
- Both load without violations

**Cost system:**
- Class default abilities (passives + class-specific actives) show as Free
- Cross-class abilities show their cost
- Selecting an ability consumes budget; budget indicator updates live
- Equipment that modifies budget (Steel Helm, Augmentor, etc.) updates the budget indicator when equipment is changed
- "Continue to Deployment" is gated by valid budget

**Validation:**
- Team is valid when all 4 units have a class, no equipment is duplicated, all ability budgets non-negative, no class-restriction violations
- Inline feedback identifies violations (per plan-review settle on shape)
- "Continue to Deployment" greyed when invalid

**Quality:**
- Tests at 1048+, 0 failing
- ADR if substrate gaps required new design (likely none if Chris's read holds)
- `docs/handoff.md` updated

## Out of scope

- **Pass-and-play toggle + dual deployment + battle-loop AI gating** — dedicated future session
- **Team persistence (save/load library)** — Phase F campaign features
- **Other maps / map selection** — future session
- **Other team sizes** — locked at 4 for River Ridge / Mage War v1
- **AI deployment logic** — Red uses authored placements
- **New class content (Squire, etc.)** — future content sessions
- **Team builder tutorial / onboarding** — future polish
- **Visual animation polish in the team builder** — future polish
- **Cross-team item sharing rules beyond unique-per-team** — current rule is unique-within-team; Blue and Red can both have a Wizard's Robe
- **Settings expansion (where pass-and-play would live)** — Phase E later
- **Surrender flow** — ADR-0041; Phase E/F
- **Charged-action tooltip browser verification** — S33.5 carry
- **Pacing + cliff-thickness playtest read** — S33.5 carry, still unplaytested
- **River Ridge balance tuning** — playtest-informed; post-S36's loadout adjustments
- **AI active absorption exploitation** — S27 carry
- **AI projection forecast extension** — S30 carry
- **Burn × Purifier playtest observation** — S33.5 setup ready
- **Procced Lightning Strike / Rasp Pendant action-log attribution** — S30 carries
- **TS strict-mode test errors** — S34 carry; pre-existing on main
- **`map-and-battlefield.md` open questions** — Phase E doesn't surface these
- **Opponent sprite flip during deployment** — S35 carry; cosmetic
- **Deployment roster panel stats scope** — S35 carry; team builder addresses its own surface (decision 14)

## Files likely touched

Non-exhaustive. Audit confirms / corrects.

**New screen + state:**
- `src/app/TeamBuilderScreen.tsx`
- `src/ui/team-builder-state.ts` (state + validity)
- `src/ui/use-team-builder.ts` (React hook consuming the state)

**New UI components:**
- `src/ui/team-builder-roster.tsx` (4 unit slots; click to select)
- `src/ui/team-builder-class-picker.tsx` (card-pick UI)
- `src/ui/team-builder-equipment-slots.tsx` (per-slot dropdowns)
- `src/ui/team-builder-ability-picker.tsx` (defaults + cross-class)
- `src/ui/team-builder-default-loader.tsx` (load-default dropdown)

**New content:**
- `src/content/teams/current-test-team.ts`
- `src/content/teams/pure-mage-team.ts`

**Adjusted content:**
- `src/content/battles/river-ridge-battle.ts` (Blue + Red loadouts adjusted for unique-per-team)

**Routing:**
- `src/app/App.tsx` (add `'teamBuilder'` screen state; thread output to deployment)
- `src/app/BattleSetupScreen.tsx` (route to team builder instead of directly to deployment)

**DeploymentScreen integration:**
- `src/app/DeploymentScreen.tsx` (accepts team builder output per decision 8)

**Engine substrate (if audit reveals gaps):**
- `src/engine/abilities/...` — ability budget gates if needed
- `src/engine/equipment/...` — unique-per-team validation if not present

**Tests:**
- `src/ui/team-builder-state.test.ts` (state mutations, validity)
- `src/ui/team-builder-equipment-slots.test.tsx` (filtering)
- `src/ui/team-builder-ability-picker.test.tsx` (cost system)
- `src/content/teams/current-test-team.test.ts` (template compliance)
- `src/content/teams/pure-mage-team.test.ts` (template compliance)
- `src/content/battles/river-ridge-battle.test.ts` (unique-per-team compliance — new structural test)
- `src/app/team-builder-integration.test.tsx` (end-to-end through deployment)

**ADRs:**
- Possibly one if substrate gaps require new design. Plan-review determines.

**Documentation:**
- `docs/handoff.md` — session handoff
- Possibly `docs/twentyOneDesign/team-builder.md` — design doc for the team builder mechanics (unique-per-team rule, cost system framing) if it warrants durable home

## Workflow notes

- **Plaintext-first review required.**
- **Audit-heavy session.** The cost substrate audit determines substantial design downstream; the unique-per-team violation audit determines content edits; the `DeploymentScreen` output contract audit determines screen integration. All gate the implementation shape.
- **Adjust test team loadouts early.** Item 2 lands before items that consume team baselines (default templates, integration tests). Avoids re-baselining mid-session.
- **ADR path is `docs/decisions/`.**
- **HMR / Fast Refresh conventions from S34 apply.** No class exports in Fast-Refreshable component modules; `useRef` not `useMemo` for load-once singletons; cleanup functions capture references before destroy. Team builder is DOM-only (no Pixi), so the Pixi-related parts of the convention don't apply, but the class-export rule still does.
- **Mid-session design questions** route through Chris to the planner. Most likely surfaces: substrate-gap closing if audit reveals missing pieces; UI layout specifics; validation feedback shape; default template confirm-overwrite UX.
- **`DeploymentScreen.tsx` precedent.** S35's separate-screen pattern with typed props in/out is the model. Team builder matches; no renderer needed.
- **Phase E continues.** The full pre-battle flow (Title → Battle Setup → Team Builder → Deployment → Battle) is functional by session end.

## Watch-fors

**Addressed this session:**
- Team builder UI (Phase E continuation)
- Unique-per-team equipment enforcement
- Test team loadouts adjusted for compliance
- Default team templates authored
- Cost system surfaced via team builder UI (substrate consumption)
- Output contract from team builder to deployment

**Not addressed this session, longer-term carry-forward:**

- **Pass-and-play toggle + dual deployment + battle-loop AI gating** — dedicated future session
- **Team persistence** — Phase F campaign features
- **Other maps / map selection** — future session
- **AI deployment logic** — future tactics-layer pass
- **New class content (Squire, additional Mages)** — future content sessions
- **Title screen layout eyeball at real window sizes** — S34 carry
- **Full battle → results → continuity-button loop manual playtest** — S34 carry
- **Opponent sprite flip during deployment** — S35 carry; cosmetic
- **Deployment roster panel stats scope** — S35 carry; team builder addresses its own surface
- **Pacing + cliff-thickness playtest read** — S33.5 carry, still unplaytested
- **Charged-action tooltip browser verification** — S33.5 carry
- **Burn × Purifier playtest observation** — S33.5 setup ready
- **Walk-on-Water passive** — future content
- **River Ridge balance tuning** — playtest-informed; post-S36's loadout adjustments will need a fresh read
- **Procced Lightning Strike action-log attribution / Rasp Pendant drain attribution** — S30 carries
- **AI active absorption exploitation** — S27 carry
- **AI projection forecast extension via `computeOutgoingHitChance`** — S30 carry
- **Procced spell uses caster's MA / Magus Crown calibration / Tintinibar Regen / Sorcerer's Robe Move +1** — ongoing playtest reads
- **Suppress pre-battle init entries in release builds** — longer-term polish
- **`map-and-battlefield.md` open questions** — elevation hit-chance/cover, AoE multi-layer, LoS tie-breaking
- **`mapAllTerrainCosts` vs `defaultStepCost`** — no v1 case
- **Centralized `canApplyHeal` helper** — explicitly rejected (ADR-0074); revisit at third heal-site
- **`isWaterTile` predicate keys on elevation, not registry** — S33 carry
- **`buildBattle` test-fixture extraction** — triggers at fourth duplication
- **Wand swing ally-targetability** — S31 carry
- **Status-badge polarity convention extension** — chip pre-icons if status lists grow
- **Team color palette → engine `Team` shape** — long-term
- **Tooltip Option B authored-description pass** — post-current-roadmap
- **`onTurnStart` symmetric widening** — S26 carry
- **Multiplicative tick-amount stacking** — S28 carry
- **`onFinalDamage` fires on absorbed hits but handlers gate** — design pattern
- **Forecast facing uses actual attacker→target geometry** — S30 carry
- **Unit detail panel's per-facing evasion uses `unit` as attacker stand-in** — S30 carry
- **Constant-map labels don't carry icons today** — S28 polish
- **`pa_factor` NotYetImplementedError** — audit E3
- **TS strict-mode test errors** — S34 carry (~201 pre-existing on main)
- **Surrender flow** — ADR-0041; Phase E/F
- **MVP-unit smarter algorithm** — S24 Wave 1
- **Permadeath timer** — S24 Wave 1
- **Settings expansion** — Phase E later (natural home for pass-and-play toggle)
- **Reactions in projection column** — S24 Wave 1
- **Forecast accuracy row visibility** — S30 reject
- **Hit-chance and cover modifiers from elevation differential** — `map-and-battlefield.md` open question
- **`fillVitalsFromComputedMaxes` ordering invariant** — S32 carry; holds for v1
- **Bedrock Stride ongoing playtest read** — integration-tested S33; real playtest still pending
- **HMR / Fast Refresh class-export rule** — S34 convention; code comments in place

## Estimated size

**Medium-large.** Larger than typical UI sessions:
- Three nested UI surfaces (class picker, equipment per-slot, ability picker) — each small individually, aggregate is real
- Two new content templates (current-test-team + pure-mage-team)
- Test team loadout adjustments (content edits + new structural test)
- Audit-and-integration with existing cost substrate
- Output contract design and screen integration with deployment
- Validation logic

Honest size: comparable to S35 (the deployment phase session), possibly slightly larger due to the audit + content adjustments.

**36a/36b split allowance** reserved if audit reveals substantial substrate gaps OR if UI work balloons:
- **36a:** Team builder UI scaffold + class/equipment selection + default templates + test team adjustments + output contract to deployment
- **36b:** Ability selection + cost system integration + validation polish

Likely no split if Chris's substrate read holds (most cost-system pieces already present).

**End of session: full pre-battle flow Title → Battle Setup → Team Builder → Deployment → Battle functional.** Sessions 37+ extend Phase E (pass-and-play toggle, settings expansion, additional polish).
