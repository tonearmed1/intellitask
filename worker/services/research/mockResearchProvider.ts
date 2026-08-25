import type { ResearchProvider, ResearchResult } from "./provider";

/** Deterministic research results for tests and for when no search API key is configured. */
export class MockResearchProvider implements ResearchProvider {
  readonly name = "mock";

  async search(query: string, maxResults = 4): Promise<ResearchResult[]> {
    const results: ResearchResult[] = [
      {
        title: `${query} — official information`,
        url: `https://example.com/search?q=${encodeURIComponent(query)}`,
        extract: `Mock research summary for "${query}". Configure BRAVE_SEARCH_API_KEY to enable live web research.`,
      },
      {
        title: `${query} — requirements and deadlines`,
        url: "https://example.com/requirements",
        extract: `No live source configured. This is placeholder research content for "${query}".`,
      },
    ];
    return results.slice(0, maxResults);
  }
}
