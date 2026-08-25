export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;

  // Non-secret vars (wrangler.jsonc "vars")
  AI_PROVIDER: string;
  AI_MODEL: string;
  ALLOW_WEB_RESEARCH: string;

  // Secrets (wrangler secret put / .dev.vars)
  SESSION_SECRET?: string;
  ANTHROPIC_API_KEY?: string;
  OPENAI_API_KEY?: string;
  BRAVE_SEARCH_API_KEY?: string;
}
