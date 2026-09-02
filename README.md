# Intellitask

An AI-powered task and project manager. You describe a high-level **outcome** —
"Prepare for EICMA", "Plan a 10-day trip to Japan", "Launch a new website" —
and Intellitask reasons about what completing it actually requires: the
workstreams, tasks, subtasks, dependencies, physical items, and deadlines
you'd otherwise have to think through yourself.

It's a personal, single-user application built to run on **Vercel**
(serverless functions + a Postgres database), with a clean, calm,
information-dense interface.

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
worker/            The entire backend (a Hono app; deployed as one Vercel
                    serverless function, but not tied to any one host)
  routes/          HTTP endpoints, one file per resource
  services/        Business logic (AI, tasks, projects, research, ...)
  db/              Drizzle ORM schema + Postgres client + row→domain mappers
  lib/              Auth, CSRF, sanitization, error types, validation
  middleware/      requireAuth, requireCsrf
  types/           Env and Hono app-context types
  vercel-entry.ts  Source for the deployed function (see below)

src/                React 19 + TypeScript client (Vite)
  pages/            One component per route
  features/         Feature-scoped UI (tasks, projects, auth, command bar, ...)
  components/       Generic UI primitives (Button, Modal, Input, ...)
  services/         Typed fetch wrappers, one per backend resource
  lib/              api client, theme, dates, cn()

shared/             Types and the AI JSON schema (zod), imported by both
                    the client and the Worker so requests/responses stay
                    in sync at compile time.

api/                Vercel's function directory. api/index.ts is generated
                    at build time (gitignored) — see "Deployment model".

migrations/         Hand-rolled SQL migrations, applied by scripts/migrate.mjs
                    (tracked in a `_migrations` table, filename order).

tests/
  unit/             Pure-logic unit tests (vitest, plain Node)
  integration/      Service-layer tests against PGlite (embedded WASM
                     Postgres), no HTTP layer
  e2e/              Playwright — full browser, full HTTP, full auth, against
                     PGlite exposed over a real Postgres wire-protocol socket
```

**Deployment model**: a single Vercel serverless function (Node.js runtime)
serves `/api/*`; static assets (the built React app) are served directly by
Vercel's CDN, with a SPA fallback rewrite for client-side routing.

The function isn't `worker/index.ts` compiled by Vercel directly. Two things
about Vercel's zero-config Node builder made that not work in practice, so
`scripts/build-api.mjs` pre-bundles `worker/vercel-entry.ts` (which just
imports the Hono app and wraps it with `hono/vercel`'s `handle()`) into a
single self-contained `api/index.ts` at build time, via esbuild:

1. With `"type": "module"` in `package.json`, Vercel's Node builder doesn't
   bundle TypeScript API routes — it transpiles each file individually and
   runs the result under Node's *native* ESM loader, which requires every
   relative import to carry an explicit `.js` extension and can't resolve
   the `@shared/*` tsconfig path alias at all. Bundling sidesteps this
   instead of rewriting every relative import in `worker/**`.
2. Vercel's zero-config router generates a broken, single-segment-only route
   for a `[...path].ts`-style catch-all function name, regardless of
   extension — it 404s anything under a nested path like `/api/auth/login`.
   `vercel.json` works around this with an explicit
   `{ "source": "/api/:path*", "destination": "/api/index" }` rewrite to a
   plain, non-dynamic function name instead of relying on catch-all file
   detection.

`api/index.ts` is gitignored — it's a build artifact, regenerated by
`npm run build` (and therefore by Vercel's own build step) every time.

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
- A Vercel account (free tier is enough) for deployment
- A Postgres database reachable via a connection string — Neon (via Vercel's
  Marketplace integration, or standalone) is what this was built and
  deployed against; any standard Postgres works, since the app talks to it
  over the normal `pg` wire protocol
- Optional: an Anthropic or OpenAI API key for live AI generation (the app
  works fully offline with the mock provider otherwise)
- Optional: a Brave Search API key for live web research
- **Nothing external is required for local development or the test suite** —
  see below.

## Local installation

```bash
npm install
cp .env.example .env         # then fill in values you want to test with
```

For everyday local dev you don't need a real Postgres instance at all —
point `DATABASE_URL` at any Postgres you have (a throwaway local one is
easiest: `npx @electric-sql/pglite-socket` style setup, or just install
Postgres locally, or point it at your real Neon dev branch). Then:

```bash
npm run db:migrate            # applies migrations/*.sql
node scripts/create-user.mjs <username> <password>
npm run dev
```

Open the printed local URL (Vite prints it, typically `http://localhost:5173`)
and sign in with the account you just created.

`npm run dev` runs two processes together (via `concurrently`): a local API
server (`@hono/node-server` + `tsx`, hot-reloading on save) on port 8787, and
Vite's own dev server for the React app, which proxies `/api/*` to the API
server. Both share one terminal, prefixed `api`/`client`.

## Vercel setup

1. **Install the Vercel CLI** (used ad hoc via `npx vercel`, not a project
   dependency) and log in:

   ```bash
   npx vercel login
   ```

2. **Link the project** (creates a new Vercel project the first time, or
   connects to an existing one):

   ```bash
   npx vercel link
   ```

3. **Provision Postgres.** Easiest path — the Neon integration from Vercel's
   Marketplace, which provisions a database and wires `DATABASE_URL` (plus
   several other `PG*`/`POSTGRES_*` variants) into the project automatically:

   ```bash
   npx vercel integration add neon
   ```

   This needs a one-time terms acceptance in the browser the first time; the
   CLI prints the URL. Alternatively, connect any existing Postgres by
   setting `DATABASE_URL` yourself (Storage tab in the dashboard, or
   `vercel env add DATABASE_URL production`).

4. **Set the remaining environment variables** (Project → Settings →
   Environment Variables in the dashboard, or `vercel env add <NAME>
   <environment>`):

   | Var | Purpose |
   |---|---|
   | `AI_PROVIDER` | `mock` \| `anthropic` \| `openai` |
   | `AI_MODEL` | model id, e.g. `claude-sonnet-4-5` |
   | `ANTHROPIC_API_KEY` | required if `AI_PROVIDER=anthropic` |
   | `OPENAI_API_KEY` | required if `AI_PROVIDER=openai` |
   | `ALLOW_WEB_RESEARCH` | `true` \| `false` |
   | `BRAVE_SEARCH_API_KEY` | required if web research is enabled |
   | `SESSION_SECRET` | any long random string |

   None of the AI/research keys are required to deploy — with
   `AI_PROVIDER=mock` and `ALLOW_WEB_RESEARCH=false` the app runs fully
   offline server-side.

5. **Apply migrations to the production database**, from your machine,
   pointed at the same `DATABASE_URL` Vercel is using:

   ```bash
   npx vercel env pull .env.local     # downloads DATABASE_URL etc. locally
   set -a; source .env.local; set +a
   npm run db:migrate
   ```

6. **Create your login account** the same way:

   ```bash
   node scripts/create-user.mjs <username> <a-strong-password>
   ```

7. **Deploy:**

   ```bash
   npm run deploy      # == npx vercel deploy --prod
   ```

Your app will be live at `https://<project-name>-<hash>.vercel.app`, aliased
to `https://<project-name>.vercel.app` (or a custom domain you attach via the
dashboard).

**If you connect the project's GitHub repo for auto-deploy-on-push:** be
aware Vercel's build-cache restoration can occasionally serve a stale routing
config right after a push (observed once during this project's own
deployment — a route added in `vercel.json` didn't take effect until a
manually forced, cache-free redeploy). If a push-triggered deploy ever
behaves differently from a deploy you tested locally, run
`npx vercel deploy --prod --force` to redeploy without reusing the build
cache, then re-verify.

## Database (Postgres) and migrations

Schema lives in `migrations/*.sql`, applied by a small hand-rolled runner
(`scripts/migrate.mjs`) that tracks what's been applied in a `_migrations`
table (filename order — never edit an already-applied migration; add a new
one instead):

```bash
DATABASE_URL=postgres://... npm run db:migrate
```

Tables: `users`, `sessions`, `settings`, `projects`, `tasks`,
`task_dependencies`, `milestones`, `context_entries`, `research_sources`,
`project_research`, `ai_runs`, `inbox_items`. Array-valued columns
(`tags`, `assumptions`, `questions`, `risks`, `missing_information`) are
native Postgres `jsonb`, not hand-encoded JSON text. The `users` table exists
even though this is a single-user app today, so multi-user support could be
added later without a schema rewrite.

## Authentication

Minimal, secure, single-user. No signup flow, no email/password reset UI —
you provision the one account yourself:

```bash
DATABASE_URL=postgres://... node scripts/create-user.mjs <username> <password>
```

This hashes the password with PBKDF2-SHA256 (100,000 iterations, random
salt) and upserts it into the `users` table directly via a `pg` client — the
password itself never leaves your machine except as a hash. To change the
password, just re-run the script with the same username.

Sessions are opaque random tokens stored server-side in the `sessions`
table, delivered via an `HttpOnly`, `Secure` (in production), `SameSite=Strict`
cookie. A second, non-`HttpOnly` cookie carries a CSRF token that the client
echoes back in an `X-CSRF-Token` header on every mutating request
(double-submit pattern) — `GET` requests are exempt.

## AI provider configuration

Set via Vercel environment variables (see step 4 above) — there's no
`wrangler.jsonc`-equivalent config file, since Vercel's own env var store is
the single source of truth for both local `vercel env pull` and production.

Settings → AI provider in the app lets you switch the *provider* at runtime
(persisted in the `settings` table); the *model* is env-configured only, and
the Settings page says so explicitly rather than pretending it's editable.

API keys are **only ever read server-side** (`process.env` inside
`worker/types/env.ts` → `loadEnv()`) — they are never serialized into any API
response or client bundle.

## Web research configuration

Off by default. Toggle "Allow web research" in Settings, and set
`BRAVE_SEARCH_API_KEY` to use live results; without a key, a mock research
provider returns clearly-labelled placeholder results so the whole pipeline
is still exercised. The planner only researches when a cheap keyword
heuristic (`worker/services/research/index.ts` → `shouldResearch`) thinks
it's warranted (event names, visa/entry requirements, marketplace policies,
etc.) — not on every request. All research results are stored
(`research_sources` / `project_research`) and shown as sources in the UI.

## Running tests

Nothing external needed for any of these — no Neon/Vercel account, no real
Postgres server.

```bash
npm run test              # unit tests (vitest, plain Node)
npm run test:integration  # integration tests, against PGlite (embedded
                           # WASM Postgres, spun up and torn down per run)
npm run test:e2e          # Playwright, full browser + HTTP + auth, against
                           # PGlite exposed over a real Postgres wire-protocol
                           # socket — the exact production `pg` client code
                           # path, no external service
npm run test:all          # unit → integration → e2e, in order
```

E2E tests spin up their own API + client dev servers
(`playwright.config.ts` → `webServer`), apply migrations, and provision a
dedicated `e2e_user` account automatically (`tests/e2e/global-setup.ts`) —
no manual setup needed, just `npm run test:e2e`.

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

Then `npm run deploy` (or `npx vercel deploy --prod`), and re-check
`/api/health` plus a real login against the deployed URL — a clean local
build does not guarantee Vercel's own build/routing behaves identically (see
"Vercel setup" above and "Troubleshooting" below for the specific gotchas
this project hit).

## Backup considerations

Data lives in your Postgres provider. With Neon specifically, point-in-time
recovery and branching are built in (see the Neon dashboard). For a
provider-agnostic backup, a plain `pg_dump` works against any Postgres
connection string:

```bash
pg_dump "$DATABASE_URL" --format=custom --file=backup.dump
```

Restore with:

```bash
pg_restore --clean --dbname="$DATABASE_URL" backup.dump
```

Run `pg_dump` on a schedule (cron, GitHub Action, etc.) if your provider
doesn't already give you point-in-time recovery.

## Troubleshooting

- **"AI provider is set to Anthropic but ANTHROPIC_API_KEY is not
  configured"** — you set `AI_PROVIDER=anthropic` (or picked it in Settings)
  without setting the env var. Either add `ANTHROPIC_API_KEY` in the Vercel
  dashboard (then redeploy) or switch the provider back to `mock`/`openai`.
- **Login fails with "Invalid username or password"** — you haven't run
  `scripts/create-user.mjs` against the `DATABASE_URL` you're actually
  hitting, or the password doesn't match. Double-check you pulled the right
  environment's connection string (`vercel env pull`).
- **`/api/*` returns a raw Vercel `404 NOT_FOUND` page** (not JSON from the
  app) — this means the request never reached the Hono app. Two known
  causes, both already worked around in this repo (see "Deployment model"
  above), but worth knowing if you restructure `api/` or `vercel.json`:
  a `[...path]`-named catch-all function only matching a single path segment,
  or a stale build cache after a `vercel.json` routing change. Try
  `npx vercel deploy --prod --force` first.
- **A request to `/api/*` hangs until timeout, then fails** — almost always
  means the deployed function's default export isn't in the shape Vercel's
  Node runtime expects. `hono/vercel`'s `handle()` returns a Web-standard
  `(Request) => Response` function; it must be exported under named HTTP
  methods (`export const GET = handler`, etc., see
  `worker/vercel-entry.ts`), not `export default`, or the returned Response
  is silently dropped.
- **`ERR_MODULE_NOT_FOUND` in Vercel's function logs** — something is
  importing `worker/**` or `shared/**` without going through the bundled
  `api/index.ts`. Confirm `scripts/build-api.mjs` actually ran as part of
  `npm run build` and that `api/index.ts` exists in the deployed output.
- **Stale/incorrect routing right after a `git push`-triggered deploy** —
  see the note at the end of "Vercel setup": force a cache-free redeploy.
