import type { ContextEntry } from "@shared/types";

// Common English stopwords plus a few app-domain filler words that would
// otherwise dominate the overlap score without carrying meaning.
const STOPWORDS = new Set([
  "a", "an", "the", "and", "or", "but", "for", "with", "to", "of", "in", "on",
  "at", "by", "is", "are", "be", "our", "we", "you", "your", "it", "this",
  "that", "will", "should", "need", "needs", "plan", "project", "task",
  "prepare", "preparing", "organise", "organize",
]);

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));
}

/**
 * Keyword/category relevance scoring for context entries. Deliberately
 * simple (token overlap + category/tag boosts) so it's fast, deterministic,
 * and needs no external embedding service — but it only looks at
 * `selectRelevantContext`'s inputs/outputs, so it can be swapped for a
 * vector-similarity implementation later without touching any caller.
 */
export function selectRelevantContext(
  entries: ContextEntry[],
  queryText: string,
  limit = 6,
): ContextEntry[] {
  if (entries.length === 0) return [];
  const queryTokens = new Set(tokenize(queryText));
  if (queryTokens.size === 0) return entries.slice(0, limit);

  const scored = entries.map((entry) => {
    const entryTokens = tokenize(`${entry.title} ${entry.content} ${entry.tags.join(" ")}`);
    let score = 0;
    for (const token of entryTokens) {
      if (queryTokens.has(token)) score += 1;
    }
    // Small boost for category/tag words appearing verbatim in the query
    // (e.g. mentioning a supplier or product name directly).
    for (const tag of entry.tags) {
      if (queryTokens.has(tag.toLowerCase())) score += 2;
    }
    return { entry, score };
  });

  const relevant = scored.filter((s) => s.score > 0).sort((a, b) => b.score - a.score);

  // If nothing scored (no keyword overlap at all), fall back to the most
  // recently updated entries rather than sending nothing — a little
  // context is usually better than none for company/personal facts.
  if (relevant.length === 0) {
    return [...entries]
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, Math.min(3, limit));
  }

  return relevant.slice(0, limit).map((s) => s.entry);
}
