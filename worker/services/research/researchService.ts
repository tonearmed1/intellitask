import type { Database } from "../../db/client";
import { researchSources, projectResearch } from "../../db/schema";
import { newId, nowIso } from "../../lib/ids";
import { sanitizePlainText } from "../../lib/sanitize";
import type { ResearchProvider, ResearchResult } from "./provider";
import type { ResearchSnippet } from "../ai/provider";

/**
 * Persists already-fetched search results (no network call here). Used when
 * the search has to happen before the target row (e.g. a project not yet
 * inserted) exists to link against.
 */
export async function persistResearchResults(
  db: Database,
  providerName: string,
  projectId: string,
  taskId: string | null,
  query: string,
  results: ResearchResult[],
): Promise<void> {
  const timestamp = nowIso();
  for (const r of results) {
    const id = newId("rsrc");
    await db.insert(researchSources).values({
      id,
      query: sanitizePlainText(query, 300),
      sourceUrl: r.url,
      title: sanitizePlainText(r.title, 300),
      extract: sanitizePlainText(r.extract, 1500),
      researchedAt: timestamp,
      providerName,
    });
    await db.insert(projectResearch).values({
      id: newId("preg"),
      projectId,
      researchSourceId: id,
      taskId: taskId ?? null,
      createdAt: timestamp,
    });
  }
}

export interface RunResearchOptions {
  db: Database;
  provider: ResearchProvider;
  projectId: string;
  taskId?: string | null;
  query: string;
  maxResults?: number;
}

/**
 * Runs a web search, persists every result as a research_sources row plus a
 * project_research link (so the UI can show "Research used" + sources), and
 * returns sanitized snippets ready to hand to an AI prompt builder.
 */
export async function runAndStoreResearch(
  opts: RunResearchOptions,
): Promise<ResearchSnippet[]> {
  const { db, provider, projectId, taskId, query, maxResults = 4 } = opts;
  const results = await provider.search(sanitizePlainText(query, 300), maxResults);
  const timestamp = nowIso();

  const snippets: ResearchSnippet[] = [];
  for (const r of results) {
    const id = newId("rsrc");
    await db.insert(researchSources).values({
      id,
      query: sanitizePlainText(query, 300),
      sourceUrl: r.url,
      title: sanitizePlainText(r.title, 300),
      extract: sanitizePlainText(r.extract, 1500),
      researchedAt: timestamp,
      providerName: provider.name,
    });
    await db.insert(projectResearch).values({
      id: newId("preg"),
      projectId,
      researchSourceId: id,
      taskId: taskId ?? null,
      createdAt: timestamp,
    });
    snippets.push({ title: r.title, url: r.url, extract: r.extract });
  }
  return snippets;
}
