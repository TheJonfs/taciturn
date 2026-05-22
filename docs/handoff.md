# Session Handoff

This is a transient note from one session to the next.

**Discipline:** This document is *overwritten* each session, not appended. When starting a session, read this file and process every item — act on it, promote it elsewhere (ADR, design-doc edit, GitHub issue), or explicitly drop it with a reason. Items do not accumulate. If there are no notes to leave, replace the contents with `_No handoff this session._` so the next session knows the file has been processed.

---

## From Session 45 close (2026-05-22) — Hunter class + bow weapon substrate + three follow-up items

S45 landed the **Hunter** (8th class; roster now 4 physical / 4 magical) and the **bow** weapon class, then a follow-up batch added three new items (Mantle of Protection, Wand of Lumen, Ironfoot) plus the small substrate hook the Lumen needed. **1342 tests pass (119 files; +57 net)**, `tsc -b` clean, `npm run build` succeeds end-to-end locally. ADR-0083 captures the bow substrate; ADR-0084 captures the new `modifyStatusApplicationStackCount` hook. The bow audit found the engine cleaner than the brief assumed — two pre-specified pieces were avoidable (see below).

### What shipped

- **Substrate (ADR-0083):** `WeaponEquipment.twoHanded` (slotting rejects off-hand/shield) + `range` (weapon-sourced reach; `computeAbilityRange` forks for weapon-tagged physical attacks, parallel to the variance fork); `WeaponPhysicalVariance` gains a `height_delta` arm (first variance arm reading the *target* — `resolvePhysicalVarianceBand` took a `target` param, threaded through its 3 call sites); `CtEffectSpec.stat?: 'pa'|'ma'` (PA-scaled CT push); `AbilityEffects.selfMove` (Scramble repositioning).
- **Hunter:** stats HP 116 / MP 28 / PA 6 / MA 3 / Speed 9, Move 4 / Jump 3, evades 6/3/0. Native R/S/M — Updraft (Reaction, accumulating +1 Jump on hit), Eagle Eye (Support cost 2, ×2 physical hit chance), High Jump (Movement cost 1, +2 Jump). Marksmanship command set — Pin Down (Slow 4t, Brave-and-Speed @ base 50), Charged Attack (charged physical, ×1.5, actionSpeed 25), Scramble (1-tile jump-5 hop).
- **Weapons:** Longbow (WP 7 / Acc 33 / 2H / range 2-5 vert-inf / height-delta var) and Riptide Bow (WP 5 / Acc 33 / 2H / range 2-5 / + 30% Undertow proc → PA-scaled CT push ~18). New `slow` and `updraft` statuses; new `'bow'` damage tag.
- **Team template:** "Highland Hunters" (Hunter + Knight + Earth Mage + Water Mage), registered in `defaultTeamTemplates`.
- **UI:** equipment picker auto-clears the off-hand on a two-handed equip + grays it out; `computeTeamValidity` flags two-handed conflicts; detail-text shows bow range / two-handed / "Var by elevation". Class picker gained the Hunter tagline ("Ranged elevation marksman") and portrait wiring (`hunter.png`, which was pre-placed in the repo but unwired).
- **Registry:** `content-id-registry.md` backfilled with the S45 rows (Hunter content only — the broader pre-S45 staleness remains a carry, see below).

### Follow-up batch (also in S45): three items + new hook

- **Substrate (ADR-0084):** new `modifyStatusApplicationStackCount` hook — source-side, additive, single-pass numeric modifier fired inside `applyStatus` before the type's `composeApplyState` reads the stack count. `ApplyStatusArgs.sourceAbilityTags` lets contributors gate on the casting ability's tags. Equipment carries the modifier declaratively (`statusApplicationStackCountModifiers` field + generic contributor). Structurally recursion-free: the chain mutates a number, it does not re-enter the apply path.
- **Mantle of Protection** (accessory): +25 resistance to fire/water/earth/lightning/holy/dark; +25 to front/side/back evasion. The most defensively-oriented accessory in v1.
- **Wand of Lumen** (weapon): WP 2 / Acc 90 wand. 100% on-hit `tagged_resistance_shift` of `+25 Earth / −25 Water` (via `wand_of_lumen_apply_shift`, mirroring the Depths/Deepwood content). Bonus: +1 stack on Burn applications driven by the wielder's fire-tagged abilities (the new hook).
- **Ironfoot** (accessory): −1 Move, −1 Jump, −1 Speed; +1 PA, +1 MA; +1 Movement-bucket capacity. The reverse-Lightfoot tradeoff slot.

### Two brief assumptions the audit overturned (Chris confirmed in plan-review)

1. **No `modifyAccuracy` hook.** Eagle Eye reuses the existing `modifyOutgoingHitChance` (caster-side, physical-only, multiplicative, pre-clamp) — mathematically identical, no new closed-surface hook.
2. **No `scramble` ActionType.** Scramble is a `selfMove` ability effect that relocates the caster in-reduce (the knockback pattern, ADR-0026), recorded on `UseAbilityOutcome.casterMove` and replayed by the animator as a `move`. No 5-site ActionType wiring.

Also: charge-time needed **no** generalization (the gate was already flavor-agnostic), so the brief's contingency ADR-0084 was not written.

### Post-commit / next-session

- **Verify the Vercel deployment** under the restored `npm run build` gate (passes locally; the one item not locally verifiable).
- **Browser verification — team-builder layer DONE; in-battle layer NOT done.** Verified in the dev server: app boots with zero new console errors (only the pre-existing border/borderColor warnings); Hunter is selectable in the class picker (portrait + tagline render); both bows equippable; equipping the Longbow auto-empties + grays the off-hand; Updraft / Eagle Eye / High Jump all show "Free" for the Hunter; the "Highland Hunters" template loads with 4 valid units; base stats render HP 116 / MP 28 / PA 6 / MA 3 / SPD 9. **Not yet driven in an actual battle:** height-delta damage scaling visibly on the map, Eagle Eye's ~66% hit feel, the Riptide CT-push read, a Charged Attack resolving, and the Scramble hop *animating* (the `casterMove` → `move`-anim path). All of these are covered at the engine/test layer (1330 tests), so this is a feel/rendering check, not a correctness gap.
- **All seven S45 watch-fors** are logged in `docs/playtest-watch.md` (bow accuracy, elevation safe zones, Pin Down EV, Riptide tuning, Charged Attack speed, Scramble frequency, cross-build combos, AI Hunter placement).

### Carry-forward (longer-term, unchanged)

- **`content-id-registry.md` broader reconciliation** — S45 added its own rows, but the pre-S45 staleness persists: the Equipment section lists only 5 of ~52 items; several abilities/statuses (Alchemist kit, Assassin Shadow Arts members, S42 statuses speed_save/brave_down/faith_down, the full passive list) are missing. A dedicated docs sweep is still owed.
- Calculator class (9th, magical-knowledge specialist).
- Second map design — S46 candidate.
- 5v5 unlock — later in roadmap.
- Equipment expansion (Hi-Potion / Holy Water / Elixir + accessories).
- Charm/Seduction (team-override substrate, dedicated session).
- Pyromancer R/S/M consolidation (future R/S/M review).
- Knight base-PA recalibration (playtest-driven).
- AI deployment role-aware sorting (playtest-driven; the Hunter sharpens the case — see watch-for).
- Speed Save / Updraft per-swing reaction cap (S42 D5 deviation — Updraft inherits the same "one grant per enemy turn even under multi-swing" throttle).
- Renderer-side multi-swing animation polish (S42 carry).
- Permadeath badge first-playtest visual read (S41 carry).
- Border/borderColor React dev warnings (cosmetic console noise).
- `assignAiTeamNames` removal (confirmed dead post-S43; still exported + tested).
- ActionType-wiring smoke test (future CI item; S45 added no ActionTypes, so the gap is unchanged).
