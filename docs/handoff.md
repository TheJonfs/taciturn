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
- Long-running plan (that's `docs/roadmap.md`, if/when it exists).

---

## From session 2026-05-03 (foundation scaffold)

### Suggested next-session scope

**Combined "core types + CT system."** The CT system needs `Unit`, `ChargedAction`, `GameState`, and branded ID types to exist. The shapes in `docs/design/core-types.md` are explicitly illustrative; we'll discover the real shapes by implementing CT. Doing core types as a small first task within the CT session avoids a dangling micro-session that produces only types nothing consumes yet.

### Open questions to resolve early in the next session

- **Accessor return-type pattern.** `tilesAt`, `tileAt`, `unitAt`, and similar accessors will be called everywhere. With `noUncheckedIndexedAccess` on, every indexed read is `T | undefined`. Pick one pattern up front and apply it consistently: throw on missing (callers narrow before calling), return `undefined` (callers handle), or return a `Result<T>` shape. This decision affects every consumer in CT, map, status, and turn modules.
- **`ChargedAction` concrete shape.** `core-types.md` describes Charged Actions as first-class CT entities but doesn't pin the type. The CT session is where this gets nailed down — likely worth an ADR if the shape diverges from anything implied by the design doc.

### Things I considered but did not do

- **Type-aware ESLint** (`@typescript-eslint/recommended-type-checked`). Cost is too high relative to the empty code surface. Revisit when engine code exists; `no-floating-promises` becomes valuable as soon as async appears.
- **Zod or similar runtime validation.** Not needed yet — `GameState` is constructed only by the reducer, never deserialized from untrusted input. Reconsider when save/load lands.
- **`.gitattributes` for line endings.** Currently relying on `core.autocrlf` (CRLF in working tree on Windows, LF in repo). Skipped because the project is single-contributor on Windows. Add `* text=auto eol=lf` if a non-Windows contributor joins or if line-ending diff noise appears.

### Things to flag (not blocking)

- **Branch protection on `main`** is not enabled on the GitHub remote. Direct push to `main` works. If this project moves to a "branch per feature with PR review" workflow, enable required-status-checks once CI exists.
- **No CI yet.** Add a GitHub Actions workflow running `typecheck`, `test:run`, `lint`, `build` on push and PR once meaningful tests exist (likely mid-CT-session).
- **Repository description on GitHub.** Currently empty; might want a short one-line summary visible from the repo home page.
