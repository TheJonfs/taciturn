# Deployment

This doc covers how to ship Taciturn to a public URL for cross-machine
playtesting. v1 target is **Vercel** — a static-SPA host with a free
tier sufficient for the demo.

## Prerequisites

- A Vercel account (the existing account from prior projects works fine).
- Repository pushed to a Git host Vercel can read (GitHub, GitLab, or
  Bitbucket). The Vercel UI walks you through repo authorization on the
  first project.

## Local production smoke

Run the production build locally before deploying — catches build-time
errors and asset-path issues without waiting for a remote build.

```sh
npx vite build     # production bundle; emits to dist/
npm run preview    # serves dist/ on http://localhost:4173 (default)
```

Open the preview URL and run through the full pre-battle flow (Title →
Setup → Team Builder → Deployment → Battle). If the dev build works but
preview breaks, the Vite production pipeline is the suspect, not the
runtime.

> **Note:** `npm run build` chains `tsc -b && vite build`. The TS step
> currently fails on a pre-existing strict-mode error pile (S34 carry,
> ~200 errors, captured in the roadmap as a Phase F cleanup). The
> production *runtime* is unaffected — Vite uses esbuild which strips
> types without typechecking, so `vite build` produces a working
> bundle. `vercel.json` runs `vite build` directly to side-step the
> failing tsc gate. When the S34 errors are resolved, the
> `vercel.json` build command can flip back to `npm run build`.

## Vercel project creation

The first deploy needs a one-time project setup in Vercel's UI; later
deploys auto-trigger on push to the configured branch.

1. Open https://vercel.com/dashboard and click **Add New… → Project**.
2. Pick the `taciturn` repository from the Git import list. (If the
   repo isn't visible, install / authorize the Vercel app on the Git
   host first.)
3. Vercel auto-detects the framework (**Vite**); leave defaults.
4. The project root has a `vercel.json` that sets:
   - `buildCommand: "vite build"` (see the note above on why this
     bypasses the `npm run build` script for now)
   - `outputDirectory: "dist"`
   - SPA rewrite (`/* → /index.html`) — forward-compatible with any
     future client-side router pass.
5. Click **Deploy**. The first build runs on Vercel; the URL appears
   when it's done (usually a `taciturn-<hash>.vercel.app` subdomain).
6. Open the deployed URL and run the same end-to-end flow as the local
   smoke. Pixi.js renders the deployment phase and battle, so visual
   checks are part of the verification.

## Subsequent deploys

Once the project is configured, every push to the production branch
triggers a fresh build. PRs get preview deployments too, accessible
from the PR's Vercel comment. No manual steps after the initial setup.

## Out of scope (for the v1 demo deploy)

- **Custom domain.** Vercel's auto-generated subdomain is fine for the
  cross-machine playtest goal. Custom domain (taciturn.io or similar)
  defers to whenever the project goes wider.
- **Environment variables / secrets.** The app has no backend, no API
  keys, no analytics. Nothing to configure.
- **Vercel Analytics / Speed Insights.** Free-tier integration is one
  click in the Vercel dashboard if a future polish pass wants real
  cross-machine performance data.
- **Pass-and-play vs. AI-only deployment branches.** Per the roadmap,
  pass-and-play toggle + dual deployment is a dedicated future session.
- **Production hardening** (CSP, frame-options, rate-limiting). The
  game is a static SPA with no auth surface — none of this is load-
  bearing today.

## Troubleshooting

If the deployed build runs differently from local preview:

- **Asset 404s** — likely a `base` mismatch. The current `vite.config.ts`
  defaults `base` to `/`, which Vercel root deploys correctly. Check
  the browser console for which path 404'd; if it's prefixed with the
  deployment subdomain hash, the build expected a different root.
- **Blank page after first render** — likely a runtime error in code
  that wasn't exercised at build time. Open DevTools console; the stack
  trace points to the source.
- **Slow first load** — Pixi.js's bundle is sizable; first-paint after
  a cold cache can take a few seconds on slower connections. Repeat
  loads are fast (cache).
