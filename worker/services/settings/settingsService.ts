import { eq } from "drizzle-orm";
import type { Database } from "../../db/client";
import { settings } from "../../db/schema";
import { nowIso } from "../../lib/ids";
import type { AppSettings } from "@shared/types";

const DEFAULTS: AppSettings = {
  aiProvider: "mock",
  aiModel: "claude-sonnet-4-5",
  allowWebResearch: false,
  theme: "system",
};

export async function getSettings(db: Database): Promise<AppSettings> {
  const rows = await db.select().from(settings).where(eq(settings.id, 1)).limit(1);
  const row = rows[0];
  if (!row) return DEFAULTS;
  return {
    aiProvider: row.aiProvider as AppSettings["aiProvider"],
    aiModel: row.aiModel,
    allowWebResearch: row.allowWebResearch,
    theme: row.theme as AppSettings["theme"],
  };
}

export async function updateSettings(
  db: Database,
  patch: Partial<AppSettings>,
): Promise<AppSettings> {
  const current = await getSettings(db);
  const next: AppSettings = { ...current, ...patch };
  await db
    .insert(settings)
    .values({
      id: 1,
      aiProvider: next.aiProvider,
      aiModel: next.aiModel,
      allowWebResearch: next.allowWebResearch,
      theme: next.theme,
      updatedAt: nowIso(),
    })
    .onConflictDoUpdate({
      target: settings.id,
      set: {
        aiProvider: next.aiProvider,
        aiModel: next.aiModel,
        allowWebResearch: next.allowWebResearch,
        theme: next.theme,
        updatedAt: nowIso(),
      },
    });
  return next;
}
