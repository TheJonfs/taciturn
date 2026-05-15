# Session 37 Brief: Phase E Polish — Team-Build State Preservation + Equipment Authoring + Tidal Wave Display Fix + Playtest Watch Doc

## Context

Phase E surfaces are functional (Title → Battle Setup → Team Builder → Deployment → Battle, all browser-verified through deployment per S36). Session 37 is a mixed-mode session: one UI feature (team-build state preservation on back-navigation), one bug fix (Tidal Wave's 5000% knockback chance in the charged-action detail tooltip), one content authoring pass (seven new equipment items per Chris's design), and one durable documentation add (`docs/playtest-watch.md` as the persistent home for systemic playtest watch items).

The new equipment closes the S36-flagged gap on mage equipment pool size (head/armor slots were exactly catalog-sized for a pure-mage team, forcing rather than choosing) and adds cross-cutting build options for Knight (Spiked Mail's physical reflect, Crusader's Helm's Faith-bump for hybrid-caster Knights) and universal slots (Travel Garb's Move +1, Lookout's Hood's Speed +1).

End of session: team builder state persists across back-navigation; Tidal Wave's tooltip reports correctly-bounded knockback chance; seven new equipment items are authored, tested, and visible in the team builder's dropdowns; `docs/playtest-watch.md` accumulates the standing playtest observations going forward.

## Inputs (read first)

In recommended order:

1. **`CLAUDE.md`** — project conventions.
2. **`docs/handoff.md`** — Session 36 handoff. Particularly the mage equipment pool limitation (this session's content closes it) and the dropped-from-carry items (opponent sprite flip handled, charged-action tooltip working except for the Tidal Wave bug, pacing/cliff-thickness as ongoing observation).
3. **`docs/twentyOnePlanning/roadmap-sessions-21-plus.md`** — Session 37 entry; Sessions 38+ for context.
4. **`src/content/items/`** — existing item catalog; the new items follow established authoring patterns.
5. **`src/app/App.tsx`** — current screen-state machinery; team draft state lifts here per decision 1.
6. **`src/app/TeamBuilderScreen.tsx`** — current state ownership; draft becomes a prop/initial-state input.
7. **`src/ui/charged-action-detail-panel.tsx`** (or wherever the tooltip lives — audit confirms) — Tidal Wave bug surface.
8. **`src/engine/`** — survey for existing reflect/proc substrate. Spiked Mail's physical reflect either composes with existing hooks (likely) or needs a small substrate addition (less likely, given Mage War's existing damage-proc machinery from procced weapons and Rasp Pendant).

### Paths to survey before planning

Current-tree audit. Particularly:

- **Charged-action detail tooltip path.** Trace how the tooltip computes the knockback chance display. The 5000% figure suggests either (a) a percentage applied to an already-percentaged value (e.g., 50.0 × 100 = 5000), or (b) a missing clamp on a weighted-chance accumulator, or (c) the wrong source field surfacing. Audit identifies the actual cause.

- **Knockback chance computation in the engine.** Confirm where the engine's actual application reads the knockback chance from. The audit checks whether the engine and the tooltip share a source, or whether the tooltip is reading a pre-clamp field while the engine reads a post-clamp field.

- **Spiked Mail substrate.** Confirm whether the existing damage-proc / reflect machinery (`onFinalDamage` hook? `modifyOutgoingDamage`? a reflect-specific hook?) can compose a "20% physical damage reflected to attacker" effect. The likely candidates: `onFinalDamage` fires after damage application and could trigger a reflective `system_damage` against the attacker. Audit confirms shape.

- **Stat-mod patterns for the simpler items.** Travel Garb (Move +1), Lookout's Hood (Speed +1), Crusader's Helm (Faith +10), Light/Dark Robe (elemental resistances), Tricorn (Brave +10) all compose with existing `statMods` / `modifyMove` / `modifyResistance` patterns. The audit confirms the authoring shape (likely the same `statMods` field used by Battle Gear, Magus Crown, Sorcerer's Robe, etc.).

- **Team draft state lift surface.** Identify where in `App.tsx` the screen state lives, and the minimal interface change to preserve `teamDraft` across screen transitions. Confirm `TeamBuilderScreen` can accept an optional initial-state prop without restructuring its hook.

- **Existing playtest-relevant carry-forwards.** Survey the carry-forward list (S33.5/S34/S35/S36 handoffs) for items that belong in `docs/playtest-watch.md`. This populates the doc on creation.

### Architectural decisions

After the audit:

1. **Team draft state lift shape.** Per Chris's call: option A (lift into App state). Implementation:
   - `App.tsx` holds a `teamDraft: TeamBuilderState | null` state alongside `screen`
   - `TeamBuilderScreen` receives `initialDraft: TeamBuilderState | null` and `onDraftChange: (draft) => void` props
   - When screen changes from `'teamBuilder'`, the draft persists in `App`; when screen returns to `'teamBuilder'`, the draft re-hydrates
   - **Clearing semantics:** draft clears on return-to-title (full reset back to fresh state); draft clears on battle start (deployment confirmed = team committed). Draft persists during team-builder ↔ setup ↔ deployment back-and-forth.
   
   **Recommendation: as stated.** Plan-review confirms clearing semantics if a different shape feels right (e.g., persist across return-to-title too, or only clear on explicit "Start New Team" button).

2. **Tidal Wave display bug fix.** Audit-determined. Fix scope is local to the tooltip computation; the engine's actual knockback chance computation isn't changing. Most likely diagnosis: a percentage scaling oversight in the tooltip's formatter (raw probability shown as `prob * 100 * 100`% instead of `prob * 100`%). Regression test pins the formatter to the correct output range.

3. **Spiked Mail substrate.** Per audit:
   - **If existing hook composes (likely):** Spiked Mail registers an `onFinalDamage` handler (or equivalent) that reads the incoming physical damage's final amount, computes 20% as reflect, and fires a `system_damage` against the attacker. The reflect proc reads as `[reflect]` in the action log (or similar attribution).
   - **If new substrate needed (less likely):** add a `physicalReflect` hook similar to the existing damage-modifier hooks. Plan-review settles if needed.
   
   **Reflect semantics:** Spiked Mail's reflect fires on the *wearer being hit physically*, dealing 20% of the *post-mitigation damage* to the attacker. KO'd wearers don't reflect (the wearer is engagement-inactive). Reflect cannot KO the wearer (it's outgoing from them) but can KO the attacker. Reflect is physical damage; honored by the attacker's defenses normally.

4. **New equipment items — authoring.** Following existing item authoring patterns (per Battle Gear / Magus Crown / Sorcerer's Robe / etc.). All seven items land in `src/content/items/`:

   - **Travel Garb** (universal body): HP +80, Move +1. Composes with the existing `modifyMove` hook used by Sorcerer's Robe.
   - **Lookout's Hood** (universal head): HP +20, Speed +1.
   - **Spiked Mail** (Knight body): HP +100, 20% physical reflect (per decision 3).
   - **Crusader's Helm** (Knight head): HP +20, MP +10, Faith +10. No MA bump (deliberate, per Chris's design — Knight hybrid-caster piece distinct from Pointy Hat).
   - **Light Robe** (Mage body): HP +75, MP +20, Fire resist +75, Lightning resist +75.
   - **Dark Robe** (Mage body): HP +75, MP +20, Water resist +75, Earth resist +75.
   - **Tricorn** (Mage head): HP +10, MP +10, Brave +10.

5. **Equipment design conventions to capture durably.** Two principles surfaced during S37 design that warrant durable documentation:
   
   - **HP-on-every-armor-piece convention.** Chris noted: every armor and head piece adds at least some HP, otherwise a high-MA Lightning Mage one-shots naked units.
   - **Tradeoffs-not-tiers principle.** Equipment offers build choices, not power tiers — a new piece should differ from existing pieces along multiple axes (some better, some worse) rather than being strictly better or strictly worse than what exists. (Surfaced when the original Light/Dark Robe specs were caught as strictly worse than Sorcerer's Robe; the revised specs trade higher per-element resistance and HP for narrower elemental coverage and no Move bonus.)
   
   Two options for where to capture:
   - **(a) New `docs/twentyOneDesign/content-authoring.md`** or similar — permanent home; future content sessions reference.
   - **(b) Inline comments in the item module headers.** Less discoverable but proximate to the relevant code.
   
   **Recommendation: (a)** — design intent worth durable record, especially since both principles will keep applying to future content authoring. Plan-review picks the specific filename if a more apt one exists in the design-doc structure already.

6. **Light/Dark Robe pairing.** The symmetric design (Light covers Fire/Lightning resistance; Dark covers Water/Earth) creates a three-way build choice at the Mage body slot:
   - **Sorcerer's Robe** — balanced (Move +1, +50 to all four elements, +30 MP)
   - **Light Robe** — specialized for Fire/Lightning matchups (+75 HP, +75 to those two elements, no Move bonus, less MP)
   - **Dark Robe** — specialized for Water/Earth matchups (same as Light but mirrored elements)
   
   The pairing is intentional per Chris: a team running into Fire-heavy opponents wants Light Robes; Water-heavy opponents wants Dark; unknown or mixed opponent rosters favor Sorcerer's. Worth a short note in the item flavor descriptions reinforcing the complementary intent. Both items live in the same content file (`light-dark-robes.ts`) or in separate files (`light-robe.ts`, `dark-robe.ts`); plan-review picks based on convention.

7. **`docs/playtest-watch.md` — durable home for systemic playtest watch items.** Per Chris's call. Initial population from existing carry-forwards:
   - River Ridge balance post-S36 loadout changes (watch Battle Gear HP swing on Fire Mage; new equipment items adding fresh balance reads)
   - Burn × Purifier readability when it surfaces in battle (Red Lightning Mage carries Purifier)
   - Bedrock Stride real-knockback playtest (integration-tested S33; real playtest still pending)
   - Tidewalker tempo signature on River Ridge
   - Procced spell uses caster's MA — does it feel right?
   - Magus Crown / Tintinibar / Sorcerer's Robe calibration reads
   - Pacing constants (260/480/1100/360 ms) — initial read good per Chris; ongoing observation
   - Cliff-edge thickness (2/3/5px) — initial read good per Chris; ongoing observation
   - Spiked Mail reflect feel (new this session; needs human read on whether 20% feels right)
   - Crusader's Helm as Knight hybrid-caster piece (new this session; does the Faith bump matter in current ability set?)
   - Tricorn as Mage hybrid-physical / reaction-trigger piece (new this session; does the Brave bump pay off?)
   - Light/Dark Robe choice salience (new this session; does opponent-element matching emerge as a real decision?)
   
   Doc shape per plan-review: each entry has a "what to watch," "why it matters," "what signal would indicate adjustment" structure. Lightweight; sessions can add to it; you cross items off as you observe.

8. **Reflect attribution in action log.** Spiked Mail's reflect proc fires from the wearer back to the attacker. Action log should distinguish this from the wearer's own attacks. Likely surface: a `[reflect]` tag on the resulting damage entry, similar to how procs are attributed. Plan-review confirms shape.

9. **Test strategy.**
   - **Team-build state preservation:** integration test that team-builder draft survives a screen transition out and back; test that the draft clears on return-to-title and on battle start.
   - **Tidal Wave display fix:** unit test on the formatter; regression test pinning a known knockback chance to its expected percentage display.
   - **New equipment items:** structural tests confirming each item's statMods and hook registrations; integration tests for any item with a hook (Spiked Mail's reflect, Travel Garb's Move +1, Light/Dark Robe's resistances composing through `modifyResistance`).
   - **Spiked Mail reflect:** dedicated integration test — wearer takes 50 physical damage → attacker takes 10 damage (clean integer); reflect doesn't fire on magical damage; reflect doesn't fire on a KO'd wearer; reflect can't be reflected (no infinite loop).
   - **Equipment in team builder:** the new items appear in the appropriate slot dropdowns with appropriate class filtering; test team and pure-mage team templates still load correctly.
   - **`docs/playtest-watch.md`:** structural check that the file exists; no test gate on content.

10. **Order of work.**
    - Audit (tooltip path, knockback computation, reflect substrate)
    - Tidal Wave display fix (small; lands early to verify the fix is local)
    - New equipment items (content authoring; Spiked Mail last if substrate work is needed)
    - `docs/playtest-watch.md` creation + population
    - Team-build state preservation (UI change)
    - End-to-end verification (full pre-battle flow with new items; back-nav preservation)

11. **37a/37b split allowance.** Bounded scope; split unlikely. Possible split point if audit reveals Spiked Mail needs substrate work:
    - **37a:** Tidal Wave fix + simpler equipment items (six of seven) + state preservation + playtest doc
    - **37b:** Spiked Mail with substrate addition
    
    Most likely: no split.

The plaintext plan is reviewed before code lands.

## Implementation work

Following plan approval, items land roughly in audit-then-build order.

### Item 1: Tidal Wave knockback display fix

- Locate the tooltip formatter for charged-action detail panel knockback chance
- Identify the root cause (likely scaling/clamp issue per decision 2)
- Apply the local fix
- Regression test on the formatter

### Item 2: New equipment items — simple stat-mods

- Travel Garb (universal body): HP +80, Move +1
- Lookout's Hood (universal head): HP +20, Speed +1
- Crusader's Helm (Knight head): HP +20, MP +10, Faith +10
- Light Robe (Mage body): HP +75, MP +20, Fire/Lightning resistance +75
- Dark Robe (Mage body): HP +75, MP +20, Water/Earth resistance +75
- Tricorn (Mage head): HP +10, MP +10, Brave +10
- All composed via existing statMods / hook patterns
- Structural + composition tests per item

### Item 3: Spiked Mail with reflect substrate

- Per audit's reflect-substrate finding
- Spiked Mail registers physical-reflect hook (likely `onFinalDamage` or equivalent)
- Reflect fires 20% of post-mitigation physical damage back to the attacker
- KO'd wearers don't reflect; reflect can't infinite-loop; reflect honored by attacker defenses normally
- Action log attribution per decision 8 (probably `[reflect]` tag)
- Integration tests per decision 9

### Item 4: `docs/playtest-watch.md`

- Create the doc
- Populate from carry-forwards per decision 7
- Document the doc's discipline (sessions can add; Chris crosses off; lighter than ADRs, more durable than handoffs)

### Item 5: Team-build state preservation

- Lift `teamDraft: TeamBuilderState | null` into `App.tsx`
- `TeamBuilderScreen` accepts `initialDraft` + `onDraftChange` props
- Clearing semantics per decision 1: clear on return-to-title and on battle start; persist otherwise
- Tests for back-nav preservation, clearing, fresh-start flows

### Item 6: HP-on-every-armor-piece convention documentation

- Per decision 5: durable note in `docs/twentyOneDesign/` (plan-review picks specific home)
- Short; captures the design intent for future content authoring

### Item 7: End-to-end verification

- Manual playtest: full flow with new items appearing in team builder; back-nav preservation working; Tidal Wave tooltip reads correctly
- Quick playtest of Spiked Mail reflect in a real engagement (or via dev-debug surface if not browser-driveable)

## Acceptance criteria

**Tidal Wave display:**
- The charged-action detail panel's knockback chance for Tidal Wave reports a percentage in [0, 100]% range
- Regression test pins the formatter's output to expected values

**New equipment items:**
- All seven items authored in `src/content/items/` with appropriate class restrictions
- Travel Garb shows up in universal body dropdowns; Spiked Mail and Crusader's Helm in Knight-only; Light Robe / Dark Robe / Tricorn in Mage-only; Lookout's Hood universal head
- Each item's mechanical effects compose correctly (verified by tests)
- Spiked Mail's 20% physical reflect fires correctly (20% of post-mitigation damage to attacker; doesn't fire on magical damage; doesn't fire when wearer is KO'd; doesn't infinite-loop)

**Mage equipment pool no longer forces:**
- Pure-mage team templates can build distinct head/armor loadouts across all four units (previously forced because pool was exactly catalog-sized)

**Team-build state preservation:**
- Team Builder → Continue to Deployment → Back to Team Builder lands on the draft, not a fresh empty builder
- Team Builder → Back to Setup → forward to Team Builder also preserves the draft
- Title screen reset (Back to Title from anywhere) clears the draft
- Battle start clears the draft (next time team builder opens, fresh)

**Playtest watch doc:**
- `docs/playtest-watch.md` exists, populated with current systemic watch items
- Doc discipline documented inside the file (how to use; what belongs)

**HP-on-armor convention:**
- Design intent captured in `docs/twentyOneDesign/` (location settled at plan-review)

**Quality:**
- Tests at 1077+, 0 failing
- No new ADR expected unless Spiked Mail substrate work warrants one
- `docs/handoff.md` updated

## Out of scope

- **Pass-and-play toggle + dual deployment + battle-loop AI gating** — dedicated future session
- **Other maps / map selection** — future session
- **AI deployment logic** — future tactics-layer pass
- **Team persistence across browser sessions** — Phase F campaign features
- **Title screen + team builder narrow-viewport layout eyeballs** — carry-forward; not active this session
- **River Ridge balance tuning post-S37** — playtest-informed; the new equipment will need balance reads, captured in playtest-watch doc
- **Surrender flow** — ADR-0041; Phase E/F
- **Additional class content (Squire, etc.)** — future content sessions
- **More equipment expansion beyond these seven items** — future content sessions
- **Settings expansion** — Phase E later
- **`buildBattle` test-fixture extraction** — triggers at fourth duplication
- **`map-and-battlefield.md` open questions** — elevation hit-chance/cover, AoE multi-layer, LoS tie-breaking
- **AI active absorption exploitation** — S27 carry
- **AI projection forecast extension** — S30 carry
- **Procced Lightning Strike action-log attribution / Rasp Pendant drain attribution** — S30 carries
- **TS strict-mode test errors** — S34 carry; pre-existing on main

## Files likely touched

Non-exhaustive. Audit confirms / corrects.

**Bug fix:**
- `src/ui/charged-action-detail-panel.tsx` (or wherever the tooltip computation lives) — Tidal Wave display fix

**New equipment:**
- `src/content/items/travel-garb.ts`
- `src/content/items/lookouts-hood.ts`
- `src/content/items/spiked-mail.ts`
- `src/content/items/crusaders-helm.ts`
- `src/content/items/light-robe.ts` (or `light-dark-robes.ts` if paired)
- `src/content/items/dark-robe.ts` (or paired with Light Robe)
- `src/content/items/tricorn.ts`
- `src/content/items/index.ts` (or catalog assembly) — register new items

**Reflect substrate (if needed):**
- `src/engine/abilities/hooks.ts` (or wherever onFinalDamage / equivalent lives) — possible substrate addition
- `src/engine/...` — reflect proc machinery

**State preservation:**
- `src/app/App.tsx` — `teamDraft` state lifted
- `src/app/TeamBuilderScreen.tsx` — accepts `initialDraft` + `onDraftChange` props
- `src/ui/team-builder-state.ts` — possibly adjusts to support external draft injection
- `src/ui/use-team-builder.ts` — hook updates

**Tests:**
- `src/ui/charged-action-detail-panel.test.tsx` (or formatter test) — Tidal Wave regression
- `src/content/items/travel-garb.test.ts` and others for each new item
- `src/content/items/spiked-mail-reflect.test.ts` — dedicated reflect integration
- `src/app/team-draft-preservation.test.tsx` — back-nav integration
- `src/content/battles/river-ridge-battle.test.ts` — confirms current loadouts still valid with new items in catalog

**Documentation:**
- `docs/playtest-watch.md` — new persistent doc
- `docs/twentyOneDesign/content-authoring.md` (or location settled at plan-review) — HP-on-armor convention note
- `docs/handoff.md` — session handoff

**ADRs:**
- Possibly one if Spiked Mail substrate addition needs codification. Plan-review determines.

## Workflow notes

- **Plaintext-first review required.**
- **Audit-first for the bug fix.** Tidal Wave's 5000% has a specific symptom; the audit traces the formatter path before the fix lands.
- **Audit-first for Spiked Mail substrate.** If existing hooks compose, the item is content-only work. If not, a small substrate addition is needed; plan-review surfaces the call.
- **Order matters:** Tidal Wave fix early (smallest, isolated); simple equipment items next (parallel-able); Spiked Mail last (potential substrate dependency); state preservation independent (can land anytime); playtest doc + convention doc at any point.
- **ADR path is `docs/decisions/`.**
- **Mid-session design questions** route through Chris to the planner. Most likely surfaces: Spiked Mail reflect attribution shape; HP-on-armor convention doc location; Light/Dark Robe file pairing convention.
- **Mage equipment pool closure.** Post-S37, a pure-mage team has 7 head options (Pointy Hat / Magus Crown / Guard Cap / Focus Band / Tricorn / Steel Helm / Augmentor) and 5 body options (Wizard's Robe / Sorcerer's Robe / Battle Gear / Light Robe / Dark Robe). Comfortably above the team's 4-unit consumption.

## Watch-fors

**Addressed this session:**
- Tidal Wave 5000% knockback display bug
- Mage equipment pool expansion (S36 carry closed)
- Team-build state preservation on back-navigation
- HP-on-armor design intent captured durably
- Playtest watch doc created for ongoing observations

**Not addressed this session, longer-term carry-forward:**

- **Pass-and-play toggle + dual deployment + battle-loop AI gating** — dedicated future session
- **Title screen + team builder narrow-viewport layout eyeballs** — eyeball-only; small visual check pending
- **Full battle → results → continuity-button loop manual playtest** — S34 carry; Chris doing ongoing playtest, will surface via playtest-watch.md
- **River Ridge balance tuning post-S37** — new equipment may shift balance; reads accumulate in playtest-watch.md
- **AI deployment logic** — future tactics-layer pass
- **Other maps / map selection** — future session
- **Additional class content** — future content sessions
- **Walk-on-Water passive** — future content
- **AI active absorption exploitation** — S27 carry
- **AI projection forecast extension via `computeOutgoingHitChance`** — S30 carry
- **Procced Lightning Strike action-log attribution / Rasp Pendant drain attribution** — S30 carries
- **Procced spell uses caster's MA / Magus Crown calibration / Tintinibar Regen / Sorcerer's Robe Move +1** — ongoing playtest reads (now in playtest-watch.md)
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
- **`onFinalDamage` fires on absorbed hits but handlers gate** — design pattern (Spiked Mail will exercise this if `onFinalDamage` is the chosen substrate)
- **Forecast facing uses actual attacker→target geometry** — S30 carry
- **Unit detail panel's per-facing evasion uses `unit` as attacker stand-in** — S30 carry
- **Constant-map labels don't carry icons today** — S28 polish
- **`pa_factor` NotYetImplementedError** — audit E3
- **TS strict-mode test errors** — S34 carry (~202 pre-existing on main)
- **Surrender flow** — ADR-0041; Phase E/F
- **MVP-unit smarter algorithm** — S24 Wave 1
- **Permadeath timer** — S24 Wave 1
- **Settings expansion** — Phase E later
- **Reactions in projection column** — S24 Wave 1
- **Forecast accuracy row visibility** — S30 reject
- **Hit-chance and cover modifiers from elevation differential** — `map-and-battlefield.md` open question
- **`fillVitalsFromComputedMaxes` ordering invariant** — S32 carry
- **Bedrock Stride ongoing playtest read** — now in playtest-watch.md
- **HMR / Fast Refresh class-export rule** — S34 convention; code comments in place

## Estimated size

**Medium.** Three substantial scope items (state preservation, equipment authoring, bug fix) plus documentation. None individually large. The Spiked Mail reflect is the only potential scope surprise; if existing substrate composes, content-only; if not, small substrate addition.

**37a/37b split allowance** reserved for the Spiked Mail substrate case:
- **37a:** Tidal Wave fix + simpler equipment items (six of seven) + state preservation + playtest doc + convention doc
- **37b:** Spiked Mail with substrate addition

Likely no split if Mage War's existing damage-proc machinery (procced weapons, Rasp Pendant) provides the right hook shape — high probability per the project's substrate maturity at this point.

**End of session:** team-build state preservation working; Tidal Wave display correct; seven new equipment items in the catalog with Spiked Mail's reflect functional; playtest-watch.md as the durable home for systemic observations. Phase E polish stretch in good shape; Sessions 38+ extend further per roadmap.
