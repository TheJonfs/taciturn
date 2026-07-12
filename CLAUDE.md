# CLAUDE.md

This is the project constitution. You read it at the start of every session. Read it carefully before making changes.

## Project

**Taciturn** — a browser-based tactical RPG inspired by Final Fantasy Tactics. Local pass-and-play in v1; online play and isometric rendering are future stretch goals. The architecture is intentionally designed to support those without rework.

The chief architect and creative director is Chris. You are Chris's implementer and collaborator. Default to writing code; ask when architectural decisions or scope changes are warranted.

## Tech stack

- **Language:** TypeScript (strict mode)
- **Build:** Vite
- **UI shell:** React (menus, character screens, HUD outside the battle map)
- **Battle rendering:** PixiJS (the battle map canvas)
- **State updates:** Immutable game state via reducer; Immer for ergonomic structural updates
- **Tests:** Vitest

## Architectural ground rules

These are non-negotiable. Code that violates them is wrong, not "a different style." Discuss before changing any of these.

1. **Engine knows nothing about rendering.** Code in `src/engine/` does not import from React, PixiJS, or any UI library. The renderer reads engine state; the engine has no awareness of pixels.

2. **Game state is immutable.** All state changes happen through the reducer: `(state, action, seed) → (newState, outcome, generatedActions)`. Never mutate state in place, even for performance.

3. **Actions are the unit of state transition.** Every change is an Action through the reducer. Player choices, system events, status ticks, charged action resolutions — all are Actions in the log.

4. **Identity by ID.** Units, abilities, classes, items reference each other by stable IDs. Don't store object references that could go stale.

5. **Computed vs. stored.** Stored: HP, MP, position, CT, equipped abilities. Computed: max HP, current Speed, current bucket capacity, Move Range. Computed values are never cached in state — caching creates consistency bugs.

6. **Pure validation.** `validateAction(state, action)` is pure. No side effects, no RNG.

7. **Per-action seeds.** Each Action has a seed derived from `(masterSeed, sequenceNumber)`. The reducer is pure given `(state, action, seed)`. Outcomes are stored on actions for replay.

8. **Hook system is closed.** The hook surface (`onTurnStart`, `onDamageDealt`, etc.) is a fixed list. Adding a new hook is a deliberate engine change, not ad hoc. See `docs/design/status-effects.md`.

9. **Statuses, equipped passives, equipment, and class traits all use the same hook surface.** They differ in registration (when handlers come and go) but not in mechanism.

## Where to find context

The design docs in `docs/design/` are authoritative. When working on a subsystem, read the corresponding doc first. They explain not just what but why.

| Working on... | Read first |
|---|---|
| Turn order, Speed, charged actions | `docs/design/ct-system.md` |
| Loadout, abilities, capacity/cost | `docs/design/ability-slots.md` |
| Unit, Tile, Map, Action, GameState shapes | `docs/design/core-types.md` |
| Movement, range, line-of-sight, AoE | `docs/design/map-and-battlefield.md` |
| Status effects, hook system | `docs/design/status-effects.md` |
| Action lifecycle, damage pipeline, reactions | `docs/design/action-resolution.md` |
| Turn flow, battle outcomes, validation | `docs/design/turn-structure.md` |
| Terminology and proper nouns | `docs/design/glossary.md` |
| Code organization, module boundaries | `docs/architecture/overview.md` |
| Existing content (id ↔ name lookup) | `docs/content-id-registry.md` |
| Campaign nodes/beats model, the Atlas authoring tool | `docs/atlas-guide.md` |
| Adding a new `ActionType` discriminant | `docs/conventions/action-types.md` |

For decisions made during implementation, check `docs/decisions/` (ADR-style records).

## Conventions

- **TypeScript strict mode.** No `any` without an explicit comment justifying.
- **Pure functions where possible.** Engine code is mostly pure; side-effecting code is isolated.
- **Module boundaries.** Engine, AI, renderer, UI are separate. Don't import across them except through defined interfaces (e.g., `src/engine/index.ts`).
- **Tests alongside source.** `src/engine/ct/projection.ts` has its tests in `src/engine/ct/projection.test.ts`.
- **One concept per file.** When a file gets multi-purpose, split it.
- **Branch per feature.** Don't mix unrelated changes in one commit.

## Anti-patterns

Things to actively avoid (some of these come from past project failure modes):

- **Don't add convenience mutators to GameState.** Anything that changes state goes through the reducer.
- **Don't create new hooks for one-off cases.** If something doesn't fit the existing hook surface, surface the problem before adding to the surface.
- **Don't conflate Move (action) / Move Range (stat) / Movement (bucket).** They're three concepts. The glossary disambiguates.
- **Don't store computed values in state.** Speed, Move Range, max HP, bucket capacities are computed on read.
- **Don't bypass validation.** UI may pre-validate for UX, but the engine re-validates before reducing.
- **Don't add features without updating the design doc.** New mechanics either fit existing design or warrant a doc update before implementation.
- **Don't catch errors silently.** If a validation fails or a reducer hits an impossible state, fail loudly. Silent fallbacks are how bugs hide.
- **Don't write code in `src/engine/` that imports from `src/renderer/` or `src/ui/`.** The dependency arrow goes one way only.

## Working with design docs

Design docs are authoritative. If implementation diverges from a design doc, exactly one of these is true:

1. The design doc is wrong → update it (and capture the rationale in an ADR).
2. The implementation is wrong → fix it.
3. The divergence is real and intentional → write an ADR explaining why.

Don't silently let implementation drift from design. Drift is how a project becomes incomprehensible to its future self.

## Testing

- **Unit tests** for pure functions (validation, computed values, individual reducers).
- **Integration tests** for cross-module flows (full action lifecycle, turn boundaries, replay).
- **Determinism tests** for the reducer: same `(state, action, seed)` always produces same `(newState, outcome)`.
- Every reducer branch needs at least one happy-path and one edge-case test.

UI/renderer tests are deferred to specific component decisions.

## Asking vs. proceeding

Default to proceeding when:
- The design doc answers the question.
- The change is implementation detail within an established pattern.
- You're writing tests, refactoring for clarity, or fixing obvious bugs.

Ask before proceeding when:
- A real architectural decision is needed (new hook, new action type, new bucket flavor).
- A change would touch multiple modules in non-obvious ways.
- The design docs are ambiguous or contradict each other.
- The user's request seems to conflict with a ground rule.

When you ask, be specific: state the choice, give your recommendation, name the tradeoff.

## Session conventions

When ending a session:
- All changes committed with descriptive messages.
- Any new architectural decisions captured as an ADR in `docs/decisions/`.
- Tests passing.
- If work is incomplete, leave a clear note (in commit message or `WIP.md`) about state and next steps.
- Update `docs/roadmap.md` if items completed, scope shifted, or sequencing changed.
- Update `docs/handoff.md` with notes for the next session (see below).
- Append any **player-facing** changes to `docs/guide-changelog.md` (a one-way feed the parallel guide-writing sessions read). Player-facing only — mechanics, content, player-visible UX; *not* internal refactors, AI scoring, or tests. If none this session, add the one-line "no player-facing changes" entry. See the file's header for the filter and format.

When starting a session:
- Read this file.
- Read `docs/roadmap.md` to know where the project is and what this session is meant to accomplish.
- Read `docs/handoff.md` and process every item.
- Read any relevant design docs for the work at hand.
- Check `docs/decisions/` for ADRs since you last looked.
- Run tests to confirm starting state is healthy.

### Handoff document

`docs/handoff.md` is a transient note from one session to the next. It captures things that don't fit the other persistence mechanisms: things noticed but not acted on, choices considered and rejected, suggested scope for the next session, and watch-for items that aren't ADR-worthy.

The discipline that keeps it useful rather than a junk drawer: it is *overwritten* each session, not appended. When starting a session, read every item and either (a) act on it, (b) promote it to an ADR / design-doc edit / GitHub issue, or (c) drop it explicitly. Items do not accumulate. When ending a session, replace the file with this session's outgoing notes — or with `_No handoff this session._` if there are none.

Decisions go in ADRs. What changed goes in commit messages. System design goes in design docs. The handoff doc is for everything else worth carrying forward exactly once.

## Things to flag, not silently change

If you notice any of these, surface them rather than fixing reflexively:

- Inconsistencies between design docs and implementation.
- Tests that pass but seem to test the wrong thing.
- Patterns that work but feel wrong (these are often signs of design issues).
- Performance hotspots (most of the engine is not performance-sensitive; if you find one that is, it's worth a discussion before optimizing).

The goal is collaborative architecture, not implementation-by-fiat.
