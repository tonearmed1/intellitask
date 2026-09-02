# Development Status

## Completed

**Backend (Hono, deployed as a Vercel serverless function)**
- Postgres schema + migrations (11 tables, native `jsonb` for array columns),
  auth (PBKDF2 sessions + CSRF double-submit), full REST API for
  projects/tasks/dependencies/milestones/context/inbox/search/settings/
  dashboard
- AIProvider abstraction with Mock (deterministic, offline), Anthropic
  (tool-use structured output), and OpenAI (json_schema structured output)
  implementations, all validated against shared zod schemas with
  retry-on-invalid-JSON
- Web research abstraction (Brave Search + mock), prompt-injection-safe
  (fenced, sanitized, explicitly-instructed-to-ignore untrusted content)
- Task tree/dependency/deadline/completion pure-logic services
- Context relevance selection (keyword/category scoring) and project-memory
  similarity search, both wired into AI generation
- AI safety: new-project generation persists immediately (explicit user
  action, in one real Postgres transaction); review/next-actions/improve are
  read-only until the user clicks Add; every AI write is tagged
  `ai_generated`/`ai_suggested` vs `user`

**Frontend (React 19 + TypeScript + Tailwind v4)**
- Auth flow, first-run onboarding (skippable), responsive app shell with a
  mobile hamburger drawer, command bar (`Cmd/Ctrl+K`) with live search, `N`
  for new quick task, `Esc` to close modals
- Today / Projects / Project Detail / Timeline / Context / Settings / Inbox
  pages; full nested task tree UI (collapsible, dependency display, inline
  priority/due-date editors, quick-add subtask, AI expand with staged
  loading text)
- AI assistant panel (Review / Next Actions / Improve) with per-suggestion
  Add actions
- Dark / light / system theme

**Tests**
- 66 unit tests, 24 integration tests (real Postgres via PGlite), 15
  Playwright E2E tests (13 desktop + 2 mobile-viewport), all against
  production code paths — the E2E suite exercises the exact `pg` client used
  in production, via PGlite exposed over a real Postgres wire-protocol
  socket

**Deployment**
- Live on Vercel (serverless functions + Neon Postgres), verified end-to-end
  against the actual production deployment: health check, login, session
  cookie + CSRF, and a real nested-path API route, plus a full login →
  dashboard pass through an actual browser.

## Bugs found and fixed during testing

All of these were caught by actually running the app and its tests, not by
inspection.

**During the original Cloudflare build:**

1. **Dependencies were write-only from the client's perspective.** The
   `TaskWithChildren.dependsOn` field only exposed target task ids, not the
   dependency row's own id, so the UI could add a dependency but never
   display or remove an existing one. Changed it to carry
   `{dependencyId, taskId, title}[]`. (Persists into the Postgres version.)
2. **Sidebar scrolled away with page content** instead of staying fixed,
   because the shell used `min-h-screen` (grows to fit content) instead of
   `h-screen` + `overflow-hidden` on the flex row. Also had **no mobile
   layout at all** — the fixed 240px sidebar ate most of a 375px viewport.
   Fixed the scroll containment and added a proper off-canvas drawer with a
   hamburger trigger below the `md` breakpoint. (Persists.)
3. **`GET /api/auth/me` returned 401 for anonymous visitors**, which is the
   normal/expected case on every page load before login, not an error — it
   was logging a console error on every single page visit. Changed it to
   return `200 {username: null}`; caught by the E2E "zero console errors"
   assertion on the critical-flow test. (Persists.)
4. **The spec's `N` = new-task keyboard shortcut was never wired up**
   (`Cmd/Ctrl+K` and `Esc` were implemented, `N` was missed). Added, with
   guards so it doesn't fire while typing or with a modal open. (Persists.)
5. Two D1-specific bugs (an `ai_runs` foreign-key ordering issue, and D1's
   "too many SQL variables" limit on large batch inserts) were fixed at the
   time with D1-specific workarounds. Both were **superseded, not carried
   forward** — see the Postgres migration below, which replaced the
   underlying pattern entirely rather than porting the workaround.

**During the Vercel/Postgres migration:**

6. **`ai_runs` success log recorded `projectId: null`.** While rewriting
   `createProjectWithAiPlan` to use a single real Postgres transaction, the
   success-logging call got moved to before the transaction (using the
   locally-generated id before it was confirmed committed). Caught by an
   integration test (`expected 0 to be greater than 0`). Fixed by logging
   after the transaction commits.
7. **`PGLiteSocketServer`'s default `maxConnections: 1`** caused
   intermittent 500s under the E2E suite, since the Node `pg.Pool` opens
   several connections concurrently. Fixed by raising it to 20 in
   `tests/e2e/global-setup.ts`, and separately capped the production pool at
   `max: 5` in `worker/db/client.ts`.
8. **Mobile E2E `toBeHidden()` assertion was wrong**, not the app: the
   off-canvas drawer uses a CSS `transform` (needed for the slide-in
   animation), not `display:none`, so Playwright correctly does not consider
   it "hidden" even though it's visually off-screen. Fixed the test to check
   `boundingBox().x < 0` instead.

**During the initial Vercel deployment (found only once actually deployed —
none of this is reproducible with local tooling):**

9. **`ERR_MODULE_NOT_FOUND` at runtime** — Vercel's Node builder doesn't
   bundle TypeScript API routes when `package.json` has `"type": "module"`;
   it transpiles each file individually and runs the result under Node's
   native ESM loader, which needs explicit `.js` extensions on every
   relative import and can't resolve the `@shared/*` tsconfig alias at all.
   Fixed by pre-bundling the function with esbuild
   (`scripts/build-api.mjs`) instead of rewriting ~200 import specifiers.
10. **Every `/api/*` request hung until timeout.** `hono/vercel`'s
    `handle()` returns a Web-standard `(Request) => Response` handler, but
    Vercel's Node runtime only recognizes that signature via named
    HTTP-method exports (or a `fetch` export) — a bare `export default` is
    silently treated as the legacy `(req, res)` Node handler shape, and the
    returned `Response` is dropped. Fixed by exporting the handler under
    `GET`/`POST`/`PUT`/`PATCH`/`DELETE`/`HEAD`/`OPTIONS` from
    `worker/vercel-entry.ts`.
11. **Nested API paths 404'd** (e.g. `/api/auth/login`, while
    `/api/health` worked). Vercel's zero-config router generated a
    single-segment-only regex (`^/api/([^/]+)$`) for a `[...path]`-named
    catch-all function, regardless of its extension. Fixed by bundling to a
    plain, non-dynamic `api/index.ts` and adding an explicit
    `{ "source": "/api/:path*", "destination": "/api/index" }` rewrite in
    `vercel.json` instead of relying on filename-based catch-all detection.
12. **A GitHub-push-triggered auto-deploy briefly served stale, broken
    routing** shortly after the fix above was pushed, even though the exact
    same source deployed cleanly moments earlier via `vercel deploy --prod`
    run locally. Root cause not fully isolated (Vercel's build-cache
    restoration is the leading suspect — the auto-deploy's build log showed
    it restoring cache from an earlier deployment); resolved immediately by
    forcing a cache-free redeploy (`vercel deploy --prod --force`). Flagged
    in the README as something to watch for after any push-triggered
    deploy.

## Known limitations / intentionally deferred to V2

- **Cross-parent task moving** has no dedicated UI. Reordering among
  siblings (move up/down) is implemented and wired up; the backend
  `moveTask` service supports reparenting, but no picker UI exposes it yet.
  Drag-and-drop was deliberately skipped per the spec's own guidance
  ("reliability over visual cleverness") in favor of the simpler up/down
  controls.
- **"Improve this project" apply action** only wires up the `missing_task`
  suggestion type end-to-end (creates a real task). The other four
  suggestion types (redundant_task, reorder, unrealistic_deadline,
  missing_dependency) are surfaced with a clear description but are
  informational-only — applying them would mean editing/deleting existing
  tasks automatically, which cuts against the "AI should not silently
  overwrite user edits" requirement more than a simple additive suggestion
  does. Flagged rather than half-implemented.
- **No explicit login rate-limiting.** Timing-safe password comparison and
  generic error messages are in place; a dedicated rate limiter (e.g. a
  Postgres- or Redis-backed counter, or a Vercel Firewall rule) is a
  reasonable V2 addition if this is ever exposed beyond a single trusted
  user.
- **Semantic/embedding-based context relevance** was intentionally not
  built — the spec explicitly allows a keyword/category approach for V1.
  The interface (`selectRelevantContext(entries, queryText, limit)`) takes
  only plain data in and out, so it can be swapped for a vector-search
  implementation later without touching any caller.

## Final verification

Run locally, in this order, on the code that was pushed:

```
npm run typecheck          →  clean, 0 errors
npm run lint                →  0 errors, 6 pre-existing react-refresh warnings
                                (context files mixing component + hook exports —
                                cosmetic, does not affect correctness)
npm run test                →  66/66 unit tests passing
npm run test:integration    →  24/24 integration tests passing (real
                                Postgres via PGlite)
npm run test:e2e            →  15/15 E2E tests passing (run multiple times to
                                rule out flakiness/state leakage — consistently
                                green), against the real `pg` client/wire
                                protocol via PGlite-socket
npm run build                →  production build succeeds, including the
                                esbuild API-function bundling step
```

Beyond the automated suites, the actual **production deployment on Vercel**
was verified directly (not a local approximation of it):
- `GET /api/health` → `200 {"ok":true}`
- `POST /api/auth/login` with the real production account → `200`, valid
  session cookie + CSRF token
- `GET /api/auth/me` with that session → `200 {"username":"..."}`
- `GET /api/projects` (a nested route) → `200`, correctly routed through
  the Vercel rewrite
- A full login → onboarding → dashboard pass through an actual browser
  session against the live URL

**Not testable in this environment:** live calls to the real Anthropic/
OpenAI/Brave Search APIs — the production deployment has real API keys
configured, but no AI project has actually been generated against them yet
as part of this handoff. The `MockAIProvider` and mock research provider
exercise every other code path identically (same validation, same
persistence, same error handling), and the Anthropic/OpenAI provider code
was reviewed carefully against each API's current structured-output
documentation. Creating a real project in the live app is the natural first
end-to-end test of that path.
