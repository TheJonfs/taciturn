# ADR-0052 — `modifySystemDamage` hook: single modification seam for engine-emitted damage

**Status:** Accepted (Session 26, 2026-05-11)

**Context.** `system_damage` is the engine-emitted damage-the-target action used by Poison ticks (ADR-0024), falling-damage post-knockback (ADR-0026), and ability-self-cost charges like Storm Caller (ADR-0032). Per ADR-0027, system_damage *bypasses* the seven-stage damage pipeline — no variance, no Faith, no resistance, no Counter trigger, no `onDamageReceived` hook firing. The emitter precomputes the amount and the reducer applies the HP delta.

Bedrock Stride (Earth Mage's Movement-bucket passive, session 26 content) needs immunity to fall damage. With the pipeline bypassed, the existing `onDamageReceived` chain (a passive that returns a 0× multiplier to mitigate) isn't fired and can't intercept. Pre-26 there was no way for a passive (or status, or equipment) to influence the amount of an emitted system_damage action.

Three sources will want this capability in v1 + Cluster 4–5:

1. **Bedrock Stride** (this session) — fall-damage immunity.
2. **Purifier-style equipment** (future) — reduce Poison tick damage.
3. **Status / equipment that scale or null specific system_damage sources** — e.g., a "Burning Boots" item that adds extra ability_self_cost damage on certain casts.

The shared shape — "modify the amount of an in-flight system_damage against the target, gating on the SystemDamageSource discriminant" — is uniform across all three.

**Decision.** Introduce a single new hook on the closed surface:

```typescript
modifySystemDamage: {
  args: {
    unit: Unit;
    source: SystemDamageSource;
    tags: ReadonlySet<DamageTag>;
    baseAmount: number;
  };
  return: number;
};
```

- **Where fired:** inside `reduceSystemDamage`, against the *target's* hooks, between the target-exists/KO checks and the HP-delta apply. Each handler receives the running amount and returns the new one; the chain runs in source-tier and per-handler priority order. A handler returning 0 (or any value ≤ 0) prevents the damage — the reducer clamps the post-chain amount with `Math.max(0, …)`, and the existing `applied === 0` short-circuit no-ops the apply.
- **Outcome shape:** the resulting `SystemDamageOutcome.amount` reflects the *post-modification* amount, not the originally-emitted `payload.amount`. Consumers (action log, replay) see what the unit-perceived damage was.
- **Source-discriminant gating:** handlers gate on `args.source.kind`. Bedrock Stride checks `=== 'falling'`. A Poison-resisting passive would check `=== 'status_tick' && source.statusTypeId === poisonId`.
- **Handler registration:** standard `passiveHook` / `statusHook` / future equipment-hook registration. No new registration pathway.

**Consequences.**

- **Modification is unified.** Future fall-immunity, Poison-resistance, self-cost-mitigation content all use the same hook; no per-source plumbing.
- **`system_damage` still bypasses the seven-stage pipeline.** This decision is *not* a reversal of ADR-0027. The bypass is preserved — `modifySystemDamage` is a single, isolated modification seam, not the full pipeline.
- **`outcome.amount` semantics shift.** Pre-26, it equaled `payload.amount`. Post-26, it equals the post-chain modified amount. Existing tests asserted `outcome.applied`, not `outcome.amount`, so the change is non-breaking for the test surface. Replay determinism preserved because handlers are deterministic given `(state, action, seed)`.
- **Composition is multiplicative-chainable.** Two handlers (halve, then zero-falling) compose naturally — the second sees the first's output. Source-tier ordering (Status → Passive → Equipment → Class) preserves the existing handler-precedence semantics.
- **No clamp at the handler boundary.** Handlers may return negative values; the reducer clamps to ≥ 0. Tested. The clamp is centralized rather than asking each handler to clamp.

**Alternatives considered.**

- **Narrow `queryFallImmunity` hook returning `boolean`.** Solves only fall-damage. Future Poison-tick modification would need a separate hook. Hook-surface bloat per use-case is exactly what ADR-0005's "closed surface" guidance pushes back against.
- **Walk the unit's loadout inside the falling-damage emitter** looking for an ability-id-keyed `fallImmune: true` flag. Engine-knows-ability-ids couples engine to specific content; violates the "engine knows nothing about specific abilities" principle.
- **Route `system_damage` through the seven-stage damage pipeline.** Larger reversal of ADR-0027 than warranted. The pipeline assumes attacker/target framing (DamageContext requires both), with seven stages plus variance and Faith — overkill for "subtract a precomputed amount." `system_damage` is structurally simpler and benefits from staying so.
- **Make Bedrock Stride a custom-trigger status** (apply hidden status on equip, fire its own `onDamageReceived` somehow). Pre-26 statuses don't have any way to intercept `system_damage` either — the bypass affects status hooks too. Same problem, different layer.

**References.**

- Session 26 brief: `docs/twentyOnePlanning/session-26-brief.md` (Architectural Decision 1)
- `src/engine/hooks/hooks.ts` (`modifySystemDamage` in HookSignatures)
- `src/engine/hooks/runners.ts` (`runModifySystemDamage`)
- `src/engine/actions/reducers.ts` (`reduceSystemDamage` — fire-site)
- `src/content/abilities/bedrock-stride.ts` (first consumer)
- `src/engine/actions/modify-system-damage.test.ts` (chain composition + clamp + source-gating)
- Related: ADR-0027 (status side-effect infrastructure / system_damage bypass), ADR-0026 (forced-movement falling damage)
