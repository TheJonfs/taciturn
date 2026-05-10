## ADR-0035: Controllers pre-filter proposed actions through `runOnActionAttempted`

**Status:** Accepted
**Date:** 2026-05-10

## Context

The post-Session-20 engine audit (`docs/audits/post-20-engine-audit.md`, item E9) flagged that the basic AI calls `validateAction` to filter candidate actions but does not simulate the `runOnActionAttempted` hook chain. `validateAction` is intentionally pure — its file header documents that `onActionAttempted` hooks fire in `commitAction`, not in validation (range, target, budget). A unit afflicted with Don't Move, Don't Act, or Silence passes `validateAction`'s structural checks but is blocked at commit time. The `DemoOrchestrator` ([`src/app/demo/orchestrator.ts`](../../src/app/demo/orchestrator.ts)) treats commit failure as fatal and throws.

Surface conditions:

- The post-reconciliation tuning (Earth Cataclysm power 12 + MA 12, Faith 0.49) lands Don't Move ~41% per-application instead of the prior ~27%. Two integration tests in `src/app/controllers/ai-controller.integration.test.ts` failed with `commit failed for move by "blue_lightning_mage": can't move`.
- Mid-session, the diagnostic surfaced that the failing iteration put the failing actor on the *greedy placeholder controller*, not the AI. The greedy controller had the structurally identical bug at its move-proposal site: it picked a destination from `getLegalMoves` (pure pathfinding, no hooks) and committed without `runOnActionAttempted` ever running. The audit named only the AI; the gap was symmetric across both controllers.

This ADR records the broader rule that any `Controller` (the orchestrator-facing decision interface) must pre-filter through `runOnActionAttempted` before returning a `commit` decision.

## Decision

Controllers must run `runOnActionAttempted` against any action they intend to return as `{ kind: 'commit', action }`. Treat anything other than `'allowed'` as a filter signal and either propose a different action or end the turn. The pattern:

```typescript
function canCommitAction(state, catalog, actor, action) {
  if (!validateAction(state, action, catalog).valid) return false;
  const attempt = runOnActionAttempted(state, catalog, {
    unit: actor, action, isReaction: false,
  });
  return attempt.kind === 'allowed';
}
```

Both `validateAction` and `runOnActionAttempted` are pure (the latter's handlers receive no state and return `ActionAttemptResult` only — see `src/engine/hooks/runners.ts`), so this is a clean pre-flight check at no risk of state mutation.

Applied at every controller-side commit-decision site:

- `src/ai/basic.ts` — four sites (`pickBestHeal`, `pickJointActOrMove` act-in-place, `pickJointActOrMove` move, `pickBestMove` fallback). Replaces the prior `validateAction`-only checks.
- `src/app/demo/controller.ts` (greedy placeholder) — two sites (attack proposal, move proposal). Adds the check; greedy previously checked only the attack via `validateAction` and didn't validate moves at all.

`'replaced'` is treated identically to `'blocked'`: the controller scored the original action; if commit would substitute a different action (e.g., Taunted retargeting), the controller's choice and the engine's commit diverge. Filtering forces the controller to re-derive a candidate against accurate semantics rather than committing an action it didn't choose. No content currently produces `'replaced'` results (Taunted is the only known emitter and isn't in the Mage War demo), but the rule is forward-looking.

### Rejected alternatives

- **Orchestrator-side fallback to Wait on commit failure.** When `commitAction` fails for a unit afflicted with a known-blocking status, the orchestrator could substitute a Wait/end-turn instead of throwing. Rejected: this papers over the bug. The controller would observe one outcome (the Wait), have scored a different action, and the AI's apparent behavior diverges silently from its scoring. Future debugging gets harder; the AI's pre-filter is the cleaner long-term fix because it keeps the controller's decision and the orchestrator's commit aligned.

- **Make `validateAction` impure / fold the hook chain into validation.** `validateAction` is documented and depended on as pure. Folding `onActionAttempted` into it would surprise callers (the validator currently has no side effects and no access to state-mutating handlers). Cleaner to keep validation pure and add the hook check as a separate explicit pre-flight step.

- **Factor a "pure-mode" runner out of `runOnActionAttempted`.** The existing runner is already pure — handlers do not receive state and return `ActionAttemptResult` only. No factor-out needed.

## Consequences

- **Two failing integration tests pass.** `every battle terminates within a sane step bound` and `basic AI wins at least as many matchups as greedy across both team assignments` both clear after the fix lands across both controllers.

- **Controllers can no longer treat the orchestrator as fault-tolerant.** Any new controller (UI controller, future AI tier) must apply the same rule. Worth documenting in the controller-implementation guidance once a third controller is authored.

- **`canCommitAction` is duplicated across `src/ai/basic.ts` and `src/app/demo/controller.ts`.** A small intentional duplication. The two controllers live in different module tiers (ai is engine-only; demo is app-tier), and the helper is small enough that pulling it into a shared location would over-couple the layers. If a third controller appears, promote to a shared utility — likely `src/engine/actions/can-commit.ts` so it can be imported from both tiers.

- **`runOnActionAttempted`'s purity becomes load-bearing.** The runner currently has no `state` parameter passed to handlers and returns `ActionAttemptResult` only — handlers cannot mutate state by construction. If a future hook signature change adds state-mutating capability to `onActionAttempted`, the controller pre-filter pattern breaks (or starts double-firing side effects). Worth a comment on the runner that it must stay pure for this contract to hold; flagging in the handoff for the next session that touches the hook system.

- **Greedy's pre-existing `validateAction` call inside `pickReachableMeleeTarget` (target-enumeration loop) is unchanged.** That call is the candidate-filtering pass for picking *which* enemy to target; the proposed action that gets returned from the controller still goes through `canCommitAction` for the final pre-flight. The two checks have different jobs and can coexist.

## Related

- ADR-0024 — action chain and commit semantics (`runOnActionAttempted` fires inside `commitAction`)
- ADR-0033 — AI tier-2 substrate (the controller-side `validateAction` filtering pattern this fix extends)
- `docs/audits/post-20-engine-audit.md` — Section E.9 (originating finding) and Section F (test failures)
- `docs/twentyOnePlanning/session-21-brief.md` — Item 2 (specification)
