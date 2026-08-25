export interface ResearchResult {
  title: string;
  url: string;
  extract: string;
}

/**
 * Provider-isolated web search abstraction. Swap the implementation
 * (Brave today) for another search API later without touching any caller.
 */
export interface ResearchProvider {
  readonly name: string;
  search(query: string, maxResults?: number): Promise<ResearchResult[]>;
}
