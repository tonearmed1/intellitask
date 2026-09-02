import { Hono } from "hono";
import { z } from "zod";
import { parseJsonBody } from "../lib/validation";
import type { AppEnv } from "../types/hono";
import { getSettings, updateSettings } from "../services/settings/settingsService";

export const settingsRoutes = new Hono<AppEnv>();

settingsRoutes.get("/", async (c) => {
  const db = c.get("db");
  const settings = await getSettings(db);
  return c.json({
    settings,
    availableProviders: ["mock", "anthropic", "openai"],
    envDefaults: {
      aiProvider: c.get("appEnv").AI_PROVIDER,
      aiModel: c.get("appEnv").AI_MODEL,
      anthropicConfigured: Boolean(c.get("appEnv").ANTHROPIC_API_KEY),
      openaiConfigured: Boolean(c.get("appEnv").OPENAI_API_KEY),
      researchConfigured: Boolean(c.get("appEnv").BRAVE_SEARCH_API_KEY),
    },
  });
});

const updateSchema = z.object({
  aiProvider: z.enum(["mock", "anthropic", "openai"]).optional(),
  aiModel: z.string().min(1).max(100).optional(),
  allowWebResearch: z.boolean().optional(),
  theme: z.enum(["light", "dark", "system"]).optional(),
});

settingsRoutes.patch("/", async (c) => {
  const db = c.get("db");
  const body = await parseJsonBody(c.req.raw, updateSchema);
  const settings = await updateSettings(db, body);
  return c.json({ settings });
});
