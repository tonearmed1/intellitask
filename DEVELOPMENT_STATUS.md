# Development Status

## Completed

**Backend (Cloudflare Worker, Hono)**
- D1 schema + migrations (11 tables), auth (PBKDF2 sessions + CSRF
  double-submit), full REST API for projects/tasks/dependencies/milestones/
  context/inbox/search/settings/dashboard
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
  action); review/next-actions/improve are read-only until the user clicks
  Add; every AI write is tagged `ai_generated`/`ai_suggested` vs `user`

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
- 73 unit tests, 24 integration tests (real D1 via Miniflare), 15 Playwright
  E2E tests (13 desktop + 2 mobile-viewport)

## Bugs found and fixed during testing

All of these were caught by actually running the app and its tests, not by
inspection:

1. **`ai_runs` FK violation on generation failure.** The success/failure
   log for `generateProject` referenced a `project_id` that didn't exist yet
   (the project row was inserted after the AI call). Fixed by inserting a
   placeholder project row before the AI call, updating it with the plan
   afterward, and deleting it if generation fails.
2. **D1 "too many SQL variables" on large generated plans.** A 58-task plan
   produced a single `INSERT ... VALUES (...), (...), ...` with 1,300+ bound
   parameters, over D1's per-statement limit. Fixed with
   `worker/db/chunkedInsert.ts`, which splits rows into safe-sized chunks
   and sends them as one `db.batch()` call.
3. **Dependencies were write-only from the client's perspective.** The
   `TaskWithChildren.dependsOn` field only exposed target task ids, not the
   dependency row's own id, so the UI could add a dependency but never
   display or remove an existing one. Changed it to carry
   `{dependencyId, taskId, title}[]`.
4. **Sidebar scrolled away with page content** instead of staying fixed,
   because the shell used `min-h-screen` (grows to fit content) instead of
   `h-screen` + `overflow-hidden` on the flex row. Also had **no mobile
   layout at all** — the fixed 240px sidebar ate most of a 375px viewport.
   Fixed the scroll containment and added a proper off-canvas drawer with a
   hamburger trigger below the `md` breakpoint.
5. **`GET /api/auth/me` returned 401 for anonymous visitors**, which is the
   normal/expected case on every page load before login, not an error — it
   was logging a console error on every single page visit. Changed it to
   return `200 {username: null}`; caught by the E2E "zero console errors"
   assertion on the critical-flow test.
6. **The spec's `N` = new-task keyboard shortcut was never wired up**
   (`Cmd/Ctrl+K` and `Esc` were implemented, `N` was missed). Added, with
   guards so it doesn't fire while typing or with a modal open.

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
  generic error messages are in place; a dedicated rate limiter (e.g. via
  Cloudflare's rate-limiting rules or a KV-backed counter) is a reasonable
  V2 addition if this is ever exposed beyond a single trusted user.
- **Semantic/embedding-based context relevance** was intentionally not
  built — the spec explicitly allows a keyword/category approach for V1.
  The interface (`selectRelevantContext(entries, queryText, limit)`) takes
  only plain data in and out, so it can be swapped for a vector-search
  implementation later without touching any caller.

## Final verification

Run locally, in this order, on the code that was pushed:

```
npm run typecheck        →  clean, 0 errors
npm run lint              →  0 errors, 6 pre-existing react-refresh warnings
                              (context files mixing component + hook exports —
                              cosmetic, does not affect correctness)
npm run test               →  73/73 unit tests passing
npm run test:integration  →  24/24 integration tests passing (real D1)
npm run test:e2e          →  15/15 E2E tests passing (run twice in a row to
                              rule out flakiness/state leakage — both green)
npm run build              →  production build succeeds
```

Production build was additionally verified by running `wrangler dev`
directly against the built `dist/client` output (not just `vite dev`),
confirming: static asset serving, SPA fallback routing, and API auth gating
all work under the real Workers runtime.

Manually exercised in-browser beyond what the automated suites cover:
AI project generation ("Prepare for EICMA" → 6 workstreams, 58 tasks, 5
milestones, resolved dependencies), task complete/expand/edit/delete, AI
review panel, project delete with confirmation, dark mode, mobile drawer
navigation, Context entry create, Inbox capture → suggestion → accept flow,
Timeline grouped-by-month view, command bar search against real data, and
the `N`/`Esc` keyboard shortcuts.

**Not testable in this environment:** live calls to the real Anthropic/
OpenAI/Brave Search APIs — no API keys were available. The `MockAIProvider`
and mock research provider exercise every other code path identically
(same validation, same persistence, same error handling), and the
Anthropic/OpenAI provider code was reviewed carefully against each API's
current structured-output documentation, but a live call against production
credentials has not been made. This is the one external step called out in
the handoff.
