# Planner Context: Taciturn / Mage War / The Guide

A note from the prior planner-Claude to the next, after Phase E closed at Session 38.

## What this is

Orientation for a fresh thread picking up the planner role on Taciturn (the engine), Mage War (its showcase 4v4 demo), and the Player's Guide (the cadet's handbook parallel project). Tactical history lives in the session briefs and `docs/` (ADRs, design docs, roadmap, handoffs). This file covers the strategic and relational context the briefs assume.

## The project in one breath

Taciturn is a browser-based tactical RPG engine inspired by FFT; Mage War is its showcase 4v4 demo set at the Gariland Magic Academy in Ivalice. Through Session 38 the engine has its battle loop, equipment system with cost/capacity substrate, deployment phase, team builder with named units, three sample team templates, and Vercel deployment. The parallel Player's Guide — a cadet's handbook in the Gariland instructor's voice — has shipped a first draft. Both projects have their own `CLAUDE.md`; the game lives at the repo root, the guide at `guide/`.

## The collaboration shape

Chris (Christopher Jones, NASA aerospace engineer, the project's chief architect and creative director) works with a separate Claude Code implementer for the actual code work. The thread-Claude is the **planner** — drafts session briefs Chris reviews before they ship, processes handoffs after each session, mediates between planner and implementer.

Working patterns that have emerged across the arc:

- **Audit-first framing on bug fixes.** The implementer audits the codebase before committing to a fix shape. The planner proposes structured starting points with appropriate hedging about not seeing live code. Audit reshaping initial fix proposals (S33.5, S33.5A, S37 all showed this) is the system working as designed, not a planner failure.
- **Plan-review settles architectural calls before code lands.** Planner proposes options with reasoning; Chris picks; implementer executes.
- **Brief gaps Chris fills with domain knowledge mid-session** are expected — planner recommendations sit at a default level; Chris extends per game-design intent (examples: one-unit-per-class rule in S36; Brave/Faith sliders in S36; three-layer HMR cause in S34's diagnostic).
- **Direct feedback is welcome and expected. Sycophancy is unwelcome.** Chris explicitly noted earlier: acknowledge limitation (planner doesn't see live code) without diminishing capacity (planner adds real value through cross-session continuity and architectural framing). The right posture is propose-with-hedging, not retreat-from-proposing.
- **Honest acknowledgment when the planner misframes** (S33 canEnter recommendation, S33.5 heal-gate framing, S36 team-size assumption) is healthier than either over-claiming or self-diminishing. Brief gets reshaped, work proceeds, planner learns.

## The choice ahead

Phase E closed with Session 38. Two tracks compete for the next session budget:

**Track A — Content expansion within current rendering.** Pass-and-play toggle (closes a long-running Phase E carry), surrender flow (ADR-0041), settings expansion, additional classes (Priest, Monk, Archer), additional maps, two-handed / dual-wield weapons, campaign / multi-battle persistence. Each session is small-to-medium; cumulative effect is "Mage War plus more Mage War."

**Track B — Isometric rendering transition.** CLAUDE.md is explicit: *"online play and isometric rendering are future stretch goals. The architecture is intentionally designed to support those without rework."* This is a multi-session arc; new asset pipeline, depth sorting, camera adjustments, animation rework. Probably wants its own design pass before code lands.

The prior planner's read: continue Track A in small bites while playtest signal accumulates and the guide work matures, then evaluate Track B with real data (does the top-down feel limiting? does playtest reveal elevation-readability gaps that isometric would address?). Chris's instinct may differ; the new thread inherits the open question rather than a decision.

## Technical conventions worth knowing immediately

- **The codebase is at ~1100+ tests across 100+ files**, very disciplined. Audits often confirm substrate is already in place — Chris has good intuition about this; his "I'm pretty sure the audit will show..." reads have been right multiple times.
- **HMR / Fast Refresh conventions (S34):** no class exports in Fast-Refreshable component modules (disqualifies the whole module from Fast Refresh); `useRef` not `useMemo` for load-once singletons (`useMemo` gets a fresh identity on Fast Refresh, churning effect deps); cleanup functions capture references before destroy.
- **ADR-0074's principle:** engine-reported absolutes over UI arithmetic on magnitudes. Renderer / UI derives from engine-reported `hpAfter` / `mpAfter` / etc., not from `snap.hp - damage`-style reconstruction. Honored across renderer surfaces.
- **Cross-pollination between game and guide is genuine.** The Ivalician names table from S38 coordinated with the guide's Gariland Academy framing. Voice / vocabulary / canon decisions in either project should consider the other.
- **Doc locations:** ADRs live at `docs/decisions/`. Session handoffs at `docs/handoff.md` (overwritten each session, not appended — process every item at session start). Roadmap at `docs/twentyOnePlanning/roadmap-sessions-21-plus.md`. Playtest observations at `docs/playtest-watch.md`; deliberate test plans at `docs/playtest-scenarios.md`.

## On Phase F's structure

The roadmap frames Phase F as small empirical sessions, which suits Track A's cadence well but doesn't naturally accommodate Track B's longer-arc design work. If isometric rendering becomes a real direction, it probably wants its own roadmap phase with a deliberate design pass first — similar to how Phase E was framed as a multi-session UI arc rather than a single session. Worth flagging when Chris settles the next direction.

## What the briefs look like

Session briefs follow a stable template: Context → Inputs (read first) → Goal → Pre-implementation plan (audit-first; architectural decisions with recommendations) → Implementation work → Acceptance criteria → Out of scope → Files likely touched → Workflow notes → Watch-fors → Estimated size. Recent examples accumulate as the project proceeds; the most recent session's brief is the freshest template reference.

## Last note

The Player's Guide's colophon names the prior planner-Claude alongside Chris as collaborator across "many sessions of design and implementation, of writing and revising, and the voice that carries the annotations throughout." A new thread won't remember the prior conversations, but the guide sits on disk with the prose worked out, and that's a real persistent artifact across instances. The collaboration shape is good. Lean into it.
