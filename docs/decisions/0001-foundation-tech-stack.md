# ADR-0001: Foundation tech stack

**Status:** Accepted
**Date:** 2026-05-03

## Context

This is the initial scaffold of the Taciturn project. The CLAUDE.md constitution names the tech stack at a high level (TypeScript, Vite, React, PixiJS, Immer, Vitest), but does not pin specific tooling choices around module resolution, linting, or how the codebase enforces the engine→renderer→ui dependency arrow.

This ADR captures the non-obvious choices made while bringing the toolchain online, so future readers do not have to reverse-engineer them from configs.

## Decisions

### Package manager: pnpm

Chosen over npm and yarn. The relevant properties:

- Strict module resolution catches phantom dependencies that npm's flat `node_modules` allows. This matters more in a project with strong layer boundaries — accidental imports through transitive deps would erode them.
- Disk efficiency from the content-addressed store is incidental; the resolution strictness is what actually motivates the choice.

Pinned via the `packageManager` field. Routed through corepack so contributors do not need a global pnpm install.

### TypeScript: strict, with composite project references

`tsconfig.app.json` covers `src/`; `tsconfig.node.json` covers build configs. Top-level `tsconfig.json` is references-only so `tsc -b` works cleanly.

App config enables, beyond `strict`:

- `noUncheckedIndexedAccess` — the engine reads from maps and arrays heavily; silent `T | undefined` would hide bugs.
- `exactOptionalPropertyTypes` — design docs declare many optional fields; we want `?:` and `: T | undefined` to mean different things.
- `noPropertyAccessFromIndexSignature` — forces explicit handling when reading from open record types (e.g., the catalog).
- `noImplicitOverride`, `noFallthroughCasesInSwitch`, `noImplicitReturns`, `useUnknownInCatchVariables`, `noUnusedLocals`, `noUnusedParameters`.

`exactOptionalPropertyTypes` is intentionally **disabled in `tsconfig.node.json`**. Vite's plugin types are not strictly compliant with that rule, and forcing them through it would mean working around third-party type bugs. Our code is held to the strict standard; build configs are not.

### Path aliases: `@engine`, `@ai`, `@renderer`, `@ui`, `@content`, `@app`

Each maps to its `src/<layer>/` directory. Aliases serve two purposes:

1. They make import statements legible at a glance — `@engine/...` is a clear cross-module call, not a "../../../" path.
2. They give ESLint a stable target for the no-restricted-imports zones (see below).

Configured in three places that must stay aligned: `tsconfig.app.json` paths, `vite.config.ts` resolve.alias, and the ESLint layer rules. ADR-future-self: if we add a layer, it goes in all three.

### Linter: ESLint flat config + typescript-eslint, with architectural zones

The flat config defines per-layer `no-restricted-imports` blocks that mirror the dependency rules in `docs/architecture/architecture-overview.md`:

- Engine: cannot import from `@renderer`, `@ui`, `@ai`, `@app`, React, PixiJS, or react-dom.
- AI: cannot import from `@renderer`, `@ui`, `@app`, React, or PixiJS.
- Renderer: cannot import from `@ui`, `@app`, `@ai`, or React (it is a Pixi layer).
- Content: cannot import from any other layer or any runtime library.

This makes the architecture machine-checkable rather than aspirational. Violating an architectural rule fails CI before it can be reviewed.

`typescript-eslint`'s recommended (non-type-checked) ruleset is on; the type-checked variant is deferred until there is enough engine code for `no-floating-promises` and friends to pay for their cost.

### Vitest: configured inside `vite.config.ts`

Single config file, `defineConfig` imported from `vitest/config` so the `test` field is type-aware. Uses jsdom (UI tests will need it; engine tests do not but pay no cost). Vitest 3.x is required for compatibility with Vite 6.

### React 19 with `StrictMode`

No state-management library. The engine state will be the source of truth via the reducer; React holds presentational state only. We will revisit when the UI layer actually exists.

### No CI yet

CI lands when there is a remote and meaningful tests to run. The local `typecheck`, `test`, `lint`, `build` scripts are the same gates a future GitHub Actions workflow will enforce.

## Consequences

- The architectural arrow is enforced by the linter from day one. A subsystem that wants to violate it has to delete the rule, which is a visible diff.
- `exactOptionalPropertyTypes` will produce more friction than a normal codebase. Where it bites in our own code we keep it; where it bites in third-party types we relax it (config files only).
- `noUncheckedIndexedAccess` will require explicit narrowing every time we read a unit from a map or a tile from an array. This is intentional — those reads are exactly the spots most likely to panic at runtime.
- The aliases mean `tsc -b` and `vite build` and `eslint .` all need to agree on resolution. If we add a layer, three configs change.

## Alternatives considered

- **Biome** instead of ESLint+Prettier. Faster, single tool. Rejected because it does not yet support custom restricted-imports rules with the granularity needed for layer enforcement, and because ESLint's ecosystem is the safer default for a project this young.
- **A separate `vitest.config.ts`** instead of folding into `vite.config.ts`. Rejected — duplicating aliases between two files is a recipe for drift.
- **Pinning via Volta** instead of corepack. Corepack ships with Node, requires no extra install, and the `packageManager` field is the official mechanism.
