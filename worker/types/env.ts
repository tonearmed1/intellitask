/** App configuration read from process.env — a Vercel serverless function, not a Workers "bindings" object. */
export interface Env {
  AI_PROVIDER: string;
  AI_MODEL: string;
  ALLOW_WEB_RESEARCH: string;

  SESSION_SECRET?: string;
  ANTHROPIC_API_KEY?: string;
  OPENAI_API_KEY?: string;
  BRAVE_SEARCH_API_KEY?: string;
}

export function loadEnv(): Env {
  return {
    AI_PROVIDER: process.env.AI_PROVIDER ?? "mock",
    AI_MODEL: process.env.AI_MODEL ?? "claude-sonnet-4-5",
    ALLOW_WEB_RESEARCH: process.env.ALLOW_WEB_RESEARCH ?? "false",
    SESSION_SECRET: process.env.SESSION_SECRET,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    BRAVE_SEARCH_API_KEY: process.env.BRAVE_SEARCH_API_KEY,
  };
}
