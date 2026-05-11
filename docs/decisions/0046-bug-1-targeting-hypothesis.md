# ADR-0046 — Bug 1 (mid-battle targeting failure): hypothesis tree and dev-only instrumentation

**Status:** Accepted (Session 24.5, 2026-05-11)

**Context.** During Chris's second playtest pass of the MVP build (post-Session-24 Wave 2), one specific enemy unit became un-targetable mid-battle: when the player Lightning Mage selected a spell, other nearby enemies highlighted as eligible targets but the AI Lightning Mage did not, and clicking the AI Lightning Mage's tile behaved as Cancel. The condition persisted after the player Lightning Mage moved (ruling out position-overlay artifacts). On the next available unit turn, the AI Lightning Mage was targetable again.

Session 24.5's audit examined every code path that could reject a single-unit ability target:

- `useTurnFlow.computeLegalTargets` (single_unit branch) — iterates `state.units.values()`, filters `vitals.hp <= 0`, probes `validateAction`. Highlight follows.
- Tile-click handler (target-select) — calls `buildAction`; null → cancel. Then `canCommitAction` (validateAction + `runOnActionAttempted`); false → cancel.
- `validateAction` for `use_ability` single_unit — actor active-turn check, MP cost, target unit exists, target tile exists, `inRange`, `rangeMode` ('arc' / 'straight_line' / 'melee').
- `runOnActionAttempted` — fires the **actor's** hooks only. Target-side statuses cannot block the player's targeting through this path.

Hypotheses ruled out by audit:

- **Status on the AI Lightning Mage** (Charging, Vulnerable, any tagged debuff). Charging's `queryTurnSkipped` is actor-side; nothing in the hook surface lets a target-side status filter targeting. Vulnerable is `on_damage_received` only.
- **Taunted on the player's Lightning Mage.** Taunted blocks attacks on *non-source* units uniformly (deterministic per (taunt-source, actor, ability) tuple) — would block all enemies except the Knight, not specifically the AI Lightning Mage. Symptom doesn't match.
- **Range / arc on the Training Field map.** Uniform single-layer at elevation 2 → arc check has nothing to block on; the `inRange` check passes for h ≤ 4 / v ≤ 2 unconditionally.

Hypotheses **not** ruled out, in rough order of plausibility:

1. A subtle bug in `validateAction` or `inRange` for a specific positional configuration (corner-tile, distance-equals-range, etc.).
2. A renderer-side hit-test issue: `BattleRenderer.hitTest` finds the topmost tile by `tile.layer`, then `unitAt(state, x, y, top.layer)`. If a unit's `position.layer` doesn't match the topmost-tile-layer the hit-test resolves to, `unitAt` returns `null` → `buildAction` for single_unit returns `null` → cancel. (Doesn't explain the missing highlight on its own — but if combined with a state-level issue, this would compound.)
3. A stale React-memo or render-cycle issue in `legalTargetsState` (dependency closure not catching an update).
4. A timing artifact between turn boundaries — the state machine briefly seeing a partially-updated state during animation drain.

The audit was exhaustive; the bug is subtle. **Fixing speculatively risks shipping an adjacent change that doesn't actually cover the case.**

**Decision.** Defer the fix. Land development-only diagnostic logging at three points so the next playtest occurrence produces structured diagnostic output:

1. **`computeLegalTargets` (single_unit branch)** logs per-candidate rejection reasons via `console.debug('[targeting] reject', ...)`. Includes the candidate's id, position, and the `validateAction` rejection reason.

2. **Target-select tile-click handler** logs both the `buildAction === null` and `canCommitAction === false` paths. The `canCommitAction` failure path re-calls `validateAction` to extract the structured reason (otherwise the bool return would lose information).

3. **`BattleRenderer.hitTest`** logs when the click resolves to a tile where `unitAt` returns null but a sprite exists at (tileX, tileY) — surfaces the layer-mismatch hypothesis.

All three gated by `import.meta.env.DEV` so production builds carry no overhead.

When the bug recurs in playtest, the console output should narrow it to one of the hypotheses above, and the fix follows.

**Consequences.**

- No code-level change to behavior. Players don't see the diagnostic output; only the next playtest's dev console does.
- Tests stay green (the diagnostic calls have no observable effect on test output beyond `console.debug` lines, which vitest doesn't surface by default).
- The hypothesis tree is documented; future readers don't have to re-audit when the bug recurs.

**Alternatives considered.**

- **Speculative fix in `validateAction`** (e.g., loosen the arc check, change inRange's bounds). Rejected — bug remains unattributed. If a different mechanism is at play, the speculative fix masks it.
- **Augmenting `canCommitAction` to return a structured `{ allowed: boolean; reason?: string }`** instead of bool. Rejected for v1: dev-side re-call of `validateAction` extracts the reason without an engine API change. Worth reconsidering if Bug-1-style cases recur (more than 1-2 similar reports).
- **Removing the cancel-on-non-target-click behavior** so the player can re-click without re-selecting the ability. Rejected — that's a UX change, not a fix; the playtest report specifically described the highlight missing, which is a state-level bug regardless of click behavior.

**References.**

- Session 24.5 brief: `docs/twentyOnePlanning/session-24-5-brief.md` (Bug 1 section)
- Session 24.5 plan: `docs/twentyOnePlanning/session-24-5-plan.md` (Architectural decision 1)
- Targeting pipeline: `src/ui/use-turn-flow.ts:computeLegalTargets`
- canCommitAction: `src/engine/actions/can-commit.ts` (ADR-0039)
- validateAction: `src/engine/actions/validate.ts`
- Hook system: `src/engine/hooks/runners.ts`
