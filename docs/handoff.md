# Session Handoff

This is a transient note from one session to the next.

**Discipline:** This document is *overwritten* each session, not appended. When starting a session, read this file and process every item — act on it, promote it elsewhere (ADR, design-doc edit, GitHub issue), or explicitly drop it with a reason. Items do not accumulate. If there are no notes to leave, replace the contents with `_No handoff this session._` so the next session knows the file has been processed.

What belongs here:

- Things noticed but not acted on.
- Implementation choices considered and rejected.
- Suggested scope or sequencing for the next session.
- Watch-for items and open questions that aren't ADR-worthy.

What does *not* belong here:

- Decisions (those are ADRs).
- What changed (that's the commit message).
- System design (that's the design docs).
- Long-running plan (that's `docs/roadmap.md`).
- Comprehensive progress / deferred-work review (`docs/progress.md` is the durable home for that — refreshed periodically, not session-by-session).

---

## From session 2026-05-08 (session 17c: Knight expansion + equipment integration)

### Suggested next-session scope

**Session 18 — Water Mage** (per `docs/roadmap-sessions-14-20.md`).

Engine work:
- CT push as damage rider: damage spec gains a `ctPush?: { factor }` field (or similar) so abilities can declare `target CT -= 2 × MA` mid-resolve. Water Base spell is the first consumer.
- Self-CT manipulation by reactions (Water Reaction = "self +20 CT on hit"). Flows through `onActionTargeted` with a CT-push side effect.
- CT refund hook (Water Support: "magic actions refund 10 CT after use"). New post-action-resolve consumer; first hook of its kind.
- Knockback: Water Mage's AoE spell + Ultimate are the first content consumers of the `applyKnockback` primitive shipped in 17b. Forced-movement collision policy lands as a real test (cancel-on-blocker per ADR-0026).
- New status: **Speed -1** (multiplicative debuff via modifyStatQuery — clean addition).

Content work (plaintext-first):
- Full 7-ability Water Mage kit: Base spell (damage + CT push), Buff (CT gain on ally), AoE (damage + chance of knockback 1), Debuff (Speed -1 status), Ultimate (cone shape, always knocks back), Reaction (self +20 CT on hit), Support (magic actions refund 10 CT).

ADR-0029 (anticipated): CT-push primitive + CT-refund hook.

The 17c substrate that 18 inherits:
- **`factors` selection** is in place; Water content can opt in to `{ faith: true, ma: true }` or other shapes per ability. PA-factor still NotYetImplementedError until a consumer ships.
- **`applyAlways: true`** is available for Water statuses that should bypass the formula (Speed -1 from the Debuff might not need it; Ultimate's knockback is a side effect, not a status).
- **`modifyEvasion`** hook is live; Water doesn't currently use it but a future "Water Veil" support that grants evasion would be a natural consumer.
- **Equipment integration** is fully wired. Water Mage's class definition needs `equipmentSlots`. v1 demo doesn't equip Water Mages; the slots can default to all-true for parity with Earth Mage.
- **Source-KO status sweep** — no v1 consumer beyond Taunted; Water content unlikely to need it but it's available.
- **`removeStatus(... force: true)`** is available for the deferred mid-battle equipment-removal path. Water content shouldn't need it.

### Things noticed during the session

- **Pre-existing TS strict-mode errors in test files surfaced by `npm run typecheck`.** These existed before 17c (knockback.test.ts using `makeUnit({ id, position })` without `spd`; runners.test.ts onTick handler returning void). Vitest doesn't full-typecheck so they don't surface in `npm test`. Worth a session of cleanup at some point — `tsc -b --noEmit` should be green, not a list of pre-existing baggage. **Not session-blocking, but flagged.**

- **Status hook firing direction inconsistency.** `modifyHitChance` runs against the *target's* hooks (Blind on the defender). Taunted needed to gate by *attacker's* behavior — so its handler is on `onActionAttempted` (a probabilistic block) rather than `modifyHitChance`. Worked, but the pattern is "Taunted blocks 40% of attempted attacks against non-source targets," not a clean hit-chance modifier. If a future session needs "Taunted reduces accuracy" as a hit-chance modifier, the right shape is a new `modifyHitChance` runner that fires against the attacker's hooks (parallel to the existing target-side runner). Document/decide when content surfaces it.

- **Per-ability cost field is currently vestigial for active members of command sets.** Looking at attack.ts and the new Battle Skill members (power_attack, stasis_sword, taunt) — they each declare `baseCost: 1`, but command-set membership is the real gate. Validation doesn't read individual ability `baseCost` on actives. The field exists for symmetry with passive abilities (where it's the real cost). When a future system needs "command-set members each cost something against a budget" (a Mimic-style "you can equip 2 abilities from a command set" pattern), this field becomes meaningful. v1 fine.

- **Bulwark Stance's Move/Jump min-clamp at 0.** `Math.max(0, args.baseValue - 1)` so a baseline-Move-1 Knight doesn't go negative. v1 has no baseline-Move-1 Knight, but the clamp is defensive. If a future "Move 0" stance is desired, the floor would be -1. v1 fine.

- **Default factors merge semantics.** The first impl was sparse override (declared keys merge over defaults), which silently kept faith for Stasis Sword. Switched to full-override (declared `factors` replaces default entirely). Watch for: when a future ability adds a new factor (PA), the existing Earth Magic content that omits `factors` keeps default `{ faith: true, ma: true }` — no migration needed. New abilities that want PA + faith + ma must list all three explicitly. Cleaner, but the verbosity grows with the factor list.

- **`'sword'` damage tag.** Added to the closed `DamageTag` union for Long Sword. Future weapon types (axe, bow, spear) extend the union as content arrives. The `'weapon'` tag stays the marker that "ability uses the equipped weapon"; per-weapon types are additional tags that compose for resistance/category interactions.

### Things considered but did not do

- **Renaming `AbilityDefinition.tags` from `ReadonlyArray<string>` to a closed enum.** Considered: tighter typing for hook gating (Silence on `'voice'`, Earth Mage's resistance-stop, etc.). Rejected: ability-level tags are a content convention, not an engine-layer constraint; growing the enum every time a new tag ships would be friction. The string union is fine for hook-gating purposes.

- **Auto-recompute MaxHp when equipment changes mid-battle.** Per ADR-0028, deferred. v1 has no mid-battle equipment changes; the recompute-and-clamp policy (current HP retained, clamped at new max? scaled proportionally?) is its own ADR when content surfaces it.

- **`modifyHitChance` runner against the attacker's hooks** (parallel to the existing target-side runner). Considered: would let Taunted's effect compose as a hit-chance modifier rather than a probabilistic block. Rejected: v1 has no consumer for the attacker-side direction beyond Taunted, and the probabilistic-block path works without growing the closed surface. Surface when content needs it.

- **Per-equipment-source priority on hook handlers.** Considered: equipment that wants to compose in a specific order (a "Strength Ring +1 PA" applying before "Cursed Ring -1 PA" produces 0; reversed produces 0 too — order doesn't matter for additive PA mods). Rejected: additive composition is order-independent. When multiplicative equipment mods land (a "Berserker's Mantle ×1.5 PA" + Strength Ring +1), order matters, and we'd want explicit priority. Surface when content ships.

- **`AbilityDefinition.tags` propagating into the equipment damage tag set.** Considered: an ability whose `tags` includes `'fire'` could compose that into damage tags for content that uses ability tags vs. damage tags interchangeably. Rejected: today the two tag sets are separate (ability tags for hook gating, damage tags for resistance lookups). The split is intentional. If a future ability wants the cross-pollination, adding `'fire'` to its damage tag set is the right answer.

- **Stasis Sword defaulting to `actionSpeed > 0`** (charged version). Considered: a "Sword Tech" feel where Knight Battle Skills take a beat to land. Rejected per plaintext review: the Knight identity is "instant martial action"; Mages charge, Knights swing. Stasis Sword stays instant.

### Open questions for later sessions (not blocking)

- **Equipment-stripping abilities.** No v1 consumer; if a future class has a "Steal Equipment" or "Disarm" ability, the `removeStatus(force: true)` path lights up. Surface when content needs it.

- **Equipment that grants statuses with finite durations.** All v1 equipment-granted statuses use `permanent_per_unit_ct` (Boots of Haste). If a future "Cursed Ring" grants Poison with a fixed duration, the equipment apply path needs to honor the spec's `duration` somehow. Today the apply path doesn't pass a duration for equipment grants; the status's durationMode is the source of truth. v1 fine; surface when content needs it.

- **Mid-battle equipment removal recompute.** Deferred per ADR-0028. When theft / equipment-break ships, the policy on current HP scaling and the equipment-anchored statuses' lifecycle needs an ADR.

- **AI awareness of equipment.** The basic AI (`decideBasicAi`) reads PA/MA/HP via `runModifyStatQuery` (so equipment stat mods compose naturally), but doesn't reason about *what* equipment a target is wearing for tactical decisions. Tier 1.5 AI in session 20 might want this; for v1 not load-bearing.

- **Taunted's probabilistic-block stable hash.** Currently uses `stableHash(sourceId | unitId | abilityId)` so a Taunted unit attempting the same ability on the same target always gets the same block-or-not decision. This is replay-deterministic but slightly weird flavor — the unit "knows" the outcome before they try. A per-action seeded approach (with a sub-stream off the action seed) would be cleaner. Surface when Taunt sees real play and the determinism feels off.

### Notes for future ADRs

- **ADR for CT-push primitive** (anticipated session 18) — the damage-rider shape, the post-action CT manipulation hook, and how knockback / CT-push interact with reaction triggers.

- **ADR for mid-battle equipment removal** when content surfaces it — current HP clamping, equipment-anchored status lifecycle, recompute determinism.

- **ADR for attacker-side `modifyHitChance` runner** if Taunted (or future Concentration etc.) wants the cleaner hit-chance-modifier shape.
