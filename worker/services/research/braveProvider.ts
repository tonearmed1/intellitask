import { AppError } from "../../lib/errors";
import type { ResearchProvider, ResearchResult } from "./provider";

const BRAVE_SEARCH_URL = "https://api.search.brave.com/res/v1/web/search";
const REQUEST_TIMEOUT_MS = 15_000;

/** https://brave.com/search/api/ */
export class BraveResearchProvider implements ResearchProvider {
  readonly name = "brave";

  constructor(private readonly apiKey: string) {}

  async search(query: string, maxResults = 4): Promise<ResearchResult[]> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const url = new URL(BRAVE_SEARCH_URL);
      url.searchParams.set("q", query);
      url.searchParams.set("count", String(maxResults));

      const res = await fetch(url, {
        headers: {
          Accept: "application/json",
          "X-Subscription-Token": this.apiKey,
        },
        signal: controller.signal,
      });

      if (!res.ok) {
        throw new AppError(
          502,
          "research_failed",
          `Web research failed (${res.status}). Continuing without it.`,
        );
      }

      const body = (await res.json()) as {
        web?: { results?: { title?: string; url?: string; description?: string }[] };
      };

      return (body.web?.results ?? [])
        .slice(0, maxResults)
        .filter((r): r is { title: string; url: string; description?: string } =>
          Boolean(r.title && r.url),
        )
        .map((r) => ({
          title: r.title,
          url: r.url,
          extract: (r.description ?? "").replace(/<[^>]+>/g, ""),
        }));
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw new AppError(502, "research_failed", "Web research request failed. Continuing without it.");
    } finally {
      clearTimeout(timeout);
    }
  }
}
