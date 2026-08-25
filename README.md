# Intellitask

An AI-powered task and project manager. You describe a high-level **outcome** —
"Prepare for EICMA", "Plan a 10-day trip to Japan", "Launch a new website" —
and Intellitask reasons about what completing it actually requires: the
workstreams, tasks, subtasks, dependencies, physical items, and deadlines
you'd otherwise have to think through yourself.

It's a personal, single-user application built to run entirely on Cloudflare
(Workers + D1), with a clean, calm, information-dense interface.

## What it does

- **AI project generation** — turn an outcome into a structured plan
  (workstreams → tasks → nested subtasks, arbitrary depth), with assumptions,
  clarifying questions, risks, missing information, and backward-planned
  milestones.
- **Expand any task with AI** — get a focused subtask breakdown for one task,
  with an option to go a level deeper.
- **AI project review** — an audit of what's likely missing, risks, upcoming
  deadlines, and blockers. Nothing is added without you clicking "Add".
- **"What should I do next?"** — 3–5 recommended tasks with a short reason,
  considering priority, deadline, effort, and dependency blockers.
- **"Improve this project"** — suggestions for missing/redundant tasks,
  reordering, unrealistic deadlines, and missing dependencies.
- **User context** — save facts about your company, people, products,
  suppliers, and preferences; relevant entries are automatically pulled into
  future AI generations via keyword/category relevance scoring (no embeddings
  required, but the interface is shaped so a vector-search implementation
  could be swapped in later without touching callers).
- **Project memory** — new plans consider similar past projects so
  commonly-forgotten items (extension cables, spare chargers, etc.) get
  surfaced again.
- **Optional web research** — when enabled, the planner can pull in current
  information (e.g. event dates, entry requirements) via a provider-isolated
  search abstraction (Brave Search API, or a mock provider when no key is
  configured). Retrieved content is always treated as untrusted, fenced data
  in the AI prompt — never as instructions.
- **Today / Projects / Timeline / Inbox / Context / Settings** views, a
  command bar (`Cmd/Ctrl+K`), dark/light/system theme, and full keyboard
  support.
- **Quick tasks** for things that don't need decomposition ("Call Marco").

## Architecture

```
worker/            Cloudflare Worker (Hono) — the entire backend
  routes/          HTTP endpoints, one file per resource
  services/        Business logic (AI, tasks, projects, research, ...)
  db/              Drizzle ORM schema + D1 client + row→domain mappers
  lib/             Auth, CSRF, sanitization, error types, validation
  middleware/      requireAuth, requireCsrf
  types/           Env and Hono app-context types

src/                React 19 + TypeScript client (Vite)
  pages/            One component per route
  features/         Feature-scoped UI (tasks, projects, auth, command bar, ...)
  components/       Generic UI primitives (Button, Modal, Input, ...)
  services/         Typed fetch wrappers, one per backend resource
  lib/              api client, theme, dates, cn()

shared/             Types and the AI JSON schema (zod), imported by both
                    the client and the Worker so requests/responses stay
                    in sync at compile time.

migrations/         D1 SQL migrations (wrangler's native migration system)
tests/
  unit/             Pure-logic unit tests (vitest, plain Node)
  integration/      Service-layer tests against a real D1/SQLite instance
                     (Miniflare's Node API), no HTTP layer
  e2e/              Playwright — full browser, full HTTP, full auth
```

**Deployment model**: a single Cloudflare Worker serves both the built React
app (via the Workers static-assets binding) and the `/api/*` routes. There is
no separate Pages project and no CORS to configure — `wrangler.jsonc` routes
`/api/*` to the Worker (`run_worker_first`) and everything else falls back to
the static SPA build.

**AI providers**: `worker/services/ai/provider.ts` defines the `AIProvider`
interface (`generateProject`, `expandTask`, `reviewProject`,
`suggestNextActions`, `improveProject`). Three implementations exist:

- `MockAIProvider` — deterministic, offline, keyword-driven. Used by every
  automated test and as the default so the app works with zero configuration.
- `AnthropicProvider` — uses tool-use (forced tool call) against the
  Anthropic Messages API so the model's output is structurally guaranteed to
  match the JSON schema in `worker/services/ai/json-schemas.ts`.
- `OpenAIProvider` — uses OpenAI's structured outputs (`json_schema` response
  format) against the Chat Completions API.

All three validate their output against the zod schemas in
`shared/ai-schema.ts` before it's ever persisted, and retry (with a
correction instruction appended to the prompt) up to 3 times if the model
returns something invalid.

## Requirements

- Node.js 20+ (developed and tested on Node 25)
- npm
- A Cloudflare account (free tier is enough) for deployment
- Optional: an Anthropic or OpenAI API key for live AI generation (the app
  works fully offline with the mock provider otherwise)
- Optional: a Brave Search API key for live web research

## Local installation

```bash
npm install
cp .env.example .dev.vars   # then fill in values you want to test with
npm run db:migrate:local    # applies migrations/*.sql to a local D1 instance
node scripts/create-user.mjs <username> <password> --apply --local
npm run dev
```

Open the printed local URL (Vite prints it, typically `http://localhost:5173`)
and sign in with the account you just created.

`npm run dev` uses the official `@cloudflare/vite-plugin`, which runs your
Worker code and D1 (via Miniflare) inside the same Vite dev server as the
React app — one process, real Workers runtime semantics, hot reload for both
sides.

## Cloudflare setup

1. **Install Wrangler** (already a dev dependency; `npx wrangler --version`
   to confirm) and log in:

   ```bash
   npx wrangler login
   ```

2. **Create the D1 database:**

   ```bash
   npx wrangler d1 create intellitask-db
   ```

   This prints a `database_id`. Put it into **both** places it appears in
   `wrangler.jsonc` (the top-level `d1_databases` entry and the one under
   `env.production.d1_databases`) — replace `REPLACE_WITH_YOUR_D1_DATABASE_ID`.

3. **Apply migrations to the remote database:**

   ```bash
   npm run db:migrate:remote
   ```

4. **Create your user account on the remote database:**

   ```bash
   node scripts/create-user.mjs <username> <a-strong-password> --apply --remote
   ```

5. **Set secrets** (never put these in `wrangler.jsonc`):

   ```bash
   npx wrangler secret put ANTHROPIC_API_KEY     # if using Anthropic
   npx wrangler secret put OPENAI_API_KEY        # if using OpenAI
   npx wrangler secret put BRAVE_SEARCH_API_KEY  # optional, for web research
   ```

   None of these are required to deploy — with none set, `AI_PROVIDER` should
   stay `mock` (or you'll get a clear 500 error telling you which key is
   missing rather than a silent failure).

6. **Choose your AI provider** by editing `wrangler.jsonc` →
   `env.production.vars.AI_PROVIDER` (`"mock"`, `"anthropic"`, or
   `"openai"`) and `AI_MODEL` (e.g. `"claude-sonnet-4-5"` or `"gpt-4o"`).
   These are plain vars, not secrets, since they aren't sensitive.

7. **Deploy:**

   ```bash
   npm run deploy
   ```

   This runs the production build (`tsc -b && vite build`) and then
   `wrangler deploy`, which bundles `worker/index.ts` fresh and uploads it
   along with the built static assets from `dist/client`.

Your app will be live at `https://intellitask.<your-subdomain>.workers.dev`
(or a custom domain you attach via the Cloudflare dashboard).

## Database (D1) and migrations

Schema lives in `migrations/*.sql`, applied via Wrangler's native migration
tracking (`d1_migrations` table, applied in filename order — never edit an
already-applied migration; add a new one instead).

```bash
npm run db:migrate:local     # local dev database
npm run db:migrate:remote    # production database
```

Tables: `users`, `sessions`, `settings`, `projects`, `tasks`,
`task_dependencies`, `milestones`, `context_entries`, `research_sources`,
`project_research`, `ai_runs`, `inbox_items`. The `users` table exists even
though this is a single-user app today, so multi-user support could be added
later without a schema rewrite.

Optional dev seed data (a few example projects/tasks, **not** applied
automatically and never touches production):

```bash
npm run db:seed:local
```

## Authentication

Minimal, secure, single-user. No signup flow, no email/password reset UI —
you provision the one account yourself:

```bash
node scripts/create-user.mjs <username> <password> --apply --local   # or --remote
```

This hashes the password with PBKDF2-SHA256 (100,000 iterations, random
salt) and upserts it into the `users` table directly via `wrangler d1
execute` — the password itself never leaves your machine except as a hash.

Sessions are opaque random tokens stored server-side in the `sessions`
table, delivered via an `HttpOnly`, `Secure` (in production), `SameSite=Strict`
cookie. A second, non-`HttpOnly` cookie carries a CSRF token that the client
echoes back in an `X-CSRF-Token` header on every mutating request
(double-submit pattern) — `GET` requests are exempt.

To change the password, just re-run `create-user.mjs` with the same
username; it upserts.

## AI provider configuration

| Var | Where | Purpose |
|---|---|---|
| `AI_PROVIDER` | `wrangler.jsonc` vars | `mock` \| `anthropic` \| `openai` |
| `AI_MODEL` | `wrangler.jsonc` vars | model id, e.g. `claude-sonnet-4-5` |
| `ANTHROPIC_API_KEY` | secret | required if `AI_PROVIDER=anthropic` |
| `OPENAI_API_KEY` | secret | required if `AI_PROVIDER=openai` |

Settings → AI provider in the app lets you switch the *provider* at runtime
(persisted in the `settings` table); the *model* is env-configured only, and
the Settings page says so explicitly rather than pretending it's editable.

API keys are **only ever read server-side** (`Env` in Worker code) — they are
never serialized into any API response or client bundle.

## Web research configuration

Off by default. Toggle "Allow web research" in Settings, and set
`BRAVE_SEARCH_API_KEY` as a secret to use live results; without a key, a
mock research provider returns clearly-labelled placeholder results so the
whole pipeline is still exercised. The planner only researches when a cheap
keyword heuristic (`worker/services/research/index.ts` → `shouldResearch`)
thinks it's warranted (event names, visa/entry requirements, marketplace
policies, etc.) — not on every request. All research results are stored
(`research_sources` / `project_research`) and shown as sources in the UI.

## Running tests

```bash
npm run test              # unit tests (vitest, plain Node, no D1)
npm run test:integration  # integration tests (real D1/SQLite via Miniflare)
npm run test:e2e          # Playwright, full browser + HTTP + auth
npm run test:all          # unit → integration → e2e, in order
```

E2E tests spin up their own dev server (`playwright.config.ts` →
`webServer`) on port 5175, apply migrations, and provision a dedicated
`e2e_user` account automatically (`tests/e2e/global-setup.ts`) — no manual
setup needed, just `npm run test:e2e`.

First time running E2E tests, install a browser:

```bash
npx playwright install chromium
```

## Deployment checklist

Do **not** deploy until all of these pass locally:

```bash
npm run typecheck
npm run lint
npm run test
npm run test:integration
npm run test:e2e
npm run build
```

Then `npm run deploy`.

## Backup considerations

D1 data lives entirely in Cloudflare's managed SQLite. To back up:

```bash
npx wrangler d1 export intellitask-db --remote --output backup.sql
```

Run this on a schedule (cron, GitHub Action, etc.) if you want point-in-time
recovery — Cloudflare does not currently offer automatic D1 backups. Restore
with:

```bash
npx wrangler d1 execute intellitask-db --remote --file backup.sql
```

## Troubleshooting

- **"AI provider is set to Anthropic but ANTHROPIC_API_KEY is not
  configured"** — you set `AI_PROVIDER=anthropic` (or picked it in Settings)
  without setting the secret. Either `wrangler secret put ANTHROPIC_API_KEY`
  or switch the provider back to `mock`/`openai`.
- **Login fails with "Invalid username or password"** — you haven't run
  `scripts/create-user.mjs` against the environment you're hitting (local vs
  remote are separate databases), or the password doesn't match.
- **D1 "too many SQL variables"** — this was a real bug we hit and fixed
  (see `worker/db/chunkedInsert.ts`): large AI-generated plans are inserted
  in chunks sized to stay under D1's per-statement bound-parameter limit,
  sent as a single `db.batch()` round trip. If you see this again after
  modifying an insert, it's the column-count × row-count math in that file
  that needs adjusting.
- **`wrangler dev` can't find the D1 database** — run
  `npm run db:migrate:local` first; Wrangler creates the local SQLite file
  on first migration apply.
- **Stale local D1 state during development** — local D1 lives in
  `.wrangler/state/`. Delete that directory and re-run migrations for a
  clean slate.
