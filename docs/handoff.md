# Session Handoff

This is a transient note from one session to the next.

**Discipline:** This document is *overwritten* each session, not appended. When starting a session, read this file and process every item — act on it, promote it elsewhere (ADR, design-doc edit, GitHub issue), or explicitly drop it with a reason. Items do not accumulate. If there are no notes to leave, replace the contents with `_No handoff this session._` so the next session knows the file has been processed.

---

## From Session 42 close (2026-05-20) — Assassin + Two Weapons substrate + Lightning Stab swap

S42 shipped as a **monolith** (no 42a/42b split — the audit found the attack pipeline already consolidated, so the substrate was additive, not invasive). Four pieces: the Two Weapons multi-swing substrate, the full Assassin class, the Knight's Stasis Sword → Lightning Stab swap, and **The Offering** (the swings-per-weapon accessory originally slated for S43 — pulled forward at Chris's request once the substrate proved it was a small add). **1263 tests passing across 114 files** (up from 1224 / 111; +39). Two ADRs: ADR-0080 (unified attack pipeline + multi-swing, with The Offering addendum), ADR-0081 (Brave/Faith-and-Speed formulas + Remedy-immune stat debuffs).

### Plan-review decisions (settled with Chris)

- **Monolith**, not 42a/42b — audit showed consolidation cost was small.
- **D2 Remedy: stat debuffs non-clearable.** Audit surfaced that the brief's premise was *wrong* — `pa_down`/`ma_down`/`speed_down` had no polarity, defaulted to `'debuff'`, and *were* Remedy-cleared. Chris's call: make stat-reduction debuffs Remedy-immune (data-driven flag). **This changed existing Fire/Earth Strike / Brine / Earth Quake calibration** — those debuffs are now permanent-until-battle-end (see playtest-watch).
- **D9: "Lightning Stab"** (not "Hallowed Bolt").
- **Team: Assassin + Knight + Alchemist + Mage** → "Shadow and Steel" template.

### What shipped

**Substrate (engine):**

- **`modifyDualWield` hook** (new closed-surface boolean OR-query; `hooks.ts` + `runModifyDualWield` runner + `hooks/index.ts` export). Two Weapons returns true. Engine asks "may this unit attack off-hand?" content-agnostically.
- **`multiWeapon?: boolean`** on `ActiveAbilityDefinition` — true on `attack` (→ Counter) and `power_attack`; absent on `lightning_stab` / `stasis_sword` / magic (D1b defaults: damage attacks multi-swing, status-rider attacks opt out).
- **`attackingWeaponSlot?: EquipmentSlotId`** threaded through `RunDamagePipelineArgs` → `DamageContext`. When set, `physicalPaWp` reads that slot's weapon (`getWeaponInSlot`) and `attackProcContributor` scopes procs to that slot. **Undefined = bit-identical pre-S42 behavior** (dominant-weapon + all-item procs) — this is what kept the 1224 pre-existing tests unchanged.
- **Swing loop** in `resolveSingleTargetDispatch` (`attackingWeaponSlots` helper). Fast path (`[undefined]`) identical to before; multi-swing loops `resolveAbilityEffect` per slot with `perTargetSeed(seed, swingIndex)`. Each swing fully resolves (damage → procs → reactions) before the next; stops early on target KO; caster effects fire only on swing 0. AoE path is single-swing (no v1 AoE weapon attack).
- **`speed` factor** in `StatusFormulaFactors` → `0.9 + caster_speed/20` (caster-only, `computeSpeedFactor`). Wired into `computeStatusChance` + `rollAbilityChance` (+forecast shares `computeStatusChance`). Brave-and-Speed / Faith-and-Speed variants.
- **`remedyImmune?: boolean`** on `StatusEffectType`. Remedy predicate (`applyConsumableEffects`) skips it. Set on `pa_down`/`ma_down`/`speed_down`/`brave_down`/`faith_down`.

**Content:**

- **Assassin class** (`assassin.ts`, baseline HP 96 / MP 24 / PA 6 / MA 3 / SPD 14, evade 8/4/0). Native free: Two Weapons (S), Speed Save (R), Fleet of Foot (M). First-action set: **Shadow Arts** (`shadow_stitch`, `blowdart`, `undermine`, `sow_doubt`).
- **Abilities:** `two_weapons` (modifyDualWield + PA×0.75, cross-class cost 3), `speed_save` (reaction → +1 Speed accumulator), `fleet_of_foot` (move+1/jump+1, cost 1), the four Command Set abilities, `lightning_stab` (Silence rider, baseChance 50 `{brave,ma}`, single-swing, 8 MP).
- **Statuses:** `speed_save` (buff, STACK_ADDITIVE accumulator, persists KO), `brave_down` / `faith_down` (permanent, remedyImmune, STACK_ADDITIVE, magnitude 20).
- **Knight swap:** `battle_skill` command set members `stasis_sword` → `lightning_stab`. Stasis Sword stays registered (cross-class option).
- **The Offering** (`the_offering.ts`, accessory): each equipped weapon swings twice on the **basic Attack only** (`attackSwingMultiplier: 2` → new `modifySwingsPerWeapon` hook; new `basicAttack` ability flag gates it to `attack`, `isReaction` excludes Counter). `statMods: { pa: -2 }` balancing tax. Stacks with Two Weapons → 4 swings. The second multi-swing axis ADR-0080 anticipated.
- **Team:** `shadow-and-steel.ts` (Lysha/Aldric/Corvin/Senna).

**UI:**

- Assassin tagline "Swift debilitating skirmisher".
- **Two dual-wield gates fixed** (both found in browser verification): (1) equipment-picker dropdown (`team-builder-equipment-slots.tsx`) now offers an off-hand weapon when `modifyDualWield` is present; (2) team-builder *validation* (`team-builder-state.ts` `isDualWielding`) no longer flags a two-weapon Assassin as invalid. Both detect capability via a `modifyDualWield` hook scan (content-agnostic).
- Action menu / unit-detail panel are data-driven — Shadow Arts members, the Speed Save status badge, and the passives surface automatically (verified to load without error; not driven through the PixiJS battle canvas).

### Browser verification (what was / wasn't covered)

Verified in-browser, no console errors anywhere: Assassin selectable + tagline; stats correct with **Two Weapons PA × 0.75 composing live** (PA 4–5 depending on gear); **both knives equippable** (picker gate); team-builder validation accepts the dual-wield Assassin (deployment button enables); Shadow and Steel loads; deployment screen renders.

**NOT browser-verified (PixiJS canvas — not DOM-scriptable):** in-battle multi-swing animation/log, the in-battle action menu, and the Lightning Stab/Speed Save in-combat behavior. These are covered by deterministic tests (`session-42-multiswing-integration.test.ts`, `assassin-commandset.test.ts`). **First manual playtest should drive an actual battle** to confirm: two damage flashes on a dual-wield attack, Shadow Arts targeting/forecast, Speed Save badge incrementing, Lightning Stab Silence.

### Watch-fors / things noticed (next-session candidates)

- **Speed Save vs the reaction cap (D5 deviation).** The flat `perUnitPerTurnReactions: 1` throttles Speed Save to once per enemy *turn*, even on a 2-swing enemy hit (D5 wanted up to 2 procs). Honoring per-swing needs a per-ability reaction-cap override — deferred. Flagged in playtest-watch.
- **Existing stat debuffs are now Remedy-immune.** A real balance change to Fire Strike / Earth Strike / Brine / Earth Quake (their PA/MA/Speed Down now stick all battle). Watch whether this over-tunes those abilities; lever is per-status `remedyImmune` scoping.
- **`movement-debuff` left Remedy-clearable** (finite, ability-tied) while flat stat debuffs are immune — a deliberate scoping call (ADR-0081). Revisit if inconsistent in playtest.
- **Assassin AI is purely the existing data-driven offensive classification** — no Assassin-specific heuristics. Verify in playtest the Assassin doesn't idle / spam one ability / pick poor debuff targets; add scoring if it does.
- **`content-id-registry.md` is stale** (was already missing the Alchemist's abilities/statuses pre-S42). I added the class + command-set rows and the Lightning Stab swap, but the active-abilities / passives / statuses tables are incomplete (pre-S39b). Warrants a reconciliation pass.
- **No Assassin portrait asset** — the class card shows no image (other classes have portraits). Cosmetic; add when art is available.
- **Lightning Stab + Bravestrider Silence rate** — see playtest-watch; may read "too sticky."
- **Knight + Two Weapons (cross-class) damage king** — earlier math had it out-damaging Martial Expertise; watch whether the shield-loss trade keeps Martial Expertise a real choice.
- **The Offering burst ceiling.** Two Weapons + The Offering = four basic-Attack swings (plus per-swing weapon procs and four chances to trigger the target's Counter/Speed Save). The −2 PA + accessory-slot cost is the only brake. Watch whether four-swing basic attacks over-tune raw output, especially on Knight + dual axes + Battle Gear; lever is the −2 PA magnitude or `attackSwingMultiplier` not stacking with dual-wield. (Note: it's basic-Attack-only, so it does NOT amplify Power Attack — a deliberate ceiling.)

### Carry-forward (longer-term, unchanged)

- Charm/Seduction (team-override substrate, dedicated session).
- Knight base-PA recalibration (playtest-driven).
- Pyromancer R/S/M consolidation (4 free passives — future R/S/M review).
- AI deployment / random-fill (Red still authored placements).
- TS strict-mode pile (~230, S34 carry).
- Pass-and-play toggle + dual deployment + battle-loop AI gating (dedicated session).
- Calculator class.
- Additional consumables (Hi-Potion, Holy Water, Elixir); buff/debuff consumables (`applyStatus` on ConsumableEffects).
- Renderer-side multi-swing animation polish (basic reuse of existing flash; polish deferred).
- Permadeath badge first-playtest visual read (S41 carry).
- Command-set display-name renames (Fire Spells / etc. — S40 carry).
- ActionType-wiring smoke test (future CI; no new ActionTypes added this session).
