# ADR-0144: TABA Ch3 weapon uniques (×8), playtest fixes, and the two weapon-attack seams

**Status:** accepted (S87)
**Context:** `docs/TABADesign/taba-ch3-uniques-and-fixes-brief.md` — debug JP tool,
Moon Robe / Katana playtest items, and the 8 settled Ch3 weapon uniques.

## What shipped

1. **📈 Grant JP (dev)** — repeatable manage-roster chip: +100 JP per currently
   *unlocked* class (`reclassableClasses`, so spend-crossed tiers join the next
   press) per active party member. No force-unlock, no once-guard, DEV-gated.
2. **Moon Robe fix** — the `modifySpellPower` chain is now seeded with the
   ability's full effective coefficient and its result IS the effective SP.
   The pre-fix wiring seeded 0 and added the result back, so a `factor` entry
   multiplied only the *other riders' deltas* (×1.0 alone — the playtest's
   target-smeared 68→68). Additive riders are bit-identical. Display arm for
   factor (and perExtraTarget) SP entries added.
3. **Katana verification** — all three ordered checks PASS against the shipped
   substrate (crit magnitude real via `critRoll`; the three chance sources sum
   additively onto weapon attacks; Katana ×2 on the multiplier axis only).
   Pinned as regressions; no engine change.
4. **The 8 uniques** (all `hidden`, pool Ch3 `unique`, seed-only until the
   economy pass): Nandani's Wrath, Cremation, Shadowblade, Sline, Golden Rod,
   Del's Stave, Volley Bow, Excalibur. Six are pure composition; two carried
   engine seams (below). Holy imbue (work item 4) landed as composition:
   `'holy'` was already a DamageTag with a live resistance field — Excalibur
   tags `['sword','holy']` and ADR-0028's weapon-tag merge does the rest.

## Decisions

### D1 — Weapon-attack AoE seam (`attackAoe`, Volley Bow)

The target-anchored arm of the weapon-attack-shape seam (lance `pierces` is the
caster-anchored arm). One resolver (`weaponAttackAoeSpec` /
`attackAoeForWeapon` in `engine/items/weapon-attack-aoe.ts`) backs:

- `validateAction` — upgrades the basic Attack's *effective* targeting to
  unit_or_tile (empty-ground aim; bows keep their no-LoS arc semantics since
  the attack's rangeMode stays 'melee');
- the reducer's per-swing dispatch (`swingAoeForSlot` = pierce ∪ attackAoe) —
  standard AoE machinery: per-target seeds (independent Acc rolls), ruleset
  friendly fire (v1 TRUE — the Volley Bow hits allies, settled ruling),
  barrier damage inside the footprint (the single-barrier short-circuit yields
  when the weapon declares an AoE);
- the UI's target enumeration + hover footprint.

Aether Bloom does NOT expand it — its hooks gate on the `'magical'` ability
tag (same answer as the Palliative Pike question). AI *valuation* of the blast
stays deferred (standing AI-capability deferral); the projection resolver
evaluates volley targets without throwing.

### D2 — Cast-time MP dump seam (`castMpDump`, Del's Stave)

On any `'magical'`-tagged cast (ALL casts per Chris — heals and buffs
included), the commit spends ALL current MP; +1 SP per `mpPerBonusSp` (10) MP
beyond the effective cost, floor, NO cap (the MP economy self-caps the nova).
The bonus is a function of PRE-CAST MP, so:

- the reducer computes it once at commit (`engine/abilities/mp-dump.ts`);
- instant casts thread it into the dispatch; charged casts bank it on
  **`ChargedAction.bonusSpellPower`** (new optional field — resolution can't
  recompute from vitals);
- `additionalPowerCoefficient` now threads through `resolveAbilityTargets`
  into every dispatch flavor (summed with the Mathematician bonus in
  math_skill dispatch);
- AI projection / UI forecast recompute the identical formula from live
  vitals inside the shared projection pipeline (exact-parity test: projected
  160 === live charged resolve 160).

Known approximation: a math_skill cast's per-target MP scaling isn't visible
to the prospective read (base cost only). No content pairs the dump with
math_skill today.

### D3 — Signed `system_mp_restore` (Golden Rod's MP burn)

The brief assumed `system_damage` covered MP drain; audit found no one-sided
MP-loss channel (`system_damage` is HP-only; `system_mp_drain` is a transfer —
a self-drain nets zero). Rather than adding a new ActionType (the
surface-stays-closed rule), `system_mp_restore.amount` is now SIGNED: negative
= burn, floored at 0 MP; `applied` carries the sign. Positive behavior is
bit-identical. **Flagged for Chris**: if a dedicated `system_mp_burn`
discriminant is preferred, this is a contained refactor.

### D4 — Rulings preserved verbatim

- Shadowblade proc mirrors **Magebane** (Chris's session ruling): flat
  weapon-side 50%, `applyAlways` applications bent only by the target's
  modifier chain. Speed Up (new status, Speed Save's STACK_ADDITIVE pattern)
  + Speed Down (reused) both stack PERMANENTLY, both directions.
- Golden Rod drain is LINEAR (10% of max/turn), lethal, carried by a granted
  status (`golden_rod_pact`, `permanent_per_unit_ct` tick — there is no
  equipment→onTurnStart contributor, and none was added).
- Sline × The Offering compose to 4 strikes; The Offering NOT reworked (D1
  of the brief).
- Excalibur = Knight Sword family (live via Absolom/Defender), Brave-variance
  contract, Auto-Haste via statusGrants, Holy-imbued, above-curve by intent.
- Tile aim for Volley Bow settled by Chris in-session (aim at empty ground).

## Audit-overturns-spec notes (reported per the brief's norm)

- **Tailored Outfit does not exist** — the brief cited it as the start-of-turn
  precedent; the real precedent is `statusGrants` → a permanent per-turn-tick
  status (`regen_auto`). Golden Rod uses that path.
- The composition seams the brief listed (on-hit procs, accumulating stat
  statuses, swing multiplier, auto-status, imbue, brave statMods) all existed;
  the 6 non-seam uniques are pure content.
- S86's Moon Robe unit test exercised the runner with a hand-fed baseValue and
  passed while the call site was wrong — the regression suite now pins the
  full pipeline on-vs-off ratio against two target profiles.

## Consequences

- Items 133 → 141; statuses 46 → 49 (`speed_up`, `gilded_focus`,
  `golden_rod_pact`); abilities 128 → 130 (`cremation_burn_proc`,
  `shadowblade_proc`).
- Every new rider renders through `formatItemDetail` (shared by Loadout
  inspector / Team Builder / in-battle panel); the three new statuses carry
  authored tooltips.
- Enemy loadouts must NOT carry the effect weapons until the AI-valuation
  beat (standing deferral).
